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
| `hero.videos` | The ordered "Anatomy of Time" sequence. Each entry has `src`, `poster`, `eyebrow`, `title`, `line`. Reorder or delete entries and the scroll segments adapt automatically |
| `hero.scrollLengthPerVideo` | Scroll distance per video, in % of viewport height (default 125, so 4 videos = 500vh) |
| `hero.lerp` | Scrub smoothing, 0 to 1. Lower is softer |
| `setTime` | Heading, model line, specs, city chips (IANA time zones), dial crop/pivot, hand pivots, hand lengths, beat rate |
| `setTime.hands.hour.filter` | CSS filter that turns the rose-gold hour hand steel. Set to `'none'` if you supply a steel hand |
| `products` | The collection. `price: null` shows "Price on request". `word` is the large faint word behind each panel |
| `viewing` | Text of the Private Viewing section |

## Replace assets

Keep the same file names and paths, or update the paths in `site.js`.

```
public/media/hero-1.mp4 … hero-4.mp4     scroll-scrubbed sequence (muted, never autoplayed)
public/img/hero-poster.jpg               assembled watch, also the first-frame poster
public/img/exploded-1.jpg … exploded-3.jpg   posters for videos 2 to 4 (used for reduced motion)
public/img/dial.jpg                      dial with NO hands
public/img/hand-hour.jpg / hand-minute.jpg / hand-second.jpg
public/img/gallery/watch-01.jpg … watch-04.jpg
```

**Videos.** The last frame of each clip should match the first frame of the next:
the site switches clips on the exact scroll boundary with no crossfade.
All four videos are downloaded as Blobs before the site opens (that is what the
loader bar shows), because seeking a local Blob is smooth while seeking a streamed
MP4 is not.

**Dial.** If you change the dial image, update `setTime.dial.pivot` (centre hole as a
fraction of the image width/height) and `setTime.dial.crop` (side of the square crop
as a fraction of the image height).

**Hands.** Each hand image must lie horizontally and point RIGHT. Supply either a
pure green (#00FF00) background, which is keyed out in the browser, or a transparent
PNG. Update `pivot` (centre of the hand's pivot hole as a fraction of the image) if
the geometry changes. The tip is detected automatically, and each hand is scaled so
the minute hand reaches the minute track (`setTime.lengths`).

## Optional: even smoother scrubbing

Re-encode each video so every frame is a keyframe and the audio track is removed:

```bash
ffmpeg -i hero-1.mp4 -an -c:v libx264 -g 1 -crf 20 -pix_fmt yuv420p -movflags +faststart hero-1-scrub.mp4
```

Repeat for each clip, then either rename the outputs to `hero-1.mp4` … `hero-4.mp4`
or point `hero.videos[n].src` in `site.js` at the new files. Files get larger,
but seeking becomes nearly instant on every browser.

## Structure

```
index.html
src/main.js                 boot, Lenis, nav, footer
src/data/site.js            all editable content
src/modules/loader.js       blob preloader + progress line
src/modules/hero.js         pinned video scrub (Anatomy of Time)
src/modules/setTime.js      interactive watch, chroma key, drag, city times
src/modules/collection.js   horizontal corridor + detail overlay
src/modules/viewing.js      booking form to WhatsApp
src/modules/cursor.js       desktop cursor ring
src/styles/*.css
```

## Behaviour notes

- **Reduced motion** (`prefers-reduced-motion: reduce`): no smooth scroll, no pinning,
  no video scrubbing. The hero becomes poster images with simple fades, the collection
  becomes a native swipe row, and city changes jump instead of gliding.
- **Mobile (< 768 px)**: the collection is a native horizontal swipe with scroll-snap.
  On touch screens the watch hands are dragged by touching the hands themselves,
  so the page still scrolls over the dial.
- **Keyboard**: the hour and minute hands are sliders (arrow keys, Page Up/Down),
  city chips are buttons, and the detail overlay traps focus and closes with Esc.
