/* ==========================================================================
   MAISON HEURE · entry
   ========================================================================== */
import './styles/base.css';
import './styles/hero.css';
import './styles/settime.css';
import './styles/collection.css';
import './styles/viewing.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { site, whatsappLink } from './data/site.js';
import { startDownloads, runLoader, hideLoader } from './modules/loader.js';
import { buildHero, initHero } from './modules/hero.js';
import { buildSetTime, initSetTime } from './modules/setTime.js';
import { buildCollection, initCollection } from './modules/collection.js';
import { buildViewing, initViewing } from './modules/viewing.js';
import { initCursor } from './modules/cursor.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const html = document.documentElement;

// A pinned, scroll-scrubbed story should always start at its beginning.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* --------------------------------------------------------------------------
   Smooth scroll (off for reduced motion)
   -------------------------------------------------------------------------- */
let lenis = null;
if (!reduced) {
  // lerp-based smoothing follows the wheel closely (a long `duration` felt sluggish).
  lenis = new Lenis({
    lerp: 0.14,
    smoothWheel: true,
    wheelMultiplier: 1,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

/** Scroll to a y value or an element (pinned sections resolve to their spacer). */
function scrollToTarget(target) {
  let dest = target;
  if (target instanceof Element) {
    const spacer = target.parentElement?.classList.contains('pin-spacer') ? target.parentElement : target;
    dest = spacer.getBoundingClientRect().top + window.scrollY;
  }
  if (lenis) lenis.scrollTo(dest, { duration: 1.6, force: true });
  else window.scrollTo({ top: dest, behavior: 'auto' });
}

function lockScroll(on) {
  if (lenis) (on ? lenis.stop() : lenis.start());
  html.classList.toggle('is-locked', on);
}

/* --------------------------------------------------------------------------
   Static content from site.js
   -------------------------------------------------------------------------- */
document.querySelectorAll('[data-site-name]').forEach((el) => {
  el.textContent = site.name;
});
const titleCase = site.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
document.title = `${titleCase} · Independent watch boutique`;

function buildFooter(footer) {
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  footer.innerHTML = `
    <div class="footer__inner">
      <p class="footer__mark" aria-hidden="true">${esc(site.name)}</p>
      <div class="footer__cols">
        <div>
          <p class="label">Boutique</p>
          ${site.address.map((l) => `<p>${esc(l)}</p>`).join('')}
        </div>
        <div>
          <p class="label">Contact</p>
          <a href="${esc(whatsappLink(`Hello ${site.name}`))}" target="_blank" rel="noopener">WhatsApp ${esc(
    site.whatsappDisplay
  )}</a>
          <a href="${esc(site.instagram.url)}" target="_blank" rel="noopener">Instagram ${esc(site.instagram.handle)}</a>
        </div>
        <div>
          <p class="label">Opening hours</p>
          ${site.hours.map((l) => `<p>${esc(l)}</p>`).join('')}
        </div>
        <div>
          <p class="label">About this site</p>
          <p>${esc(site.name)} is an independent retailer. This is not the official site of any watch brand shown.</p>
        </div>
      </div>
      <div class="footer__base">
        <span>© ${new Date().getFullYear()} ${esc(site.name)}</span>
        <span class="footer__note">${esc(site.footerNote)}</span>
      </div>
    </div>`;
}

const sections = {
  hero: document.getElementById('anatomy'),
  setTime: document.getElementById('set-the-time'),
  collection: document.getElementById('collection'),
  viewing: document.getElementById('viewing'),
};

buildHero(sections.hero, { reduced });
buildSetTime(sections.setTime);
buildCollection(sections.collection);
buildViewing(sections.viewing);
buildFooter(document.getElementById('footer'));

// The watch prepares its hands while the videos download.
const setTimeReady = initSetTime(sections.setTime, { reduced }).catch((err) =>
  console.error('[setTime] init failed', err)
);

/* --------------------------------------------------------------------------
   Navigation
   -------------------------------------------------------------------------- */
function initNav() {
  const nav = document.getElementById('nav');
  const toggle = nav.querySelector('.nav__toggle');
  const links = [...nav.querySelectorAll('.nav__menu a')];
  const mobile = window.matchMedia('(max-width: 767px)');

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.visually-hidden').textContent = open ? 'Close menu' : 'Menu';
    if (mobile.matches) lockScroll(open);
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  mobile.addEventListener('change', () => nav.classList.contains('is-open') && setOpen(false));

  const go = (e, hash) => {
    const target = hash === '#top' ? 0 : document.querySelector(hash);
    if (target === null) return;
    e.preventDefault();
    if (nav.classList.contains('is-open')) setOpen(false);
    scrollToTarget(target);
  };
  links.forEach((a) => a.addEventListener('click', (e) => go(e, a.getAttribute('href'))));
  nav.querySelector('.nav__brand').addEventListener('click', (e) => go(e, '#top'));

  ScrollTrigger.create({
    start: 40,
    end: 'max',
    toggleClass: { targets: nav, className: 'is-scrolled' },
  });

  links.forEach((a) => {
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    ScrollTrigger.create({
      trigger: el,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => {
        if (self.isActive) links.forEach((l) => l.setAttribute('aria-current', String(l === a)));
        else a.setAttribute('aria-current', 'false');
      },
    });
  });
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
async function boot() {
  // Data saver or a 2G connection: never download the film, use posters.
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const constrained = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));
  const sources = site.hero.videos.map((v) => v.src);
  const downloads = reduced || constrained ? null : startDownloads(sources, site.hero.network);

  // Waits for the film, but never longer than loaderMaxWait. A slow download
  // continues in the background and the hero upgrades itself when it lands.
  await runLoader({ downloads, maxWait: site.hero.network.loaderMaxWait });

  // Create pinned ScrollTriggers in page order: hero, then collection.
  initHero(sections.hero, { downloads, reduced, scrollTo: scrollToTarget });
  initCollection(sections.collection, { reduced, lockScroll, scrollToTarget });
  initViewing(sections.viewing, { scrollToTarget });
  initNav();
  initCursor({ reduced });

  await setTimeReady;
  ScrollTrigger.refresh();

  await hideLoader();
  html.classList.remove('is-loading');
  if (lenis) lenis.start();

  if (!reduced) {
    gsap.from('.hero__title', { y: 48, opacity: 0, duration: 1.4, ease: 'expo.out' });
    gsap.from('.hero__cue', { opacity: 0, duration: 1.2, delay: 0.5, ease: 'power2.out' });
  }
}

boot().catch((err) => {
  console.error(err);
  // Never leave the visitor stuck behind the loader.
  document.getElementById('loader')?.remove();
  html.classList.remove('is-loading');
  if (lenis) lenis.start();
});

if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('orientationchange', () => setTimeout(() => ScrollTrigger.refresh(), 300));
window.addEventListener('load', () => ScrollTrigger.refresh());
