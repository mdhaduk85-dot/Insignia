# INSIGNIA

INSIGNIA is a browser-based American Sign Language (ASL) fingerspelling project. It combines a webcam hand-sign recognizer with a reference guide, account flows, and optional text translation through Amazon Translate.

The frontend is made with HTML, CSS, and JavaScript. A Flask backend streams webcam frames, detects a hand with MediaPipe, classifies hand landmarks with a TensorFlow Lite model, and provides the API used by the frontend.

## Features

- Live webcam hand tracking and recognition for the model's labeled signs.
- A learning page with reference images for the ASL alphabet and numbers, plus phrase guides.
- A translation page that builds text from recognized signs and can translate it into one of the listed languages.
- Signup with email verification, login, logout, and password reset.
- SQLite storage for user accounts; passwords are stored as hashes.
- A health endpoint that reports the status of the backend worker threads.

Recognition depends on having a working camera and the bundled model files. Text translation requires AWS credentials and access to Amazon Translate. Signup and password-reset codes are printed to the backend console when SMTP is not configured; this behavior is intended for local development.

## Project layout

```text
.
├── backend/
│   ├── server.py                         # Flask API and live recognition server
│   ├── app.py                            # Standalone webcam/model utility
│   ├── keypoint_classification_EN.ipynb  # Model training notebook
│   ├── model/
│   │   └── keypoint_classifier/
│   │       ├── keypoint_classifier.tflite # Model used by the live server
│   │       ├── keypoint_classifier.keras  # Keras model checkpoint
│   │       ├── keypoint_classifier.py    # TensorFlow Lite wrapper
│   │       ├── keypoint_classifier_label.csv
│   │       └── keypoint.csv              # Landmark training data
│   └── utils/
│       └── cvfpscalc.py
├── requirements.txt                      # Python backend and training dependencies
├── res/
│   ├── signs/                            # Reference images for letters and digits
│   └── ...                               # Images, SVGs, and demo video
└── src/
    ├── index.html                        # Home page and account interface
    ├── translate.html                    # Live recognition and translation
    ├── learn.html                        # Sign-language reference guide
    ├── about.html
    ├── script.js
    ├── learn.js
    └── *.css
```

The browser loads the TensorFlow Lite model through the backend; it does not run the model directly in the page. The training notebook is optional for running the existing app.

## Requirements

- Python 3.10 is recommended.
- A webcam for live sign recognition.
- A modern browser with camera access enabled.
- Internet access for externally hosted fonts and frontend libraries.
- Optional: AWS credentials with permission to call Amazon Translate.
- Optional: SMTP credentials to send signup and password-reset emails.
- A static web server for the frontend. The instructions below use the **Live Server** extension in Visual Studio Code.

The backend imports Flask, Flask-CORS, boto3, OpenCV, NumPy, MediaPipe, and TensorFlow. Install them in the Python environment you will use to run the server.

## Run locally

Run the backend and frontend in separate terminals. Commands below use PowerShell from the project root.

### 1. Create and prepare a Python environment

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If PowerShell blocks virtual-environment activation, use the Python executable directly instead:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 2. Configure local environment variables

Set a stable Flask session secret before starting the backend. In PowerShell, for the current terminal:

```powershell
$env:FLASK_SECRET_KEY = "<a-long-random-secret>"
```

Without `FLASK_SECRET_KEY`, the server creates a temporary random key each time it starts, so existing browser sessions will be invalidated after a restart.

Email and AWS configuration are optional for starting the app. To enable SMTP email delivery, set:

```powershell
$env:MAIL_SENDER = "you@example.com"
$env:MAIL_PASSWORD = "<smtp-app-password>"
$env:MAIL_HOST = "smtp.gmail.com"
$env:MAIL_PORT = "587"
```

To enable Amazon Translate, configure AWS credentials using a supported AWS provider, such as environment variables, a shared AWS credentials profile, or an attached role. Set the region if needed:

```powershell
$env:AWS_REGION = "us-east-1"
```

The AWS identity needs permission to call `translate:TranslateText`. Do not put credentials in source files or commit them.

When SMTP is not configured, signup and password-reset OTPs are written to the backend console for local development. Do not use that mode in a public deployment.

### 3. Start the Flask backend

The model wrapper uses a path relative to the `backend` directory, so start the server with that as the working directory:

```powershell
Set-Location backend
python server.py
```

The backend listens on `http://localhost:5000` and starts worker threads for the camera, gesture processing, frame encoding, email, and OTP cleanup. The SQLite database is created at `backend/db.sqlite3` when the server initializes it; it is local application data and is excluded from Git.

Check that the backend is responding by opening `http://localhost:5000/api/health`. The response includes a status and the worker-thread states. If the camera cannot be opened, check camera permissions and close other applications using it.

### 4. Serve the frontend

In a second terminal, from the project root:

1. Open the project folder in Visual Studio Code.
2. Open `src/index.html`.
3. Use **Open with Live Server**.
4. Navigate to the Translate and Learn pages from the site navigation.

The frontend calls the backend at `http://localhost:5000`. Using a local web server (rather than opening the HTML file directly) allows browser features such as camera access and frontend asset paths to work as intended.

## API overview

The frontend currently uses the following backend routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Backend and worker-thread status |
| `GET` | `/api/gesture/status` | Latest recognized sign, gesture, and FPS |
| `GET` | `/api/video_feed` | Live MJPEG webcam stream |
| `POST` | `/api/translate` | Translate text with Amazon Translate |
| `POST` | `/api/signup` | Start signup and send or log a verification OTP |
| `POST` | `/api/verify-signup-otp` | Verify signup OTP and create the account |
| `POST` | `/api/resend-signup-otp` | Resend a signup OTP |
| `POST` | `/api/login` | Authenticate with username or email and password |
| `POST` | `/api/logout` | End the current session |
| `GET` | `/api/me` | Return the current session user, if any |
| `POST` | `/api/forgot` | Request a password-reset OTP |
| `POST` | `/api/verify-otp` | Verify a password-reset OTP |
| `POST` | `/api/reset-password` | Set a new password with the reset token |

The translation request accepts JSON with `text`, `target_lang`, and an optional `source_lang` (defaults to `auto`). The response contains the translated text and detected source and target language codes.

## Model and training

The live server uses `backend/model/keypoint_classifier/keypoint_classifier.tflite` and the label order in `keypoint_classifier_label.csv`. Reference images used on the Learn page are under `res/signs/`.

To inspect or retrain the classifier, install Jupyter in the active environment with `python -m pip install jupyter`, then open `backend/keypoint_classification_EN.ipynb` and run it from the `backend` directory so its relative file paths resolve. The notebook uses `backend/model/keypoint_classifier/keypoint.csv` as training data and writes model outputs into the classifier directory. Training is not required to run the existing app.

`backend/app.py` is a separate, standalone webcam/model utility. It is not the Flask server used by the website; the website backend entry point is `backend/server.py`.

To run the standalone utility instead, stop the Flask server, then run it from the `backend` directory:

```powershell
python app.py --device 0 --width 960 --height 540
```

It opens a local OpenCV window and exits when you press **Esc**. The `--device` option selects the camera index; `--use_static_image_mode` enables MediaPipe's static-image mode.

## Troubleshooting

- **Backend connection fails:** Start `server.py` and confirm `http://localhost:5000/api/health` returns JSON. The frontend's API URL is currently set to `http://localhost:5000`.
- **Camera does not start:** Allow camera access for the browser and operating system, connect a webcam, and close other applications that may be using it. Check the backend console for camera errors.
- **Reference images do not load:** Serve the site from the project root using Live Server and open the page under `src/`; do not open the HTML file directly from disk.
- **Signup/reset email is not delivered:** Configure `MAIL_SENDER` and `MAIL_PASSWORD`. With SMTP unset, look for the OTP in the backend console.
- **Translation fails:** Configure AWS credentials and region, verify that the AWS identity can call Amazon Translate, and check the backend console for AWS errors.
- **Login stops working after a restart:** Set the same `FLASK_SECRET_KEY` before each backend start so session cookies remain valid.

## Notes

- The frontend loads Google Fonts, Font Awesome, GSAP, and Typed.js from external services, so those resources require network access.
- `backend/db.sqlite3` contains local account data and should not be committed or shared.
- Use properly secured secrets, email delivery, and deployment settings before exposing the development server to other users.
