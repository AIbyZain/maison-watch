/* ==========================================================================
   Section 2 · Set the Time
   A live watch: real dial image, three chroma-keyed hands, drag to set,
   city chips that glide the hands along the shortest path.
   ========================================================================== */
import { gsap } from 'gsap';
import { site, whatsappLink } from '../data/site.js';

const cfg = site.setTime;
const DAY = 86400;
const HALF_DAY = 43200;
const mod = (n, m) => ((n % m) + m) % m;
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* --------------------------------------------------------------------------
   Image helpers
   -------------------------------------------------------------------------- */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/**
 * Removes a pure-green background and returns a transparent image URL plus
 * the detected tip position of the hand (fraction of image width).
 * Transparent PNGs pass through untouched (they contain no green to key).
 */
async function keyHand(src, pivotY) {
  const img = await loadImage(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  let data;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch (err) {
    console.warn('[setTime] Canvas is tainted, using the image as-is:', err);
    return { url: src, w, h, tipX: null };
  }

  const d = data.data;
  const DEAD = 12; // tolerance for JPEG noise inside the hand itself
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    // 1. Background: clearly green.
    if (g > 120 && g > r * 1.4 && g > b * 1.4) {
      d[i + 3] = 0;
      continue;
    }

    // 2. Edges: a blend of hand and green. Estimate the green share,
    //    lower alpha accordingly and un-mix the green from the colour.
    const mx = Math.max(r, b);
    const spill = g - mx;
    if (spill <= 0) continue;
    if (spill <= DEAD) {
      d[i + 1] = mx; // tiny tint: just remove spill
      continue;
    }
    const f = Math.min((spill - DEAD) / (255 - DEAD), 0.98); // green fraction
    const keep = 1 - f;
    d[i] = Math.min(255, r / keep);
    d[i + 2] = Math.min(255, b / keep);
    d[i + 1] = Math.min(mx / keep, Math.max(0, (g - 255 * f) / keep));
    d[i + 3] = Math.round(a * keep);
  }
  ctx.putImageData(data, 0, 0);

  // Find the tip: right-most column with solid pixels near the pivot line.
  let tipX = null;
  const y0 = Math.max(0, Math.floor((pivotY - 0.12) * h));
  const y1 = Math.min(h - 1, Math.ceil((pivotY + 0.12) * h));
  outer: for (let x = w - 1; x >= 0; x--) {
    for (let y = y0; y <= y1; y++) {
      if (d[(y * w + x) * 4 + 3] > 150) {
        tipX = x / w;
        break outer;
      }
    }
  }

  const url = await new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')), 'image/png')
  );
  return { url, w, h, tipX };
}

/* --------------------------------------------------------------------------
   Time helpers
   -------------------------------------------------------------------------- */
const formatters = new Map();
function secondsInZone(zone) {
  const now = new Date();
  const ms = now.getMilliseconds() / 1000;
  if (!zone) return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + ms;
  if (!formatters.has(zone)) {
    formatters.set(
      zone,
      new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
    );
  }
  const parts = formatters.get(zone).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return mod(get('hour'), 24) * 3600 + get('minute') * 60 + get('second') + ms;
}

/* --------------------------------------------------------------------------
   Markup
   -------------------------------------------------------------------------- */
export function buildSetTime(section) {
  const enquire = whatsappLink(`Hello ${site.name}, I would like to enquire about the ${cfg.model}.`);
  section.innerHTML = `
    <div class="settime__grid">
      <div class="settime__head">
        <h2 class="serif" id="settime-title">${esc(cfg.heading)}</h2>
        <p>${esc(cfg.subline)}</p>
      </div>

      <div class="settime__watch">
        <div class="dialbox">
          <img class="dialbox__img" src="${esc(cfg.dial.src)}" alt="Sunray green dial with baton indexes and a date window at 6 o’clock" width="1376" height="768" decoding="async" />
          <img class="hand hand--hour" alt="" />
          <img class="hand hand--minute" alt="" />
          <img class="hand hand--second" alt="" />
          <div class="hand-hit hand-hit--hour" data-hand="hour" data-cursor="Drag" role="slider" tabindex="0"
               aria-label="Hour hand. Use arrow keys to move by one hour." aria-valuemin="0" aria-valuemax="1439"></div>
          <div class="hand-hit hand-hit--minute" data-hand="minute" data-cursor="Drag" role="slider" tabindex="0"
               aria-label="Minute hand. Use arrow keys to move by one minute." aria-valuemin="0" aria-valuemax="1439"></div>
        </div>

        <p class="readout" aria-hidden="true">
          <span class="readout__seg" data-h>00</span><span class="readout__sep">:</span><span class="readout__seg" data-m>00</span><span class="readout__sep">:</span><span class="readout__seg readout__seg--s" data-s>00</span>
        </p>
        <p class="readout__zone label" data-zone>Your local time</p>
        <p class="visually-hidden" aria-live="polite" data-live></p>

        <div class="chips" role="group" aria-label="Show the time in">
          ${cfg.cities
            .map(
              (c, i) =>
                `<button class="chip" type="button" data-city="${i}" aria-pressed="${i === 0 ? 'true' : 'false'}">${esc(
                  c.label
                )}</button>`
            )
            .join('')}
        </div>
      </div>

      <div class="settime__info">
        <p class="settime__model">${esc(cfg.model)}</p>
        <dl class="specs">
          ${cfg.specs
            .map((s) => `<div><dt class="label">${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`)
            .join('')}
        </dl>
        <a class="btn" href="${esc(enquire)}" target="_blank" rel="noopener">Enquire</a>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   Behaviour
   -------------------------------------------------------------------------- */
export async function initSetTime(section, { reduced }) {
  const box = section.querySelector('.dialbox');
  const dialImg = section.querySelector('.dialbox__img');
  const handEls = {
    hour: section.querySelector('.hand--hour'),
    minute: section.querySelector('.hand--minute'),
    second: section.querySelector('.hand--second'),
  };
  const hits = {
    hour: section.querySelector('.hand-hit--hour'),
    minute: section.querySelector('.hand-hit--minute'),
  };
  const out = {
    h: section.querySelector('[data-h]'),
    m: section.querySelector('[data-m]'),
    s: section.querySelector('[data-s]'),
    zone: section.querySelector('[data-zone]'),
    live: section.querySelector('[data-live]'),
  };
  const chips = [...section.querySelectorAll('.chip')];

  /* ---- 1. Crop the dial around its pivot (percentages: fully responsive) ---- */
  function placeDial() {
    const W = dialImg.naturalWidth || 1376;
    const H = dialImg.naturalHeight || 768;
    const side = cfg.dial.crop * H; // crop square side in image px
    const widthPct = (W / side) * 100;
    box.style.setProperty('--dial-w', `${widthPct}%`);
    box.style.setProperty('--dial-l', `${50 - cfg.dial.pivot.x * widthPct}%`);
    box.style.setProperty('--dial-t', `${50 - (cfg.dial.pivot.y * H * 100) / side}%`);
  }
  if (dialImg.complete && dialImg.naturalWidth) placeDial();
  else dialImg.addEventListener('load', placeDial, { once: true });

  /* ---- 2. Prepare hands: key, measure, size, pin on the pivot ---- */
  const fallbackTip = { hour: 0.887, minute: 0.923, second: 0.885 };
  const minuteLen = cfg.lengths.minute;
  const lengths = {
    minute: minuteLen,
    hour: minuteLen * cfg.lengths.hourRatio,
    second: cfg.lengths.second,
  };

  const keyed = await Promise.all(
    ['hour', 'minute', 'second'].map((name) =>
      keyHand(cfg.hands[name].src, cfg.hands[name].pivot.y).catch((err) => {
        console.warn('[setTime]', err);
        return { url: cfg.hands[name].src, w: 1376, h: 768, tipX: null };
      })
    )
  );

  ['hour', 'minute', 'second'].forEach((name, i) => {
    const { url, w, h, tipX } = keyed[i];
    const { pivot, filter } = cfg.hands[name];
    let reach = (tipX ?? fallbackTip[name]) - pivot.x; // pivot-to-tip, fraction of image width
    if (!(reach > 0.05)) reach = fallbackTip[name] - pivot.x;

    const widthFrac = lengths[name] / reach; // image width as fraction of box
    const heightFrac = widthFrac * (h / w); // box is square, so % of height == % of width
    const el = handEls[name];
    el.src = url;
    el.style.width = `${widthFrac * 100}%`;
    el.style.left = `${(0.5 - pivot.x * widthFrac) * 100}%`;
    el.style.top = `${(0.5 - pivot.y * heightFrac) * 100}%`;
    el.style.transformOrigin = `${pivot.x * 100}% ${pivot.y * 100}%`;
    if (filter && filter !== 'none') el.style.filter = filter;

    if (hits[name]) hits[name].style.width = `${lengths[name] * 100}%`;
  });
  box.classList.add('is-ready');

  /* ---- 3. Time state ---- */
  const bps = reduced ? 1 : cfg.beatsPerSecond;
  const state = {
    base: secondsInZone(null),
    baseAt: performance.now(),
    v: 0, // displayed time, seconds (unbounded; wrapped for display)
    corr: 0, // readout correction while a 12 h shortest-path glide runs
    mode: 'run', // 'run' | 'drag' | 'tween'
    frozenSec: 0,
  };
  state.v = state.base;
  let tween = null;

  const running = () => state.base + (performance.now() - state.baseAt) / 1000;
  const restartFrom = (v) => {
    state.base = v;
    state.baseAt = performance.now();
    state.v = v;
    state.mode = 'run';
  };

  let lastText = '';
  function draw() {
    if (state.mode === 'run') state.v = running();
    const v = state.v;
    const secs = state.mode === 'drag' ? state.frozenSec : mod(v, 60);
    const stepped = Math.floor(secs * bps + 1e-6) / bps;
    const minuteDeg = (mod(v, 3600) / 3600) * 360;
    const hourDeg = (mod(v, HALF_DAY) / HALF_DAY) * 360;
    const secondDeg = stepped * 6;

    handEls.hour.style.transform = `rotate(${hourDeg - 90}deg)`;
    handEls.minute.style.transform = `rotate(${minuteDeg - 90}deg)`;
    handEls.second.style.transform = `rotate(${secondDeg - 90}deg)`;
    hits.hour.style.transform = `rotate(${hourDeg - 90}deg)`;
    hits.minute.style.transform = `rotate(${minuteDeg - 90}deg)`;

    const shown = mod(v + state.corr, DAY);
    const hh = Math.floor(shown / 3600);
    const mm = Math.floor(mod(shown, 3600) / 60);
    const ss = Math.floor(secs);
    const text = `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
    if (text !== lastText) {
      out.h.textContent = pad(hh);
      out.m.textContent = pad(mm);
      out.s.textContent = pad(ss);
      const valueText = `${pad(hh)}:${pad(mm)}`;
      const valueNow = String(hh * 60 + mm);
      for (const hit of Object.values(hits)) {
        hit.setAttribute('aria-valuenow', valueNow);
        hit.setAttribute('aria-valuetext', valueText);
      }
      lastText = text;
    }
  }

  /* ---- Throttled screen-reader announcements ---- */
  let lastAnnounce = 0;
  let announceTimer = 0;
  function announce() {
    const now = performance.now();
    const wait = Math.max(0, 1000 - (now - lastAnnounce));
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      lastAnnounce = performance.now();
      const shown = mod(state.v + state.corr, DAY);
      out.live.textContent = `Time shown: ${pad(Math.floor(shown / 3600))}:${pad(
        Math.floor(mod(shown, 3600) / 60)
      )}. ${out.zone.textContent}.`;
    }, wait);
  }

  function setZoneLabel(text, chipIndex) {
    out.zone.textContent = text;
    chips.forEach((c, i) => c.setAttribute('aria-pressed', String(i === chipIndex)));
  }

  /* ---- 4. Cities: glide along the shortest path on the 12 h dial ---- */
  function goToCity(i) {
    const city = cfg.cities[i];
    if (tween) tween.kill();
    const duration = reduced ? 0 : 1.4;
    const from = state.mode === 'run' ? running() : state.v;
    const target = secondsInZone(city.zone) + duration; // land exactly on real time
    let delta = mod(target - from, HALF_DAY);
    if (delta > HALF_DAY / 2) delta -= HALF_DAY;
    const end = from + delta;

    setZoneLabel(city.zone ? `${city.label} time` : 'Your local time', i);

    if (!duration) {
      state.corr = 0;
      restartFrom(target);
      announce();
      return;
    }
    state.corr = target - end; // multiple of 12 h: keeps AM/PM right on the readout
    state.mode = 'tween';
    state.v = from;
    tween = gsap.to(state, {
      v: end,
      duration,
      ease: 'power3.inOut',
      onComplete: () => {
        state.corr = 0;
        restartFrom(target);
        tween = null;
        announce();
      },
    });
  }
  chips.forEach((chip, i) => chip.addEventListener('click', () => goToCity(i)));

  /* ---- 5. Dragging (mouse + touch via pointer events) ---- */
  const SECONDS_PER_DEG = { minute: 3600 / 360, hour: HALF_DAY / 360 };
  let drag = null;

  const pointerAngle = (e) => {
    const r = box.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    return { deg: (Math.atan2(x, -y) * 180) / Math.PI, dist: Math.hypot(x, y) / r.width };
  };
  const angleDiff = (a, b) => {
    let d = mod(a - b, 360);
    if (d > 180) d -= 360;
    return d;
  };

  function beginManual() {
    if (tween) {
      tween.kill();
      tween = null;
    }
    if (state.mode === 'run') state.v = running();
    state.v += state.corr;
    state.corr = 0;
    // Keep the already-paused second hand if a drag starts during the settle.
    if (state.mode !== 'drag') state.frozenSec = Math.floor(mod(state.v, 60) * bps) / bps;
    state.mode = 'drag';
    setZoneLabel('Set by hand', -1);
  }

  function endManual() {
    // Settle the minute hand onto the minute that matches the paused second hand.
    const target = Math.round((state.v - state.frozenSec) / 60) * 60 + state.frozenSec;
    const settle = reduced ? 0 : 0.6;
    tween = gsap.to(state, {
      v: target,
      duration: settle,
      ease: 'power3.out',
      onComplete: () => {
        tween = null;
        restartFrom(target);
        announce();
      },
    });
  }

  box.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const { deg, dist } = pointerAngle(e);
    let hand = e.target.dataset?.hand;
    // On touch screens only the hands themselves grab, so the page still scrolls over the dial.
    if (!hand && e.pointerType === 'touch') return;
    if (!hand) {
      if (dist < 0.06 || dist > 0.5) return;
      const minuteDeg = (mod(state.mode === 'run' ? running() : state.v, 3600) / 3600) * 360;
      const hourDeg = (mod(state.mode === 'run' ? running() : state.v, HALF_DAY) / HALF_DAY) * 360;
      hand =
        Math.abs(angleDiff(deg, minuteDeg)) <= Math.abs(angleDiff(deg, hourDeg)) || dist > lengths.hour + 0.04
          ? 'minute'
          : 'hour';
    }
    e.preventDefault();
    beginManual();
    drag = { hand, last: deg, id: e.pointerId };
    box.setPointerCapture(e.pointerId);
    box.classList.add('is-dragging');
    document.dispatchEvent(new CustomEvent('cursor:drag', { detail: true }));
  });

  box.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { deg } = pointerAngle(e);
    state.v += angleDiff(deg, drag.last) * SECONDS_PER_DEG[drag.hand];
    drag.last = deg;
  });

  const stopDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    box.classList.remove('is-dragging');
    document.dispatchEvent(new CustomEvent('cursor:drag', { detail: false }));
    if (box.hasPointerCapture(e.pointerId)) box.releasePointerCapture(e.pointerId);
    endManual();
  };
  box.addEventListener('pointerup', stopDrag);
  box.addEventListener('pointercancel', stopDrag);

  /* ---- Keyboard on the hand sliders ---- */
  Object.entries(hits).forEach(([name, hit]) => {
    hit.addEventListener('keydown', (e) => {
      const step = name === 'minute' ? 60 : 3600;
      let delta = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = step;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -step;
      else if (e.key === 'PageUp') delta = step * (name === 'minute' ? 10 : 3);
      else if (e.key === 'PageDown') delta = -step * (name === 'minute' ? 10 : 3);
      if (!delta) return;
      e.preventDefault();
      if (tween) {
        tween.kill();
        tween = null;
      }
      const base = (state.mode === 'run' ? running() : state.v) + state.corr;
      state.corr = 0;
      restartFrom(base + delta);
      setZoneLabel('Set by hand', -1);
      announce();
    });
  });

  /* ---- 6. Run only while visible ---- */
  let ticking = false;
  const start = () => {
    if (!ticking) gsap.ticker.add(draw);
    ticking = true;
  };
  const stop = () => {
    if (ticking) gsap.ticker.remove(draw);
    ticking = false;
  };
  draw();
  const io = new IntersectionObserver((entries) => (entries[0].isIntersecting ? start() : stop()), {
    rootMargin: '200px 0px',
  });
  io.observe(section);

  return () => {
    stop();
    io.disconnect();
  };
}
