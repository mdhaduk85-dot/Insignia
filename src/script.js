
// CUSTOM CURSOR
(function() {
  let dot = document.getElementById('cursorDot');
  let ring = document.getElementById('cursorRing');
  if (!dot) {
    dot = document.createElement('div');
    dot.className = 'cursor cursor-dot';
    document.body.appendChild(dot);
  }
  if (!ring) {
    ring = document.createElement('div');
    ring.className = 'cursor cursor-ring';
    document.body.appendChild(ring);
  }

  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    dot.style.left = mouseX + 'px';
    dot.style.top = mouseY + 'px';
  });

  // Smooth ring follow
  function animateRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';
    requestAnimationFrame(animateRing);
  }
  animateRing();

  document.addEventListener('mousedown', () => { dot.classList.add('clicked'); ring.classList.add('clicked'); });
  document.addEventListener('mouseup', () => { dot.classList.remove('clicked'); ring.classList.remove('clicked'); });

  document.querySelectorAll('a, button, [onclick], .testimony-card, .rec').forEach(el => {
    el.addEventListener('mouseenter', () => { dot.classList.add('hover'); ring.classList.add('hover'); });
    el.addEventListener('mouseleave', () => { dot.classList.remove('hover'); ring.classList.remove('hover'); });
  });
})();

// SCROLL PROGRESS BAR
(function() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.prepend(bar);
  window.addEventListener('scroll', () => {
    const scrolled = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    bar.style.width = scrolled + '%';
  });
})();

// NAV ENTRANCE + SCROLL STATE
(function() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  // Delay reveal after preloader
  setTimeout(() => nav.classList.add('nav-visible'), 2800);
  window.addEventListener('scroll', () => {
    nav.classList.toggle('nav-scrolled', window.scrollY > 60);
  });
})();

// HERO ENTRANCE
(function() {
  const heroText = document.querySelector('.hero-text-wrapper');
  const bento = document.querySelector('.bento-wrapper');
  if (heroText) {
    setTimeout(() => heroText.classList.add('visible'), 2600);
  }
  if (bento) {
    setTimeout(() => bento.classList.add('visible'), 2600);
  }
})();

// SCROLL REVEAL
(function() {
  const items = document.querySelectorAll('.rec, .testimony-card');
  if (!items.length) return;

  // stagger delay per card
  items.forEach((el, i) => {
    el.style.transitionDelay = (0.06 * (i % 5)) + 's';
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  items.forEach(el => observer.observe(el));
})();


const API_URL = 'http://localhost:5000';

let isStreamingActive = false;
let statusUpdateInterval = null;

// tracking for hand sign stability
let _lastRawSign = null;
let _signStableSince = 0;
let _displayedSign = '—';


// Amazon Translate


async function translateRegisteredText() {
  const regDiv  = document.querySelector('.registeredText');
  const resDiv  = document.getElementById('translationResult');
  const statusDiv = document.getElementById('translationStatus');
  const btn     = document.getElementById('translateBtn');
  const copyBtn = document.getElementById('copyTranslation');

  const text = _getSentence().trim() || (regDiv ? regDiv.textContent.trim() : '');
  if (!text) {
    if (statusDiv) { statusDiv.textContent = 'Nothing to translate – register some signs first.'; statusDiv.className = 'translation-status error'; }
    return;
  }

  const targetLang = (document.getElementById('targetLang')?.value || 'es');

  // Loading state
  if (btn)       { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating…'; }
  if (statusDiv) { statusDiv.textContent = 'Contacting Amazon Translate…'; statusDiv.className = 'translation-status loading'; }
  if (resDiv)    { resDiv.classList.remove('has-result'); }
  if (copyBtn)   { copyBtn.classList.remove('copied'); }

  try {
    const response = await fetch(`${API_URL}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text, target_lang: targetLang, source_lang: 'auto' }),
    });

    const data = await response.json();

    if (data.success) {
      if (resDiv) {
        resDiv.textContent = data.translated_text;
        resDiv.classList.add('has-result');
      }
      if (statusDiv) {
        statusDiv.textContent = `Detected: ${data.source_lang.toUpperCase()} → ${data.target_lang.toUpperCase()} · Amazon Translate`;
        statusDiv.className = 'translation-status success';
      }
    } else {
      if (statusDiv) { statusDiv.textContent = `Error: ${data.error}`; statusDiv.className = 'translation-status error'; }
    }
  } catch (err) {
    if (statusDiv) { statusDiv.textContent = `Network error: ${err.message}`; statusDiv.className = 'translation-status error'; }
    console.error('Translation error:', err);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-language"></i> Translate'; }
  }
}

// Copy translation to clipboard
document.addEventListener('DOMContentLoaded', () => {
  const copyBtn = document.getElementById('copyTranslation');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const resDiv = document.getElementById('translationResult');
      const text   = resDiv ? resDiv.textContent : '';
      if (!text || text === 'Translation will appear here…') return;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
          copyBtn.classList.remove('copied');
        }, 1800);
      });
    });
  }
});

// Check backend connection
async function checkConnection() {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    if (response.ok) {
      document.getElementById('connectionStatus').textContent = 'Backend Connected';
      document.getElementById('connectionStatus').classList.add('connected');
      return true;
    }
  } catch (error) {
    document.getElementById('connectionStatus').textContent = 'Backend connection cannot be fetched';
    document.getElementById('connectionStatus').classList.remove('connected');
    console.error('Backend connection failed:', error);
  }
  return false;
}

async function startGestureRecognition() {
  // Check backend availability
  const connected = await checkConnection();
  if (!connected) {
    alert('Error: Cannot connect to backend. Make sure the server is running on http://localhost:5000');
    return;
  }

  const videoFeed = document.getElementById('videoFeed');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const videoError = document.getElementById('videoError');
  if (loadingIndicator) loadingIndicator.style.display = 'block';
  if (videoFeed) videoFeed.style.display = 'none';
  if (videoError) videoError.textContent = '';

  // Set the video feed
  videoFeed.src = `${API_URL}/api/video_feed`;
  videoFeed.onload = () => {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    videoFeed.style.display = 'block';
    isStreamingActive = true;
    startStatusUpdates();
    if (videoError) videoError.textContent = '';
  };
  videoFeed.onerror = () => {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (videoError) videoError.textContent = 'Failed to load video feed. Check if the backend is running and camera is accessible.';
    videoFeed.style.display = 'none';
  };
}

function stopGestureRecognition() {
  const videoFeed = document.getElementById('videoFeed');
  if (videoFeed) videoFeed.src = '';
  isStreamingActive = false;
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }
  // Reset status display
  document.getElementById('handStatus').textContent = 'No Hand';
  document.getElementById('handSign').textContent = '—';
  document.getElementById('fpsDisplay').textContent = '—';
  const handIndicator = document.getElementById('handIndicator');
  if (handIndicator) {
    handIndicator.style.display = 'none';
    handIndicator.classList.remove('active');
  }
}

function startStatusUpdates() {
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
  }
  statusUpdateInterval = setInterval(updateStatus, 200);
}

async function updateStatus() {
  try {
    const response = await fetch(`${API_URL}/api/gesture/status`);
    if (!response.ok) return;
    const data = await response.json();
    // Update hand detection
    const handIndicator = document.getElementById('handIndicator');
    const handStatus = document.getElementById('handStatus');
    if (data.hand_detected) {
      if (handIndicator) {
        handIndicator.classList.add('active');
        handIndicator.style.display = 'block';
      }
      handStatus.textContent = 'Detected';
    } else {
      if (handIndicator) {
        handIndicator.classList.remove('active');
        handIndicator.style.display = 'none';
      }
      handStatus.textContent = 'No Hand';
    }

    const rawSign = data.hand_sign || '—';
    const now = Date.now();
    if (rawSign !== _lastRawSign) {
      _lastRawSign = rawSign;
      _signStableSince = now;
    } else {
      if (now - _signStableSince >= 1000 && rawSign !== _displayedSign) {
        _displayedSign = rawSign;
      }
    }
    document.getElementById('handSign').textContent = _displayedSign;
    // trigger pop animation
    const hs = document.getElementById('handSign');
    hs.classList.remove('sign-update');
    void hs.offsetWidth; // reflow
    hs.classList.add('sign-update');
    // show/hide the register buttons
    const btnWrapper = document.querySelector('.handSignWrapper .btn-wrapper');
    if (btnWrapper) {
      btnWrapper.style.display = (_displayedSign && _displayedSign !== '—') ? 'flex' : 'none';
    }
    document.getElementById('fpsDisplay').textContent = (data.fps || 0).toFixed(1);
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

function toggleFullscreen() {
  const container = document.querySelector('.video-container');
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      alert(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}


let _currentWord = '';

function _renderWordBuffer() {
  const buf = document.getElementById('wordBuffer');
  if (buf) buf.textContent = _currentWord || '';
}

function _renderSentence() {
  const regDiv = document.querySelector('.registeredText');
  if (regDiv) regDiv.textContent = _getSentence();
}

function _getSentence() {
  const regDiv = document.querySelector('.registeredText');
  return regDiv ? regDiv.dataset.sentence || '' : '';
}

function _setSentence(val) {
  const regDiv = document.querySelector('.registeredText');
  if (regDiv) {
    regDiv.dataset.sentence = val;
    regDiv.textContent = val;
  }
}

// add current letter to the word buffer
function addLetterToWord() {
  if (!_displayedSign || _displayedSign === '—' || _displayedSign === 'None') return;
  _currentWord += _displayedSign;
  _renderWordBuffer();

  // reset the displayed sign so the next distinct letter can be captured
  _displayedSign = '—';
  const hs = document.getElementById('handSign');
  if (hs) hs.textContent = _displayedSign;
  const btnWrapper = document.querySelector('.handSignWrapper .btn-wrapper');
  if (btnWrapper) btnWrapper.style.display = 'none';

  // reset stability tracker so the same letter can be added again
  _lastRawSign = null;
  _signStableSince = 0;
}

// "Add Word" button
function commitWord() {
  const word = _currentWord.trim();
  if (!word) return;
  const current = _getSentence();
  _setSentence(current ? current + ' ' + word : word);
  _currentWord = '';
  _renderWordBuffer();
  const btn = document.getElementById('btnAddWord');
  if (btn) {
    btn.classList.add('word-committed');
    setTimeout(() => btn.classList.remove('word-committed'), 500);
  }
}

// Add a space
function addSpace() {
  commitWord();
}

// backspace
function backspace() {
  if (_currentWord.length > 0) {
    _currentWord = _currentWord.slice(0, -1);
    _renderWordBuffer();
  } else {
    const parts = _getSentence().trim().split(/\s+/);
    parts.pop();
    _setSentence(parts.join(' '));
  }
}

// Clear everything
function clearAll() {
  _currentWord = '';
  _setSentence('');
  _renderWordBuffer();
  _displayedSign = '—';
  const hs = document.getElementById('handSign');
  if (hs) hs.textContent = '—';
  const btnWrapper = document.querySelector('.handSignWrapper .btn-wrapper');
  if (btnWrapper) btnWrapper.style.display = 'none';
  _lastRawSign = null;
  _signStableSince = 0;
  const resDiv = document.getElementById('translationResult');
  const statusDiv = document.getElementById('translationStatus');
  if (resDiv) { resDiv.textContent = 'Translation will appear here…'; resDiv.classList.remove('has-result'); }
  if (statusDiv) { statusDiv.textContent = ''; statusDiv.className = 'translation-status'; }
}


// Start camera automatically on page load
document.addEventListener('DOMContentLoaded', async () => {
  const connected = await checkConnection();
  if (connected) {
    console.log('Backend connection established');
    startGestureRecognition();
  } else {
    console.warn('Backend not reachable. Please start the server.');
  }


  const btnT       = document.getElementById('btnT');
  const btnF       = document.getElementById('btnF');
  const btnAddWord = document.getElementById('btnAddWord');
  const btnClear   = document.getElementById('btnClear');
  const translateBtn = document.getElementById('translateBtn');

  if (btnT)       btnT.addEventListener('click', addLetterToWord);
  if (btnF)       btnF.addEventListener('click', backspace);
  if (btnAddWord) btnAddWord.addEventListener('click', commitWord);
  if (btnClear)   btnClear.addEventListener('click', clearAll);
  if (translateBtn) translateBtn.addEventListener('click', translateRegisteredText);
});



const overlay = document.getElementById("authOverlay");
const loginCard = document.getElementById("loginCard");
const signupCard = document.getElementById("signupCard");

function openAuth(signup = false) {
  overlay.classList.add("active");
  if (signup) {
    loginCard.classList.add("hidden");
    signupCard.classList.remove("hidden");
  } else {
    signupCard.classList.add("hidden");
    loginCard.classList.remove("hidden");
  }
}

function toggleAuth() {
  loginCard.classList.toggle("hidden");
  signupCard.classList.toggle("hidden");
  const forgot = document.getElementById('forgotCard');
  if (forgot) forgot.classList.add('hidden');
}


function closeAuth(e) {
  if (e.target === overlay) forceClose();
}

function forceClose() {
  overlay.classList.remove("active");
}


document.addEventListener("DOMContentLoaded", () => {
    const chars = document.querySelectorAll('.char-grid span');

    function randomPulse() {
        chars.forEach(c => c.classList.remove('active'));

        // Pick 3 random characters to highlight
        for (let i = 0; i < 3; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            chars[randomIndex].classList.add('active');
        }
    }

    setInterval(randomPulse, 800);
});


const paths = document.querySelectorAll("#logoSVG path");
let progress = { value: 0 };
paths.forEach(path => {
  const length = path.getTotalLength();
  path.style.strokeDasharray = length;
  path.style.strokeDashoffset = length;
});

const tl = gsap.timeline({ delay: 0.15 });

// Draw SVG typography
tl.to("#logoSVG path", {
  fill:"#ffffff",
  strokeDashoffset: 0,
  duration: 0.75,
  stagger: 0.1,
  ease: "power1.out"
});



gsap.to(progress, {
  value: 100,
  duration: 1.75,
  onUpdate: () => {
    gsap.set(".loading-line .progress", {
      scaleX: progress.value / 100
    });
  }
});


tl.to({}, { duration: 0.5 });

// Exit preloader
tl.to(".preloader", {
  yPercent: -100,
  duration: .85,
  ease: "power4.inOut",
  onComplete: () => {
    document.body.style.overflow = "auto";
  }
});



// Animated counters

        function animateCounter(elementId, start, end, duration) {
            const element = document.getElementById(elementId);
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const value = Math.floor(progress * (end - start) + start);


                element.textContent = value.toLocaleString();

                if (progress < 1) {
                    window.requestAnimationFrame(step);
                } else {

                    element.classList.add('pulse');
                    setTimeout(() => {
                        element.classList.remove('pulse');
                    }, 500);
                }
            };
            window.requestAnimationFrame(step);
        }

        // Animate progress bar
        function animateProgressBar() {
            const bar = document.getElementById('growthBar');
            bar.style.width = '78%';
        }

        // Initialize animations when page loads
        document.addEventListener('DOMContentLoaded', function() {

            setTimeout(() => {
                animateCounter('counter1', 0, 1247859, 2000);
                animateCounter('counter2', 0, 10432, 1800);
                animateCounter('counter3', 0, 98.7, 1500);

                setTimeout(animateProgressBar, 500);
            }, 3000);

        });

// login/signup submission handling

async function postJSON(url, data) {
  const resp = await fetch(`${API_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return resp.json();
}

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value;
    const password = form.password.value;
    try {
      const result = await postJSON('/api/login', { email, password });
      if (result.success) {
        alert('Welcome ' + (result.username || '') + '!');
        // server should have set a session cookie; refresh nav from server state
        if (typeof updateNavForAuth === 'function') updateNavForAuth();
        forceClose();
        // redirect to originally requested protected page if present, otherwise home
        const dest = getAndClearRedirect() || 'index.html';
        window.location.href = dest;
      } else {
        alert('Login failed: ' + (result.error || 'unknown'));
      }
    } catch (err) {
      console.error(err);
      alert('Unable to login');
    }
  });
}

if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form     = e.target;
    const name     = form.name.value.trim();
    const email    = form.email.value.trim();
    const password = form.password.value;

    // Basic client-side guard
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const result = await postJSON('/api/signup', { name, email, password });
      if (result.success && result.requires_verification) {
        // Transition to the email-verify card
        _svEmail = email.toLowerCase();
        document.getElementById('svSubText').textContent =
          `A 6-digit code was sent to ${email}`;
        svClearBoxes();
        fpShowMsg('svMsg', '', false);
        svStartTimer(600);
        signupCard.classList.add('hidden');
        document.getElementById('signupVerifyCard').classList.remove('hidden');
      } else if (result.success) {
        // Fallback: direct success (shouldn't happen with new backend)
        toggleAuth();
      } else {
        alert('Signup failed: ' + (result.error || 'unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Unable to reach server. Please try again.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// Signup email-verification

let _svEmail   = '';
let _svTimerId = null;

/* * Countdown timer shown inside the signup-verify card. */
function svStartTimer(seconds) {
  if (_svTimerId) clearInterval(_svTimerId);
  const display = document.getElementById('svCountdown');
  let remaining = seconds;
  _svTimerId = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(_svTimerId);
      fpShowMsg('svMsg', 'Code expired — please request a new one.', true);
      if (display) display.textContent = '0:00';
      return;
    }
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    if (display) display.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

/* * Wire up auto-advance, backspace-back, and paste for .sv-digit boxes. */
function svInitBoxes() {
  const boxes = [...document.querySelectorAll('.sv-digit')];
  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/, '');
      if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
    });
    box.addEventListener('keydown', ev => {
      if (ev.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
    });
    box.addEventListener('paste', ev => {
      ev.preventDefault();
      const digits = (ev.clipboardData || window.clipboardData)
        .getData('text').replace(/\D/g, '');
      digits.split('').forEach((ch, j) => { if (boxes[i + j]) boxes[i + j].value = ch; });
      boxes[Math.min(i + digits.length, boxes.length - 1)].focus();
    });
  });
}

function svGetOtp() {
  return [...document.querySelectorAll('.sv-digit')].map(b => b.value).join('');
}

function svClearBoxes() {
  document.querySelectorAll('.sv-digit').forEach(b => b.value = '');
  document.querySelectorAll('.sv-digit')[0]?.focus();
}

// Verify-OTP form submit
const signupVerifyForm = document.getElementById('signupVerifyForm');
if (signupVerifyForm) {
  signupVerifyForm.addEventListener('submit', async e => {
    e.preventDefault();
    const otp = svGetOtp();
    if (otp.length < 6) { fpShowMsg('svMsg', 'Please enter all 6 digits.'); return; }

    fpSetLoading('svBtn', 'svBtnSpinner', 'svBtnText', true);
    fpShowMsg('svMsg', '', false);
    try {
      const res = await postJSON('/api/verify-signup-otp', { email: _svEmail, otp });
      if (res.success) {
        if (_svTimerId) clearInterval(_svTimerId);
        fpShowMsg('svMsg', '✓ Email verified — account created! Redirecting…', false);
        setTimeout(() => {
          document.getElementById('signupVerifyCard').classList.add('hidden');
          // User is already logged-in server-side; redirect straight to app
          // server should have created the session; refresh nav from server state
          if (typeof updateNavForAuth === 'function') updateNavForAuth();
          forceClose();
          // redirect to originally requested protected page if present, otherwise home
          const destSv = getAndClearRedirect() || 'index.html';
          window.location.href = destSv;
        }, 1800);
      } else {
        fpShowMsg('svMsg', res.error || 'Incorrect code.');
        const boxes = document.getElementById('svOtpBoxes');
        if (boxes) {
          boxes.classList.add('shake');
          setTimeout(() => boxes.classList.remove('shake'), 500);
        }
      }
    } catch { fpShowMsg('svMsg', 'Unable to reach server.'); }
    finally  { fpSetLoading('svBtn', 'svBtnSpinner', 'svBtnText', false); }
  });
}

/* * Resend the signup verification code. */
async function svResendOtp() {
  if (!_svEmail) return;
  const link = document.getElementById('svResendLink');
  if (link) { link.style.opacity = '0.4'; link.style.pointerEvents = 'none'; }
  fpShowMsg('svMsg', '', false);
  try {
    const res = await postJSON('/api/resend-signup-otp', { email: _svEmail });
    if (res.success) {
      svClearBoxes();
      svStartTimer(600);
      fpShowMsg('svMsg', '✓ New code sent!', false);
    } else {
      fpShowMsg('svMsg', res.error || 'Unable to resend code.');
    }
  } catch { fpShowMsg('svMsg', 'Unable to reach server.'); }
  finally {
    // Re-enable resend link after 30 s
    setTimeout(() => {
      if (link) { link.style.opacity = ''; link.style.pointerEvents = ''; }
    }, 30_000);
  }
}

// Back to Sign Up link inside the verify card
function svBackToSignup() {
  if (_svTimerId) clearInterval(_svTimerId);
  document.getElementById('signupVerifyCard').classList.add('hidden');
  signupCard.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', svInitBoxes);

// Forgot-password

let _fpEmail      = '';
let _fpResetToken = '';
let _otpTimerId   = null;

function fpShowMsg(elId, text, isError = true) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text;
  el.className   = 'auth-msg ' + (isError ? 'auth-msg-error' : 'auth-msg-ok');
}

function fpSetLoading(btnId, spinnerId, textId, loading) {
  const btn     = document.getElementById(btnId);
  const spinner = document.getElementById(spinnerId);
  const label   = document.getElementById(textId);
  if (!btn) return;
  btn.disabled = loading;
  if (spinner) spinner.classList.toggle('hidden', !loading);
  if (label)   label.classList.toggle('hidden',   loading);
}

function showCard(id) {
  ['forgotCard','otpCard','resetCard','signupVerifyCard'].forEach(c => {
    const el = document.getElementById(c);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
}

// Password strength bar
function updateStrength(pw) {
  const bar = document.getElementById('strengthBar');
  if (!bar) return;
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const colors = ['', '#ff4d4d', '#ffa500', '#f0d000', '#1ef0ff'];
  bar.style.width      = (score * 25) + '%';
  bar.style.background = colors[score];
}

document.getElementById('newPassword')?.addEventListener('input', e => updateStrength(e.target.value));

// Show / hide password
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const hidden   = input.type === 'password';
  input.type     = hidden ? 'text' : 'password';
  btn.querySelector('i').className = hidden ? 'fas fa-eye-slash' : 'fas fa-eye';
}

// OTP countdown timer
function startOtpTimer(seconds) {
  if (_otpTimerId) clearInterval(_otpTimerId);
  const display = document.getElementById('otpCountdown');
  let remaining = seconds;
  _otpTimerId = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(_otpTimerId);
      fpShowMsg('otpMsg', 'OTP expired. Please request a new one.', true);
      if (display) display.textContent = '0:00';
      return;
    }
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    if (display) display.textContent = `${m}:${s.toString().padStart(2,'0')}`;
  }, 1000);
}

// OTP digit-box keyboard auto-advance
function initOtpBoxes() {
  const boxes = document.querySelectorAll('.otp-digit');
  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/, '');
      if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
    });
    box.addEventListener('paste', e => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'');
      paste.split('').forEach((ch, j) => { if (boxes[i + j]) boxes[i + j].value = ch; });
      boxes[Math.min(i + paste.length, boxes.length - 1)].focus();
    });
  });
}
initOtpBoxes();

function getOtpValue() {
  return [...document.querySelectorAll('.otp-digit')].map(b => b.value).join('');
}
function clearOtpBoxes() {
  document.querySelectorAll('.otp-digit').forEach(b => b.value = '');
  document.querySelectorAll('.otp-digit')[0]?.focus();
}

// Step 1 — Request OTP
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('fpEmail').value.trim().toLowerCase();
    if (!email) { fpShowMsg('forgotMsg', 'Please enter your email.'); return; }

    fpSetLoading('forgotBtn','forgotBtnSpinner','forgotBtnText', true);
    fpShowMsg('forgotMsg', '', false);
    try {
      const res = await postJSON('/api/forgot', { email });
      if (res.success) {
        _fpEmail = email;
        document.getElementById('otpSubText').textContent = `A 6-digit code was sent to ${email}`;
        clearOtpBoxes();
        fpShowMsg('otpMsg', '', false);
        showCard('otpCard');
        startOtpTimer(600);
      } else {
        fpShowMsg('forgotMsg', res.error || 'Something went wrong.');
      }
    } catch { fpShowMsg('forgotMsg', 'Unable to reach server.'); }
    finally  { fpSetLoading('forgotBtn','forgotBtnSpinner','forgotBtnText', false); }
  });
}

// Step 1b — Resend OTP
async function resendOtp() {
  if (!_fpEmail) return;
  const link = document.getElementById('resendLink');
  if (link) { link.style.opacity = '0.4'; link.style.pointerEvents = 'none'; }
  fpShowMsg('otpMsg', '', false);
  try {
    await postJSON('/api/forgot', { email: _fpEmail });
    clearOtpBoxes();
    startOtpTimer(600);
    fpShowMsg('otpMsg', '✓ New OTP sent!', false);
  } catch { fpShowMsg('otpMsg', 'Unable to resend.'); }
  finally {
    setTimeout(() => {
      if (link) { link.style.opacity = ''; link.style.pointerEvents = ''; }
    }, 30000);
  }
}

// Step 2 — Verify OTP
const otpForm = document.getElementById('otpForm');
if (otpForm) {
  otpForm.addEventListener('submit', async e => {
    e.preventDefault();
    const otp = getOtpValue();
    if (otp.length < 6) { fpShowMsg('otpMsg', 'Please enter all 6 digits.'); return; }

    fpSetLoading('otpBtn','otpBtnSpinner','otpBtnText', true);
    fpShowMsg('otpMsg', '', false);
    try {
      const res = await postJSON('/api/verify-otp', { email: _fpEmail, otp });
      if (res.success) {
        _fpResetToken = res.reset_token;
        if (_otpTimerId) clearInterval(_otpTimerId);
        fpShowMsg('resetMsg', '', false);
        document.getElementById('newPassword').value     = '';
        document.getElementById('confirmPassword').value = '';
        showCard('resetCard');
      } else {
        fpShowMsg('otpMsg', res.error || 'Incorrect OTP.');
        const boxes = document.getElementById('otpBoxes');
        if (boxes) { boxes.classList.add('shake'); setTimeout(() => boxes.classList.remove('shake'), 500); }
      }
    } catch { fpShowMsg('otpMsg', 'Unable to reach server.'); }
    finally  { fpSetLoading('otpBtn','otpBtnSpinner','otpBtnText', false); }
  });
}

// Step 3 — Reset Password
const resetForm = document.getElementById('resetForm');
if (resetForm) {
  resetForm.addEventListener('submit', async e => {
    e.preventDefault();
    const newPw  = document.getElementById('newPassword').value;
    const confPw = document.getElementById('confirmPassword').value;

    if (newPw.length < 8) { fpShowMsg('resetMsg', 'Password must be at least 8 characters.'); return; }
    if (newPw !== confPw)  { fpShowMsg('resetMsg', 'Passwords do not match.'); return; }

    fpSetLoading('resetBtn','resetBtnSpinner','resetBtnText', true);
    fpShowMsg('resetMsg', '', false);
    try {
      const res = await postJSON('/api/reset-password', {
        email: _fpEmail,
        reset_token: _fpResetToken,
        new_password: newPw,
      });
      if (res.success) {
        fpShowMsg('resetMsg', '✓ Password updated! Redirecting to login…', false);
        setTimeout(() => { _fpEmail = ''; _fpResetToken = ''; backToLogin(); }, 2200);
      } else {
        fpShowMsg('resetMsg', res.error || 'Reset failed. Please start over.');
      }
    } catch { fpShowMsg('resetMsg', 'Unable to reach server.'); }
    finally  { fpSetLoading('resetBtn','resetBtnSpinner','resetBtnText', false); }
  });
}

// Override showForgot / backToLogin
function showForgot() {
  loginCard.classList.add('hidden');
  signupCard.classList.add('hidden');
  const fm = document.getElementById('forgotMsg');
  if (fm) fm.textContent = '';
  showCard('forgotCard');
  overlay.classList.add('active');
}

function backToLogin() {
  ['forgotCard','otpCard','resetCard','signupVerifyCard'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  if (_otpTimerId) clearInterval(_otpTimerId);
  if (_svTimerId)  clearInterval(_svTimerId);
  loginCard.classList.remove('hidden');
  signupCard.classList.add('hidden');
}


const links = document.querySelectorAll(".footer-links a,.nav a");

links.forEach(link => {
  link.addEventListener("mousemove", e => {
    const rect = link.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    link.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;
  });

  link.addEventListener("mouseleave", () => {
    link.style.transform = "translate(0, 0)";
  });
});


function back(){
  window.location.href = 'index.html';
}

// Update navigation links when user is logged in
let _authCache = { ts: 0, logged: false, info: null };
async function fetchServerAuth() {
  // short cache to avoid calling /api/me on every click
  const now = Date.now();
  if (now - _authCache.ts < 30_000) return { logged: _authCache.logged, info: _authCache.info };
  try {
    const resp = await fetch(`${API_URL}/api/me`, { credentials: 'include' });
    if (!resp.ok) {
      _authCache = { ts: now, logged: false, info: null };
      return { logged: false, info: null };
    }
    const data = await resp.json();
    // Accept multiple possible shapes from different backends
    const logged = !!(data.authenticated || data.logged_in || data.user || data.username || data.email);
    _authCache = { ts: now, logged, info: data };
    return { logged, info: data };
  } catch (e) {
    console.warn('Could not fetch /api/me:', e);
    _authCache = { ts: now, logged: false, info: null };
    return { logged: false, info: null };
  }
}

// Update navigation links based on server session state
async function updateNavForAuth() {
  const { logged } = await fetchServerAuth();

  const loginEl = document.getElementById('navLogin');
  const signupEl = document.getElementById('navSignup');

  if (loginEl) {
    if (logged) {
      loginEl.textContent = 'Translate';
      loginEl.removeAttribute('onclick');
      loginEl.setAttribute('href', 'translate.html');
    } else {
      loginEl.textContent = 'Login';
      loginEl.setAttribute('onclick', 'openAuth()');
      loginEl.removeAttribute('href');
    }
  }

  if (signupEl) {
    if (logged) {
      signupEl.textContent = 'Learn';
      signupEl.removeAttribute('onclick');
      signupEl.setAttribute('href', 'learn.html');
    } else {
      signupEl.textContent = 'Sign Up';
      signupEl.setAttribute('onclick', 'openAuth(true)');
      signupEl.removeAttribute('href');
    }
  }
}

// Helper to get and clear a stored redirect target
function getAndClearRedirect() {
  try {
    const r = sessionStorage.getItem('insigniaRedirect');
    sessionStorage.removeItem('insigniaRedirect');
    return r;
  } catch (e) { return null; }
}

// Intercept clicks to protected pages and show login modal when not authenticated
document.addEventListener('click', async (e) => {
  const a = e.target.closest && e.target.closest('a');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  // protect learn.html and translate.html
  if (/\/(?:learn|translate)\.html$|^(?:learn|translate)\.html$/.test(href)) {
    const { logged } = await fetchServerAuth();
    if (!logged) {
      e.preventDefault();
      try { sessionStorage.setItem('insigniaRedirect', href || a.href); } catch (err) {}
      openAuth();
    }
  }
});

// On page load, if user directly opened a protected page, prompt login
document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname || window.location.href;
  if (/\/(?:learn|translate)\.html$|(?:learn|translate)\.html$/.test(path)) {
    const { logged } = await fetchServerAuth();
    if (!logged) {
      try { sessionStorage.setItem('insigniaRedirect', window.location.pathname + window.location.search + window.location.hash); } catch (err) {}
      openAuth();
    }
  }
});

document.addEventListener('DOMContentLoaded', updateNavForAuth);