// DATA
const ALPHABET = [
  { letter:'A', desc:'Closed fist with thumb resting on the side, not tucked inside.', tip:'Thumb position distinguishes A from S and E.', diff:'easy' },
  { letter:'B', desc:'Four fingers extended and together, thumb folded across palm. Palm faces forward.', tip:'Keep fingers tightly together — spacing changes the letter.', diff:'easy' },
  { letter:'C', desc:'Hand curved into a "C" shape, fingers together, thumb parallel to fingers.', tip:'The curve mimics the letter\'s shape — use consistent spacing.', diff:'easy' },
  { letter:'D', desc:'Index finger extended upward, other three fingers curved touching thumb, forming a circle.', tip:'The circle at the bottom is the key feature.', diff:'easy' },
  { letter:'E', desc:'All four fingers bent at the knuckles, tips touching the thumb. Resembles a claw.', tip:'E looks like a tight, flattened fist with all fingertips forward.', diff:'medium' },
  { letter:'F', desc:'Index finger and thumb form a circle. Other three fingers extended and slightly spread.', tip:'F and 9 share a similar shape — the difference is context.', diff:'easy' },
  { letter:'G', desc:'Index finger and thumb extended to pointing to the side. Other fingers closed.', tip:'The hand points horizontally — like you\'re indicating a direction.', diff:'easy' },
  { letter:'H', desc:'Index and middle finger extended together and pointing sideways. Other fingers closed.', tip:'H and U look similar — H points to the side, U points up.', diff:'easy' },
  { letter:'I', desc:'Only the pinky finger extended upward, all other fingers closed into a fist.', tip:'Think of it as the smallest letter using the smallest finger.', diff:'easy' },
  { letter:'J', desc:'Start with pinky and third finger extended upward with index and middle finger bent by thumb.', tip:'J requires more practice as it is not intuitive.', diff:'medium' },
  { letter:'K', desc:'Index finger pointing up, middle finger angle outward at 45°,thumb between them.', tip:'K and P use the same handshape-orientation changes the letter.', diff:'medium' },
  { letter:'L', desc:'Index finger pointing up, thumb extended out horizontally forming an "L" shape.', tip:'The most intuitive letter — mirrors the written letter L exactly.', diff:'easy' },
  { letter:'M', desc:'Three fingers (index, middle, ring) folded over the thumb, pinky tucked in.', tip:'Count the knuckles visible — three for M, two for N.', diff:'medium' },
  { letter:'N', desc:'Index and middle fingers folded over thumb. Ring and pinky tucked.', tip:'N and M differ only by one finger over the thumb.', diff:'medium' },
  { letter:'O', desc:'All fingers and thumb curved and touching at the tips, forming a circle/oval.', tip:'O is round and open — if it looks like a flat C, adjust.', diff:'easy' },
  { letter:'P', desc:'Same handshape as K but rotated downward so the index finger points toward the floor.', tip:'P = K pointing down. Useful mnemonic: P "falls" on the page.', diff:'hard' },
  { letter:'Q', desc:'G handshape (index and thumb parallel) but rotated downward, pointing at the floor.', tip:'Q = G pointing down. Both have the same base handshape.', diff:'medium' },
  { letter:'R', desc:'Index and middle fingers crossed and extended upward. Other fingers closed.', tip:'R looks like crossing your fingers for luck — which it does!', diff:'easy' },
  { letter:'S', desc:'Closed fist with thumb wrapped over the front of the fingers.', tip:'S differs from A in thumb placement — over fingers vs. side.', diff:'easy' },
  { letter:'T', desc:'Thumb tucked between index and middle finger, forming a fist.', tip:'T looks like a thumb peeking through two fingers.', diff:'medium' },
  { letter:'U', desc:'Index and middle fingers extended upward together. Other fingers and thumb closed.', tip:'U points up while H points sideways — same handshape, different orientation.', diff:'easy' },
  { letter:'V', desc:'Index and middle fingers extended in a "V" for victory shape, fingers spread apart.', tip:'V is spread while U is together — that\'s the key difference.', diff:'easy' },
  { letter:'W', desc:'Index, middle, and ring fingers extended and spread apart. Thumb holds down pinky.', tip:'Count three spread fingers — like a wide W written by hand.', diff:'easy' },
  { letter:'X', desc:'Index finger hooked or bent into a hook shape. Other fingers closed.', tip:'X looks like a beckoning hook — or the letter X\'s crossed shape in miniature.', diff:'hard' },
  { letter:'Y', desc:'Thumb and pinky extended outward, all other fingers closed.', tip:'Y is the "hang loose" or "shaka" gesture — very recognizable.', diff:'easy' },
  { letter:'Z', desc:'Index finger extended, traces a "Z" shape in the air.', tip:'Z is the second movement letter. Draw a bold Z with a relaxed wrist.', diff:'medium' },
];

const NUMBERS = [
  { num:'0', desc:'Closed fist with thumb resting on the side similar to letter S but used for zero.', tip:'Zero often looks like the sign for O so context matters.', diff:'easy' },
  { num:'1', desc:'Index finger extended upward. Other fingers closed.', tip:'Like the letter D without the circle.', diff:'easy' },
  { num:'2', desc:'Index and middle fingers extended and separated.', tip:'Similar to letter V but with fingers together.', diff:'easy' },
  { num:'3', desc:'Thumb, index, and middle fingers extended. Other fingers closed.', tip:'Different from W by thumb position.', diff:'easy' },
  { num:'4', desc:'Four fingers extended and together, thumb tucked against palm.', tip:'Looks like letter B without the badge.', diff:'easy' },
  { num:'5', desc:'All five fingers extended and spread.', tip:'Use the whole hand to show five.', diff:'easy' },
  { num:'6', desc:'Thumb touches pinky, other fingers extended.', tip:'Like a backwards W handshape.', diff:'medium' },
  { num:'7', desc:'Thumb touches ring finger; remaining fingers extended.', tip:'Thumb position distinguishes 7 from 6 and 8.', diff:'medium' },
  { num:'8', desc:'Thumb touches middle finger; others extended.', tip:'Orientation changes meaning with 7 and 9.', diff:'medium' },
  { num:'9', desc:'Thumb touches index finger; other fingers extended.', tip:'This is the same as letter F in orientation only.', diff:'hard' },
];

const PHRASES = [
  {
    emoji: '👋',
    phrase: 'Hello',
    steps: [
      'Open hand, fingers together, palm facing outward',
      'Raise hand to forehead level, fingers near temple',
      'Move hand outward and slightly away — like a salute'
    ],
    tag: 'Greeting'
  },
  {
    emoji: '🙏',
    phrase: 'Thank You',
    steps: [
      'Flat hand, palm facing up near chin',
      'Move hand forward and slightly downward',
      'Keep the motion smooth and deliberate'
    ],
    tag: 'Courtesy'
  },
  {
    emoji: '❓',
    phrase: 'How are you?',
    steps: [
      'Bent "V" shape with both hands, knuckles facing you',
      'Twist both hands simultaneously outward (wrists rotate)',
      'Raise brows slightly — facial expression marks the question'
    ],
    tag: 'Question'
  },
  {
    emoji: '😊',
    phrase: 'I\'m Fine',
    steps: [
      'Touch the chest with a flat hand for "I"',
      'Tap the thumb of a "5" hand to your chest twice for "FINE"',
      'Smile — facial expression reinforces the meaning'
    ],
    tag: 'Response'
  },
  {
    emoji: '💬',
    phrase: 'Please',
    steps: [
      'Open hand, palm flat against your chest',
      'Make a circular motion on your chest (clockwise)',
      'Maintain a polite, earnest facial expression'
    ],
    tag: 'Courtesy'
  },
  {
    emoji: '😔',
    phrase: 'Sorry',
    steps: [
      'Close hand into a fist, hold against chest',
      'Move fist in a circular motion on the chest',
      'Downcast eyes or furrowed brows reinforce meaning'
    ],
    tag: 'Courtesy'
  },
  {
    emoji: '👍',
    phrase: 'Yes',
    steps: [
      'Close hand into a fist, thumb position neutral',
      'Nod the fist up and down from the wrist',
      'Nodding head simultaneously strengthens the sign'
    ],
    tag: 'Response'
  },
  {
    emoji: '👎',
    phrase: 'No',
    steps: [
      'Extend index and middle fingers together',
      'Bring them down quickly to touch the thumb',
      'Head shake simultaneously for natural expression'
    ],
    tag: 'Response'
  },
];

// BUILD ALPHABET CARDS
const grid = document.getElementById('alphaGrid');
const numGrid = document.getElementById('numGrid');
const noResultsAlpha = document.getElementById('noResults');
const noResultsNum = document.getElementById('noResultsNum');
let viewedLetters = new Set();

// build alphabet cards
ALPHABET.forEach((item, i) => {
  const card = document.createElement('div');
  card.className = 'sign-card';
  card.dataset.letter = item.letter;
  card.dataset.diff = item.diff;
  card.id = `card-${item.letter}`;
  card.style.transitionDelay = `${(i % 13) * 0.04}s`;

  card.innerHTML = `
    <div class="sign-card-inner">
      <div class="sign-face">
        <div class="card-letter">
          ${item.letter}
          <span class="card-letter-sub">${item.letter.toLowerCase()}</span>
        </div>
        <div class="card-footer">
          <span class="card-badge badge-${item.diff}">${item.diff}</span>
          <span class="card-hint-icon"><i class="fas fa-rotate"></i></span>
        </div>
      </div>
      <div class="sign-back">
        <p class="back-desc">${item.desc}</p>
        <p class="back-keyword">💡 ${item.tip}</p>
      </div>
    </div>`;

  card.addEventListener('mouseenter', () => {
    viewedLetters.add(item.letter);
    updateProgress();
  });

  // open sign modal on click
  card.addEventListener('click', () => {
    showSignModal(item.letter);
  });

  grid.appendChild(card);
});

// append alpha no-results after alphabet grid
grid.appendChild(noResultsAlpha);

// build number cards
NUMBERS.forEach((item, i) => {
  const card = document.createElement('div');
  card.className = 'sign-card';
  card.dataset.letter = item.num;
  card.dataset.diff = item.diff;
  card.id = `card-${item.num}`;
  card.style.transitionDelay = `${((ALPHABET.length + i) % 13) * 0.04}s`;

  card.innerHTML = `
    <div class="sign-card-inner">
      <div class="sign-face">
        <div class="card-letter">
          ${item.num}
        </div>
        <div class="card-footer">
          <span class="card-badge badge-${item.diff}">${item.diff}</span>
          <span class="card-hint-icon"><i class="fas fa-rotate"></i></span>
        </div>
      </div>
      <div class="sign-back">
        <p class="back-desc">${item.desc}</p>
        <p class="back-keyword">💡 ${item.tip}</p>
      </div>
    </div>`;

  card.addEventListener('mouseenter', () => {
    viewedLetters.add(item.num);
    updateProgress();
  });
  card.addEventListener('click', () => {
    showSignModal(item.num);
  });

  numGrid.appendChild(card);
});
// append number no-results
numGrid.appendChild(noResultsNum);

// BUILD ALPHA QUICK-JUMP
const alphaNav = document.getElementById('alphaNav');
ALPHABET.forEach(item => {
  const btn = document.createElement('button');
  btn.className = 'alpha-btn';
  btn.textContent = item.letter;
  btn.addEventListener('click', () => {
    const card = document.getElementById(`card-${item.letter}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.querySelector('.sign-card-inner').style.transform = 'rotateY(180deg)';
      setTimeout(() => card.querySelector('.sign-card-inner').style.transform = '', 2200);
    }
    document.querySelectorAll('.alpha-btn').forEach(b => b.style.background = '');
    btn.style.background = 'rgba(0,240,255,0.2)';
    setTimeout(() => btn.style.background = '', 1500);
  });
  alphaNav.appendChild(btn);
});

// BUILD NUMBER QUICK-JUMP
const numberNav = document.getElementById('numberNav');
NUMBERS.forEach(item => {
  const btn = document.createElement('button');
  btn.className = 'alpha-btn';
  btn.textContent = item.num;
  btn.addEventListener('click', () => {
    const card = document.getElementById(`card-${item.num}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.querySelector('.sign-card-inner').style.transform = 'rotateY(180deg)';
      setTimeout(() => card.querySelector('.sign-card-inner').style.transform = '', 2200);
    }
    document.querySelectorAll('.alpha-btn').forEach(b => b.style.background = '');
    btn.style.background = 'rgba(0,240,255,0.2)';
    setTimeout(() => btn.style.background = '', 1500);
  });
  numberNav.appendChild(btn);
});

// BUILD PHRASES
const phrasesGrid = document.getElementById('phrasesGrid');
PHRASES.forEach((p, i) => {
  const card = document.createElement('div');
  card.className = 'phrase-card';
  card.style.transitionDelay = `${(i % 4) * 0.08}s`;
  const stepsHtml = p.steps.map((s, n) =>
    `<li data-n="${n+1}">${s}</li>`).join('');
  card.innerHTML = `
    <div class="phrase-emoji">${p.emoji}</div>
    <h3 class="phrase-text">${p.phrase}</h3>
    <ol class="phrase-steps">${stepsHtml}</ol>
    <span class="phrase-tag">${p.tag}</span>`;
  phrasesGrid.appendChild(card);
});

// PROGRESS
function updateProgress() {
  const n = viewedLetters.size;
  const total = ALPHABET.length + NUMBERS.length;
  const pct = Math.round((n / total) * 100);
  document.getElementById('progPct').textContent = pct + '%';
  document.getElementById('progFill').style.width = pct + '%';
  document.getElementById('progViewed').textContent = n;
}

// SEARCH & FILTER
let activeFilter = 'all';

function applyFilters() {
  const q = document.getElementById('searchInput').value.trim().toUpperCase();
  let visibleAlpha = 0;
  let visibleNum = 0;

  document.querySelectorAll('#alphaGrid .sign-card').forEach(card => {
    const letter = card.dataset.letter;
    const diff   = card.dataset.diff;
    const matchQ = !q || letter.includes(q);
    const matchF = activeFilter === 'all' || diff === activeFilter;
    const show = matchQ && matchF;
    card.style.display = show ? '' : 'none';
    if (show) visibleAlpha++;
  });

  document.querySelectorAll('#numGrid .sign-card').forEach(card => {
    const letter = card.dataset.letter;
    const diff   = card.dataset.diff;
    const matchQ = !q || letter.includes(q);
    const matchF = activeFilter === 'all' || diff === activeFilter;
    const show = matchQ && matchF;
    card.style.display = show ? '' : 'none';
    if (show) visibleNum++;
  });

  noResultsAlpha.style.display = visibleAlpha === 0 ? 'block' : 'none';
  noResultsNum.style.display = visibleNum === 0 ? 'block' : 'none';
}

document.getElementById('searchInput').addEventListener('input', applyFilters);

document.querySelectorAll('.tag[data-filter]').forEach(tag => {
  tag.addEventListener('click', () => {
    activeFilter = tag.dataset.filter;
    document.querySelectorAll('.tag[data-filter]').forEach(t => t.classList.remove('active'));
    tag.classList.add('active');
    applyFilters();
  });
});

document.getElementById('resetFilter').addEventListener('click', () => {
  activeFilter = 'all';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.tag[data-filter]').forEach(t => t.classList.remove('active'));
  document.querySelector('.tag[data-filter="all"]').classList.add('active');
  applyFilters();
});

// SIDEBAR NAVIGATION
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.target);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Update active nav item on scroll
const sections = ['alphabet-section', 'phrases-section', 'tips-section', 'anatomy-section', 'quiz-section'];
const sectionEls = sections.map(id => document.getElementById(id));
window.addEventListener('scroll', () => {
  const mid = window.scrollY + window.innerHeight / 2;
  sectionEls.forEach((el, i) => {
    if (!el) return;
    const top = el.offsetTop, bot = top + el.offsetHeight;
    if (mid >= top && mid < bot) {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.cat-btn')[i]?.classList.add('active');
    }
  });
}, { passive: true });

// SCROLL REVEAL
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.08 });

document.querySelectorAll('.sign-card, .phrase-card, .tip-card, .anatomy-card, .dyk-strip, .quiz-cta').forEach(el => {
  revealObserver.observe(el);
});

// SCROLL PROGRESS BAR
window.addEventListener('scroll', () => {
  const p = window.scrollY / (document.body.scrollHeight - window.innerHeight);
  document.getElementById('scrollBar').style.width = (p * 100) + '%';
}, { passive: true });

// NAV SCROLL STATE
window.addEventListener('scroll', () => {
  document.getElementById('mainNav').classList.toggle('nav-scrolled', window.scrollY > 60);
}, { passive: true });

// SIGN IMAGE MODAL

// create modal elements
const signModal = document.createElement('div');
signModal.id = 'signModal';
signModal.className = 'sign-modal';
signModal.innerHTML = `
  <div class="sign-modal-backdrop"></div>
  <div class="sign-modal-content">
    <button class="sign-modal-close">✕</button>
    <img id="signModalImg" src="" alt="" />
  </div>
`;
document.body.appendChild(signModal);

const signModalImg = signModal.querySelector('#signModalImg');
const signModalClose = signModal.querySelector('.sign-modal-close');

function showSignModal(letter) {
  // image path convention; adjust as needed
  signModalImg.src = `/res/signs/${letter}.png`;
  signModalImg.alt = `Sign for ${letter}`;
  signModal.classList.add('visible');
}

function hideSignModal() {
  signModal.classList.remove('visible');
}

signModalClose.addEventListener('click', hideSignModal);
signModal.querySelector('.sign-modal-backdrop').addEventListener('click', hideSignModal);

// CURSOR
(function() {
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';
  });
  (function loop() {
    rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    requestAnimationFrame(loop);
  })();
  document.addEventListener('mousedown', () => { dot.classList.add('cl'); ring.classList.add('cl'); });
  document.addEventListener('mouseup',   () => { dot.classList.remove('cl'); ring.classList.remove('cl'); });
  document.querySelectorAll('a, button, .sign-card, .phrase-card, .cat-btn, .alpha-btn, .tag, .hs-item').forEach(el => {
    el.addEventListener('mouseenter', () => { dot.classList.add('hov'); ring.classList.add('hov'); });
    el.addEventListener('mouseleave', () => { dot.classList.remove('hov'); ring.classList.remove('hov'); });
  });
})();

// GSAP PRELOADER
(function() {
  const paths = document.querySelectorAll('#logoSVG path');
  paths.forEach(p => {
    const l = p.getTotalLength();
    p.style.strokeDasharray = l;
    p.style.strokeDashoffset = l;
  });
  const tl = gsap.timeline({ delay: 0.15 });
  const prog = { v: 0 };
  tl.to('#logoSVG path', { fill:'#fff', strokeDashoffset: 0, duration: 0.75, stagger: 0.1, ease:'power1.out' });
  gsap.to(prog, { v: 100, duration: 1.75, onUpdate: () => gsap.set('.loading-line .progress', { scaleX: prog.v / 100 }) });
  tl.to({}, { duration: 0.4 });
  tl.to('.preloader', {
    yPercent: -100, duration: .85, ease: 'power4.inOut',
    onComplete: () => {
      document.body.style.overflow = 'auto';
      // Animate nav in after preloader
      setTimeout(() => document.getElementById('mainNav').classList.add('nav-visible'), 100);
      // Animate progress bar
      setTimeout(() => updateProgress(), 400);
    }
  });
})();
