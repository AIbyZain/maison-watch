/* ==========================================================================
   Section 1 · Anatomy of Time
   Pinned stage; vertical scroll scrubs the video(s) in site.hero.videos.
   Captions come from site.hero.chapters and are spread over the whole scroll,
   independent of how many videos there are.
   ========================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { site } from '../data/site.js';

const EPS = 0.04; // stay a hair before the very end of a clip (avoids a blank last frame)
const INTRO_END = 0.1; // in chapter units: captions appear after the intro title fades

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function panelHTML(v, i) {
  return `
    <article class="hero__panel" data-index="${i}">
      <p class="label">${esc(v.eyebrow)}</p>
      <h2 class="serif">${esc(v.title)}</h2>
      <p>${esc(v.line)}</p>
    </article>`;
}

/** Build markup. Called before the loader finishes so the poster sits behind it. */
export function buildHero(section, { reduced }) {
  const { title, cue, videos, chapters } = site.hero;
  const first = videos[0];

  if (reduced) {
    section.classList.add('hero--static');
    section.innerHTML = `
      <div class="hero__stage">
        <img class="hero__poster" src="${esc(first.poster)}" alt="" width="2576" height="1438" />
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

  section.innerHTML = `
    <div class="hero__stage">
      <div class="hero__media">
        ${videos
          .map(
            (v, i) => `
          <video class="hero__video" data-index="${i}" muted playsinline preload="auto"
                 disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1"></video>`
          )
          .join('')}
        <img class="hero__poster" src="${esc(first.poster)}" alt="The watch, fully assembled" width="2576" height="1438" />
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
    </div>`;
}

/**
 * @param {HTMLElement} section
 * @param {{ urls: string[], reduced: boolean, scrollTo: (y:number)=>void }} opts
 */
export function initHero(section, { urls, reduced, scrollTo }) {
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

  const n = site.hero.videos.length; // video segments
  const m = site.hero.chapters.length; // caption chapters
  const videos = [...section.querySelectorAll('.hero__video')];
  const panels = [...section.querySelectorAll('.hero__panel')];
  const dots = [...section.querySelectorAll('.hero__dot')];
  const intro = section.querySelector('.hero__intro');
  const fill = section.querySelector('.hero__rail-fill');
  const lerp = site.hero.lerp;

  const durations = new Array(n).fill(5);
  const lastSet = new Array(n).fill(0);
  const pending = new Array(n).fill(false);

  // Attach sources (blob URLs from the loader). Never autoplay.
  videos.forEach((v, i) => {
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.src = urls[i];
    v.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(v.duration) && v.duration > 0) durations[i] = v.duration;
      if (pending[i]) {
        pending[i] = false;
        // A parked "end" position was requested before the real duration was known.
        if (i < activeIdx) lastSet[i] = Math.max(durations[i] - EPS, 0);
        v.currentTime = lastSet[i];
      }
    });
    v.addEventListener(
      'loadeddata',
      () => {
        // Prime decoding on iOS/Safari without letting playback run.
        const p = v.play();
        if (p && p.then) {
          p.then(() => {
            v.pause();
            v.currentTime = lastSet[i];
          }).catch(() => {});
        }
        if (i === 0) section.classList.add('is-ready');
      },
      { once: true }
    );
    v.load();
  });

  let target = 0; // overall pinned progress, 0..1
  let smooth = 0;
  let activeIdx = -1;
  let chapterIdx = -2;
  let textIdx = -2;

  // While scrubbing we wait for the previous seek to land before issuing the next one,
  // otherwise fast scrolling keeps cancelling seeks and the frame freezes.
  // `force` is used for parking clips on their boundary frames.
  function seek(i, t, force = false) {
    const v = videos[i];
    if (!v) return;
    if (v.readyState < 1) {
      lastSet[i] = t;
      pending[i] = true; // applied on loadedmetadata
      return;
    }
    if (Math.abs(lastSet[i] - t) < 0.001 && !force) return;
    if (v.seeking && !force) return;
    lastSet[i] = t;
    v.currentTime = t;
  }

  function setActive(idx) {
    // Park every other clip on its boundary frame so a switch is seamless in both directions.
    videos.forEach((v, j) => {
      if (j < idx) seek(j, Math.max(durations[j] - EPS, 0), true);
      else if (j > idx) seek(j, 0, true);
      v.classList.toggle('is-active', j === idx);
    });
    activeIdx = idx;
  }

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
    if (prev) {
      gsap.to(prev, { autoAlpha: 0, y: -24, duration: 0.7, ease: 'power3.in', overwrite: true });
    }
    if (next) {
      gsap.set(next, { y: 0 });
      gsap.fromTo(
        next,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.9, delay: prev ? 0.35 : 0.1, ease: 'power2.out', overwrite: true }
      );
      gsap.fromTo(
        next.children,
        { y: 34, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.3, delay: prev ? 0.35 : 0.1, stagger: 0.09, ease: 'expo.out', overwrite: true }
      );
    }
    textIdx = idx;
  }

  function render(progress) {
    // Video: split the scroll equally between clips.
    const p = progress * n;
    const idx = Math.min(Math.max(Math.floor(p), 0), n - 1);
    const local = Math.min(Math.max(p - idx, 0), 1);
    if (idx !== activeIdx) setActive(idx);
    const d = durations[idx];
    seek(idx, Math.min(Math.max(local * d, 0), Math.max(d - EPS, 0)));

    // Captions: split the scroll equally between chapters.
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
    end: () => `+=${(window.innerHeight * site.hero.scrollLength) / 100}`,
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      target = self.progress;
      fill.style.transform = `scaleY(${self.progress})`;
    },
  });

  target = st.progress;
  smooth = target;
  render(smooth);

  const tick = () => {
    const diff = target - smooth;
    if (Math.abs(diff) < 0.00005) smooth = target;
    else smooth += diff * lerp;
    render(smooth);
  };
  gsap.ticker.add(tick);

  dots.forEach((d) =>
    d.addEventListener('click', () => {
      const j = Number(d.dataset.index);
      scrollTo(st.start + (st.end - st.start) * ((j + 0.2) / m));
    })
  );

  return () => {
    gsap.ticker.remove(tick);
    st.kill();
  };
}
