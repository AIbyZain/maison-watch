/* ==========================================================================
   Section 1 · Anatomy of Time
   Canvas image sequence on a pinned stage. No video decoding at all:
   scroll sets a target frame, one rAF loop eases toward it and draws a
   pre-decoded image only when the rounded frame index changes.
   ========================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { site } from '../data/site.js';

const cfg = site.hero;
const INTRO_END = 0.1; // in chapter units: captions appear after the intro title fades
const FIRST_PASS_STEP = 8;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* --------------------------------------------------------------------------
   Frame set
   -------------------------------------------------------------------------- */
/** Chosen once on load: mobile set on small screens, Data Saver or low-memory devices. */
export function pickFrameSet() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = !!(conn && conn.saveData);
  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  const mobile = window.innerWidth < 768 || saveData || lowMemory;
  return { key: mobile ? 'mobile' : 'desktop', ...cfg.frames[mobile ? 'mobile' : 'desktop'] };
}

/** 1-based frame number -> URL, e.g. /hero-frames/desktop/f_0001.webp */
export function frameUrl(set, n) {
  const { prefix, pad, ext } = cfg.frames;
  return `${set.path}${prefix}${String(n).padStart(pad, '0')}${ext}`;
}

/* --------------------------------------------------------------------------
   Progressive loader
   Order: frame 1, then every 8th (+ the last), then every 4th, every 2nd, rest.
   Each image is decoded (img.decode) before it counts as ready.
   -------------------------------------------------------------------------- */
export function createFrameLoader(set) {
  const count = set.count;
  const images = new Array(count).fill(null);
  const listeners = new Set();

  const queued = new Uint8Array(count);
  const order = [];
  const push = (k) => {
    if (k >= 0 && k < count && !queued[k]) {
      queued[k] = 1;
      order.push(k);
    }
  };
  push(0);
  for (let k = 0; k < count; k += FIRST_PASS_STEP) push(k);
  push(count - 1);
  const firstPassSize = order.length;
  for (const step of [4, 2, 1]) for (let k = 0; k < count; k += step) push(k);

  // First-pass progress, reported to the loader.
  const progressCbs = new Set();
  let firstSettled = 0;
  let resolveFirst;
  const firstPass = {
    progress: 0,
    onProgress: (cb) => progressCbs.add(cb),
    promise: new Promise((r) => (resolveFirst = r)),
  };

  async function load(k) {
    const img = new Image();
    img.decoding = 'async';
    img.src = frameUrl(set, k + 1);
    try {
      await img.decode();
      images[k] = img;
      listeners.forEach((cb) => cb(k));
    } catch (_) {
      /* missing or corrupt frame: the nearest loaded frame is drawn instead */
    }
  }

  let next = 0;
  async function worker() {
    while (next < order.length) {
      const i = next++;
      await load(order[i]);
      if (i < firstPassSize) {
        firstSettled += 1;
        firstPass.progress = firstSettled / firstPassSize;
        progressCbs.forEach((cb) => cb(firstPass.progress));
        if (firstSettled === firstPassSize) resolveFirst();
      }
    }
  }

  return {
    images,
    firstPass,
    onFrame: (cb) => listeners.add(cb),
    start() {
      const n = Math.max(1, cfg.frames.parallel || 6);
      for (let w = 0; w < n; w++) worker();
      return this;
    },
  };
}

/* --------------------------------------------------------------------------
   Markup
   -------------------------------------------------------------------------- */
function panelHTML(v, i) {
  return `
    <article class="hero__panel" data-index="${i}">
      <p class="label">${esc(v.eyebrow)}</p>
      <h2 class="serif">${esc(v.title)}</h2>
      <p>${esc(v.line)}</p>
    </article>`;
}

export function buildHero(section, { reduced, set }) {
  const { title, cue, chapters } = cfg;

  if (reduced) {
    // Static: frame 1 with the title, then the last frame with the four captions.
    section.classList.add('hero--static');
    section.innerHTML = `
      <div class="hero__stage">
        <img class="hero__still" src="${esc(frameUrl(set, 1))}" alt="The watch, fully assembled"
             width="${set.width}" height="${set.height}" />
        <div class="hero__vignette" aria-hidden="true"></div>
        <div class="hero__intro">
          <h1 class="hero__title serif">${esc(title)}</h1>
        </div>
      </div>
      <div class="hero__chapters">
        <div class="hero__chapter fade-in">
          <img src="${esc(frameUrl(set, set.end))}" alt="The movement, laid open" loading="lazy" decoding="async"
               width="${set.width}" height="${set.height}" />
          <div class="hero__chapter-list">
            ${chapters.map(panelHTML).join('')}
          </div>
        </div>
      </div>`;
    return;
  }

  section.innerHTML = `
    <div class="hero__stage">
      <canvas class="hero__canvas" aria-label="The watch, taken apart as you scroll" role="img"></canvas>
      <div class="hero__vignette" aria-hidden="true"></div>

      <div class="hero__intro">
        <h1 class="hero__title serif">${esc(title)}</h1>
        <div class="hero__cue" aria-hidden="true">
          <span class="label">${esc(cue)}</span>
          <span class="hero__cue-line"></span>
        </div>
      </div>

      <div class="hero__copy" aria-live="polite">
        ${chapters.map(panelHTML).join('')}
      </div>

      <div class="hero__rail">
        <span class="hero__rail-track"><span class="hero__rail-fill"></span></span>
        <div class="hero__dots">
          ${chapters
            .map(
              (v, i) =>
                `<button class="hero__dot" type="button" data-index="${i}" aria-label="Go to chapter ${i + 1}: ${esc(
                  v.title
                )}"></button>`
            )
            .join('')}
        </div>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   Behaviour
   -------------------------------------------------------------------------- */
/**
 * @param {HTMLElement} section
 * @param {{ reduced: boolean, set: ReturnType<typeof pickFrameSet>,
 *           frames: ReturnType<typeof createFrameLoader> | null, scrollTo: (y:number)=>void }} opts
 */
export function initHero(section, { reduced, set, frames, scrollTo }) {
  if (reduced) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.2 }
    );
    section.querySelectorAll('.fade-in').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }

  const stage = section.querySelector('.hero__stage');
  const canvas = section.querySelector('.hero__canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const panels = [...section.querySelectorAll('.hero__panel')];
  const dots = [...section.querySelectorAll('.hero__dot')];
  const intro = section.querySelector('.hero__intro');
  const fill = section.querySelector('.hero__rail-fill');
  const images = frames.images;
  const count = set.count;
  const lastIndex = count - 1;
  const starts = set.segments; // 1-based first frame of each chapter
  const m = starts.length;

  /* ---- Canvas sizing + cover math: only on resize, never during scroll ---- */
  const cover = { dx: 0, dy: 0, dw: 0, dh: 0 };
  let needsDraw = true;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    // Resizing resets the context state, so these are set again each time.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const s = Math.max(canvas.width / set.width, canvas.height / set.height);
    cover.dw = set.width * s;
    cover.dh = set.height * s;
    cover.dx = (canvas.width - cover.dw) / 2;
    cover.dy = (canvas.height - cover.dh) / 2;
    ctx.fillStyle = '#0b0a09';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    needsDraw = true;
  }
  resize();
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  };
  window.addEventListener('resize', onResize);

  /* ---- Drawing ---- */
  let target = 0; // frame index (0-based float) requested by scroll
  let current = 0; // eased frame index
  let drawn = -1; // index the loop last asked for
  let shown = -1; // index of the image actually on the canvas (may be a neighbour)

  function nearestLoaded(i) {
    if (images[i]) return i;
    for (let d = 1; d <= lastIndex; d++) {
      if (i - d >= 0 && images[i - d]) return i - d;
      if (i + d <= lastIndex && images[i + d]) return i + d;
    }
    return -1;
  }

  function draw(i) {
    const k = nearestLoaded(i);
    drawn = i;
    needsDraw = false;
    if (k < 0) return; // nothing loaded yet: keep the background colour
    ctx.drawImage(images[k], cover.dx, cover.dy, cover.dw, cover.dh);
    shown = k;
  }

  // A frame that arrives closer to the requested one than what is shown triggers a redraw.
  frames.onFrame((k) => {
    if (drawn < 0 || shown < 0 || Math.abs(k - drawn) < Math.abs(shown - drawn)) needsDraw = true;
  });

  const lerp = set.lerp;
  let raf = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    const diff = target - current;
    current = Math.abs(diff) < 0.01 ? target : current + diff * lerp;
    const idx = Math.round(current);
    if (idx !== drawn || needsDraw) draw(idx);
  }
  const startLoop = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const stopLoop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  /* ---- Captions, intro, dots: driven by scroll progress in onUpdate ---- */
  let chapterIdx = -2;
  let textIdx = -2;

  function setChapter(idx) {
    if (idx === chapterIdx) return;
    dots.forEach((d, j) => {
      d.classList.toggle('is-active', j === idx);
      d.classList.toggle('is-passed', j < idx);
      if (j === idx) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
    });
    chapterIdx = idx;
  }

  function setText(idx) {
    if (idx === textIdx) return;
    const prev = panels[textIdx];
    const next = panels[idx];
    // transform + opacity only
    if (prev) gsap.to(prev, { autoAlpha: 0, y: -24, duration: 0.6, ease: 'power3.in', overwrite: true });
    if (next) {
      gsap.set(next, { y: 0 });
      gsap.fromTo(
        next,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.8, delay: prev ? 0.3 : 0.1, ease: 'power2.out', overwrite: true }
      );
      gsap.fromTo(
        next.children,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.1, delay: prev ? 0.3 : 0.1, stagger: 0.08, ease: 'expo.out', overwrite: true }
      );
    }
    textIdx = idx;
  }

  /** Position in chapter units (e.g. 1.5 = halfway through chapter 2), from a 1-based frame. */
  function chapterPos(frame1) {
    let i = 0;
    while (i < m - 1 && frame1 >= starts[i + 1]) i++;
    const from = starts[i];
    const to = i < m - 1 ? starts[i + 1] : set.end;
    const local = to > from ? Math.min(Math.max((frame1 - from) / (to - from), 0), 1) : 0;
    return { i, pos: i + local };
  }

  function updateUI(progress) {
    fill.style.transform = `scaleY(${progress})`;
    const { i, pos } = chapterPos(1 + progress * lastIndex);
    setChapter(i);
    setText(pos < INTRO_END ? -1 : i);
    const introA = Math.min(Math.max(1 - pos / 0.08, 0), 1);
    intro.style.opacity = introA;
    intro.style.transform = `translate3d(0, ${(1 - introA) * -24}px, 0)`;
    intro.style.visibility = introA === 0 ? 'hidden' : 'visible';
  }

  const html = document.documentElement;
  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${(window.innerHeight * cfg.scrollLength) / 100}`,
    pin: true,
    scrub: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      target = self.progress * lastIndex;
      updateUI(self.progress);
    },
    // No blur above the canvas while it is pinned.
    onToggle: (self) => html.classList.toggle('hero-pinned', self.isActive),
  });

  target = st.progress * lastIndex;
  current = target;
  updateUI(st.progress);
  html.classList.toggle('hero-pinned', st.isActive || st.progress === 0);

  /* ---- Run the loop only while the hero is on screen ---- */
  const io = new IntersectionObserver((entries) => (entries[0].isIntersecting ? startLoop() : stopLoop()));
  io.observe(section);
  startLoop();

  dots.forEach((d) =>
    d.addEventListener('click', () => {
      const j = Number(d.dataset.index);
      const from = starts[j];
      const to = j < m - 1 ? starts[j + 1] : set.end;
      const frame1 = from + (to - from) * 0.2;
      scrollTo(st.start + (st.end - st.start) * ((frame1 - 1) / lastIndex));
    })
  );

  return () => {
    stopLoop();
    io.disconnect();
    window.removeEventListener('resize', onResize);
    st.kill();
  };
}
