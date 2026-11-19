// Neon Heist Canvas — drawing engine (rebuilt 2026-11-20).
// Turns photos, a layout and colour grades into GTA-style poster cover art on a
// canvas. Every panel, gradient, sun, palm, skyline, halftone dot and letter is drawn
// here from scratch — no Rockstar logo, artwork or font is used anywhere. Panels are
// polygons: diagonal seams, staggered strips and, new in this rebuild, a radial burst
// (a central hexagon hub with six wedges radiating out), so the composition reads
// like a comic-book cover instead of a grid. The sun, palms and neon glow are only
// ever drawn into SKY panels (empty panels) — never over a photo — so the subject's
// face is never fought by an overlay. Photos can be cover-fit or shown whole
// (fit: 'whole' draws the full photo over a sky wash), so any photo works.

export const GRADES = {
  sunset: {
    label: 'Sunset', sky: ['#ffb347', '#ff6a3d', '#c22a72'], wash: '#ff7a3d', washOp: 0.20,
    sun: '#ffd166', sunCore: '#fff3c4', accent: '#ffd166', frame: '#1c0b26',
    caption: '#ffffff', captionStroke: '#2b0a1e', mono: false,
  },
  neon: {
    label: 'Neon', sky: ['#ff2ea6', '#7b2ff7', '#00e5ff'], wash: '#ff2ea6', washOp: 0.22,
    sun: '#00f0ff', sunCore: '#d8fbff', accent: '#00f0ff', frame: '#0b0620',
    caption: '#ffffff', captionStroke: '#12002e', mono: false,
  },
  vice: {
    label: 'Vice City', sky: ['#ff8fb3', '#ff4d8d', '#19c3c3'], wash: '#ff5c9e', washOp: 0.18,
    sun: '#ffe066', sunCore: '#fffbe0', accent: '#19c3c3', frame: '#120a24',
    caption: '#fff7d6', captionStroke: '#1c0b26', mono: false,
  },
  miami: {
    label: 'Miami', sky: ['#7ef0d4', '#19c3c3', '#ff5c9e'], wash: '#19c3c3', washOp: 0.16,
    sun: '#ff8fb3', sunCore: '#ffe3ee', accent: '#ff8fb3', frame: '#08222a',
    caption: '#ffffff', captionStroke: '#08222a', mono: false,
  },
  noir: {
    label: 'Noir', sky: ['#8a8a8a', '#3d3d3d', '#0d0d0d'], wash: '#000000', washOp: 0.10,
    sun: '#e8e8e8', sunCore: '#ffffff', accent: '#e8e8e8', frame: '#000000',
    caption: '#f2f2f2', captionStroke: '#000000', mono: true,
  },
};

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1080x1920': [1080, 1920],
  '1920x1080': [1920, 1080],
};

export const LAYOUTS = {
  solo: { label: 'Solo', panels: 1 },
  slant: { label: 'Diagonal duo', panels: 2 },
  hero: { label: 'Hero slant', panels: 3 },
  strips: { label: 'Offset strips', panels: 3 },
  quad: { label: 'Staggered quad', panels: 4 },
  triptych: { label: 'Triptych', panels: 3 },
  burst: { label: 'Radial burst', panels: 7 },
};

/** Deterministic pseudo-random stream from a seed, so skylines are stable per panel. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where a ray from (cx, cy) at angle `rad` (screen coords, y down) hits the canvas rect. */
function rayHit(cx, cy, rad, w, h) {
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (w - cx) / dx);
  if (dx < -1e-9) t = Math.min(t, (0 - cx) / dx);
  if (dy > 1e-9) t = Math.min(t, (h - cy) / dy);
  if (dy < -1e-9) t = Math.min(t, (0 - cy) / dy);
  return [cx + dx * t, cy + dy * t];
}

function normAngle(a) {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

/**
 * Panel polygons for a layout, as fractions of the canvas. Each panel is
 * { poly: [[x, y], ...], rect: {x, y, w, h} } where rect is the bounding box
 * the photo cover-fits into. Order is draw order (later panels overlap earlier).
 * The burst layout is a central hexagon hub (drawn last) with six wedges radiating
 * out to the canvas edges, one wedge per 60-degree sector.
 */
export function layoutPanels(layout, w, h) {
  const P = (fracs) => {
    const poly = fracs.map(([fx, fy]) => [fx * w, fy * h]);
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { poly, rect: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } };
  };
  switch (layout) {
    case 'solo':
      return [P([[0, 0], [1, 0], [1, 1], [0, 1]])];
    case 'slant': // two panels split by a diagonal seam
      return [
        P([[0, 0], [0.58, 0], [0.42, 1], [0, 1]]),
        P([[0.58, 0], [1, 0], [1, 1], [0.42, 1]]),
      ];
    case 'hero': { // big hero with a slanted right edge, two stacked on the right
      return [
        P([[0, 0], [0.66, 0], [0.55, 1], [0, 1]]),
        P([[0.66, 0], [1, 0], [1, 0.485], [0.607, 0.485]]),
        P([[0.605, 0.515], [1, 0.515], [1, 1], [0.55, 1]]),
      ];
    }
    case 'strips': // three horizontal strips, middle shifted right and overlapping
      return [
        P([[0, 0], [1, 0], [1, 0.33], [0, 0.33]]),
        P([[0, 0.64], [0.92, 0.64], [0.92, 1], [0, 1]]),
        P([[0.10, 0.31], [1, 0.31], [1, 0.66], [0.10, 0.66]]),
      ];
    case 'quad': // 2x2 with staggered offsets — comic-book energy, not a grid
      return [
        P([[0, 0], [0.52, 0], [0.52, 0.46], [0, 0.46]]),
        P([[0, 0.50], [0.48, 0.50], [0.48, 1], [0, 1]]),
        P([[0.48, 0.05], [1, 0.05], [1, 0.52], [0.48, 0.52]]),
        P([[0.52, 0.55], [1, 0.55], [1, 1], [0.52, 1]]),
      ];
    case 'triptych': // middle panel taller than its neighbours
      return [
        P([[0, 0.07], [0.33, 0.07], [0.33, 0.93], [0, 0.93]]),
        P([[0.33, 0], [0.67, 0], [0.67, 1], [0.33, 1]]),
        P([[0.67, 0.07], [1, 0.07], [1, 0.93], [0.67, 0.93]]),
      ];
    case 'burst': {
      // Central hexagon hub + six wedges, one per 60-degree sector.
      const cx = w * 0.5;
      const cy = h * 0.46;
      const rx = w * 0.27;
      const ry = h * 0.235;
      const hex = (deg) => {
        const a = (deg * Math.PI) / 180;
        return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
      };
      const corners = [[0, 0], [w, 0], [w, h], [0, h]];
      const panels = [];
      for (let k = 0; k < 6; k++) {
        const a0 = (k * 60 * Math.PI) / 180;
        const a1 = ((k + 1) * 60 * Math.PI) / 180;
        const b0 = rayHit(cx, cy, a0, w, h);
        const b1 = rayHit(cx, cy, a1, w, h);
        // Rectangle corners whose angle from the hub falls strictly inside the sector.
        const inside = corners
          .map((c) => ({ c, a: normAngle(Math.atan2(c[1] - cy, c[0] - cx)) }))
          .filter(({ a }) => {
            const rel = normAngle(a - a0);
            return rel > 0.001 && rel < normAngle(a1 - a0) - 0.001;
          })
          .sort((p, q) => normAngle(p.a - a0) - normAngle(q.a - a0))
          .map(({ c }) => c);
        const poly = [b0, ...inside, b1, hex((k + 1) * 60), hex(k * 60)];
        const xs = poly.map((p) => p[0]);
        const ys = poly.map((p) => p[1]);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        panels.push({ poly, rect: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } });
      }
      // The hub, drawn last so its neon ring sits on top of the wedge seams.
      const hubPoly = [0, 60, 120, 180, 240, 300].map((d) => hex(d));
      const hx = hubPoly.map((p) => p[0]);
      const hy = hubPoly.map((p) => p[1]);
      const hx0 = Math.min(...hx);
      const hy0 = Math.min(...hy);
      panels.push({
        poly: hubPoly,
        rect: { x: hx0, y: hy0, w: Math.max(...hx) - hx0, h: Math.max(...hy) - hy0 },
      });
      return panels;
    }
    default:
      return [P([[0, 0], [1, 0], [1, 1], [0, 1]])];
  }
}

/** True when (x, y) lies inside a polygon (ray casting). */
export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Clamps a panel's pan offset so the zoomed photo still covers its rectangle. */
function clampPan(rect, dw, dh, ox, oy) {
  const maxX = Math.max(0, (dw - rect.w) / 2);
  const maxY = Math.max(0, (dh - rect.h) / 2);
  return {
    ox: Math.max(-maxX, Math.min(maxX, ox)),
    oy: Math.max(-maxY, Math.min(maxY, oy)),
  };
}

/** Draws one photo into its panel rectangle: cover-fit, or whole-photo over a sky wash. */
function drawPhoto(ctx, rect, panel, grade) {
  const img = panel.img;
  if (!img) return;
  const zoom = panel.zoom || 1;
  ctx.save();
  if (grade.mono) ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.06)';
  if (panel.flip) {
    ctx.translate(rect.x + rect.w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(rect.x + rect.w / 2), 0);
  }
  if (panel.fit === 'whole') {
    // Show the entire photo, centred on a sky wash, with a soft dark edge.
    const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    sky.addColorStop(0, grade.sky[0]);
    sky.addColorStop(1, grade.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    const base = Math.min(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * 0.96 * zoom;
    const dw = img.naturalWidth * base;
    const dh = img.naturalHeight * base;
    const dx = rect.x + (rect.w - dw) / 2;
    const dy = rect.y + (rect.h - dh) / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.max(8, rect.w * 0.03);
    ctx.shadowOffsetY = Math.max(4, rect.h * 0.01);
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
    const dw = img.naturalWidth * base;
    const dh = img.naturalHeight * base;
    const { ox, oy } = clampPan(rect, dw, dh, panel.ox || 0, panel.oy || 0);
    const dx = rect.x + (rect.w - dw) / 2 + ox;
    const dy = rect.y + (rect.h - dh) / 2 + oy;
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.restore();
}

/** A striped synthwave sun, drawn in the grade's colours. */
function drawSun(ctx, cx, cy, r, grade) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.8);
  glow.addColorStop(0, grade.sunCore);
  glow.addColorStop(0.35, grade.sun);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  body.addColorStop(0, grade.sunCore);
  body.addColorStop(1, grade.sun);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    const y = cy + r * (0.05 + i * 0.22);
    const th = r * (0.05 + i * 0.03);
    ctx.fillStyle = grade.sky[1];
    ctx.globalAlpha = 0.55 + i * 0.1;
    ctx.fillRect(cx - r, y, r * 2, th);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** One palm-tree silhouette: a leaning trunk and six drooping fronds. */
function drawPalm(ctx, x, baseY, s, color, lean) {
  const topX = x + lean * s;
  const topY = baseY - s;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk: a tapered curve.
  ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * s * 0.4, baseY - s * 0.55, topX, topY);
  ctx.stroke();
  // Fronds: arcs drooping out of the crown.
  ctx.lineWidth = Math.max(1.5, s * 0.045);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.08 + i * 0.168); // spread across the top
    const ex = topX + Math.cos(a) * s * 0.62;
    const ey = topY + Math.sin(a) * s * 0.42 + s * 0.10;
    const mx = topX + Math.cos(a) * s * 0.34;
    const my = topY - s * 0.16;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(topX - s * 0.03, topY + s * 0.05, Math.max(1.5, s * 0.035), 0, Math.PI * 2);
  ctx.arc(topX + s * 0.04, topY + s * 0.06, Math.max(1.5, s * 0.03), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A dark skyline silhouette with a few lit windows along a panel's foot. */
function drawSkyline(ctx, rect, seed, grade) {
  const rand = seeded(seed);
  const baseY = rect.y + rect.h;
  ctx.fillStyle = 'rgba(10, 4, 18, 0.82)';
  let x = rect.x;
  while (x < rect.x + rect.w) {
    const bw = rect.w * (0.06 + rand() * 0.09);
    const bh = rect.h * (0.05 + rand() * 0.11);
    ctx.fillRect(x, baseY - bh, bw, bh);
    if (rand() > 0.45) {
      ctx.fillRect(x + bw * 0.2, baseY - bh - rect.h * 0.03, bw * 0.18, rect.h * 0.03);
    }
    ctx.fillStyle = grade.accent;
    ctx.globalAlpha = 0.7;
    const windows = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < windows; i++) {
      const wx = x + bw * (0.15 + rand() * 0.6);
      const wy = baseY - bh + rect.h * (0.02 + rand() * 0.08);
      ctx.fillRect(wx, wy, Math.max(2, rect.w * 0.008), Math.max(2, rect.h * 0.006));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(10, 4, 18, 0.82)';
    x += bw + rect.w * 0.012;
  }
}

/** Faint stars for noir skies — deterministic, so the panel is stable. */
function drawStars(ctx, rect, seed) {
  const rand = seeded(seed);
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const x = rect.x + rand() * rect.w;
    const y = rect.y + rand() * rect.h * 0.6;
    const r = 0.8 + rand() * 1.8;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Gradient sky + sun + skyline + palms: only ever painted into an EMPTY panel. */
function drawSkyPanel(ctx, panel, rect, grade, seed) {
  const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.55, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (grade.mono) drawStars(ctx, rect, seed + 7);
  const r = Math.min(rect.w, rect.h) * 0.20;
  drawSun(ctx, rect.x + rect.w * 0.68, rect.y + rect.h * 0.30, r, grade);
  drawSkyline(ctx, rect, seed, grade);
  const rand = seeded(seed + 31);
  const sil = 'rgba(8, 3, 16, 0.92)';
  const n = Math.max(2, Math.round(rect.w / 260));
  for (let i = 0; i < n; i++) {
    const px = rect.x + rect.w * (0.08 + (0.84 * i) / Math.max(1, n - 1)) + (rand() - 0.5) * 30;
    const ps = rect.h * (0.16 + rand() * 0.10);
    drawPalm(ctx, px, rect.y + rect.h + 2, ps, sil, (rand() - 0.5) * 0.5);
  }
}

/** A faint halftone dot field across the top of a panel, fading downward. */
function drawHalftone(ctx, rect) {
  const step = Math.max(13, rect.w * 0.026);
  let row = 0;
  for (let y = rect.y + step / 2; y < rect.y + rect.h * 0.26; y += step, row++) {
    for (let x = rect.x + step / 2; x < rect.x + rect.w; x += step) {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.02, 0.12 - row * 0.03)})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, step * (0.085 - row * 0.012)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Traces a polygon path (does not fill or stroke). */
function tracePoly(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

/** A deterministic film-grain tile, reused as a pattern so grain is stable. */
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = 140;
  t.height = 140;
  const c = t.getContext('2d');
  const rand = seeded(20260613);
  const img = c.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rand() > 0.5 ? 255 : 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.floor(rand() * 46);
  }
  c.putImageData(img, 0, 0);
  grainTile = t;
  return t;
}

/** The circular stamp badge: double ring, two text lines, one tiny palm.
 * Placement follows the title so it never sits on a face: with a bottom title it
 * rides the top-centre (sky in the hero/triptych layouts); with a top or diagonal
 * title it drops to the bottom-right, clear of the type. */
function drawBadge(ctx, w, h, grade, titlePos) {
  const r = Math.min(w, h) * 0.078;
  let cx;
  let cy;
  if (titlePos === 'bottom') {
    cx = w * 0.5;
    cy = r * 1.15;
  } else {
    cx = w - r * 1.25;
    cy = h - r * 1.35;
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.2);
  ctx.fillStyle = 'rgba(10, 4, 18, 0.78)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.025);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(r * 0.30)}px 'Arial Black', sans-serif`;
  ctx.fillText('VICE CITY', 0, -r * 0.30);
  ctx.fillStyle = grade.accent;
  ctx.font = `700 ${Math.round(r * 0.20)}px 'Arial Black', sans-serif`;
  try { ctx.letterSpacing = `${Math.round(r * 0.06)}px`; } catch { /* older canvas */ }
  ctx.fillText('LEONIDA', 0, r * 0.02);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(r * 0.16)}px 'Arial Black', sans-serif`;
  ctx.fillText('★ EST. 2026 ★', 0, r * 0.34);
  drawPalm(ctx, -r * 0.42, r * 0.62, r * 0.30, grade.accent, 0.25);
  ctx.restore();
}

/** The multi-zone type system: title + subtitle ribbon + tagline + optional badge. */
function drawType(ctx, w, h, state, grade) {
  const title = (state.caption || '').trim().toUpperCase();
  const sub = (state.subtitle || '').trim().toUpperCase();
  const tag = (state.tagline || '').trim().toUpperCase();
  const pos = state.titlePos || 'bottom';
  const font = (s) => `${s}px Anton, 'Arial Black', 'Helvetica Neue', sans-serif`;
  let size = h * 0.105 * (state.titleScale || 1);
  if (title) {
    ctx.font = font(size);
    try { ctx.letterSpacing = `${Math.round(size * 0.03)}px`; } catch { /* older canvas */ }
    while (ctx.measureText(title).width > w * 0.92 && size > 14) {
      size -= 2;
      ctx.font = font(size);
    }
  }
  const dark = grade.frame;
  const drawTitle = (tx, ty, align, rotate) => {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(rotate);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (pos === 'diagonal') {
      // Slanted accent ribbon behind the title — a real poster device.
      const tw = ctx.measureText(title).width;
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = size * 0.22;
      ctx.shadowOffsetY = size * 0.06;
      ctx.fillStyle = grade.accent;
      ctx.fillRect(-size * 0.55, -size * 0.62, tw + size * 1.1, size * 1.24);
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = dark;
      ctx.fillText(title, 0, size * 0.02);
    } else {
      // First pass: an accent-coloured neon glow behind the letters, so the title
      // lifts off busy photos even where the outline alone would not.
      ctx.save();
      ctx.shadowColor = grade.accent;
      ctx.shadowBlur = size * 0.30;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = state.captionColor || grade.caption;
      ctx.fillText(title, 0, 0);
      ctx.restore();
      // Second pass: dark outline + drop shadow + crisp fill.
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = size * 0.18;
      ctx.shadowOffsetY = size * 0.04;
      if (state.outline !== false) {
        ctx.lineJoin = 'round';
        ctx.strokeStyle = grade.captionStroke;
        ctx.lineWidth = size * 0.16;
        ctx.strokeText(title, 0, 0);
      }
      ctx.fillStyle = state.captionColor || grade.caption;
      ctx.fillText(title, 0, 0);
    }
    ctx.restore();
  };
  const drawRibbon = (text, cx, cy, fs, bg, fg) => {
    ctx.save();
    ctx.font = `800 ${fs}px 'Arial Black', 'Helvetica Neue', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(fs * 0.28)}px`; } catch { /* older canvas */ }
    const tw = ctx.measureText(text).width;
    const padX = fs * 0.9;
    const padY = fs * 0.42;
    ctx.fillStyle = bg;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = fs * 0.5;
    ctx.shadowOffsetY = fs * 0.12;
    ctx.fillRect(cx - tw / 2 - padX, cy - fs * 0.5 - padY, tw + padX * 2, fs + padY * 2);
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + fs * 0.04);
    ctx.restore();
  };
  const drawTagline = (text, cx, cy) => {
    const ts = Math.max(13, Math.round(h * 0.017));
    ctx.save();
    ctx.font = `700 ${ts}px 'Arial Black', 'Helvetica Neue', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(ts * 0.42)}px`; } catch { /* older canvas */ }
    const tw = ctx.measureText(text).width;
    // Dark pill behind the tagline: it sits over bright water/sky too often to float bare.
    ctx.fillStyle = 'rgba(10, 4, 18, 0.55)';
    ctx.fillRect(cx - tw / 2 - ts * 0.9, cy - ts * 0.75, tw + ts * 1.8, ts * 1.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grade.accent;
    ctx.fillText(text, cx, cy);
    ctx.restore();
  };
  if (title && pos === 'bottom') {
    drawTitle(w / 2, h - h * 0.055, 'center', -0.018);
    if (sub) drawRibbon(sub, w / 2, h - h * 0.055 - size * 0.92, Math.max(14, Math.round(h * 0.02)), grade.accent, dark);
    if (tag) drawTagline(tag, w / 2, h - h * 0.055 - size * (sub ? 1.45 : 0.78));
  } else if (title && pos === 'top') {
    drawTitle(w / 2, h * 0.06 + size * 0.85, 'center', 0.018);
    if (sub) drawRibbon(sub, w / 2, h * 0.06 + size * 1.62, Math.max(14, Math.round(h * 0.02)), grade.accent, dark);
    if (tag) drawTagline(tag, w / 2, h * 0.06 + size * (sub ? 2.2 : 1.55));
  } else if (title && pos === 'diagonal') {
    drawTitle(w * 0.04, h * 0.84, 'left', -0.10);
    if (sub) drawRibbon(sub, w / 2, h * 0.055, Math.max(14, Math.round(h * 0.02)), grade.accent, dark);
    if (tag) drawTagline(tag, w / 2, h * 0.115);
  }
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  if (state.badge !== false) drawBadge(ctx, w, h, grade, pos);
}

/**
 * Draws the whole cover onto `canvas` from `state`:
 * { panels: [{img, zoom, ox, oy, flip, fit, grade}], layout, grade, caption, subtitle,
 *   tagline, titlePos, titleScale, captionColor, outline, badge, grain }
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] || GRADES.vice;
  const panels = layoutPanels(state.layout || 'hero', w, h);
  ctx.fillStyle = grade.frame;
  ctx.fillRect(0, 0, w, h);
  const heroIndex = panels.reduce((best, p, i) => (p.rect.w * p.rect.h > panels[best].rect.w * panels[best].rect.h ? i : best), 0);
  panels.forEach((panel, i) => {
    const pstate = (state.panels && state.panels[i]) || {};
    const pgrade = (pstate.grade && pstate.grade !== 'auto' && GRADES[pstate.grade]) ? GRADES[pstate.grade] : grade;
    ctx.save();
    tracePoly(ctx, panel.poly);
    ctx.clip();
    if (pstate.img) {
      drawPhoto(ctx, panel.rect, pstate, pgrade);
    } else {
      drawSkyPanel(ctx, panel, panel.rect, pgrade, 1000 + i * 77);
    }
    // Colour wash (per-panel grade) + halftone + bottom shade.
    const wash = ctx.createLinearGradient(panel.rect.x, panel.rect.y, panel.rect.x, panel.rect.y + panel.rect.h);
    wash.addColorStop(0, pgrade.sky[0]);
    wash.addColorStop(1, pgrade.sky[2]);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = pgrade.washOp;
    ctx.fillStyle = wash;
    ctx.fillRect(panel.rect.x, panel.rect.y, panel.rect.w, panel.rect.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (i === heroIndex && pstate.img) drawHalftone(ctx, panel.rect);
    const shade = ctx.createLinearGradient(0, panel.rect.y + panel.rect.h * 0.55, 0, panel.rect.y + panel.rect.h);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = shade;
    ctx.fillRect(panel.rect.x, panel.rect.y, panel.rect.w, panel.rect.h);
    ctx.restore();
    // Neon-piped seam: thick frame stroke, then a thin glowing accent line.
    ctx.save();
    tracePoly(ctx, panel.poly);
    ctx.strokeStyle = grade.frame;
    ctx.lineWidth = Math.max(5, Math.round(Math.min(w, h) * 0.008));
    ctx.stroke();
    ctx.strokeStyle = pgrade.accent;
    ctx.lineWidth = Math.max(1.5, Math.round(Math.min(w, h) * 0.0022));
    ctx.shadowColor = pgrade.accent;
    ctx.shadowBlur = Math.max(6, Math.round(Math.min(w, h) * 0.012));
    ctx.stroke();
    ctx.restore();
  });
  // Burst hub ring: a thin neon ring just inside the hub edge, so the hub reads as
  // a medallion rather than one more slice.
  if (state.layout === 'burst') {
    const hub = panels[panels.length - 1];
    ctx.save();
    tracePoly(ctx, hub.poly);
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.003));
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = Math.max(8, Math.round(Math.min(w, h) * 0.016));
    ctx.stroke();
    ctx.restore();
  }
  // Film grain (before type, so the letters stay razor sharp), then vignette.
  if (state.grain !== false) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  const frameW = Math.max(6, Math.round(Math.min(w, h) * 0.012));
  ctx.strokeStyle = grade.frame;
  ctx.lineWidth = frameW;
  ctx.strokeRect(frameW / 2, frameW / 2, w - frameW, h - frameW);
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(2, frameW * 0.18);
  ctx.strokeRect(frameW * 1.6, frameW * 1.6, w - frameW * 3.2, h - frameW * 3.2);
  drawType(ctx, w, h, state, grade);
}

/** Renders the cover at the export size and returns the canvas. */
export function renderCover(width, height, state) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCover(canvas, state);
  return canvas;
}
