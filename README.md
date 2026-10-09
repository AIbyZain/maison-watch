# MAISON HEURE

Interactive website concept for an independent luxury watch boutique.
Vite + vanilla JavaScript (ES modules) + GSAP ScrollTrigger + Lenis.

> Demo concept. Prices and specifications are illustrative. The site presents
> an independent retailer and is not the official site of any watch brand.

## Run

```bash
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).
`npm run build` produces a static `dist/` folder you can host anywhere.

## Edit the content: `src/data/site.js`

Everything you are likely to change is in this one file:

| Key | What it controls |
| --- | --- |
| `name` | Boutique name (nav, loader, footer, page title, WhatsApp messages) |
| `whatsapp` | Number used for every `wa.me` link. Digits only, international format, e.g. `923001234567` |
| `whatsappDisplay` | The number as shown in the footer |
| `currency` | Prefix for prices, e.g. `PKR`, `AED`, `USD` |
| `address`, `instagram`, `hours`, `footerNote` | Footer content |
| `hero.frames` | The image sequence: folder paths, frame counts, frame size, file naming (`f_` + 4-digit number + `.webp`), parallel requests |
| `hero.frames.desktop.segments` / `.mobile.segments` | First frame of each chapter (desktop 1, 49, 97, 145, end 192; mobile 1, 25, 49, 73, end 96). Captions and dots switch on these |
| `hero.frames.*.lerp` | How fast the frame catches up with the scroll (0.15 desktop, 0.2 mobile) |
| `hero.chapters` | The four captions (eyebrow, title, line) |
| `hero.scrollLength` | Total pinned scroll, in % of viewport height (default 400). Lower = the sequence plays faster per scroll |
| `hero.loaderMaxWait` | Safety cap (ms) for very slow connections: the loader never waits longer than this for the first pass of frames |
| `setTime` | Heading, model line, specs, city chips (IANA time zones), dial crop/pivot, hand pivots, hand lengths, beat rate |
| `setTime.hands.hour.filter` | CSS filter that turns the rose-gold hour hand steel. Set to `'none'` if you supply a steel hand |
| `products` | The collection. `price: null` shows "Price on request". `word` is the large faint word behind each panel |
| `viewing` | Text of the Private Viewing section |

## Replace assets

Keep the same file names and paths, or update the paths in `site.js`.

```
public/hero-frames/desktop/f_0001.webp … f_0192.webp   hero sequence (one continuous shot), 1280x720
public/hero-frames/mobile/f_0001.webp … f_0096.webp    every second frame, 720x405
public/img/hero-poster.jpg, exploded-1.jpg … exploded-3.jpg   stills (not used by the hero any more)
public/img/dial.jpg                      dial with NO hands
public/img/hand-hour.jpg / hand-minute.jpg / hand-second.jpg
public/img/gallery/watch-01.jpg … watch-04.jpg
```

**Hero frames.** If you replace the sequence, keep the naming (`f_0001.webp`, 4-digit
padding, starting at 1) and update `count`, `width`, `height`, `segments` and `end`
for each set in `site.js`.

**Dial.** If you change the dial image, update `setTime.dial.pivot` (centre hole as a
fraction of the image width/height) and `setTime.dial.crop` (side of the square crop
as a fraction of the image height).

**Hands.** Each hand image must lie horizontally and point RIGHT. Supply either a
pure green (#00FF00) background, which is keyed out in the browser, or a transparent
PNG. Update `pivot` (centre of the hand's pivot hole as a fraction of the image) if
the geometry changes. The tip is detected automatically, and each hand is scaled so
the minute hand reaches the minute track (`setTime.lengths`).

## Structure

```
index.html
src/main.js                 boot, Lenis, nav, footer
src/data/site.js            all editable content
src/modules/loader.js       loader line (first pass of hero frames)
src/modules/hero.js         pinned canvas image sequence (Anatomy of Time)
src/modules/setTime.js      interactive watch, chroma key, drag, city times
src/modules/collection.js   horizontal corridor + detail overlay
src/modules/viewing.js      booking form to WhatsApp
src/modules/cursor.js       desktop cursor (dot + ring)
src/styles/*.css
```

## Hero: how the image sequence stays smooth

- **Frame set**, chosen once on load: the mobile set when the viewport is under 768 px,
  Data Saver is on, or `navigator.deviceMemory` is 4 or less; otherwise desktop.
- **Progressive loading**: frame 1 first (shown at once), then every 8th frame,
  every 4th, every 2nd, then the rest, 6 requests at a time. Each image is decoded
  (`img.decode()`) before it counts as ready. The loader only waits for the first
  pass (frame 1 + every 8th); the rest loads in the background. If a frame is not
  ready yet, the nearest loaded one is drawn, so the canvas is never blank.
- **Drawing**: ScrollTrigger only sets a target frame. One `requestAnimationFrame` loop
  eases toward it and calls `drawImage` only when the rounded frame changes. The loop
  pauses when the hero is off screen. Canvas size and cover-crop maths are computed
  only on resize (debounced).
- **Lenis** (lerp 0.08, native touch scrolling) is driven only by `gsap.ticker`.
- **No blur over the canvas**: the nav swaps its backdrop blur for a solid tint
  while the hero is pinned.

## Behaviour notes

- **Reduced motion** (`prefers-reduced-motion: reduce`): no smooth scroll, no pinning,
  no scrubbing. The hero shows the first and last frames as still images with the
  captions, the collection
  becomes a native swipe row, and city changes jump instead of gliding.
- **Mobile (< 768 px)**: the collection is a native horizontal swipe with scroll-snap.
  On touch screens the watch hands are dragged by touching the hands themselves,
  so the page still scrolls over the dial.
- **Navigation**: below 900 px the links collapse into a menu, so the logo always keeps
  at least 56 px of clear space from the first link.
- **Cursor**: a dot and a lagging ring, desktop mice and trackpads only. Touch
  devices keep their native behaviour.
- **Keyboard**: the hour and minute hands are sliders (arrow keys, Page Up/Down),
  city chips are buttons, and the detail overlay traps focus and closes with Esc.
