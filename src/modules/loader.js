/* ==========================================================================
   Loader
   Shows progress for the hero's FIRST pass of frames only (frame 1 + every
   8th frame). The remaining frames keep loading in the background.
   A safety cap (`maxWait`) keeps very slow connections from being stuck here;
   the hero always draws the nearest loaded frame, so it is never blank.
   ========================================================================== */
import { gsap } from 'gsap';

/**
 * @param {{ task: { progress: number, onProgress: (cb:(p:number)=>void)=>void, promise: Promise<any> } | null,
 *           maxWait: number }} opts
 */
export async function runLoader({ task, maxWait }) {
  const root = document.getElementById('loader');
  const fill = root.querySelector('.loader__fill');
  const pct = root.querySelector('[data-loader-pct]');
  const shown = { v: 0 };
  const render = () => {
    fill.style.transform = `scaleX(${shown.v})`;
    pct.textContent = String(Math.round(shown.v * 100));
  };

  if (task) {
    task.onProgress((p) =>
      gsap.to(shown, { v: p, duration: 0.5, ease: 'power3.out', overwrite: true, onUpdate: render })
    );
    await Promise.race([task.promise, new Promise((resolve) => setTimeout(resolve, maxWait))]);
  }

  // Finish the line before leaving.
  await new Promise((resolve) => {
    gsap.to(shown, { v: 1, duration: 0.45, ease: 'power3.out', overwrite: true, onUpdate: render, onComplete: resolve });
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
