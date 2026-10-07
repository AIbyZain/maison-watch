/* ==========================================================================
   Section 3 · The Collection
   Desktop: pinned horizontal corridor driven by vertical scroll.
   Mobile (<768px) and reduced motion: native swipe with scroll-snap.
   ========================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { site, formatPrice, whatsappLink } from '../data/site.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad = (n) => String(n).padStart(2, '0');

export function buildCollection(section) {
  const { products, collectionIntro } = site;
  section.innerHTML = `
    <div class="collection__pin">
      <div class="collection__track">
        <div class="collection__intro">
          <h2 class="serif" id="collection-title">${esc(collectionIntro.heading)}</h2>
          <p>${esc(collectionIntro.line)}</p>
        </div>
        ${products
          .map(
            (p, i) => `
          <article class="panel" data-index="${i}" style="--ratio: ${p.width || 1376} / ${p.height || 768}">
            <button class="panel__open" type="button" data-cursor="View" aria-label="View details: ${esc(p.name)}">
              <span class="panel__word" aria-hidden="true">${esc(p.word)}</span>
              <figure class="panel__figure">
                <img data-src="${esc(p.image)}" alt="${esc(p.name)}" width="${p.width || 1376}" height="${
              p.height || 768
            }" decoding="async" />
              </figure>
            </button>
            <div class="panel__meta">
              <h3 class="panel__name">${esc(p.name)}</h3>
              <p class="panel__price">${esc(formatPrice(p.price))}</p>
              <p class="panel__ref label">Ref. ${esc(p.ref)}</p>
            </div>
          </article>`
          )
          .join('')}
        <div class="collection__end" aria-hidden="true"></div>
      </div>
      <div class="collection__foot">
        <div class="collection__bar" aria-hidden="true"><span></span></div>
        <p class="collection__count label" aria-live="off"><span data-current>01</span> / ${pad(products.length)}</p>
      </div>
    </div>`;
}

/**
 * @param {HTMLElement} section
 * @param {{ reduced: boolean, lockScroll: (b:boolean)=>void, scrollToTarget: (el:Element)=>void }} opts
 */
export function initCollection(section, { lockScroll, scrollToTarget }) {
  const track = section.querySelector('.collection__track');
  const panels = [...section.querySelectorAll('.panel')];
  const bar = section.querySelector('.collection__bar span');
  const current = section.querySelector('[data-current]');

  /* ---- Lazy-load images when the section is near ---- */
  const imgs = [...section.querySelectorAll('img[data-src]')];
  const lazyIO = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      imgs.forEach((img) => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
      lazyIO.disconnect();
    },
    { rootMargin: '150% 0px' }
  );
  lazyIO.observe(section);

  /* ---- Counter: which panel is closest to the centre ---- */
  let currentIdx = -1;
  function updateCount(centerX) {
    let best = 0;
    let bestD = Infinity;
    panels.forEach((p, i) => {
      const r = p.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - centerX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best !== currentIdx) {
      currentIdx = best;
      current.textContent = pad(best + 1);
    }
  }

  const mm = gsap.matchMedia();
  mm.add(
    {
      desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
      native: '(max-width: 767px), (prefers-reduced-motion: reduce)',
    },
    (ctx) => {
      const metas = panels.map((p) => p.querySelector('.panel__meta'));

      if (ctx.conditions.desktop) {
        section.classList.remove('is-native');
        const distance = () => Math.max(0, track.offsetWidth - window.innerWidth);

        const pan = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              bar.style.transform = `scaleX(${self.progress})`;
              updateCount(window.innerWidth / 2);
            },
          },
        });

        panels.forEach((panel, i) => {
          const word = panel.querySelector('.panel__word');
          // Replace the CSS centring with GSAP's own so the two never stack.
          gsap.set(word, { x: 0, y: 0, xPercent: -50, yPercent: -50 });
          // The faint word travels faster than the panel: depth.
          gsap.fromTo(
            word,
            { x: () => window.innerWidth * 0.16 },
            {
              x: () => -window.innerWidth * 0.16,
              ease: 'none',
              scrollTrigger: {
                trigger: panel,
                containerAnimation: pan,
                start: 'left right',
                end: 'right left',
                scrub: true,
              },
            }
          );
          // Name, reference and price arrive as the panel nears the centre.
          gsap.set(metas[i].children, { autoAlpha: 0, y: 28 });
          ScrollTrigger.create({
            trigger: panel,
            containerAnimation: pan,
            start: 'center 72%',
            onEnter: () =>
              gsap.to(metas[i].children, {
                autoAlpha: 1,
                y: 0,
                duration: 1.2,
                stagger: 0.08,
                ease: 'expo.out',
                overwrite: true,
              }),
            onLeaveBack: () =>
              gsap.to(metas[i].children, { autoAlpha: 0, y: 28, duration: 0.7, ease: 'power3.in', overwrite: true }),
          });
        });

        updateCount(window.innerWidth / 2);
        return () => {
          gsap.set(track, { clearProps: 'transform' });
          panels.forEach((p) => gsap.set(p.querySelector('.panel__word'), { clearProps: 'transform' }));
          metas.forEach((m) => gsap.set(m.children, { clearProps: 'all' }));
        };
      }

      /* Native swipe */
      section.classList.add('is-native');
      let raf = 0;
      const onScroll = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const max = track.scrollWidth - track.clientWidth;
          bar.style.transform = `scaleX(${max > 0 ? track.scrollLeft / max : 0})`;
          const r = track.getBoundingClientRect();
          updateCount(r.left + r.width / 2);
        });
      };
      track.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      return () => {
        track.removeEventListener('scroll', onScroll);
        cancelAnimationFrame(raf);
        section.classList.remove('is-native');
      };
    }
  );

  /* ---- Detail overlay ---- */
  const detail = document.getElementById('detail');
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let open = null; // { index, button, figureSrc }

  function render(p) {
    const wa = whatsappLink(`Hello ${site.name}, I would like to enquire about the ${p.name} (Ref. ${p.ref}).`);
    detail.innerHTML = `
      <div class="detail__backdrop" data-close></div>
      <button class="detail__close" type="button" aria-label="Close details">✕</button>
      <div class="detail__inner">
        <figure class="detail__figure" style="--ratio: ${p.width || 1376} / ${p.height || 768}">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" width="${p.width || 1376}" height="${p.height || 768}" />
        </figure>
        <div class="detail__body">
          <p class="label detail__ref">Ref. ${esc(p.ref)}</p>
          <h3 class="serif detail__name" id="detail-name">${esc(p.name)}</h3>
          <p class="detail__price">${esc(formatPrice(p.price))}</p>
          <p class="detail__desc">${esc(p.description)}</p>
          <dl class="detail__specs">
            ${p.specs.map((s) => `<dt class="label">${esc(s.label)}</dt><dd>${esc(s.value)}</dd>`).join('')}
          </dl>
          <div class="detail__actions">
            <a class="btn btn--solid" href="${esc(wa)}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
            <button class="btn" type="button" data-book>Book a Private Viewing</button>
          </div>
        </div>
      </div>`;
  }

  function flipFrom(fig, sourceRect, reverse = false) {
    const F = fig.getBoundingClientRect();
    const C = sourceRect;
    const s = Math.max(C.width / F.width, C.height / F.height);
    const ix = Math.max(0, (F.width - C.width / s) / 2);
    const iy = Math.max(0, (F.height - C.height / s) / 2);
    const card = {
      x: C.left + C.width / 2 - (F.left + F.width / 2),
      y: C.top + C.height / 2 - (F.top + F.height / 2),
      scale: s,
      clipPath: `inset(${iy}px ${ix}px ${iy}px ${ix}px)`,
    };
    const full = { x: 0, y: 0, scale: 1, clipPath: 'inset(0px 0px 0px 0px)' };
    gsap.set(fig, { transformOrigin: '50% 50%' });
    return reverse
      ? gsap.fromTo(fig, full, { ...card, duration: 0.9, ease: 'expo.inOut' })
      : gsap.fromTo(fig, card, { ...full, duration: 1.25, ease: 'expo.out' });
  }

  function openDetail(index, button) {
    if (open) return;
    const p = site.products[index];
    const figureSrc = button.querySelector('.panel__figure');
    render(p);
    detail.hidden = false;
    lockScroll(true);
    open = { index, button, figureSrc };

    const fig = detail.querySelector('.detail__figure');
    const body = detail.querySelector('.detail__body').children;
    const backdrop = detail.querySelector('.detail__backdrop');
    const close = detail.querySelector('.detail__close');

    if (reducedQuery.matches) {
      gsap.fromTo(detail, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    } else {
      figureSrc.style.visibility = 'hidden';
      gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power3.out' });
      flipFrom(fig, figureSrc.getBoundingClientRect());
      gsap.fromTo(
        body,
        { autoAlpha: 0, y: 30 },
        { autoAlpha: 1, y: 0, duration: 1.2, delay: 0.35, stagger: 0.07, ease: 'expo.out' }
      );
      gsap.fromTo(close, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, delay: 0.5, ease: 'power2.out' });
    }
    close.focus({ preventScroll: true });
  }

  function closeDetail({ thenScrollTo = null } = {}) {
    if (!open) return;
    const { button, figureSrc } = open;
    const fig = detail.querySelector('.detail__figure');
    const body = detail.querySelector('.detail__body').children;
    const backdrop = detail.querySelector('.detail__backdrop');
    const close = detail.querySelector('.detail__close');

    const finish = () => {
      detail.hidden = true;
      detail.innerHTML = '';
      gsap.set(detail, { clearProps: 'opacity' });
      figureSrc.style.visibility = '';
      lockScroll(false);
      open = null;
      if (thenScrollTo) scrollToTarget(thenScrollTo);
      else button.focus({ preventScroll: true });
    };

    if (reducedQuery.matches) {
      gsap.to(detail, { opacity: 0, duration: 0.35, ease: 'power2.in', onComplete: finish });
      return;
    }

    const src = figureSrc.getBoundingClientRect();
    const onScreen = src.right > 0 && src.left < window.innerWidth && src.bottom > 0 && src.top < window.innerHeight;
    gsap.to([...body, close], { autoAlpha: 0, y: 12, duration: 0.45, ease: 'power2.in', stagger: 0.02 });
    gsap.to(backdrop, { opacity: 0, duration: 0.8, delay: 0.15, ease: 'power3.inOut' });
    if (onScreen && !thenScrollTo) {
      flipFrom(fig, src, true).eventCallback('onComplete', finish);
    } else {
      gsap.to(fig, { autoAlpha: 0, scale: 0.96, duration: 0.6, ease: 'power3.in', onComplete: finish });
    }
  }

  panels.forEach((panel, i) => {
    const btn = panel.querySelector('.panel__open');
    btn.addEventListener('click', () => openDetail(i, btn));
  });

  detail.addEventListener('click', (e) => {
    if (e.target.closest('.detail__close') || e.target.hasAttribute('data-close')) closeDetail();
    else if (e.target.closest('[data-book]')) {
      const p = site.products[open.index];
      document.dispatchEvent(new CustomEvent('maison:select-watch', { detail: { id: p.id } }));
      closeDetail({ thenScrollTo: document.getElementById('viewing') });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDetail();
      return;
    }
    if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      const items = [...detail.querySelectorAll('a[href], button:not([disabled])')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!detail.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  return () => {
    mm.revert();
    lazyIO.disconnect();
  };
}
