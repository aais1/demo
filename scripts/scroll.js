/* ============================================================
   StarCharge — cinematic scroll choreography
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ---------- Inject SVG partials ---------- */
async function injectSVG(url, target) {
  try {
    const r = await fetch(url);
    const txt = await r.text();
    target.innerHTML = txt;
  } catch (e) {
    console.warn('Could not load', url, e);
  }
}

(async () => {
  await Promise.all([
    injectSVG('partials/taurus.svg', $('#taurusVisual')),
    injectSVG('partials/ebox.svg', $('#eboxVisual')),
  ]);

  // start the engine
  init();
})();

/* ---------- engine ---------- */
function init() {
  const nav = $('#nav');
  const scrollFill = $('#scrollFill');

  const darkSections = $$('.section-dark, .product-section');

  // Reveal observer
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        $$('.fill-reveal, .fill-reveal-dark, .word-reveal', en.target).forEach(el => el.classList.add('in'));
      }
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -10% 0px' });

  $$('.reveal').forEach(el => revealObs.observe(el));
  $$('.fill-reveal, .fill-reveal-dark, .word-reveal').forEach(el => revealObs.observe(el));

  // Product showcases — explode state via scroll progress OR pill click
  setupProductShowcase('#taurus', '#taurusVisual', '#taurusControls', taurusExplode);
  setupProductShowcase('#ebox', '#eboxVisual', '#eboxControls', eboxExplode);

  /* ---------- master raf loop ---------- */
  let lastY = -1;
  function tick() {
    const y = window.scrollY;
    if (y !== lastY) {
      lastY = y;
      updateNav(y);
      updateScrollFill(y);
    }
    requestAnimationFrame(tick);
  }

  function updateNav(y) {
    let isDark = false;
    const navMid = 36;
    for (const s of darkSections) {
      const r = s.getBoundingClientRect();
      if (r.top <= navMid + 20 && r.bottom >= navMid + 20) {
        isDark = true; break;
      }
    }
    nav.classList.toggle('dark', isDark);
  }

  function updateScrollFill(y) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = clamp(y / max, 0, 1);
    scrollFill.style.setProperty('--p', (p * 100).toFixed(2) + '%');
  }

  tick();
}

/* ---------- product showcase logic ---------- */
function setupProductShowcase(sectionSel, visualSel, controlsSel, explodeFn) {
  const section = $(sectionSel);
  const visual = $(visualSel);
  const controls = $(controlsSel);
  if (!section || !visual || !controls) return;

  let mode = 'assembled'; // 'assembled' | 'exploded'
  let scrollProgress = 0;
  let userOverride = false;
  let overrideUntil = 0;

  // controls
  controls.addEventListener('click', e => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    $$('.pill', controls).forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.state;
    userOverride = true;
    overrideUntil = performance.now() + 4000; // user mode wins for a few seconds
    apply();
  });

  function progressInSection() {
    const r = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    const inside = clamp(-r.top, 0, total);
    return clamp(inside / total, 0, 1);
  }

  function apply() {
    let target;
    if (userOverride && performance.now() < overrideUntil) {
      target = mode === 'exploded' ? 1 : 0;
    } else {
      // remap: explode begins at 0.4, complete by 0.9
      const p = scrollProgress;
      const e = clamp((p - 0.35) / 0.5, 0, 1);
      target = easeInOutCubic(e);
      // also sync pill highlight
      const newMode = target > 0.5 ? 'exploded' : 'assembled';
      if (newMode !== mode) {
        mode = newMode;
        $$('.pill', controls).forEach(p => p.classList.toggle('active', p.dataset.state === mode));
      }
    }
    explodeFn(visual, target);
  }

  function loop() {
    scrollProgress = progressInSection();
    apply();
    requestAnimationFrame(loop);
  }
  loop();
}

/* ---------- explode keyframes ---------- */
function taurusExplode(host, t) {
  // t: 0 = assembled, 1 = fully exploded
  const svg = host.querySelector('svg.taurus-svg');
  if (!svg) return;
  // parts shift outward along axes
  svg.style.setProperty('--ex-cap',     (-120 * t) + 'px');
  svg.style.setProperty('--ex-display', (-60 * t) + 'px');
  svg.style.setProperty('--ex-column',  (0) + 'px');
  svg.style.setProperty('--ex-cable',   (60 * t) + 'px');
  svg.style.setProperty('--ex-base',    (90 * t) + 'px');
  svg.style.setProperty('--callout-op', t.toFixed(3));
  // gentle rotation always
  const rot = (performance.now() / 80) % 360;
  svg.style.transform = `perspective(2000px) rotateY(${Math.sin(performance.now()/4000) * 6}deg)`;
}

function eboxExplode(host, t) {
  const svg = host.querySelector('svg.ebox-svg');
  if (!svg) return;
  svg.style.setProperty('--ex-top',     (-60 * t) + 'px');
  svg.style.setProperty('--ex-cells-op', t.toFixed(3));
  svg.style.setProperty('--ex-cells',   (-30 * (1 - t)) + 'px'); // sweep into view from above
  svg.style.setProperty('--callout-op', t.toFixed(3));
  svg.style.transform = `perspective(2000px) rotateY(${Math.sin(performance.now()/5000) * 5}deg)`;
}
