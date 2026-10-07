/* ==========================================================================
   Custom cursor: a thin ring that trails the pointer.
   Desktop only (hover-capable fine pointer). Text fields keep the native caret.
   ========================================================================== */
import { gsap } from 'gsap';

export function initCursor({ reduced }) {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return () => {};

  const root = document.querySelector('.cursor');
  const label = root.querySelector('.cursor__label');
  document.documentElement.classList.add('has-cursor');

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const ring = { x: pos.x, y: pos.y };
  const setX = gsap.quickSetter(root, 'x', 'px');
  const setY = gsap.quickSetter(root, 'y', 'px');
  let visible = false;

  const onMove = (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    if (!visible) {
      visible = true;
      ring.x = pos.x;
      ring.y = pos.y;
      root.style.opacity = '1';
    }
  };
  const onLeave = () => {
    visible = false;
    root.style.opacity = '0';
  };

  const onOver = (e) => {
    const t = e.target;
    const text = t.closest('input, textarea, select');
    const withLabel = t.closest('[data-cursor]');
    const interactive = t.closest('a, button, [role="slider"], label');
    root.classList.toggle('is-hidden', !!text);
    root.classList.toggle('is-label', !!withLabel && !text);
    root.classList.toggle('is-hover', !!interactive && !withLabel && !text);
    label.textContent = withLabel ? withLabel.dataset.cursor : '';
  };

  const tick = () => {
    const k = reduced ? 1 : 0.2;
    ring.x += (pos.x - ring.x) * k;
    ring.y += (pos.y - ring.y) * k;
    setX(ring.x);
    setY(ring.y);
  };

  root.style.opacity = '0';
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  gsap.ticker.add(tick);

  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onOver);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    gsap.ticker.remove(tick);
    document.documentElement.classList.remove('has-cursor');
  };
}
