/* ==========================================================================
   Section 1 · Anatomy of Time
   Pinned stage; vertical scroll scrubs the footage in site.hero.videos.
   Captions come from site.hero.chapters, spread over the whole scroll.

   The stage upgrades itself in three steps, so it works on any connection:
     1. posters  chapter images crossfade with scroll (instant, works offline)
     2. video    the downloaded film is scrubbed by seeking
     3. frames   the film's frames, cached as images in the browser, are drawn
                 to a canvas: instant scrubbing on every device
   ========================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { site } from '../data/site.js';

const cfg = site.hero;
const EPS = 0.04; // stay a hair before the very end of a clip
const INTRO_END = 0.1; // in chapter units: captions appear after the intro title fades
const MIN_COVERAGE = 0.8; // share of frames that must be captured to use the frame cache
const BITMAP_CACHE = 14; // decoded frames kept in memory

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const once = (el, type) => new Promise((resolve) => el.addEventListener(type, resolve, { once: true }));
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));

function panelHTML(v, i) {
  return `
    <article class="hero__panel" data-index="${i}">
      <p class="label">${esc(v.eyebrow)}</p>
      <h2 class="serif">${esc(v.title)}</h2>
      <p>${esc(v.line)}</p>
    </article>`;
}

/* --------------------------------------------------------------------------
   Markup
   -------------------------------------------------------------------------- */
export function buildHero(section, { reduced }) {
  const { title, cue, videos, chapters } = cfg;

  if (reduced) {
    section.classList.add('hero--static');
    section.innerHTML = `
      <div class="hero__stage">
        <img class="hero__poster is-active" src="${esc(chapters[0].poster)}" alt="" width="2576" height="1438" />
        <div class="hero__vignette" aria-hidden="true"></div>
        <div class="hero__intro">
          <h1 class="hero__title serif">${esc(title)}</h1>
        </div>
      </div>
      <div class="hero__chapters">
        ${chapters
          .map(
            (v, i) => `
          <div class="hero__chapter fade-in">
            <img src="${esc(v.poster)}" alt="${esc(v.title)}" loading="lazy" decoding="async" />
            ${panelHTML(v, i)}
          </div>`
          )
          .join('')}
      </div>`;
    return;
  }

  section.classList.add('mode-posters');
  section.innerHTML = `
    <div class="hero__stage">
      <div class="hero__media">
        <div class="hero__posters">
          ${chapters
            .map(
              (c, i) =>
                `<img class="hero__poster${i === 0 ? ' is-active' : ''}" src="${esc(c.poster)}" alt="${
                  i === 0 ? 'The watch, fully assembled' : ''
                }" width="2576" height="1438" decoding="async" fetchpriority="${i === 0 ? 'high' : 'low'}" />`
            )
            .join('')}
        </div>
        ${videos
          .map(
            (v, i) => `
          <video class="hero__video" data-index="${i}" muted playsinline preload="auto"
                 disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1"></video>`
          )
          .join('')}
        <canvas class="hero__canvas" aria-hidden="true"></canvas>
      </div>
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

      <div class="hero__status" aria-hidden="true">
        <span class="label" data-status>Loading film</span>
        <span class="hero__status-bar"><span></span></span>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   Frame cache: play the downloaded film once, off screen, and keep each
   frame as a compressed JPEG Blob. Frames are decoded on demand, a few at a time.
   -------------------------------------------------------------------------- */
async function captureFrames(url, { fps, maxWidth, quality }) {
  const vid = document.createElement('video');
  if (!('requestVideoFrameCallback' in vid)) return null;
  vid.muted = true;
  vid.defaultMuted = true;
  vid.playsInline = true;
  vid.preload = 'auto';
  vid.setAttribute('aria-hidden', 'true');
  // Kept in the DOM (some browsers skip frame callbacks for detached videos) but invisible.
  Object.assign(vid.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '2px',
    height: '2px',
    opacity: '0.001',
    pointerEvents: 'none',
    zIndex: '-1',
  });
  document.body.appendChild(vid);
  vid.src = url;

  try {
    if (vid.readyState < 2) await once(vid, 'loadeddata');
    const count = Math.max(1, Math.round(vid.duration * fps));
    const scale = Math.min(1, maxWidth / vid.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vid.videoWidth * scale);
    canvas.height = Math.round(vid.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    const frames = new Array(count).fill(null);
    const pending = [];

    const grab = (k) => {
      if (k < 0 || k >= count || frames[k]) return;
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      // toBlob copies the bitmap synchronously, so the canvas can be reused at once.
      pending.push(
        new Promise((r) =>
          canvas.toBlob(
            (b) => {
              frames[k] = b;
              r();
            },
            'image/jpeg',
            quality
          )
        )
      );
    };

    await new Promise((resolve) => {
      const onFrame = (_now, meta) => {
        grab(Math.round(meta.mediaTime * fps));
        if (!vid.ended) vid.requestVideoFrameCallback(onFrame);
      };
      vid.requestVideoFrameCallback(onFrame);
      vid.addEventListener('ended', resolve, { once: true });
      vid.addEventListener('error', resolve, { once: true });
      const p = vid.play();
      if (p && p.catch) p.catch(resolve);
    });
    // The final frame is not always reported before `ended`.
    if (!frames[count - 1]) grab(count - 1);
    await Promise.all(pending);

    const captured = frames.filter(Boolean).length;
    if (captured / count < MIN_COVERAGE) return null;
    // Fill any dropped frames with their nearest neighbour.
    for (let k = 0; k < count; k++) {
      if (frames[k]) continue;
      for (let d = 1; d < count; d++) {
        const f = frames[k - d] || frames[k + d];
        if (f) {
          frames[k] = f;
          break;
        }
      }
    }
    return { frames, width: canvas.width, height: canvas.height };
  } catch (err) {
    console.warn('[hero] Frame cache skipped:', err);
    return null;
  } finally {
    vid.pause();
    vid.removeAttribute('src');
    vid.load();
    vid.remove();
  }
}

/* --------------------------------------------------------------------------
   Behaviour
   -------------------------------------------------------------------------- */
/**
 * @param {HTMLElement} section
 * @param {{ downloads: Array<{promise:Promise<string|null>, progress:number, done:boolean, onProgress:Function}>|null,
 *           reduced: boolean, scrollTo: (y:number)=>void }} opts
 */
export function initHero(section, { downloads, reduced, scrollTo }) {
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

  const n = cfg.videos.length; // video segments
  const m = cfg.chapters.length; // caption chapters
  const videos = [...section.querySelectorAll('.hero__video')];
  const posters = [...section.querySelectorAll('.hero__poster')];
  const panels = [...section.querySelectorAll('.hero__panel')];
  const dots = [...section.querySelectorAll('.hero__dot')];
  const intro = section.querySelector('.hero__intro');
  const fill = section.querySelector('.hero__rail-fill');
  const canvas = section.querySelector('.hero__canvas');
  const ctx = canvas.getContext('2d');
  const status = section.querySelector('.hero__status');
  const statusText = status.querySelector('[data-status]');
  const statusBar = status.querySelector('.hero__status-bar span');

  let mode = 'posters'; // 'posters' | 'video' | 'frames'
  const setMode = (next) => {
    section.classList.remove(`mode-${mode}`);
    mode = next;
    section.classList.add(`mode-${mode}`);
  };

  const durations = new Array(n).fill(5);
  const lastSet = new Array(n).fill(0);
  let urls = new Array(n).fill(null);
  let frameSets = null; // [{frames, width, height}] per video, once cached

  let target = 0; // overall pinned progress, 0..1
  let smooth = 0;
  let activeIdx = -1;
  let chapterIdx = -2;
  let textIdx = -2;

  /* ---- Download status (only visible while posters stand in) ---- */
  const showStatus = (on) => status.classList.toggle('is-visible', on);
  if (downloads && downloads.length) {
    const update = () => {
      const p = downloads.reduce((a, d) => a + d.progress, 0) / downloads.length;
      statusBar.style.transform = `scaleX(${p})`;
      statusText.textContent = `Loading film ${Math.round(p * 100)}%`;
    };
    downloads.forEach((d) => d.onProgress(update));
    update();
    if (downloads.some((d) => !d.done)) showStatus(true);
  }

  /* ---- Video seeking ---- */
  function seek(i, t, force = false) {
    const v = videos[i];
    if (!v || v.readyState < 1) {
      lastSet[i] = t;
      return;
    }
    if (Math.abs(lastSet[i] - t) < 0.001 && !force) return;
    // Wait for the previous seek to land, or fast scrolling freezes the frame.
    if (v.seeking && !force) return;
    lastSet[i] = t;
    v.currentTime = t;
  }

  function setActiveVideo(idx) {
    // Park other clips on their boundary frame so switches are seamless both ways.
    videos.forEach((v, j) => {
      if (j < idx) seek(j, Math.max(durations[j] - EPS, 0), true);
      else if (j > idx) seek(j, 0, true);
      v.classList.toggle('is-active', j === idx);
    });
    activeIdx = idx;
  }

  /* ---- Canvas drawing for the frame cache ---- */
  const bitmaps = new Map(); // key -> ImageBitmap (small LRU)
  let wantKey = '';
  let drawnKey = '';
  let decoding = false;

  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    drawnKey = '';
    if (mode === 'frames' && wantKey) requestFrame(wantKey);
  }

  function drawCover(bmp) {
    const cw = canvas.width;
    const ch = canvas.height;
    const s = Math.max(cw / bmp.width, ch / bmp.height);
    const w = bmp.width * s;
    const h = bmp.height * s;
    ctx.drawImage(bmp, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  async function decode(key) {
    const [i, k] = key.split(':').map(Number);
    const blob = frameSets?.[i]?.frames[k];
    if (!blob) return;
    decoding = true;
    try {
      const bmp = await createImageBitmap(blob);
      bitmaps.set(key, bmp);
      while (bitmaps.size > BITMAP_CACHE) {
        const oldest = bitmaps.keys().next().value;
        bitmaps.get(oldest).close?.();
        bitmaps.delete(oldest);
      }
      // Draw what just arrived (the closest available), then chase the latest request.
      if (bitmaps.has(key)) {
        drawCover(bmp);
        drawnKey = key;
      }
    } catch (err) {
      console.warn('[hero] frame decode failed', err);
    } finally {
      decoding = false;
    }
    if (wantKey && wantKey !== drawnKey) requestFrame(wantKey);
  }

  function requestFrame(key) {
    wantKey = key;
    if (key === drawnKey) return;
    const bmp = bitmaps.get(key);
    if (bmp) {
      bitmaps.delete(key); // refresh LRU order
      bitmaps.set(key, bmp);
      drawCover(bmp);
      drawnKey = key;
      return;
    }
    if (!decoding) decode(key);
  }

  const frameKey = (p) => {
    const idx = Math.min(Math.max(Math.floor(p), 0), n - 1);
    const count = frameSets[idx].frames.length;
    const k = Math.min(count - 1, Math.max(0, Math.floor((p - idx) * count)));
    return `${idx}:${k}`;
  };

  /* ---- Captions and posters ---- */
  function setChapter(idx) {
    if (idx === chapterIdx) return;
    dots.forEach((d, j) => {
      d.classList.toggle('is-active', j === idx);
      d.classList.toggle('is-passed', j < idx);
      if (j === idx) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
    });
    posters.forEach((p, j) => p.classList.toggle('is-active', j === idx));
    chapterIdx = idx;
  }

  function setText(idx) {
    if (idx === textIdx) return;
    const prev = panels[textIdx];
    const next = panels[idx];
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

  /* ---- Render one state of the scroll ---- */
  function render(progress) {
    // Footage: the scroll is split equally between clips.
    const p = progress * n;
    if (mode === 'frames') {
      requestFrame(frameKey(p));
    } else if (mode === 'video') {
      const idx = Math.min(Math.max(Math.floor(p), 0), n - 1);
      const local = Math.min(Math.max(p - idx, 0), 1);
      const d = durations[idx];
      if (idx !== activeIdx) setActiveVideo(idx);
      seek(idx, Math.min(Math.max(local * d, 0), Math.max(d - EPS, 0)));
    }

    // Captions: the scroll is split equally between chapters.
    const c = progress * m;
    const cIdx = Math.min(Math.max(Math.floor(c), 0), m - 1);
    setChapter(cIdx);
    setText(c < INTRO_END ? -1 : cIdx);
    const introA = Math.min(Math.max(1 - c / 0.08, 0), 1);
    intro.style.opacity = introA;
    intro.style.transform = `translateY(${(1 - introA) * -24}px)`;
    intro.style.visibility = introA === 0 ? 'hidden' : 'visible';
  }

  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${(window.innerHeight * cfg.scrollLength) / 100}`,
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      target = self.progress;
      fill.style.transform = `scaleY(${self.progress})`;
    },
    onRefresh: () => {
      if (mode === 'frames') sizeCanvas();
    },
  });

  target = st.progress;
  smooth = target;
  render(smooth);

  let settled = true;
  const tick = () => {
    const diff = target - smooth;
    if (Math.abs(diff) < 0.00005) {
      // Idle: nothing to redraw. In video mode keep checking, because a seek
      // skipped while the previous one was in flight must still land.
      if (settled && mode !== 'video') return;
      smooth = target;
      settled = true;
    } else {
      smooth += diff * cfg.lerp;
      settled = false;
    }
    render(smooth);
  };
  gsap.ticker.add(tick);

  dots.forEach((d) =>
    d.addEventListener('click', () => {
      const j = Number(d.dataset.index);
      scrollTo(st.start + (st.end - st.start) * ((j + 0.2) / m));
    })
  );

  /* ---- Upgrade path: posters -> video -> frames ---- */
  async function attachVideos() {
    if (!downloads || !downloads.length) return; // data saver / 2G: posters only
    urls = await Promise.all(downloads.map((dl) => dl.promise));
    showStatus(false);
    if (urls.some((u) => !u)) return; // a download failed or stalled: stay on posters

    await Promise.all(
      videos.map(async (v, i) => {
        v.muted = true;
        v.defaultMuted = true;
        v.playsInline = true;
        v.src = urls[i];
        v.load();
        if (v.readyState < 2) await once(v, 'loadeddata');
        if (Number.isFinite(v.duration) && v.duration > 0) durations[i] = v.duration;
        // Prime decoding (needed on iOS Safari) without letting playback run.
        try {
          await v.play();
        } catch (_) {
          /* autoplay refused: seeking still works */
        }
        v.pause();
      })
    );

    // Land every clip on the right frame before revealing it, so nothing jumps.
    const p = smooth * n;
    const idx = Math.min(Math.max(Math.floor(p), 0), n - 1);
    videos.forEach((v, j) => {
      const end = Math.max(durations[j] - EPS, 0);
      const t = j < idx ? end : j > idx ? 0 : Math.min(Math.max((p - idx) * durations[j], 0), end);
      lastSet[j] = t;
      v.currentTime = t;
      v.classList.toggle('is-active', j === idx);
    });
    await Promise.all(videos.map((v) => (v.seeking ? once(v, 'seeked') : null)));
    activeIdx = idx;
    setMode('video');
    settled = false;

    if (cfg.frameCache?.enabled) idle(() => buildFrameCache().catch((e) => console.warn('[hero]', e)));
  }

  async function buildFrameCache() {
    const small = window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxWidth = Math.min(
      small ? cfg.frameCache.mobileMaxWidth : cfg.frameCache.maxWidth,
      Math.max(640, Math.round(window.innerWidth * dpr))
    );
    const sets = [];
    for (const url of urls) {
      const set = await captureFrames(url, { fps: cfg.fps, maxWidth, quality: cfg.frameCache.quality });
      if (!set) return; // unsupported or too many dropped frames: keep video seeking
      sets.push(set);
    }
    frameSets = sets;
    sizeCanvas();

    // Paint the current frame first, then swap: the switch is invisible.
    const key = frameKey(smooth * n);
    const [i, k] = key.split(':').map(Number);
    const bmp = await createImageBitmap(frameSets[i].frames[k]);
    bitmaps.set(key, bmp);
    drawCover(bmp);
    drawnKey = key;
    wantKey = key;
    setMode('frames');
    settled = false;
    videos.forEach((v) => v.pause());
  }

  attachVideos().catch((err) => console.warn('[hero] video upgrade skipped:', err));

  return () => {
    gsap.ticker.remove(tick);
    st.kill();
    bitmaps.forEach((b) => b.close?.());
    bitmaps.clear();
  };
}
