/* ==========================================================================
   Loader
   Fetches every hero video as a Blob so seeking is local and smooth.
   Falls back to the plain file URL if a fetch fails.
   ========================================================================== */
import { gsap } from 'gsap';

async function fetchAsBlob(src, onProgress) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`);

  const total = Number(res.headers.get('content-length')) || 0;
  // Stream when possible so the progress bar moves during the download.
  if (!res.body || !total) {
    const blob = await res.blob();
    onProgress(1);
    return blob;
  }

  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(Math.min(loaded / total, 1));
  }
  onProgress(1);
  return new Blob(chunks, { type: res.headers.get('content-type') || 'video/mp4' });
}

/**
 * @param {string[]} sources  video paths
 * @param {{ skipVideos?: boolean }} opts
 * @returns {Promise<string[]>} playable URLs (blob: when possible)
 */
export async function runLoader(sources, { skipVideos = false } = {}) {
  const root = document.getElementById('loader');
  const fill = root.querySelector('.loader__fill');
  const pct = root.querySelector('[data-loader-pct]');

  const progress = new Array(sources.length).fill(0);
  const shown = { v: 0 };
  const render = () => {
    fill.style.transform = `scaleX(${shown.v})`;
    pct.textContent = String(Math.round(shown.v * 100));
  };
  const update = () => {
    const target = sources.length ? progress.reduce((a, b) => a + b, 0) / sources.length : 1;
    gsap.to(shown, { v: target, duration: 0.6, ease: 'power3.out', overwrite: true, onUpdate: render });
  };

  let urls;
  if (skipVideos) {
    urls = sources.slice();
    progress.fill(1);
    update();
  } else {
    urls = await Promise.all(
      sources.map((src, i) =>
        fetchAsBlob(src, (p) => {
          progress[i] = p;
          update();
        })
          .then((blob) => URL.createObjectURL(blob))
          .catch((err) => {
            console.warn('[loader] Falling back to streamed video:', err);
            progress[i] = 1;
            update();
            return src;
          })
      )
    );
  }

  // Let the bar finish its last stretch before leaving.
  await new Promise((resolve) => {
    gsap.to(shown, { v: 1, duration: 0.5, ease: 'power3.out', overwrite: true, onUpdate: render, onComplete: resolve });
  });
  return urls;
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
