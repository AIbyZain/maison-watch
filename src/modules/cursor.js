/* ==========================================================================
   Custom cursor
   A 6px dot that follows the pointer exactly and a 34px ring that follows
   with a soft lag. One rAF loop moves both with translate3d; nothing else
   is rendered per frame. States are classes on <html> (CSS does the rest).
   Enabled only for (hover: hover) and (pointer: fine): never on touch.
   ========================================================================== */

const RING_LERP = 0.15;
const STATES = ['cursor-link', 'cursor-view', 'cursor-drag-hover', 'cursor-text'];

export function initCursor() {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return () => {};

  const html = document.documentElement;
  const ring = document.querySelector('.cursor-ring');
  const dot = document.querySelector('.cursor-dot');
  if (!ring || !dot) return () => {};
  const label = ring.querySelector('.cursor-ring__label');
  html.classList.add('has-cursor', 'cursor-out');

  const pos = { x: -100, y: -100 };
  const lag = { x: -100, y: -100 };
  let seen = false;
  let raf = 0;

  /* ---- The only per-frame work: two transforms ---- */
  function loop() {
    raf = requestAnimationFrame(loop);
    lag.x += (pos.x - lag.x) * RING_LERP;
    lag.y += (pos.y - lag.y) * RING_LERP;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    ring.style.transform = `translate3d(${lag.x}px, ${lag.y}px, 0)`;
  }

  const onMove = (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    if (!seen) {
      // First move: place the ring under the pointer instead of sliding in from a corner.
      seen = true;
      lag.x = pos.x;
      lag.y = pos.y;
    }
    html.classList.remove('cursor-out');
    if (!raf) raf = requestAnimationFrame(loop);
  };

  const setState = (state, text = '') => {
    STATES.forEach((s) => html.classList.toggle(s, s === state));
    if (text) label.textContent = text;
  };

  const onOver = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('input, textarea, select')) return setState('cursor-text');
    const tagged = t.closest('[data-cursor]');
    if (tagged) {
      const kind = tagged.dataset.cursor.toLowerCase();
      if (kind === 'view') return setState('cursor-view', 'View');
      if (kind === 'drag') return setState('cursor-drag-hover', 'Drag');
    }
    if (t.closest('a, button, [role="slider"], label, summary')) return setState('cursor-link');
    setState(null);
  };

  const onDown = () => html.classList.add('cursor-down');
  const onUp = () => html.classList.remove('cursor-down');
  const onLeave = () => html.classList.add('cursor-out');
  const onEnter = () => html.classList.remove('cursor-out');
  // Set the Time announces drags (see setTime.js).
  const onDrag = (e) => html.classList.toggle('cursor-dragging', !!e.detail);

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  document.documentElement.addEventListener('pointerenter', onEnter);
  document.addEventListener('cursor:drag', onDrag);

  // Hide while the tab is in the background; stop the loop entirely.
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onOver);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    document.documentElement.removeEventListener('pointerenter', onEnter);
    document.removeEventListener('cursor:drag', onDrag);
    document.removeEventListener('visibilitychange', onVisibility);
    html.classList.remove('has-cursor', 'cursor-out', 'cursor-down', 'cursor-dragging', ...STATES);
  };
}
