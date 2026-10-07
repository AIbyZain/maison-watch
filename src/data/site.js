/* ==========================================================================
   MAISON HEURE · site data
   Everything you are likely to edit lives in this one file:
   name, contact details, currency, hero sequence, the "Set the Time" watch,
   and the collection. No other file needs to change for content edits.
   ========================================================================== */

export const site = {
  /* ---------- Brand & contact ---------- */
  name: 'MAISON HEURE',
  description: 'An independent watch boutique. Private viewings by appointment.',
  // International format, digits only (no +, spaces or dashes). Used for wa.me links.
  whatsapp: '923001234567',
  // Shown in the footer exactly as written.
  whatsappDisplay: '+92 300 123 4567',
  currency: 'PKR',
  address: ['Boutique address placeholder', 'Street, Area', 'City, Country'],
  instagram: { handle: '@maisonheure', url: 'https://instagram.com/' },
  hours: ['Mon to Sat, 11:00 to 20:00', 'Sunday by appointment'],
  footerNote: 'Demo concept. Prices and specifications are illustrative.',

  /* ---------- Section 1: Anatomy of Time ----------
     Ordered sequence. Reorder or delete entries freely; the scroll
     segments adapt to however many videos are listed here.
     `poster` is used for reduced-motion visitors and as a fallback. */
  hero: {
    title: 'Anatomy of Time',
    cue: 'Scroll to explore',
    scrollLengthPerVideo: 125, // in % of viewport height (4 videos x 125 = 500vh)
    lerp: 0.12, // smoothing toward the scroll target, 0..1 (lower = softer)
    videos: [
      {
        src: '/media/hero-1.mp4',
        poster: '/img/hero-poster.jpg',
        eyebrow: '01 — The Crystal',
        title: 'Sapphire, cut to disappear.',
        line: 'Anti-reflective on both sides, set in an octagonal bezel held by eight hexagonal screws.',
      },
      {
        src: '/media/hero-2.mp4',
        poster: '/img/exploded-1.jpg',
        eyebrow: '02 — The Dial',
        title: 'A calendar that thinks in centuries.',
        line: 'Perpetual calendar with day, date, month, week and an astronomical moon phase.',
      },
      {
        src: '/media/hero-3.mp4',
        poster: '/img/exploded-2.jpg',
        eyebrow: '03 — The Hands',
        title: 'Gold, faceted by hand.',
        line: 'Each hand is polished and bevelled, then set at 10:10 for balance.',
      },
      {
        src: '/media/hero-4.mp4',
        poster: '/img/exploded-3.jpg',
        eyebrow: '04 — The Movement',
        title: 'The heart, laid open.',
        line: 'Self-winding calibre, hand-finished bridges, visible through the skeleton dial.',
      },
    ],
  },

  /* ---------- Section 2: Set the Time ---------- */
  setTime: {
    heading: 'Set the Time.',
    subline: 'Drag the hands, or let it run.',
    model: 'Conquest Automatic · 41 mm',
    specs: [
      { label: 'Power reserve', value: '72 hours' },
      { label: 'Water resistance', value: '100 m' },
      { label: 'Dial', value: 'Sunray green' },
      { label: 'Date', value: 'At 6 o’clock' },
    ],
    dial: {
      src: '/img/dial.jpg',
      pivot: { x: 0.5, y: 0.488 }, // centre hole, as a fraction of the image
      crop: 0.9, // square crop side, as a fraction of the image HEIGHT
    },
    // Hand lengths, pivot-to-tip, as a fraction of the square watch box width.
    lengths: { minute: 0.285, hourRatio: 0.7, second: 0.3 },
    beatsPerSecond: 8, // automatic movement sweep (8 beats/s = 28,800 vph)
    hands: {
      // Each image points RIGHT (3 o'clock). Pivot = fraction of image size.
      // Green #00FF00 backgrounds are keyed out at runtime; transparent PNGs work too.
      hour: {
        src: '/img/hand-hour.jpg',
        pivot: { x: 0.257, y: 0.499 },
        // The supplied hour hand is rose gold; this filter matches it to the steel hands.
        // Set to 'none' if you replace it with a steel hand.
        filter: 'grayscale(1) brightness(1.12) contrast(1.04)',
      },
      minute: { src: '/img/hand-minute.jpg', pivot: { x: 0.198, y: 0.499 }, filter: 'none' },
      second: { src: '/img/hand-second.jpg', pivot: { x: 0.283, y: 0.499 }, filter: 'none' },
    },
    cities: [
      { label: 'Now', zone: null }, // null = the visitor's own clock
      { label: 'Karachi', zone: 'Asia/Karachi' },
      { label: 'Dubai', zone: 'Asia/Dubai' },
      { label: 'London', zone: 'Europe/London' },
      { label: 'Geneva', zone: 'Europe/Zurich' },
      { label: 'New York', zone: 'America/New_York' },
    ],
  },

  /* ---------- Section 3: The Collection (demo data) ----------
     price: a number in `currency`, or null for "Price on request". */
  collectionIntro: {
    heading: 'The Collection',
    line: 'Four pieces on the floor this season. Each can be viewed in private.',
  },
  products: [
    {
      id: 'demo-01',
      image: '/img/gallery/watch-01.jpg',
      width: 2576,
      height: 1438,
      name: 'Royal Oak Perpetual Calendar Openworked',
      ref: 'DEMO-01',
      price: null,
      word: 'PERPETUAL',
      description: 'A skeletonised perpetual calendar in brown ceramic, every gear on view.',
      specs: [
        { label: 'Case', value: 'Brown ceramic, 41 mm' },
        { label: 'Movement', value: 'Self-winding' },
        { label: 'Functions', value: 'Perpetual calendar, moon phase, week display' },
        { label: 'Water resistance', value: '20 m' },
      ],
    },
    {
      id: 'demo-02',
      image: '/img/gallery/watch-02.jpg',
      width: 1376,
      height: 768,
      name: 'Conquest Quartz',
      ref: 'DEMO-02',
      price: 520000,
      word: 'CONQUEST',
      description: 'A clean everyday steel watch with a black sunray dial.',
      specs: [
        { label: 'Case', value: 'Steel, ceramic-tone bezel, 38 mm' },
        { label: 'Dial', value: 'Black sunray' },
        { label: 'Movement', value: 'Quartz' },
        { label: 'Date', value: 'At 6 o’clock' },
        { label: 'Water resistance', value: '100 m' },
      ],
    },
    {
      id: 'demo-03',
      image: '/img/gallery/watch-03.jpg',
      width: 1376,
      height: 768,
      name: 'HydroConquest',
      ref: 'DEMO-03',
      price: 880000,
      word: 'HYDRO',
      description: 'A dive watch with an ice-blue dial and a blue ceramic bezel.',
      specs: [
        { label: 'Case', value: 'Steel, 41 mm' },
        { label: 'Bezel', value: 'Blue ceramic, unidirectional' },
        { label: 'Dial', value: 'Ice blue' },
        { label: 'Movement', value: 'Automatic, 72 h reserve' },
        { label: 'Water resistance', value: '300 m' },
      ],
    },
    {
      id: 'demo-04',
      image: '/img/gallery/watch-04.jpg',
      width: 1376,
      height: 768,
      name: 'La Grande Classique',
      ref: 'DEMO-04',
      price: 610000,
      word: 'CLASSIQUE',
      description: 'An ultra-thin dress watch, black dial set with diamond indexes.',
      specs: [
        { label: 'Case', value: 'Two-tone rose-gold PVD, 36 mm, ultra-thin' },
        { label: 'Dial', value: 'Black, diamond indexes' },
        { label: 'Movement', value: 'Quartz' },
        { label: 'Water resistance', value: '30 m' },
      ],
    },
  ],

  /* ---------- Section 4: Private Viewing ---------- */
  viewing: {
    line: 'Some things must be held to be understood.',
    note: 'Choose a piece and a day. We will confirm on WhatsApp within working hours.',
  },
};

/* ---------- Helpers (no need to edit) ---------- */
export function formatPrice(price) {
  if (price === null || price === undefined) return 'Price on request';
  return `${site.currency} ${Number(price).toLocaleString('en-US')}`;
}

export function whatsappLink(text) {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}
