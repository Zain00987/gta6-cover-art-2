// Neon Heist Canvas — presets: every layout, grade, export size and sample
// photo the studio offers, as plain data. The composer turns these specs
// into SVG; nothing here knows about the DOM.

// Palette from the art direction: Neon Coral, Electric Magenta, Tropical
// Teal, Sunset Orange, Midnight Purple.
export const PALETTE = {
  coral: '#ff5e57',
  magenta: '#ff2c80',
  teal: '#00c5c9',
  orange: '#ff9f1c',
  purple: '#2e1a47',
  ink: '#12081f',
  paper: '#fff6ec',
};

// A slot is one region of the poster, in relative coordinates (0..1).
// kind: 'photo' shows a photo, 'sky' draws the code sunset, 'title' draws
// the caption. shape: rect | poly | circle, all in poster-relative units.
export const LAYOUTS = [
  {
    id: 'tri-split',
    name: 'Tri-Split',
    blurb: 'Title strip over three tall photo columns.',
    slots: [
      { id: 'title', kind: 'title', shape: { type: 'rect', x: 0, y: 0, w: 1, h: 0.16 } },
      { id: 'col-a', kind: 'photo', shape: { type: 'rect', x: 0, y: 0.16, w: 1 / 3, h: 0.84 } },
      { id: 'col-b', kind: 'photo', shape: { type: 'rect', x: 1 / 3, y: 0.16, w: 1 / 3, h: 0.84 } },
      { id: 'col-c', kind: 'photo', shape: { type: 'rect', x: 2 / 3, y: 0.16, w: 1 / 3, h: 0.84 } },
    ],
  },
  {
    id: 'diamond-cross',
    name: 'Diamond Cross',
    blurb: 'A diamond hero in the middle, sky above, title below.',
    slots: [
      { id: 'sky-top', kind: 'sky', shape: { type: 'poly', points: [[0, 0], [1, 0], [0.78, 0.26], [0.22, 0.26]] } },
      { id: 'hero', kind: 'photo', shape: { type: 'poly', points: [[0.5, 0.2], [0.86, 0.5], [0.5, 0.8], [0.14, 0.5]] } },
      { id: 'wing-l', kind: 'photo', shape: { type: 'poly', points: [[0, 0.26], [0.22, 0.26], [0.14, 0.5], [0, 0.72]] } },
      { id: 'wing-r', kind: 'photo', shape: { type: 'poly', points: [[1, 0.26], [0.78, 0.26], [0.86, 0.5], [1, 0.72]] } },
      { id: 'title', kind: 'title', shape: { type: 'poly', points: [[0.22, 0.78], [0.78, 0.78], [1, 1], [0, 1]] } },
    ],
  },
  {
    id: 'split-2x2',
    name: 'Split Screen 2×2',
    blurb: 'Four equal photo quarters with a title band at the base.',
    slots: [
      { id: 'q-tl', kind: 'photo', shape: { type: 'rect', x: 0, y: 0, w: 0.5, h: 0.44 } },
      { id: 'q-tr', kind: 'photo', shape: { type: 'rect', x: 0.5, y: 0, w: 0.5, h: 0.44 } },
      { id: 'q-bl', kind: 'photo', shape: { type: 'rect', x: 0, y: 0.44, w: 0.5, h: 0.44 } },
      { id: 'q-br', kind: 'photo', shape: { type: 'rect', x: 0.5, y: 0.44, w: 0.5, h: 0.44 } },
      { id: 'title', kind: 'title', shape: { type: 'rect', x: 0, y: 0.88, w: 1, h: 0.12 } },
    ],
  },
  {
    id: 'l-shape',
    name: 'L-Shape',
    blurb: 'One big hero on the left, two stacked shots on the right.',
    slots: [
      { id: 'hero', kind: 'photo', shape: { type: 'rect', x: 0, y: 0, w: 0.62, h: 0.86 } },
      { id: 'side-top', kind: 'photo', shape: { type: 'rect', x: 0.62, y: 0, w: 0.38, h: 0.43 } },
      { id: 'side-low', kind: 'photo', shape: { type: 'rect', x: 0.62, y: 0.43, w: 0.38, h: 0.43 } },
      { id: 'title', kind: 'title', shape: { type: 'rect', x: 0, y: 0.86, w: 1, h: 0.14 } },
    ],
  },
  {
    id: 'radial-burst',
    name: 'Radial Burst',
    blurb: 'A round hero at the centre, six wedges bursting around it.',
    slots: [
      { id: 'hero', kind: 'photo', shape: { type: 'circle', cx: 0.5, cy: 0.5, r: 0.21 } },
      { id: 'wedge-0', kind: 'photo', shape: { type: 'wedge', cx: 0.5, cy: 0.5, r: 0.52, a0: -90, a1: -30 } },
      { id: 'wedge-1', kind: 'sky', shape: { type: 'wedge', cx: 0.5, cy: 0.5, r: 0.52, a0: -30, a1: 30 } },
      { id: 'wedge-2', kind: 'photo', shape: { type: 'wedge', cx: 0.5, cy: 0.5, r: 0.52, a0: 30, a1: 90 } },
      { id: 'wedge-3', kind: 'photo', shape: { type: 'wedge', cx: 0.5, cy: 0.5, r: 0.52, a0: 90, a1: 150 } },
      { id: 'wedge-4', kind: 'sky', shape: { type: 'wedge', cx: 0.5, cy: 0.5, r: 0.52, a0: 150, a1: 210 } },
      { id: 'wedge-5', kind: 'photo', shape: { type: 'wedge', cx: 0.5, cy: 0.5, r: 0.52, a0: 210, a1: 270 } },
      { id: 'title', kind: 'title', shape: { type: 'rect', x: 0, y: 0.9, w: 1, h: 0.1 } },
    ],
  },
  {
    id: 'banner-stack',
    name: 'Banner Stack',
    blurb: 'Three wide photo bands with a title banner at the bottom.',
    slots: [
      { id: 'band-a', kind: 'photo', shape: { type: 'rect', x: 0, y: 0, w: 1, h: 0.3 } },
      { id: 'band-b', kind: 'photo', shape: { type: 'rect', x: 0, y: 0.3, w: 1, h: 0.3 } },
      { id: 'band-c', kind: 'photo', shape: { type: 'rect', x: 0, y: 0.6, w: 1, h: 0.28 } },
      { id: 'title', kind: 'title', shape: { type: 'rect', x: 0, y: 0.88, w: 1, h: 0.12 } },
    ],
  },
  {
    id: 'marquee',
    name: 'Marquee',
    blurb: 'A big marquee photo, a title band, two small shots below.',
    slots: [
      { id: 'hero', kind: 'photo', shape: { type: 'rect', x: 0, y: 0, w: 1, h: 0.52 } },
      { id: 'title', kind: 'title', shape: { type: 'rect', x: 0, y: 0.52, w: 1, h: 0.14 } },
      { id: 'small-l', kind: 'photo', shape: { type: 'rect', x: 0, y: 0.66, w: 0.5, h: 0.34 } },
      { id: 'small-r', kind: 'photo', shape: { type: 'rect', x: 0.5, y: 0.66, w: 0.5, h: 0.34 } },
    ],
  },
];

// A grade is a filter recipe: saturation, contrast and brightness applied
// with SVG filters, plus a translucent tint laid over the photo.
export const GRADES = [
  { id: 'neon-punch', name: 'Neon Punch', saturate: 1.5, contrast: 1.12, brightness: 1.02, tint: '#ff2c80', tintOpacity: 0.08, blurb: 'Hot saturation, magenta kiss.' },
  { id: 'sun-bleach', name: 'Sun Bleach', saturate: 0.85, contrast: 0.88, brightness: 1.12, tint: '#ff9f1c', tintOpacity: 0.14, blurb: 'Bright, washed, golden hour.' },
  { id: 'midnight-glow', name: 'Midnight Glow', saturate: 1.1, contrast: 1.15, brightness: 0.82, tint: '#2e1a47', tintOpacity: 0.22, blurb: 'Dark violet nights, lit edges.' },
  { id: 'retro-film', name: 'Retro Film', saturate: 0.9, contrast: 1.08, brightness: 1.0, tint: '#e8d44d', tintOpacity: 0.1, blurb: '80s VHS warmth, soft yellow.' },
  { id: 'palm-shade', name: 'Palm Shade', saturate: 0.95, contrast: 1.05, brightness: 0.95, tint: '#00c5c9', tintOpacity: 0.14, blurb: 'Cool teal shade under the palms.' },
  { id: 'neon-outline', name: 'Neon Outline', saturate: 0, contrast: 1.6, brightness: 1.05, tint: '#ff5e57', tintOpacity: 0.18, blurb: 'High-contrast black and white, coral glow.' },
];

export const EXPORT_SIZES = [
  { id: 'square', label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
  { id: 'big-square', label: 'Big square · 1920 × 1920', w: 1920, h: 1920 },
];

export const SAMPLE_PHOTOS = [
  { id: 'neon-avenue', name: 'Neon Avenue', src: 'samples/neon-avenue.jpg' },
  { id: 'sunset-boulevard', name: 'Sunset Boulevard', src: 'samples/sunset-boulevard.jpg' },
  { id: 'boardwalk-duo', name: 'Boardwalk Duo', src: 'samples/boardwalk-duo.jpg' },
];

export const CAPTION_IDEAS = [
  'SUNSET HEIST',
  'VICE CITY NIGHTS',
  'NEON GETAWAY',
  'PALM TREE PARADISE',
  'BOARDWALK KINGS',
  'MIDNIGHT CRUISE',
  'GOLDEN HOUR GANG',
  'TURBO SUNSET',
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}
