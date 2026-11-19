// Neon Heist Canvas — the code-drawn Vice City sunset backdrop.
// Every sky panel of a poster is filled by these builders: a gradient sky, a
// striped setting sun, a building skyline, palm silhouettes, film grain and a
// halftone band. Nothing here is an image or a font — it is all SVG shapes,
// drawn fresh for each panel, so it never covers a photo: the engine only ever
// calls it for panels whose kind is 'sky'.

// One palette per grade. The sky always runs from deep top to warm horizon;
// the sun and the ground follow the same mood.
export const SKY_PALETTES = {
  none: { top: '#1c2b52', mid: '#7a4a8f', low: '#e8703f', horizon: '#ffc46b', sun: '#ffd76b', sunCore: '#fff3c4', ground: '#160d28', palm: '#120a20' },
  sunset: { top: '#241640', mid: '#a8326d', low: '#ff7a2f', horizon: '#ffc46b', sun: '#ffd76b', sunCore: '#fff3c4', ground: '#1a0f2e', palm: '#140a24' },
  neon: { top: '#12082e', mid: '#7a1e8f', low: '#e02e9e', horizon: '#38e1ff', sun: '#ff5ce1', sunCore: '#ffe9fb', ground: '#0d0620', palm: '#0a0518' },
  noir: { top: '#05070d', mid: '#101827', low: '#24344d', horizon: '#5a7290', sun: '#c8d4e2', sunCore: '#eef3f8', ground: '#04060a', palm: '#03050a' },
  vice: { top: '#2e3a5e', mid: '#8f7fb0', low: '#e8a7b8', horizon: '#f4d7c8', sun: '#ffe9a8', sunCore: '#fffbe8', ground: '#221d33', palm: '#1a1526' },
  miami: { top: '#082a3a', mid: '#0f7d8f', low: '#e02e9e', horizon: '#ff9a3d', sun: '#ff5c8a', sunCore: '#ffe9f2', ground: '#0a1226', palm: '#080e1e' },
};

export function paletteFor(gradeId) {
  return SKY_PALETTES[gradeId] ?? SKY_PALETTES.sunset;
}

// A tiny deterministic hash, so one panel always draws the same skyline and
// stars: no Math.random in the render path, which keeps exports identical.
export function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (n) => Math.round(n * 100) / 100;

// The striped sun: a disc whose lower half is cut by sky-coloured bars, the
// classic setting-sun look. Drawn as a circle plus bars, all clipped to the
// circle itself.
export function sunSVG(cx, cy, r, pal, uid) {
  const bars = [];
  const gaps = 5;
  for (let i = 0; i < gaps; i++) {
    const y = cy + (r * (i + 0.6)) / gaps;
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
    const thick = r * 0.09 + i * r * 0.035;
    bars.push(`<rect x="${esc(cx - half)}" y="${esc(y)}" width="${esc(half * 2)}" height="${esc(thick)}" fill="${pal.low}" opacity="0.92"/>`);
  }
  return `<g clip-path="url(#sunclip-${uid})">`
    + `<circle cx="${esc(cx)}" cy="${esc(cy)}" r="${esc(r)}" fill="url(#sunglow-${uid})"/>`
    + `<circle cx="${esc(cx)}" cy="${esc(cy)}" r="${esc(r * 0.92)}" fill="${pal.sun}"/>`
    + `<circle cx="${esc(cx)}" cy="${esc(cy - r * 0.18)}" r="${esc(r * 0.55)}" fill="${pal.sunCore}" opacity="0.85"/>`
    + bars.join('')
    + `</g>`
    + `<defs><clipPath id="sunclip-${uid}"><circle cx="${esc(cx)}" cy="${esc(cy)}" r="${esc(r)}"/></clipPath>`
    + `<radialGradient id="sunglow-${uid}"><stop offset="0%" stop-color="${pal.sunCore}"/><stop offset="55%" stop-color="${pal.sun}"/><stop offset="100%" stop-color="${pal.sun}" stop-opacity="0"/></radialGradient></defs>`;
}

// A jagged building skyline along the bottom of a box, with a couple of
// antennae and lit windows. The seed keeps it identical on every render.
export function skylineSVG(x, y, w, h, pal, seedText) {
  const rnd = mulberry32(seedOf(seedText));
  const base = y + h;
  let d = `M ${esc(x)} ${esc(base)} `;
  let cx = x;
  while (cx < x + w) {
    const bw = w * (0.05 + rnd() * 0.09);
    const bh = h * (0.35 + rnd() * 0.6);
    const top = base - bh;
    d += `L ${esc(cx)} ${esc(top)} `;
    if (rnd() > 0.72) {
      const ax = cx + bw * (0.3 + rnd() * 0.4);
      d += `L ${esc(ax)} ${esc(top)} L ${esc(ax)} ${esc(top - h * 0.22)} L ${esc(ax + 2)} ${esc(top - h * 0.22)} L ${esc(ax + 2)} ${esc(top)} `;
    }
    d += `L ${esc(cx + bw)} ${esc(top)} L ${esc(cx + bw)} ${esc(base)} `;
    cx += bw + w * 0.012;
  }
  d += `L ${esc(x + w)} ${esc(base)} Z`;
  const windows = [];
  const wn = Math.floor(w / 46);
  for (let i = 0; i < wn; i++) {
    if (rnd() > 0.45) continue;
    const wx = x + 8 + rnd() * (w - 16);
    const wy = base - h * (0.15 + rnd() * 0.6);
    windows.push(`<rect x="${esc(wx)}" y="${esc(wy)}" width="5" height="7" fill="${pal.horizon}" opacity="0.75"/>`);
  }
  return `<path d="${d}" fill="${pal.ground}"/>` + windows.join('');
}

// One palm: a leaning trunk and six curved fronds, as a single path group.
// lean bends the crown away from the trunk base; s is the overall size.
export function palmSVG(x, y, s, lean, pal) {
  const topX = x + lean * s;
  const topY = y - s;
  const trunk = `M ${esc(x - s * 0.03)} ${esc(y)} Q ${esc(x + lean * s * 0.4)} ${esc(y - s * 0.55)} ${esc(topX)} ${esc(topY)} `
    + `L ${esc(topX + s * 0.035)} ${esc(topY)} Q ${esc(x + lean * s * 0.45 + s * 0.05)} ${esc(y - s * 0.5)} ${esc(x + s * 0.03)} ${esc(y)} Z`;
  const fronds = [];
  const spread = [-150, -105, -60, -15, 30, 75, 120];
  for (let i = 0; i < spread.length; i++) {
    const a = (spread[i] * Math.PI) / 180;
    const len = s * (0.42 + (i % 3) * 0.07);
    const tipX = topX + Math.sin(a) * len;
    const tipY = topY - Math.abs(Math.cos(a)) * len * 0.55 + len * 0.18;
    const midX = topX + Math.sin(a) * len * 0.55;
    const midY = topY - Math.abs(Math.cos(a)) * len * 0.28 - len * 0.1;
    fronds.push(`M ${esc(topX)} ${esc(topY)} Q ${esc(midX)} ${esc(midY)} ${esc(tipX)} ${esc(tipY)} `
      + `Q ${esc(midX + (tipX - midX) * 0.4)} ${esc(midY + 6)} ${esc(topX)} ${esc(topY + 4)} Z`);
  }
  return `<g fill="${pal.palm}"><path d="${trunk}"/>${fronds.join('')}</g>`;
}

// Halftone dots along the top edge of a box, fading downward.
export function halftoneSVG(x, y, w, h, color, uid) {
  return `<rect x="${esc(x)}" y="${esc(y)}" width="${esc(w)}" height="${esc(h)}" fill="url(#dots-${uid})"/>`
    + `<defs><pattern id="dots-${uid}" width="14" height="14" patternUnits="userSpaceOnUse">`
    + `<circle cx="7" cy="7" r="3.2" fill="${color}"/>`
    + `</pattern></defs>`;
}

// A night sky's stars, deterministic per panel, only for the noir grade.
export function starsSVG(x, y, w, h, seedText) {
  const rnd = mulberry32(seedOf(seedText + ':stars'));
  const dots = [];
  const n = Math.floor((w * h) / 9000);
  for (let i = 0; i < n; i++) {
    const sx = x + rnd() * w;
    const sy = y + rnd() * h * 0.55;
    const r = 0.8 + rnd() * 1.7;
    dots.push(`<circle cx="${esc(sx)}" cy="${esc(sy)}" r="${esc(r)}" fill="#dfe9f5" opacity="${esc(0.35 + rnd() * 0.55)}"/>`);
  }
  return dots.join('');
}

// The whole sky panel, clipped to its own shape: gradient sky, striped sun,
// skyline, palms, grain and a halftone crown. box is {x, y, w, h} in canvas
// pixels; clipId is a unique id for this panel's clipPath; gradeId picks the
// palette and whether stars appear.
export function skyPanelSVG(box, clipId, gradeId, seedText) {
  const pal = paletteFor(gradeId);
  const { x, y, w, h } = box;
  const uid = clipId;
  const sunR = Math.min(w, h) * 0.3;
  const sunCx = x + w * 0.5;
  const sunCy = y + h * 0.44;
  const skylineH = h * 0.34;
  const skylineY = y + h - skylineH;
  const rnd = mulberry32(seedOf(seedText + ':palms'));
  const palms = [];
  const palmCount = w > 300 ? 3 : 2;
  for (let i = 0; i < palmCount; i++) {
    const px = x + w * (0.12 + i * 0.36 + rnd() * 0.08);
    const ps = h * (0.3 + rnd() * 0.12);
    palms.push(palmSVG(px, y + h, ps, (rnd() - 0.5) * 0.5, pal));
  }
  const stars = gradeId === 'noir' ? starsSVG(x, y, w, h, seedText) : '';
  return `<g clip-path="url(#${clipId})">`
    + `<defs><linearGradient id="sky-${uid}" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0%" stop-color="${pal.top}"/><stop offset="45%" stop-color="${pal.mid}"/>`
    + `<stop offset="78%" stop-color="${pal.low}"/><stop offset="100%" stop-color="${pal.horizon}"/>`
    + `</linearGradient>`
    + `<filter id="grain-${uid}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>`
    + `<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.06 0"/></filter></defs>`
    + `<rect x="${esc(x)}" y="${esc(y)}" width="${esc(w)}" height="${esc(h)}" fill="url(#sky-${uid})"/>`
    + stars
    + sunSVG(sunCx, sunCy, sunR, pal, uid)
    + skylineSVG(x, skylineY, w, skylineH, pal, seedText)
    + palms.join('')
    + `<rect x="${esc(x)}" y="${esc(y)}" width="${esc(w)}" height="${esc(h * 0.22)}" fill="url(#dots-${uid})" opacity="0.16"/>`
    + `<defs><pattern id="dots-${uid}" width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="6.5" cy="6.5" r="2.6" fill="#ffffff"/></pattern></defs>`
    + `<rect x="${esc(x)}" y="${esc(y)}" width="${esc(w)}" height="${esc(h)}" filter="url(#grain-${uid})" opacity="0.5"/>`
    + `</g>`;
}
