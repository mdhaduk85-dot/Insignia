"""
server.py – INSIGNIA Backend
Threading architecture
  Thread 1 · CameraThread      – Continuously reads raw frames from the webcam
                                  and puts them on `_raw_frame_queue`.

  Thread 2 · GestureThread     – Consumes raw frames from `_raw_frame_queue`,
                                  runs MediaPipe hand-detection + KeyPoint
                                  classifier, annotates the frame, then puts
                                  the finished (annotated) frame onto
                                  `_encoded_frame_queue` and updates the
                                  shared `GestureState`.

  Thread 3 · EncoderThread     – Consumes annotated frames from
                                  `_encoded_frame_queue`, JPEG-encodes them,
                                  and puts the bytes onto `_stream_queue` so
                                  that HTTP clients (MJPEG) can pull them.

  Thread 4 · EmailWorkerThread – A single long-lived daemon thread that
                                  drains `_email_queue` and sends every
                                  outgoing email (OTP / welcome). All routes
                                  just enqueue a job instead of blocking on
                                  SMTP.

  Thread 5 · OTPCleanupThread  – Sleeps 60 s between passes; evicts expired
                                  records from `_otp_store` and
                                  `_pending_signups` so memory never grows
                                  unbounded.

  Flask (threaded=True)        – Each incoming HTTP request is handled in its
                                  own thread from Werkzeug's thread pool.
"""

import csv
import copy
import queue
import threading
import itertools
import random
import smtplib
import time
import logging
from collections import Counter, deque
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import sqlite3
from functools import wraps

import boto3
from botocore.exceptions import BotoCoreError, ClientError

import cv2 as cv
import numpy as np
import mediapipe.python as mp
from flask import Flask, Response, jsonify, send_file, request, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

from utils import CvFpsCalc
from model import KeyPointClassifier

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(threadName)-22s] %(levelname)s - %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('insignia')

# Paths
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)

# Flask
app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY') or os.urandom(32)
CORS(app, supports_credentials=True)


# SECTION 1 - Shared state & inter-thread queues

# Queue capacities - keep them small so threads stay in sync and memory stays
# bounded. A maxsize of 2 means each stage can buffer at most one extra item
# before the producer blocks; this provides natural back-pressure.
_raw_frame_queue     = queue.Queue(maxsize=2)   # CameraThread  -> GestureThread
_encoded_frame_queue = queue.Queue(maxsize=2)   # GestureThread -> EncoderThread
_stream_queue        = queue.Queue(maxsize=4)   # EncoderThread -> HTTP clients

# E-mail job queue - items are dicts:
# { 'type': 'otp',     'recipient': str, 'otp': str, 'purpose': str }
# { 'type': 'welcome', 'recipient': str, 'username': str }
_email_queue: queue.Queue = queue.Queue()

# Gesture state (written by GestureThread, read by Flask routes)
class GestureState:
    """Thread-safe container for the latest gesture recognition results."""
    def __init__(self):
        self.current_gesture   = "None"
        self.current_hand_sign = "None"
        self.fps               = 0.0
        self.hand_detected     = False
        self._lock             = threading.Lock()

    def update(self, *, fps, hand_detected, hand_sign, gesture):
        with self._lock:
            self.fps               = fps
            self.hand_detected     = hand_detected
            self.current_hand_sign = hand_sign
            self.current_gesture   = gesture

    def snapshot(self) -> dict:
        with self._lock:
            return {
                'hand_detected': self.hand_detected,
                'hand_sign':     self.current_hand_sign,
                'gesture':       self.current_gesture,
                'fps':           self.fps,
                'timestamp':     datetime.now().isoformat(),
            }

gesture_state = GestureState()

# Stop event - set this to cleanly shut down all worker threads
_stop_event = threading.Event()


# SECTION 2 - Vision helpers (pure functions, no side-effects)

def calc_bounding_rect(image, landmarks):
    h, w = image.shape[:2]
    pts = np.array([
        [min(int(lm.x * w), w - 1), min(int(lm.y * h), h - 1)]
        for lm in landmarks.landmark
    ], dtype=int)
    x, y, bw, bh = cv.boundingRect(pts)
    return [x, y, x + bw, y + bh]


def calc_landmark_list(image, landmarks):
    h, w = image.shape[:2]
    return [
        [min(int(lm.x * w), w - 1), min(int(lm.y * h), h - 1)]
        for lm in landmarks.landmark
    ]


def pre_process_landmark(landmark_list):
    tmp = copy.deepcopy(landmark_list)
    base_x, base_y = tmp[0]
    tmp = [[p[0] - base_x, p[1] - base_y] for p in tmp]
    flat = list(itertools.chain.from_iterable(tmp))
    max_val = max(map(abs, flat)) or 1
    return [v / max_val for v in flat]


def draw_landmarks(image, landmark_point):
    if not landmark_point:
        return image
    connections = [
        (2,3),(3,4),
        (5,6),(6,7),(7,8),
        (9,10),(10,11),(11,12),
        (13,14),(14,15),(15,16),
        (17,18),(18,19),(19,20),
        (0,1),(1,2),(2,5),(5,9),(9,13),(13,17),(17,0),
    ]
    for a, b in connections:
        cv.line(image, tuple(landmark_point[a]), tuple(landmark_point[b]), (0,0,0),     6)
        cv.line(image, tuple(landmark_point[a]), tuple(landmark_point[b]), (255,255,255),2)
    for idx, pt in enumerate(landmark_point):
        r = 8 if idx in (4, 8, 12, 16, 20) else 5
        cv.circle(image, tuple(pt), r, (255,255,255), -1)
        cv.circle(image, tuple(pt), r, (0,0,0),       1)
    return image


def draw_info_text(image, brect, handedness, hand_sign_text):
    cv.rectangle(image, (brect[0], brect[1]), (brect[2], brect[1]-22), (0,0,0), -1)
    label = handedness.classification[0].label
    if hand_sign_text:
        label += ':' + hand_sign_text
    cv.putText(image, label, (brect[0]+5, brect[1]-4),
               cv.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1, cv.LINE_AA)
    return image


def draw_fps(image, fps):
    cv.putText(image, f"FPS:{fps}", (10,30), cv.FONT_HERSHEY_SIMPLEX,
               1.0, (0,0,0),       4, cv.LINE_AA)
    cv.putText(image, f"FPS:{fps}", (10,30), cv.FONT_HERSHEY_SIMPLEX,
               1.0, (255,255,255), 2, cv.LINE_AA)
    return image


# SECTION 3 - Worker threads

# Thread 1 · CameraThread
class CameraThread(threading.Thread):
    """
    Reads raw BGR frames from the webcam at full speed and puts them onto
    `_raw_frame_queue`. If the queue is full it drops the oldest frame so
    that downstream threads always work with the freshest data.
    """
    def __init__(self, device=0, width=854, height=480):
        super().__init__(name='CameraThread', daemon=True)
        self.device = device
        self.width  = width
        self.height = height

    def run(self):
        log.info('CameraThread starting - opening device %d', self.device)
        cap = cv.VideoCapture(self.device)
        cap.set(cv.CAP_PROP_FRAME_WIDTH,  self.width)
        cap.set(cv.CAP_PROP_FRAME_HEIGHT, self.height)

        if not cap.isOpened():
            log.error('CameraThread - cannot open camera device %d', self.device)
            return

        log.info('CameraThread - camera opened (%dx%d)', self.width, self.height)

        while not _stop_event.is_set():
            ret, frame = cap.read()
            if not ret:
                log.warning('CameraThread - frame read failed, retrying...')
                time.sleep(0.05)
                continue

            frame = cv.flip(frame, 1)   # mirror for natural UX

            # Non-blocking put: discard the oldest frame if the queue is full
            # so we never block and always stay live.
            try:
                _raw_frame_queue.put_nowait(frame)
            except queue.Full:
                try:
                    _raw_frame_queue.get_nowait()
                except queue.Empty:
                    pass
                _raw_frame_queue.put_nowait(frame)

        cap.release()
        log.info('CameraThread stopped.')


# Thread 2 · GestureThread
class GestureThread(threading.Thread):
    """
    Pulls raw frames from `_raw_frame_queue`, runs MediaPipe hand detection
    and the KeyPoint classifier, annotates the frame, updates `gesture_state`,
    then pushes the annotated frame onto `_encoded_frame_queue`.
    """
    def __init__(self):
        super().__init__(name='GestureThread', daemon=True)

    def _init_models(self):
        mp_hands = mp.solutions.hands
        self._hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5,
        )
        self._keypoint_classifier = KeyPointClassifier()
        label_path = os.path.join(
            BASE_DIR, 'model', 'keypoint_classifier', 'keypoint_classifier_label.csv'
        )
        with open(label_path, encoding='utf-8-sig') as f:
            self._keypoint_labels = [row[0] for row in csv.reader(f)]
        self._fps_calc             = CvFpsCalc(buffer_len=10)
        self._point_history        = deque(maxlen=16)
        self._finger_gest_history  = deque(maxlen=16)
        log.info('GestureThread - models loaded (%d labels)', len(self._keypoint_labels))

    def run(self):
        log.info('GestureThread starting - loading models...')
        self._init_models()

        while not _stop_event.is_set():
            try:
                frame = _raw_frame_queue.get(timeout=1.0)
            except queue.Empty:
                continue

            fps          = self._fps_calc.get()
            debug_image  = frame.copy()
            image_rgb    = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
            image_rgb.flags.writeable = False
            results      = self._hands.process(image_rgb)

            hand_sign     = "None"
            hand_detected = results.multi_hand_landmarks is not None

            if hand_detected:
                for hand_lm, handedness in zip(
                    results.multi_hand_landmarks, results.multi_handedness
                ):
                    brect         = calc_bounding_rect(debug_image, hand_lm)
                    landmark_list = calc_landmark_list(debug_image, hand_lm)
                    processed     = pre_process_landmark(landmark_list)
                    sign_id       = self._keypoint_classifier(processed)

                    if sign_id == 2:
                        self._point_history.append(landmark_list[8])
                    else:
                        self._point_history.append([0, 0])

                    self._finger_gest_history.append(0)
                    hand_sign = self._keypoint_labels[sign_id]

                    debug_image = draw_landmarks(debug_image, landmark_list)
                    debug_image = draw_info_text(debug_image, brect, handedness, hand_sign)
            else:
                self._point_history.append([0, 0])

            debug_image = draw_fps(debug_image, fps)

            # Update shared gesture state (thread-safe via GestureState.update)
            gesture_state.update(
                fps=fps,
                hand_detected=hand_detected,
                hand_sign=hand_sign,
                gesture="None",
            )

            # Push annotated frame downstream; drop oldest if full
            try:
                _encoded_frame_queue.put_nowait(debug_image)
            except queue.Full:
                try:
                    _encoded_frame_queue.get_nowait()
                except queue.Empty:
                    pass
                _encoded_frame_queue.put_nowait(debug_image)

        log.info('GestureThread stopped.')


# Thread 3 · EncoderThread
class EncoderThread(threading.Thread):
    """
    Pulls annotated BGR frames from `_encoded_frame_queue`, JPEG-encodes them,
    and puts the multipart bytes onto `_stream_queue` for HTTP clients.
    Keeping encoding in its own thread means GestureThread never waits for
    JPEG compression.
    """
    JPEG_QUALITY = 80

    def __init__(self):
        super().__init__(name='EncoderThread', daemon=True)

    def run(self):
        log.info('EncoderThread started.')
        encode_params = [cv.IMWRITE_JPEG_QUALITY, 75]

        while not _stop_event.is_set():
            try:
                frame = _encoded_frame_queue.get(timeout=1.0)
            except queue.Empty:
                continue

            ok, buf = cv.imencode('.jpg', frame, encode_params)
            if not ok:
                continue

            fb = buf.tobytes()
            chunk = (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n'
                b'Content-Length: ' + str(len(fb)).encode() + b'\r\n\r\n' +
                fb + b'\r\n'
            )

            try:
                _stream_queue.put_nowait(chunk)
            except queue.Full:
                try:
                    _stream_queue.get_nowait()
                except queue.Empty:
                    pass
                _stream_queue.put_nowait(chunk)

        log.info('EncoderThread stopped.')


# Thread 4 · EmailWorkerThread
MAIL_SENDER   = os.environ.get('MAIL_SENDER','insigniaformsu@gmail.com')
MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
MAIL_HOST     = os.environ.get('MAIL_HOST', 'smtp.gmail.com')
MAIL_PORT     = int(os.environ.get('MAIL_PORT', 587))

class EmailWorkerThread(threading.Thread):
    """
    Single long-lived SMTP worker thread. All Flask routes that need to send
    an email put a job dict onto `_email_queue`; this thread drains the queue
    sequentially, keeping all SMTP work off the Flask request threads.

    Job schemas:
      OTP email:     { 'type': 'otp',     'recipient': str, 'otp': str, 'purpose': 'reset'|'signup' }
      Welcome email: { 'type': 'welcome', 'recipient': str, 'username': str }
    """
    def __init__(self):
        super().__init__(name='EmailWorkerThread', daemon=True)

    def run(self):
        log.info('EmailWorkerThread started.')
        while not _stop_event.is_set():
            try:
                job = _email_queue.get(timeout=2.0)
            except queue.Empty:
                continue
            try:
                jtype = job.get('type')
                if jtype == 'otp':
                    self._send_otp(job['recipient'], job['otp'], job.get('purpose', 'reset'))
                elif jtype == 'welcome':
                    self._send_welcome(job['recipient'], job['username'])
                else:
                    log.warning('EmailWorkerThread - unknown job type: %s', jtype)
            except Exception as exc:
                log.exception('EmailWorkerThread - unhandled error: %s', exc)
            finally:
                _email_queue.task_done()
        log.info('EmailWorkerThread stopped.')

    # internal senders

    def _send_otp(self, recipient: str, otp: str, purpose: str) -> bool:
        if not MAIL_SENDER or not MAIL_PASSWORD:
            log.info('[DEV] OTP (%s) for %s: %s', purpose, recipient, otp)
            return True

        if purpose == 'signup':
            subject  = "INSIGNIA - Verify Your Email"
            heading  = "Verify Your Email"
            sub_line = ("You're almost in! Enter the 6-digit code below to verify "
                        "your INSIGNIA account.")
        else:
            subject  = "INSIGNIA - Your Password Reset OTP"
            heading  = "Password Reset"
            sub_line = "Use the code below to reset your INSIGNIA password."

        html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;
                    padding:36px 28px;background:#0d0d0d;border-radius:16px;
                    border:1px solid #1ef0ff22;color:#fff;">
          <h2 style="color:#1ef0ff;margin:0 0 8px;">{heading}</h2>
          <p style="opacity:.7;margin:0 0 28px;">
            {sub_line}<br>It expires in <strong>10 minutes</strong>.
          </p>
          <div style="text-align:center;letter-spacing:14px;font-size:2.4rem;
                      font-weight:700;padding:22px 0;background:rgba(30,240,255,.08);
                      border-radius:12px;color:#1ef0ff;border:1px solid #1ef0ff33;">
            {otp}
          </div>
          <p style="margin:28px 0 0;font-size:.8rem;opacity:.5;">
            If you didn't request this, please ignore this email.
          </p>
        </div>"""
        return self._smtp_send(recipient, subject, html_body)

    def _send_welcome(self, recipient: str, username: str) -> None:
        if not MAIL_SENDER or not MAIL_PASSWORD:
            log.info('[DEV] Welcome email -> %s (%s)', recipient, username)
            return

        subject   = "Welcome to INSIGNIA - Break Communication Barriers!"
        html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;
                    padding:36px 28px;background:#0d0d0d;border-radius:16px;
                    border:1px solid #1ef0ff22;color:#fff;">
          <h2 style="color:#1ef0ff;margin:0 0 8px;">Welcome, {username}!</h2>
          <p style="opacity:.7;margin:0 0 20px;">
            Welcome to INSIGNIA, your gateway to seamless sign language recognition
            and translation!<br><br>
            We're thrilled you've joined us on this journey to Break Communication Barriers and empower the Deaf and Hard of Hearing community.
            INSIGNIA uses cutting-edge AI and computer vision to instantly translate
            hand gestures into text.<br><br>
            Thank you for joining us - let's break down communication barriers together!
          </p>
          <p style="margin:28px 0 0;font-size:.8rem;opacity:.5;">
            Best regards,<br>The INSIGNIA Team
          </p>
        </div>"""
        self._smtp_send(recipient, subject, html_body)

    def _smtp_send(self, recipient: str, subject: str, html_body: str) -> bool:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = MAIL_SENDER
        msg['To']      = recipient
        msg.attach(MIMEText(html_body, 'html'))
        try:
            with smtplib.SMTP(MAIL_HOST, MAIL_PORT, timeout=10) as srv:
                srv.ehlo()
                srv.starttls()
                srv.login(MAIL_SENDER, MAIL_PASSWORD)
                srv.sendmail(MAIL_SENDER, recipient, msg.as_string())
            log.info('EmailWorkerThread - sent "%s" -> %s', subject, recipient)
            return True
        except Exception as exc:
            log.error('EmailWorkerThread - SMTP error: %s', exc)
            return False


# Convenience helpers used by Flask routes
def enqueue_otp_email(recipient: str, otp: str, purpose: str) -> None:
    """Non-blocking: put an OTP email job onto the email queue."""
    _email_queue.put({'type': 'otp', 'recipient': recipient,
                      'otp': otp, 'purpose': purpose})


def enqueue_welcome_email(recipient: str, username: str) -> None:
    """Non-blocking: put a welcome email job onto the email queue."""
    _email_queue.put({'type': 'welcome', 'recipient': recipient, 'username': username})


# Thread 5 · OTPCleanupThread
OTP_EXPIRY_SECONDS = 600   # 10 minutes
OTP_MAX_ATTEMPTS   = 5

_otp_store:       dict = {}   # { email: { otp, expires, attempts, ... } }
_pending_signups: dict = {}   # { email: { username, password_hash, otp, ... } }
_otp_lock     = threading.Lock()
_pending_lock = threading.Lock()

class OTPCleanupThread(threading.Thread):
    """
    Wakes every 60 seconds and removes expired entries from `_otp_store`
    and `_pending_signups`. Keeps memory tidy without any per-request work.
    """
    INTERVAL = 60

    def __init__(self):
        super().__init__(name='OTPCleanupThread', daemon=True)

    def run(self):
        log.info('OTPCleanupThread started (interval=%ds).', self.INTERVAL)
        while not _stop_event.is_set():
            _stop_event.wait(timeout=self.INTERVAL)
            if _stop_event.is_set():
                break
            self._cleanup()
        log.info('OTPCleanupThread stopped.')

    @staticmethod
    def _cleanup():
        now = time.time()

        expired_otp = [e for e, r in list(_otp_store.items()) if r['expires'] < now]
        expired_sig = [e for e, r in list(_pending_signups.items()) if r['expires'] < now]

        if expired_otp:
            with _otp_lock:
                for e in expired_otp:
                    _otp_store.pop(e, None)
            log.info('OTPCleanupThread - pruned %d expired OTP record(s).', len(expired_otp))

        if expired_sig:
            with _pending_lock:
                for e in expired_sig:
                    _pending_signups.pop(e, None)
            log.info('OTPCleanupThread - pruned %d expired signup record(s).', len(expired_sig))


# SECTION 4 - Thread lifecycle (start / stop)

_camera_thread  = CameraThread()
_gesture_thread = GestureThread()
_encoder_thread = EncoderThread()
_email_thread   = EmailWorkerThread()
_cleanup_thread = OTPCleanupThread()

def start_background_threads():
    """Start all daemon threads. Safe to call multiple times (idempotent)."""
    for t in (_camera_thread, _gesture_thread, _encoder_thread,
              _email_thread, _cleanup_thread):
        if not t.is_alive():
            t.start()
            log.info('Started %s', t.name)

def stop_background_threads():
    """Signal all threads to stop and wait for them to finish."""
    log.info('Stopping background threads...')
    _stop_event.set()
    for t in (_camera_thread, _gesture_thread, _encoder_thread,
              _email_thread, _cleanup_thread):
        t.join(timeout=5)
    log.info('All background threads stopped.')

# Start threads as soon as the module is imported.
start_background_threads()


# SECTION 5 - Database

DB_PATH  = os.path.join(BASE_DIR, 'db.sqlite3')
_db_lock = threading.Lock()   # Serialise writes; reads use their own connection


def get_db_connection():
    """Return a new sqlite3 connection. Caller is responsible for closing it."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # WAL mode allows concurrent reads while a write is in progress.
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def init_db():
    conn = get_db_connection()
    with conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                username   TEXT UNIQUE NOT NULL,
                email      TEXT UNIQUE NOT NULL,
                password   TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        ''')
    conn.close()
    log.info('Database initialised at %s', DB_PATH)


if hasattr(app, 'before_first_request'):
    @app.before_first_request
    def _init():
        init_db()
else:
    init_db()


def get_user_by_username(username: str):
    conn = get_db_connection()
    try:
        return conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
    finally:
        conn.close()


def get_user_by_email(email: str):
    conn = get_db_connection()
    try:
        return conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
    finally:
        conn.close()


def _generate_otp() -> str:
    return str(random.randint(0, 10 ** 6 - 1)).zfill(6)


# SECTION 6 - Auth helpers

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated


# SECTION 7 - Static / page routes

@app.route('/')
def index():
    return send_file(os.path.join(PARENT_DIR, 'src', 'index.html'))


@app.route('/gesture')
def gesture_page():
    return send_file(os.path.join(PARENT_DIR, 'src', 'gesture.html'))


@app.route('/<path:filename>')
def serve_static(filename):
    fp = os.path.join(PARENT_DIR, 'src', filename)
    if os.path.isfile(fp):
        return send_file(fp)
    return jsonify({'error': 'File not found'}), 404


# SECTION 8 - Video streaming routes

def _mjpeg_generator():
    """
    Generator consumed by /api/video_feed.
    Pulls pre-encoded MJPEG chunks from `_stream_queue`.
    Each HTTP client that connects runs this in its own Flask request thread.
    """
    while True:
        try:
            chunk = _stream_queue.get(timeout=2.0)
            yield chunk
        except queue.Empty:
            yield b'--frame\r\n\r\n'   # keep-alive so browser does not time out


@app.route('/api/video_feed')
def video_feed():
    return Response(
        _mjpeg_generator(),
        mimetype='multipart/x-mixed-replace; boundary=frame',
    )


@app.route('/api/gesture/status')
def gesture_status():
    return jsonify(gesture_state.snapshot())


@app.route('/api/health')
def health():
    """Health check - also reports live/dead status of all background threads."""
    return jsonify({
        'status': 'ok',
        'server': 'insignia',
        'threads': {
            'camera':  _camera_thread.is_alive(),
            'gesture': _gesture_thread.is_alive(),
            'encoder': _encoder_thread.is_alive(),
            'email':   _email_thread.is_alive(),
            'cleanup': _cleanup_thread.is_alive(),
        },
    })


# SECTION 9 - Auth routes (signup / login / logout / me)

@app.route('/api/signup', methods=['POST'])
def signup():
    """Stage a new account and send an email-verification OTP."""
    data     = request.get_json(force=True)
    username = (data.get('username') or data.get('name') or '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({'success': False,
                        'error': 'username, email and password are required'}), 400

    if get_user_by_username(username) or get_user_by_email(email):
        return jsonify({'success': False,
                        'error': 'username or email already taken'}), 409

    otp    = _generate_otp()
    expiry = time.time() + OTP_EXPIRY_SECONDS
    hashed = generate_password_hash(password)

    with _pending_lock:
        _pending_signups[email] = {
            'username':      username,
            'password_hash': hashed,
            'otp':           otp,
            'expires':       expiry,
            'attempts':      0,
        }

    # Non-blocking: email is sent by EmailWorkerThread
    enqueue_otp_email(email, otp, purpose='signup')

    return jsonify({
        'success':               True,
        'requires_verification': True,
        'message':               'A 6-digit verification code has been sent to your email.',
    }), 200


@app.route('/api/verify-signup-otp', methods=['POST'])
def verify_signup_otp():
    """Confirm the email-verification OTP and create the account."""
    data  = request.get_json(force=True)
    email = (data.get('email') or '').strip().lower()
    otp   = (data.get('otp')   or '').strip()

    if not email or not otp:
        return jsonify({'success': False,
                        'error': 'email and otp are required'}), 400

    with _pending_lock:
        record = _pending_signups.get(email)
        if record is None:
            return jsonify({'success': False,
                            'error': 'No pending signup found. Please sign up again.'}), 400
        if time.time() > record['expires']:
            del _pending_signups[email]
            return jsonify({'success': False,
                            'error': 'Code expired. Please sign up again.'}), 400
        if record['attempts'] >= OTP_MAX_ATTEMPTS:
            del _pending_signups[email]
            return jsonify({'success': False,
                            'error': 'Too many failed attempts. Please sign up again.'}), 429
        if record['otp'] != otp:
            record['attempts'] += 1
            remaining = OTP_MAX_ATTEMPTS - record['attempts']
            return jsonify({'success': False,
                            'error': f'Incorrect code. {remaining} attempt(s) remaining.'}), 400

        username      = record['username']
        password_hash = record['password_hash']
        del _pending_signups[email]

    if get_user_by_username(username) or get_user_by_email(email):
        return jsonify({'success': False,
                        'error': 'username or email already taken'}), 409

    with _db_lock:
        conn   = get_db_connection()
        cursor = conn.cursor()
        now    = datetime.utcnow().isoformat()
        try:
            cursor.execute(
                "INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, ?)",
                (username, email, password_hash, now),
            )
            conn.commit()
            user_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'success': False,
                            'error': 'username or email already taken'}), 409
        finally:
            conn.close()

    session['user_id']  = user_id
    session['username'] = username
    enqueue_welcome_email(email, username)   # non-blocking

    return jsonify({
        'success': True,
        'message': 'Email verified - your account is ready!',
        'user_id': user_id,
    }), 201


@app.route('/api/resend-signup-otp', methods=['POST'])
def resend_signup_otp():
    data  = request.get_json(force=True)
    email = (data.get('email') or '').strip().lower()
    if not email:
        return jsonify({'success': False, 'error': 'email is required'}), 400

    with _pending_lock:
        record = _pending_signups.get(email)
        if record is None:
            return jsonify({'success': False,
                            'error': 'No pending signup. Please sign up again.'}), 400
        otp                = _generate_otp()
        record['otp']      = otp
        record['expires']  = time.time() + OTP_EXPIRY_SECONDS
        record['attempts'] = 0

    enqueue_otp_email(email, otp, purpose='signup')
    return jsonify({'success': True, 'message': 'Verification code resent.'})


@app.route('/api/login', methods=['POST'])
def login():
    data        = request.get_json(force=True)
    login_input = (data.get('username') or data.get('email') or '').strip()
    password    = data.get('password', '')

    if not login_input or not password:
        return jsonify({'success': False, 'error': 'username/email and password required'}), 400

    user = get_user_by_email(login_input.lower()) if '@' in login_input \
           else get_user_by_username(login_input)

    if user is None or not check_password_hash(user['password'], password):
        return jsonify({'success': False, 'error': 'invalid credentials'}), 401

    session.clear()
    session['user_id']  = user['id']
    session['username'] = user['username']
    return jsonify({'success': True, 'message': 'login successful',
                    'user_id': user['id'], 'username': user['username']})


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'logged out'})


@app.route('/api/me')
def me():
    if 'user_id' not in session:
        return jsonify({'user': None}), 200
    return jsonify({'user': {
        'id':       session['user_id'],
        'username': session.get('username'),
    }})


# SECTION 10 - Forgot-password / OTP routes

@app.route('/api/forgot', methods=['POST'])
def forgot_password():
    data  = request.get_json(force=True)
    email = (data.get('email') or '').strip().lower()
    if not email:
        return jsonify({'success': False, 'error': 'email is required'}), 400

    user = get_user_by_email(email)
    if user:
        otp     = _generate_otp()
        expires = time.time() + OTP_EXPIRY_SECONDS
        with _otp_lock:
            _otp_store[email] = {'otp': otp, 'expires': expires, 'attempts': 0}
        enqueue_otp_email(email, otp, purpose='reset')   # non-blocking

    return jsonify({'success': True,
                    'message': 'If that email is registered you will receive an OTP shortly.'})


@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    data  = request.get_json(force=True)
    email = (data.get('email') or '').strip().lower()
    otp   = (data.get('otp')   or '').strip()

    if not email or not otp:
        return jsonify({'success': False, 'error': 'email and otp are required'}), 400

    with _otp_lock:
        record = _otp_store.get(email)
        if record is None:
            return jsonify({'success': False, 'error': 'No OTP requested for this email.'}), 400
        if time.time() > record['expires']:
            del _otp_store[email]
            return jsonify({'success': False, 'error': 'OTP has expired. Please request a new one.'}), 400
        if record['attempts'] >= OTP_MAX_ATTEMPTS:
            del _otp_store[email]
            return jsonify({'success': False, 'error': 'Too many failed attempts. Please request a new OTP.'}), 429
        if record['otp'] != otp:
            record['attempts'] += 1
            remaining = OTP_MAX_ATTEMPTS - record['attempts']
            return jsonify({'success': False,
                            'error': f'Incorrect OTP. {remaining} attempt(s) remaining.'}), 400

        reset_token           = _generate_otp() + _generate_otp()
        record['verified']    = True
        record['reset_token'] = reset_token
        record['expires']     = time.time() + 300

    return jsonify({'success': True, 'reset_token': reset_token})


@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data         = request.get_json(force=True)
    email        = (data.get('email')        or '').strip().lower()
    reset_token  = (data.get('reset_token')  or '').strip()
    new_password = (data.get('new_password') or '')

    if not email or not reset_token or not new_password:
        return jsonify({'success': False,
                        'error': 'email, reset_token and new_password are required'}), 400
    if len(new_password) < 8:
        return jsonify({'success': False,
                        'error': 'Password must be at least 8 characters.'}), 400

    with _otp_lock:
        record = _otp_store.get(email)
        if record is None or not record.get('verified'):
            return jsonify({'success': False, 'error': 'OTP not verified. Please start over.'}), 400
        if time.time() > record['expires']:
            del _otp_store[email]
            return jsonify({'success': False, 'error': 'Session expired. Please start over.'}), 400
        if record.get('reset_token') != reset_token:
            return jsonify({'success': False, 'error': 'Invalid reset token.'}), 400

        with _db_lock:
            conn = get_db_connection()
            try:
                hashed = generate_password_hash(new_password)
                conn.execute(
                    "UPDATE users SET password = ? WHERE email = ?", (hashed, email)
                )
                conn.commit()
            finally:
                conn.close()

        del _otp_store[email]

    return jsonify({'success': True, 'message': 'Password updated successfully. You can now log in.'})


# SECTION 11 - Amazon Translate route

AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# boto3 client is thread-safe for concurrent calls; create once and reuse.
_translate_client      = None
_translate_client_lock = threading.Lock()

def get_translate_client():
    """Return a shared boto3 Translate client, initialised once (thread-safe)."""
    global _translate_client
    if _translate_client is None:
        with _translate_client_lock:
            if _translate_client is None:   # double-checked locking pattern
                _translate_client = boto3.client(
                    'translate',
                    region_name=AWS_REGION,
                )
    return _translate_client


@app.route('/api/translate', methods=['POST'])
def translate_text():
    """
    Translate text via Amazon Translate.
    Body: { "text": str, "target_lang": str, "source_lang": str (default "auto") }
    """
    data        = request.get_json(force=True)
    text        = (data.get('text')        or '').strip()
    target_lang = (data.get('target_lang') or '').strip()
    source_lang = (data.get('source_lang') or 'auto').strip().lower()

    if not text:
        return jsonify({'success': False, 'error': 'text is required'}), 400
    if not target_lang:
        return jsonify({'success': False, 'error': 'target_lang is required'}), 400
    if source_lang in ('', 'detect'):
        source_lang = 'auto'

    try:
        client   = get_translate_client()
        response = client.translate_text(
            Text               = text,
            SourceLanguageCode = source_lang,
            TargetLanguageCode = target_lang,
        )
        return jsonify({
            'success':         True,
            'translated_text': response['TranslatedText'],
            'source_lang':     response['SourceLanguageCode'],
            'target_lang':     response['TargetLanguageCode'],
        })
    except ClientError as exc:
        code = exc.response['Error']['Code']
        msg  = exc.response['Error']['Message']
        return jsonify({'success': False, 'error': f'AWS Error ({code}): {msg}'}), 502
    except (BotoCoreError, Exception) as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


# SECTION 12 - Entry point

if __name__ == '__main__':
    try:
        # use_reloader=False prevents Flask from forking a child process which
        # would double-start the background threads.
        app.run(debug=False, host='0.0.0.0', port=5000,
                threaded=True, use_reloader=False)
    finally:
        stop_background_threads()
