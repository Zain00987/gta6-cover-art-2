// Neon Heist Canvas — layout specs and colour grades, all data, no rendering code.
// Every poster geometry lives here as plain JSON: a layout is a list of panels
// (photo or sky) plus the four type zones. The engine in poster.js only knows how
// to read this shape, so a new layout is a new object below, never new code.
// Coordinates are in a 1000 x 1000 unit square; the engine scales them to the
// poster's real pixel size, so one spec serves every export aspect.

export const UNIT = 1000;

// A panel is either a polygon { shape: 'poly', pts: [[x, y], ...] } or a circle
// { shape: 'circle', cx, cy, r }. kind 'photo' shows a picture, kind 'sky' shows
// the code-drawn Vice City backdrop. slot picks which photo of the library a
// photo panel shows by default.
export const LAYOUTS = [
  {
    id: 'billboard',
    name: 'Neon Billboard',
    blurb: 'A wide top photo, a thin sunset banner strip, and a wide bottom photo.',
    panels: [
      { id: 'p0', kind: 'photo', slot: 0, anchor: [0.5, 0], shape: 'poly', pts: [[0, 0], [1000, 0], [1000, 540], [0, 540]] },
      { id: 'strip', kind: 'sky', shape: 'poly', pts: [[0, 540], [1000, 540], [1000, 650], [0, 650]] },
      { id: 'p1', kind: 'photo', slot: 2, anchor: [0.5, 0], shape: 'poly', pts: [[0, 650], [1000, 650], [1000, 1000], [0, 1000]] },
    ],
    title: { x: 500, y: 118, align: 'middle', size: 118, maxW: 940 },
    ribbon: { x: 500, y: 588, align: 'middle', w: 640 },
    tagline: { x: 962, y: 958, align: 'end' },
    badge: { mode: 'sky', panel: 'strip', dx: 78, dy: 595 },
  },
  {
    id: 'comic',
    name: 'Comic-Strip Grid',
    blurb: 'Six equal frames in a 3 by 2 newspaper grid with a black gutter.',
    panels: [
      { id: 'p0', kind: 'photo', slot: 0, shape: 'poly', pts: [[20, 20], [330.7, 20], [330.7, 493], [20, 493]] },
      { id: 'p1', kind: 'photo', slot: 2, shape: 'poly', pts: [[344.7, 20], [655.3, 20], [655.3, 493], [344.7, 493]] },
      { id: 'p2', kind: 'photo', slot: 0, shape: 'poly', pts: [[669.3, 20], [980, 20], [980, 493], [669.3, 493]] },
      { id: 'p3', kind: 'photo', slot: 2, shape: 'poly', pts: [[20, 507], [330.7, 507], [330.7, 980], [20, 980]] },
      { id: 'p4', kind: 'photo', slot: 0, shape: 'poly', pts: [[344.7, 507], [655.3, 507], [655.3, 980], [344.7, 980]] },
      { id: 'p5', kind: 'photo', slot: 2, shape: 'poly', pts: [[669.3, 507], [980, 507], [980, 980], [669.3, 980]] },
    ],
    title: { x: 500, y: 96, align: 'middle', size: 104, maxW: 900 },
    ribbon: { x: 500, y: 190, align: 'middle', w: 560 },
    tagline: { x: 962, y: 958, align: 'end' },
    badge: { mode: 'corner', corner: 'tr', x: 930, y: 64 },
  },
  {
    id: 'spotlight',
    name: 'Spotlight Circle',
    blurb: 'A hero portrait in a big circle, four small frames at the compass points, sky everywhere else.',
    panels: [
      { id: 'bg', kind: 'sky', shape: 'poly', pts: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] },
      { id: 'n', kind: 'photo', slot: 1, shape: 'poly', pts: [[330, 30], [670, 30], [670, 160], [330, 160]] },
      { id: 'e', kind: 'photo', slot: 2, shape: 'poly', pts: [[760, 330], [960, 330], [960, 550], [760, 550]] },
      { id: 'w', kind: 'photo', slot: 2, shape: 'poly', pts: [[40, 330], [240, 330], [240, 550], [40, 550]] },
      { id: 'hero', kind: 'photo', slot: 0, shape: 'circle', cx: 500, cy: 540, r: 270 },
    ],
    title: { x: 500, y: 205, align: 'middle', size: 88, maxW: 640 },
    ribbon: { x: 500, y: 885, align: 'middle', w: 480 },
    tagline: { x: 962, y: 985, align: 'end' },
    badge: { mode: 'sky', panel: 'bg', dx: 76, dy: 76 },
  },
  {
    id: 'skyline',
    name: 'Skyline Band',
    blurb: 'A sunset sky on top, one full-bleed photo, and a sunset skyline band across the bottom.',
    panels: [
      { id: 'top', kind: 'sky', shape: 'poly', pts: [[0, 0], [1000, 0], [1000, 300], [0, 300]] },
      { id: 'p0', kind: 'photo', slot: 0, shape: 'poly', pts: [[0, 300], [1000, 300], [1000, 1000], [0, 1000]] },
      { id: 'band', kind: 'sky', shape: 'poly', pts: [[0, 780], [1000, 780], [1000, 1000], [0, 1000]] },
    ],
    title: { x: 500, y: 115, align: 'middle', size: 118, maxW: 940 },
    ribbon: { x: 500, y: 205, align: 'middle', w: 600 },
    tagline: { x: 40, y: 880, align: 'start' },
    badge: { mode: 'sky', panel: 'top', dx: 900, dy: 80 },
  },
  {
    id: 'triptych',
    name: 'Vertical Triptych',
    blurb: 'Two tall photo columns beside a full-height sunset column.',
    panels: [
      { id: 'p0', kind: 'photo', slot: 0, shape: 'poly', pts: [[0, 0], [320, 0], [320, 1000], [0, 1000]] },
      { id: 'p1', kind: 'photo', slot: 2, shape: 'poly', pts: [[340, 0], [660, 0], [660, 1000], [340, 1000]] },
      { id: 'sky', kind: 'sky', shape: 'poly', pts: [[680, 0], [1000, 0], [1000, 1000], [680, 1000]] },
    ],
    title: { x: 500, y: 108, align: 'middle', size: 92, maxW: 300 },
    ribbon: { x: 500, y: 204, align: 'middle', w: 280 },
    tagline: { x: 500, y: 952, align: 'middle' },
    badge: { mode: 'sky', panel: 'sky', dx: 840, dy: 90 },
  },
  {
    id: 'split',
    name: 'Split-Screen Double',
    blurb: 'Two tall photos split by a thin sunset seam that carries the badge.',
    panels: [
      { id: 'p0', kind: 'photo', slot: 0, shape: 'poly', pts: [[0, 0], [465, 0], [465, 1000], [0, 1000]] },
      { id: 'seam', kind: 'sky', shape: 'poly', pts: [[465, 0], [535, 0], [535, 1000], [465, 1000]] },
      { id: 'p1', kind: 'photo', slot: 1, shape: 'poly', pts: [[535, 0], [1000, 0], [1000, 1000], [535, 1000]] },
    ],
    title: { x: 500, y: 878, align: 'middle', size: 112, maxW: 940 },
    ribbon: { x: 500, y: 768, align: 'middle', w: 700 },
    tagline: { x: 962, y: 58, align: 'end' },
    badge: { mode: 'sky', panel: 'seam', dx: 500, dy: 96 },
  },
  {
    id: 'frame',
    name: 'Frame Within Frame',
    blurb: 'A sunset border all around one big centred photo, like a gallery print.',
    panels: [
      { id: 'bg', kind: 'sky', shape: 'poly', pts: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] },
      { id: 'p0', kind: 'photo', slot: 0, shape: 'poly', pts: [[70, 70], [930, 70], [930, 930], [70, 930]] },
    ],
    title: { x: 500, y: 152, align: 'middle', size: 110, maxW: 800 },
    ribbon: { x: 500, y: 256, align: 'middle', w: 560 },
    tagline: { x: 890, y: 890, align: 'end' },
    badge: { mode: 'corner', corner: 'bl', x: 58, y: 942 },
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

// Colour grades. Each grade is a filter recipe the engine turns into one SVG
// <filter>: an feColorMatrix (20 numbers, row-major RGBA) and, for noir, a
// component transfer that crushes the shadows. The numbers below are my own
// mixes, tuned by eye against the three sample photos.
export const GRADES = [
  {
    id: 'none',
    name: 'Original',
    blurb: 'No grade — the photo as it is.',
    accent: '#ff2d78',
    matrix: null,
    transfer: null,
  },
  {
    id: 'sunset',
    name: 'Warm Sunset',
    blurb: 'Golden hour: warm reds, lifted shadows, soft sky.',
    accent: '#ff9d5c',
    matrix: [
      1.14, 0.06, 0.0, 0, 0.03,
      0.03, 1.02, 0.02, 0, 0.0,
      0.0, 0.04, 0.86, 0, -0.01,
      0, 0, 0, 1, 0,
    ],
    transfer: null,
  },
  {
    id: 'neon',
    name: 'Neon Night',
    blurb: 'Electric magenta and cyan, hot highlights.',
    accent: '#ff2d78',
    matrix: [
      1.3, 0.05, 0.35, 0, 0.0,
      0.1, 0.95, 0.1, 0, 0.0,
      0.35, 0.1, 1.25, 0, 0.0,
      0, 0, 0, 1, 0,
    ],
    transfer: null,
  },
  {
    id: 'noir',
    name: 'Noir',
    blurb: 'Near-monochrome with crushed shadows and a cool lift.',
    accent: '#e8ecf4',
    matrix: [
      0.3, 0.55, 0.15, 0, 0.0,
      0.28, 0.58, 0.14, 0, 0.0,
      0.25, 0.5, 0.25, 0, 0.02,
      0, 0, 0, 1, 0,
    ],
    transfer: { slope: 1.3, intercept: -0.12 },
  },
  {
    id: 'vice',
    name: 'Pastel Vice',
    blurb: 'Muted teal-lavender wash, soft and dreamy.',
    accent: '#ffc46b',
    matrix: [
      0.9, 0.1, 0.05, 0, 0.0,
      0.05, 1.0, 0.1, 0, 0.0,
      0.1, 0.15, 1.05, 0, 0.01,
      0, 0, 0, 1, 0,
    ],
    transfer: null,
  },
  {
    id: 'miami',
    name: 'Miami Teal-Pink',
    blurb: 'Hot pink and teal, club-night energy.',
    accent: '#ff6ec7',
    matrix: [
      1.2, 0.05, 0.25, 0, 0.01,
      0.05, 1.05, 0.2, 0, 0.0,
      0.15, 0.1, 1.3, 0, 0.01,
      0, 0, 0, 1, 0,
    ],
    transfer: null,
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

// The four export post sizes. The poster is re-rendered at each size by
// scaling the same 1000-unit layout spec.
export const EXPORT_SIZES = [
  { key: '1080x1080', label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { key: '1080x1350', label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { key: '1080x1920', label: 'Story 1080 × 1920', w: 1080, h: 1920 },
  { key: '1920x1080', label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
];

// Bundled sample photos (generated for this app, free to use).
export const SAMPLE_PHOTOS = [
  { id: 'vice-avenue', name: 'Vice Avenue', src: 'samples/vice-avenue.jpg' },
  { id: 'rooftop-duo', name: 'Rooftop Duo', src: 'samples/rooftop-duo.jpg' },
  { id: 'night-cruise', name: 'Night Cruise', src: 'samples/night-cruise.jpg' },
];

// The stamp badge text. "VI" is a roman numeral, not a logo; LEONIDA is the
// fictional state the posters are set in.
export const BADGE_LINES = ['VI', 'LEONIDA'];
