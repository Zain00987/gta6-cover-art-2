// Neon Heist Canvas — poster render engine (my own design, no libraries).
// Everything is drawn on one canvas in a normalized 0..1 space and scaled to any
// output size, so the editor preview and the PNG exports are the same drawing.
// Panels are slanted quads; the hero panel is drawn last so it pops out over its
// neighbours. Photos are drawn cover-fit inside their panel clip with per-panel
// pan / zoom / flip; empty panels are "sky panels" — gradient sky, retro sun,
// palm silhouettes and glow are drawn ONLY there, never over a photo.
'use strict';

// ---------------------------------------------------------------- grades
export const GRADES = {
  sunset: { name: 'Sunset', sky: ['#ff9a3d', '#ff5e7a', '#7b2f8b'], tint: '#ff7a3d', tintAlpha: 0.16, bg: '#1c0b22' },
  neon: { name: 'Neon', sky: ['#ff00a5', '#7b2ff7', '#12002e'], tint: '#ff00a5', tintAlpha: 0.2, bg: '#0d0218' },
  vice: { name: 'Vice City', sky: ['#ff6f61', '#ff9472', '#3d1a5e'], tint: '#ff6f61', tintAlpha: 0.16, bg: '#200e2e' },
  noir: { name: 'Noir', sky: ['#4a4a4a', '#1c1c1c', '#000000'], tint: '#000000', tintAlpha: 0.0, bg: '#0a0a0a', photoFilter: 'grayscale(0.92) contrast(1.15) brightness(1.05)' },
  miami: { name: 'Miami', sky: ['#ffb400', '#ff7f50', '#ff4e50'], tint: '#ffb400', tintAlpha: 0.16, bg: '#221006' },
  gold: { name: 'Twilight Gold', sky: ['#ffcc33', '#ff8800', '#5e1a3d'], tint: '#ffaa00', tintAlpha: 0.18, bg: '#241106' },
};
export const GRADE_IDS = Object.keys(GRADES);

// ---------------------------------------------------------------- roles & copy pools
export const ROLES = ['THE BOSS', 'THE DRIVER', 'THE LOOKOUT', 'THE FIXER', 'THE INSIDER', 'THE MECHANIC'];
export const TITLES = ['COASTAL CONTRABAND', 'NEON HEIST', 'LEONIDA NIGHTS', 'PALM LINE PAYDAY', 'LAST SUMMER JOB', 'TIDE & TROUBLE'];
export const SUBTITLES = [
  'one last summer on the Leonida coast',
  'the coast is never clear',
  'every sunset has a price',
  'six friends, one getaway car',
  'when the tide turns, the loot rises',
];
export const QUOTES = [
  ['A COASTLINE CAPER THAT REWRITES THE RULEBOOK', 'THE LEONIDA GAZETTE'],
  ['PURE GOLDEN-HOUR MAYHEM', 'THE HARBOR GAZETTE'],
  ['HOTTER THAN THE ASPHALT', 'THE PALM GAZETTE'],
  ['A SUN-SOAKED THRILL RIDE', 'THE BAYSIDE BUGLE'],
  ['THE SUMMER JOB OF THE DECADE', 'THE VICE HERALD'],
];
export const TAGLINES = [
  'FIVE FRIENDS · ONE COAST · NO WAY BACK',
  'ONE COASTLINE · SIX STORIES · NO CURFEW',
  'THE WAVES HIDE MORE THAN SECRETS',
  'SIX CREW · ONE SCORE · ZERO REGRETS',
  'DRIVE FAST · LOOK GOOD · LEAVE NO TRACE',
];

// ---------------------------------------------------------------- layouts
// Each layout: 6 slanted quads in normalized coords, a hero index, and where
// the giant title sits. Panels are drawn in order; the hero is drawn last.
function quad(x1, y1, x2, y2, x3, y3, x4, y4) {
  return [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
}

function fanLayout() {
  // Radial burst: six wedges fanning out of a vanishing point near the bottom.
  const cx = 0.5, cy = 0.86, rOuter = 0.86, rInner = 0.16;
  const panels = [];
  for (let i = 0; i < 6; i++) {
    const a0 = (-72 + (i * 144) / 6) * Math.PI / 180;
    const a1 = (-72 + ((i + 1) * 144) / 6) * Math.PI / 180;
    const hero = i === 2;
    const r = hero ? rOuter + 0.06 : rOuter;
    const o0 = [cx + Math.sin(a0) * r, cy - Math.cos(a0) * r];
    const o1 = [cx + Math.sin(a1) * r, cy - Math.cos(a1) * r];
    const i1 = [cx + Math.sin(a1) * rInner, cy - Math.cos(a1) * rInner];
    const i0 = [cx + Math.sin(a0) * rInner, cy - Math.cos(a0) * rInner];
    panels.push({ pts: [o0, o1, i1, i0], hero });
  }
  return { id: 'radial', name: 'Radial Burst', titlePos: 'mid', panels };
}

export const LAYOUTS = [
  {
    id: 'hero-slant', name: 'Hero Slant', titlePos: 'mid',
    panels: [
      { pts: quad(0.02, 0.07, 0.30, 0.10, 0.285, 0.42, 0.02, 0.40) },
      { pts: quad(0.02, 0.42, 0.285, 0.44, 0.27, 0.78, 0.02, 0.76) },
      { pts: quad(0.30, 0.025, 0.70, 0.055, 0.68, 0.845, 0.30, 0.815), hero: true },
      { pts: quad(0.70, 0.055, 0.98, 0.085, 0.965, 0.40, 0.68, 0.375) },
      { pts: quad(0.68, 0.395, 0.965, 0.42, 0.95, 0.60, 0.68, 0.575) },
      { pts: quad(0.68, 0.595, 0.95, 0.62, 0.935, 0.78, 0.68, 0.755) },
    ],
  },
  {
    id: 'solo', name: 'Solo', titlePos: 'bottom',
    panels: [
      { pts: quad(0.04, 0.06, 0.96, 0.10, 0.94, 0.72, 0.04, 0.68), hero: true },
      { pts: quad(0.04, 0.735, 0.215, 0.74, 0.21, 0.795, 0.04, 0.79) },
      { pts: quad(0.225, 0.74, 0.40, 0.745, 0.395, 0.80, 0.225, 0.795) },
      { pts: quad(0.41, 0.745, 0.585, 0.75, 0.58, 0.80, 0.41, 0.795) },
      { pts: quad(0.595, 0.75, 0.77, 0.745, 0.765, 0.795, 0.595, 0.80) },
      { pts: quad(0.78, 0.745, 0.96, 0.74, 0.955, 0.79, 0.78, 0.795) },
    ],
  },
  {
    id: 'duo', name: 'Diagonal Duo', titlePos: 'mid',
    panels: [
      { pts: quad(0.02, 0.06, 0.51, 0.11, 0.49, 0.68, 0.02, 0.63), hero: true },
      { pts: quad(0.51, 0.11, 0.98, 0.06, 0.96, 0.63, 0.49, 0.68) },
      { pts: quad(0.02, 0.70, 0.255, 0.71, 0.25, 0.795, 0.02, 0.79) },
      { pts: quad(0.265, 0.71, 0.50, 0.72, 0.495, 0.80, 0.265, 0.795) },
      { pts: quad(0.51, 0.72, 0.745, 0.71, 0.74, 0.795, 0.51, 0.80) },
      { pts: quad(0.755, 0.71, 0.98, 0.70, 0.975, 0.79, 0.755, 0.795) },
    ],
  },
  {
    id: 'strips', name: 'Offset Strips', titlePos: 'top',
    panels: [
      { pts: quad(0.02, 0.06, 0.173, 0.06, 0.173, 0.78, 0.02, 0.78) },
      { pts: quad(0.181, 0.10, 0.335, 0.10, 0.335, 0.80, 0.181, 0.80) },
      { pts: quad(0.343, 0.03, 0.496, 0.03, 0.496, 0.84, 0.343, 0.84), hero: true },
      { pts: quad(0.504, 0.10, 0.658, 0.10, 0.658, 0.80, 0.504, 0.80) },
      { pts: quad(0.666, 0.06, 0.819, 0.06, 0.819, 0.78, 0.666, 0.78) },
      { pts: quad(0.827, 0.10, 0.98, 0.10, 0.98, 0.80, 0.827, 0.80) },
    ],
  },
  {
    id: 'quad', name: 'Staggered Quad', titlePos: 'mid',
    panels: [
      { pts: quad(0.02, 0.055, 0.98, 0.075, 0.975, 0.105, 0.02, 0.085) },
      { pts: quad(0.02, 0.12, 0.49, 0.16, 0.475, 0.44, 0.02, 0.40) },
      { pts: quad(0.51, 0.16, 0.98, 0.12, 0.965, 0.40, 0.475, 0.44), hero: true },
      { pts: quad(0.02, 0.42, 0.475, 0.46, 0.46, 0.76, 0.02, 0.72) },
      { pts: quad(0.495, 0.46, 0.965, 0.42, 0.95, 0.72, 0.46, 0.76) },
      { pts: quad(0.02, 0.775, 0.98, 0.755, 0.975, 0.79, 0.02, 0.80) },
    ],
  },
  {
    id: 'triptych', name: 'Triptych', titlePos: 'mid',
    panels: [
      { pts: quad(0.02, 0.06, 0.335, 0.09, 0.325, 0.68, 0.02, 0.65) },
      { pts: quad(0.345, 0.04, 0.66, 0.04, 0.65, 0.72, 0.325, 0.72), hero: true },
      { pts: quad(0.67, 0.06, 0.98, 0.09, 0.97, 0.65, 0.65, 0.65) },
      { pts: quad(0.02, 0.70, 0.335, 0.71, 0.33, 0.795, 0.02, 0.79) },
      { pts: quad(0.345, 0.71, 0.66, 0.70, 0.655, 0.79, 0.345, 0.795) },
      { pts: quad(0.67, 0.70, 0.98, 0.71, 0.975, 0.79, 0.67, 0.795) },
    ],
  },
  fanLayout(),
];

// Default panel assignment: three photo panels (three different people, nobody
// twice) and three sky panels. Roles ride along with the panels.
export function defaultPanels() {
  return [
    { src: 'samples/driver.jpg', role: 'THE DRIVER', grade: '', flip: false, zoom: 1.15, panX: 0, panY: 0 },
    { src: 'samples/lookout.jpg', role: 'THE LOOKOUT', grade: '', flip: false, zoom: 1.15, panX: 0, panY: 0 },
    { src: 'samples/boss.jpg', role: 'THE BOSS', grade: '', flip: false, zoom: 1.1, panX: 0, panY: 0 },
    { src: null, role: 'THE FIXER', grade: '', flip: false, zoom: 1, panX: 0, panY: 0 },
    { src: null, role: 'THE INSIDER', grade: '', flip: false, zoom: 1, panX: 0, panY: 0 },
    { src: null, role: 'THE MECHANIC', grade: '', flip: false, zoom: 1, panX: 0, panY: 0 },
  ];
}

export function defaultState() {
  return {
    layout: 'hero-slant',
    grade: 'sunset',
    title: 'COASTAL CONTRABAND',
    subtitle: 'one last summer on the Leonida coast',
    quote: 'A COASTLINE CAPER THAT REWRITES THE RULEBOOK',
    gazette: 'THE LEONIDA GAZETTE',
    tagline: 'FIVE FRIENDS · ONE COAST · NO WAY BACK',
    billing: 'A SUNSET PICTURES PRODUCTION · STARRING YOU',
    panels: defaultPanels(),
    selected: 2,
  };
}

// ---------------------------------------------------------------- geometry helpers
export function layoutOf(state) {
  return LAYOUTS.find((l) => l.id === state.layout) ?? LAYOUTS[0];
}

function bboxOf(pts, W, H) {
  const xs = pts.map((p) => p[0] * W), ys = pts.map((p) => p[1] * H);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

export function pointInPolygon(px, py, pts, W, H) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0] * W, yi = pts[i][1] * H;
    const xj = pts[j][0] * W, yj = pts[j][1] * H;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Hit-test in draw order (hero on top): check the hero first, then the rest reversed.
export function panelAt(state, x, y, W, H) {
  const layout = layoutOf(state);
  const order = layout.panels.map((p, i) => i).sort((a, b) => {
    const ha = layout.panels[a].hero ? 1 : 0, hb = layout.panels[b].hero ? 1 : 0;
    return hb - ha || b - a;
  });
  for (const i of order) {
    if (pointInPolygon(x, y, layout.panels[i].pts, W, H)) return i;
  }
  return -1;
}

function pathOf(ctx, pts, W, H) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * W, y * H) : ctx.lineTo(x * W, y * H)));
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Deterministic pseudo-random from a seed (barcode bars, palm jitter).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- sky art (empty panels only)
function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * 0.045);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.06, y - s * 0.55, x + s * 0.16, y - s * 0.95); ctx.stroke();
  const topX = x + s * 0.16, topY = y - s * 0.95;
  ctx.lineWidth = Math.max(1.5, s * 0.028);
  for (let k = 0; k < 7; k++) {
    const a = (-160 + k * 52) * Math.PI / 180;
    const len = s * (0.5 + (k % 2) * 0.14);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.55 - s * 0.1, topX + Math.cos(a) * len, topY + Math.sin(a) * len + s * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkyPanel(ctx, box, grade, seed) {
  const { x, y, w, h } = box;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, grade.sky[0]);
  g.addColorStop(0.55, grade.sky[1]);
  g.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // Glow behind the sun.
  const sunR = Math.min(w, h) * 0.30;
  const sunX = x + w * 0.62, sunY = y + h * 0.42;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3.2);
  glow.addColorStop(0, 'rgba(255, 236, 170, 0.85)');
  glow.addColorStop(1, 'rgba(255, 236, 170, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  // Retro sun with horizontal slits in its lower half.
  ctx.save();
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.clip();
  const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sg.addColorStop(0, '#ffe98a'); sg.addColorStop(1, '#ff5e3a');
  ctx.fillStyle = sg; ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = grade.sky[1];
  let slitY = sunY + sunR * 0.08, slitH = Math.max(2, h * 0.012);
  while (slitY < sunY + sunR) {
    ctx.fillRect(sunX - sunR, slitY, sunR * 2, slitH);
    slitY += slitH + Math.max(3, h * 0.02);
    slitH *= 1.6;
  }
  ctx.restore();
  // Distant skyline silhouette.
  const rnd = mulberry32(seed);
  ctx.fillStyle = 'rgba(26, 8, 34, 0.55)';
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.06 + rnd() * 0.08);
    const bh = h * (0.08 + rnd() * 0.14);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    bx += bw + w * 0.012;
  }
  ctx.fillStyle = 'rgba(26, 8, 34, 0.75)';
  ctx.fillRect(x, y + h - h * 0.07, w, h * 0.07);
  // Palm silhouettes, left and right edges.
  drawPalm(ctx, x + w * 0.10, y + h * 0.98, Math.min(w, h) * 0.55, 'rgba(16, 4, 22, 0.9)');
  drawPalm(ctx, x + w * 0.92, y + h * 0.99, Math.min(w, h) * 0.42, 'rgba(16, 4, 22, 0.85)');
}

// ---------------------------------------------------------------- chrome title
function drawChromeTitle(ctx, text, cx, y, size, W) {
  let s = size;
  ctx.font = `${s}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  while (ctx.measureText(text).width > W * 0.96 && s > 24) {
    s -= 4;
    ctx.font = `${s}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  }
  // Thick dark outline + drop shadow on the main canvas.
  ctx.save();
  ctx.font = `${s}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = s * 0.09;
  ctx.shadowOffsetY = s * 0.045;
  ctx.lineWidth = s * 0.085;
  ctx.strokeStyle = '#14060f';
  ctx.strokeText(text, cx, y);
  ctx.restore();
  // Gradient + retro stripes, composited through the text shape on an offscreen.
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(W));
  off.height = Math.max(2, Math.round(s * 1.5));
  const o = off.getContext('2d');
  o.font = `${s}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  o.textAlign = 'center'; o.textBaseline = 'middle';
  o.fillStyle = '#fff';
  o.fillText(text, cx, off.height / 2);
  o.globalCompositeOperation = 'source-in';
  const g = o.createLinearGradient(0, 0, 0, off.height);
  g.addColorStop(0, '#ffe066');
  g.addColorStop(0.38, '#ff7a3d');
  g.addColorStop(0.62, '#ff4d8d');
  g.addColorStop(1, '#8b5cf6');
  o.fillStyle = g;
  o.fillRect(0, 0, off.width, off.height);
  o.globalCompositeOperation = 'source-atop';
  o.fillStyle = 'rgba(255,255,255,0.30)';
  for (let yy = off.height * 0.16; yy < off.height * 0.9; yy += s * 0.17) {
    o.fillRect(0, yy, off.width, Math.max(2, s * 0.05));
  }
  o.globalCompositeOperation = 'source-atop';
  const sheen = o.createLinearGradient(0, 0, off.width, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  o.fillStyle = sheen;
  o.fillRect(0, 0, off.width, off.height);
  ctx.drawImage(off, 0, y - off.height / 2, W, off.height);
}

// ---------------------------------------------------------------- text helpers
function shadowedText(ctx, text, x, y, font, fill, shadow = 'rgba(0,0,0,0.65)', blur = 6) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRoleTagAt(ctx, panel, tx, ty, tagW, tagH, size) {
  const font = `${Math.round(size)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  const padX = size * 0.55;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 4, 12, 0.82)';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, tx, ty, tagW, tagH, size * 0.32);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = '#ffe9c9';
  ctx.textBaseline = 'middle';
  ctx.fillText(panel.role, tx + padX, ty + tagH / 2);
  ctx.restore();
}

// ---------------------------------------------------------------- the poster
export function renderPoster(ctx, W, H, state, images, opts = {}) {
  const showSelection = opts.showSelection !== false;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const layout = layoutOf(state);
  const S = W / 1080; // scale factor: all type sizes derive from the 1080 grid

  // Backdrop.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, grade.bg);
  bg.addColorStop(1, '#0a0510');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Panels: non-hero first, hero last (pop-out).
  const order = layout.panels.map((p, i) => i).sort((a, b) => {
    const ha = layout.panels[a].hero ? 1 : 0, hb = layout.panels[b].hero ? 1 : 0;
    return ha - hb || a - b;
  });
  const selectedBox = { x: 0, y: 0, w: 0, h: 0, pts: null };
  const tagJobs = []; // role tags are drawn in a separate pass after all panels
  for (const i of order) {
    const def = layout.panels[i];
    const panel = state.panels[i];
    const box = bboxOf(def.pts, W, H);
    if (showSelection && state.selected === i) Object.assign(selectedBox, box, { pts: def.pts });
    const pGrade = panel.grade ? GRADES[panel.grade] ?? grade : grade;

    ctx.save();
    pathOf(ctx, def.pts, W, H);
    ctx.clip();
    const img = panel.src ? images.get(panel.src) : null;
    if (img && img.naturalWidth > 0) {
      // Cover-fit with pan / zoom / flip.
      const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) * panel.zoom;
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      const dx = box.cx - dw / 2 + panel.panX * box.w * 0.5;
      const dy = box.cy - dh / 2 + panel.panY * box.h * 0.5;
      if (pGrade.photoFilter) ctx.filter = pGrade.photoFilter;
      ctx.save();
      if (panel.flip) {
        ctx.translate(box.cx, 0);
        ctx.scale(-1, 1);
        ctx.translate(-box.cx, 0);
      }
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
      ctx.filter = 'none';
      // Grade tint over the photo, plus a soft vignette.
      if (pGrade.tintAlpha > 0) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = Math.min(1, pGrade.tintAlpha * 2.4);
        ctx.fillStyle = pGrade.tint;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      const vg = ctx.createRadialGradient(box.cx, box.cy, Math.min(box.w, box.h) * 0.35, box.cx, box.cy, Math.max(box.w, box.h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = vg;
      ctx.fillRect(box.x, box.y, box.w, box.h);
    } else {
      drawSkyPanel(ctx, box, pGrade, 1000 + i * 77);
    }
    ctx.restore();

    // Panel frame + role ribbon (drawn after the clip is released).
    ctx.save();
    pathOf(ctx, def.pts, W, H);
    ctx.lineWidth = Math.max(2, 3.5 * S);
    ctx.strokeStyle = def.hero ? '#ffe9c9' : 'rgba(255, 233, 201, 0.85)';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = def.hero ? 18 * S : 8 * S;
    ctx.shadowOffsetY = 4 * S;
    ctx.stroke();
    ctx.restore();
    if (box.h > 34 * S) tagJobs.push({ panel, box });
  }

  // (Role tags are drawn after the title below, so they are always on top
  // and never hidden behind the title or another panel.)

  // Quote bar (top): five stars + quote + gazette, on a dark pill.
  // Drawn AFTER the panels so a pop-out hero never covers it; the font
  // shrinks until the line fits the pill.
  let qSize = 24 * S;
  const quoteText = `★★★★★  ${state.quote}  —  ${state.gazette}`;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  while (qSize > 12 * S) {
    ctx.font = `${Math.round(qSize)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    if (ctx.measureText(quoteText).width <= W * 0.90) break;
    qSize -= 1;
  }
  ctx.fillStyle = 'rgba(8, 4, 12, 0.78)';
  roundRect(ctx, W * 0.02, H * 0.012, W * 0.96, H * 0.046, 10 * S);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 5 * S; ctx.shadowOffsetY = 2;
  ctx.fillText(quoteText, W / 2, H * 0.035);
  ctx.restore();

  // Giant chrome title + script subtitle. Position follows the layout.
  const titleY = layout.titlePos === 'top' ? H * 0.20 : layout.titlePos === 'bottom' ? H * 0.66 : H * 0.52;
  drawChromeTitle(ctx, state.title.toUpperCase(), W / 2, titleY, 148 * S, W);
  // Script subtitle, centred under the title, with a drop shadow.
  ctx.save();
  ctx.font = `italic 600 ${Math.round(34 * S)}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 6 * S; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#fff';
  ctx.fillText(state.subtitle, W / 2, titleY + 96 * S);
  ctx.restore();

  // Role tags, drawn AFTER the title (and after every panel) so no panel and
  // no title glyph ever covers a tag. Guard: a tag that would fall inside the
  // giant title band moves to the bottom-left corner of its own panel instead.
  let titleSize = 148 * S;
  ctx.save();
  ctx.font = `${titleSize}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  while (ctx.measureText(state.title.toUpperCase()).width > W * 0.96 && titleSize > 24) {
    titleSize -= 4;
    ctx.font = `${titleSize}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  }
  const titleW = ctx.measureText(state.title.toUpperCase()).width;
  ctx.restore();
  const bandX0 = (W - titleW) / 2 - 12, bandX1 = (W + titleW) / 2 + 12;
  const bandY0 = titleY - titleSize * 0.75, bandY1 = titleY + 136 * S;
  for (const { panel, box } of tagJobs) {
    const size = Math.max(13, Math.min(box.w, box.h) * 0.16);
    ctx.save();
    ctx.font = `${Math.round(size)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    const tw = ctx.measureText(panel.role).width;
    ctx.restore();
    const tagW = tw + size * 0.55 * 2, tagH = size + size * 0.28 * 2;
    let tx = box.x + box.w * 0.045;
    let ty = box.y + box.h * 0.05;
    const hitsTitle = tx + tagW > bandX0 && tx < bandX1 && ty + tagH > bandY0 && ty < bandY1;
    if (hitsTitle) ty = box.y + box.h - tagH - box.h * 0.05;
    drawRoleTagAt(ctx, panel, tx, ty, tagW, tagH, size);
  }

  // Badge follows the title: top-centre when the title sits at the bottom,
  // bottom-right otherwise — never over a face.
  const badgeFont = `${Math.round(22 * S)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  ctx.save();
  ctx.font = badgeFont;
  const badgeText = '★ LEONIDA ’26 · VOL. 1';
  const bw = ctx.measureText(badgeText).width + 34 * S;
  const bh = 36 * S;
  const bx = layout.titlePos === 'bottom' ? W / 2 - bw / 2 : W * 0.97 - bw;
  const by = layout.titlePos === 'bottom' ? H * 0.075 : H * 0.795;
  ctx.fillStyle = 'rgba(8, 4, 12, 0.8)';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6 * S; ctx.shadowOffsetY = 2;
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = badgeFont;
  ctx.fillStyle = '#ffd23f';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, bx + 17 * S, by + bh / 2 + 1);
  ctx.restore();

  // Tagline strip on a dark pill so it stays readable over bright sky/water.
  // The font shrinks until the line fits inside the pill with room to spare.
  let tSize = 30 * S;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  while (tSize > 14 * S) {
    ctx.font = `${Math.round(tSize)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    if (ctx.measureText(state.tagline).width <= W * 0.86) break;
    tSize -= 1;
  }
  const tw = ctx.measureText(state.tagline).width;
  const pillW = Math.min(W * 0.94, tw + 56 * S);
  const pillH = 52 * S;
  const px = (W - pillW) / 2, py = H * 0.815;
  ctx.fillStyle = 'rgba(8, 4, 12, 0.78)';
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 8 * S; ctx.shadowOffsetY = 3;
  roundRect(ctx, px, py, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = `${Math.round(tSize)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 5 * S; ctx.shadowOffsetY = 2;
  ctx.fillText(state.tagline, W / 2, py + pillH / 2 + 1);
  ctx.restore();

  // Billing block (bottom left) + barcode + seal (bottom right).
  const bSize = 19 * S;
  ctx.save();
  ctx.font = `${Math.round(bSize)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  ctx.fillStyle = 'rgba(255, 244, 230, 0.92)';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4 * S; ctx.shadowOffsetY = 1;
  ctx.fillText(state.billing.toUpperCase(), W * 0.02, H * 0.895);
  ctx.fillStyle = 'rgba(255, 244, 230, 0.72)';
  ctx.fillText('A NEON HEIST CANVAS PICTURE  ·  LEONIDA  ·  SUMMER ’26', W * 0.02, H * 0.925);
  ctx.fillText('DIRECTED BY YOU  ·  STARRING YOUR CREW  ·  VOL. 1', W * 0.02, H * 0.955);
  ctx.restore();

  // Barcode (seeded bars) bottom-right.
  const rnd = mulberry32(20261121);
  const barX0 = W * 0.80, barY = H * 0.875, barH = H * 0.055;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 244, 230, 0.92)';
  let bx2 = barX0;
  while (bx2 < W * 0.965) {
    const bw2 = (1 + Math.floor(rnd() * 3)) * 2 * S;
    if (rnd() > 0.42) ctx.fillRect(bx2, barY, bw2, barH);
    bx2 += bw2 + (1 + Math.floor(rnd() * 2)) * 2 * S;
  }
  ctx.font = `${Math.round(15 * S)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('8 261121 000001', (barX0 + W * 0.965) / 2, barY + barH + 18 * S);
  ctx.restore();

  // Round seal stamp, overlapping the barcode's left edge.
  const sealX = W * 0.755, sealY = H * 0.915, sealR = 34 * S;
  ctx.save();
  ctx.translate(sealX, sealY);
  ctx.rotate(-0.22);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2.5 * S;
  ctx.beginPath(); ctx.arc(0, 0, sealR, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, sealR * 0.72, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.font = `${Math.round(13 * S)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ring = 'ORIGINAL COVER ART ★ ';
  for (let k = 0; k < ring.length; k++) {
    const a = (k / ring.length) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -sealR * 0.86);
    ctx.fillText(ring[k], 0, 0);
    ctx.restore();
  }
  ctx.font = `${Math.round(24 * S)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
  ctx.fillText('★', 0, 1);
  ctx.restore();

  // Selected-panel outline (editor only; exports pass showSelection: false).
  if (showSelection && state.selected >= 0 && selectedBox.pts) {
    ctx.save();
    pathOf(ctx, selectedBox.pts, W, H);
    ctx.setLineDash([10 * S, 7 * S]);
    ctx.lineWidth = 3 * S;
    ctx.strokeStyle = '#ffd23f';
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- export helpers
export function renderToCanvas(W, H, state, images) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const exportState = { ...state, selected: -1 };
  renderPoster(ctx, W, H, exportState, images, { showSelection: false });
  return canvas;
}

export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
