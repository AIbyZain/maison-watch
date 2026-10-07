/* ==========================================================================
   Loader
   Hero videos are fetched as Blobs (seeking a local Blob is smooth; seeking a
   streamed MP4 is not). Downloads run in the background: the loader waits at
   most `loaderMaxWait` ms, then the site opens and the hero upgrades itself
   when the film arrives. Stalled or failed downloads resolve to null, and the
   hero simply stays on its posters.
   ========================================================================== */
import { gsap } from 'gsap';

/**
 * Start one background download.
 * @returns {{ progress: number, done: boolean, promise: Promise<string|null>, onProgress: (cb)=>void }}
 */
function download(src, { stallTimeout, totalTimeout }) {
  const listeners = new Set();
  const item = {
    progress: 0,
    done: false,
    onProgress: (cb) => listeners.add(cb),
  };
  const emit = (p) => {
    item.progress = p;
    listeners.forEach((cb) => cb(p));
  };

  const ctrl = new AbortController();
  let stallTimer = 0;
  const kick = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => ctrl.abort(new Error('stalled')), stallTimeout);
  };
  const totalTimer = setTimeout(() => ctrl.abort(new Error('timeout')), totalTimeout);

  item.promise = (async () => {
    try {
      kick();
      const res = await fetch(src, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      let blob;
      if (res.body && total) {
        const reader = res.body.getReader();
        const chunks = [];
        let loaded = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          kick();
          chunks.push(value);
          loaded += value.length;
          emit(Math.min(loaded / total, 0.999));
        }
        blob = new Blob(chunks, { type: res.headers.get('content-type') || 'video/mp4' });
      } else {
        blob = await res.blob();
      }
      emit(1);
      return URL.createObjectURL(blob);
    } catch (err) {
      console.warn(`[loader] ${src} not used (${err?.message || err}). Showing posters instead.`);
      emit(1);
      return null;
    } finally {
      clearTimeout(stallTimer);
      clearTimeout(totalTimer);
      item.done = true;
    }
  })();

  return item;
}

/** Start all hero downloads at once. */
export function startDownloads(sources, network) {
  return sources.map((src) => download(src, network));
}

/** Combined progress (0..1) of a set of downloads. */
export function totalProgress(downloads) {
  if (!downloads || !downloads.length) return 1;
  return downloads.reduce((a, d) => a + d.progress, 0) / downloads.length;
}

/**
 * Show the loader until the downloads finish or `maxWait` ms pass, whichever is first.
 * @param {{ downloads: ReturnType<typeof startDownloads> | null, maxWait: number }} opts
 */
export async function runLoader({ downloads, maxWait }) {
  const root = document.getElementById('loader');
  const fill = root.querySelector('.loader__fill');
  const pct = root.querySelector('[data-loader-pct]');
  const shown = { v: 0 };
  const render = () => {
    fill.style.transform = `scaleX(${shown.v})`;
    pct.textContent = String(Math.round(shown.v * 100));
  };
  const update = () =>
    gsap.to(shown, { v: totalProgress(downloads), duration: 0.6, ease: 'power3.out', overwrite: true, onUpdate: render });

  if (downloads && downloads.length) {
    downloads.forEach((d) => d.onProgress(update));
    await Promise.race([
      Promise.all(downloads.map((d) => d.promise)),
      new Promise((resolve) => setTimeout(resolve, maxWait)),
    ]);
  }

  // Finish the line (the film keeps downloading in the background if needed).
  await new Promise((resolve) => {
    gsap.to(shown, { v: 1, duration: 0.5, ease: 'power3.out', overwrite: true, onUpdate: render, onComplete: resolve });
  });
}

export function hideLoader() {
  const root = document.getElementById('loader');
  return new Promise((resolve) => {
    gsap
      .timeline({
        onComplete: () => {
          root.remove();
          resolve();
        },
      })
      .to(root.querySelector('.loader__inner'), { opacity: 0, y: -12, duration: 0.8, ease: 'power3.inOut' })
      .to(root, { opacity: 0, duration: 1.1, ease: 'power3.inOut' }, '-=0.3');
  });
}
