// Neon Heist Canvas — the poster studio.
// The poster is a live inline SVG, not a canvas: every panel is a <clipPath>
// polygon holding an <image>, every grade is an SVG filter, every letter is
// SVG <text> with a glow filter. Layouts are pure data (see layouts.js); this
// file only knows how to read a layout spec and turn it into markup, so the
// whole look of the app changes when the data changes.
// Exports serialise that same SVG, inline its font and pictures as data URIs,
// draw it to an offscreen canvas and download a PNG.

import { LAYOUTS, layoutById, GRADES, gradeById, EXPORT_SIZES, SAMPLE_PHOTOS, BADGE_LINES, UNIT } from './layouts.js';
import { skyPanelSVG, paletteFor } from './backdrop.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const FONT_FAMILY = "'Anton', 'Arial Narrow', sans-serif";

// ---------------------------------------------------------------- state

export const state = {
  layoutId: 'spotlight',
  gradeId: 'sunset',
  sizeKey: '1080x1080',
  title: 'SUNSET HEIST',
  subtitle: 'VICE CITY · LEONIDA',
  tagline: 'Worth every second.',
  badgeOn: true,
  titleColor: '#ffffff',
  titleScale: 1,
  scanlines: false,
  grainOn: true,
  // Per-panel settings, keyed by panel id. A panel the current layout does not
  // have is ignored; a new panel gets its spec defaults.
  panelCfg: {},
  // The photo library: bundled samples first, then the user's uploads.
  photos: [],
};

function defaultPanelCfg(panel) {
  const anchor = panel.anchor ?? [0.5, 0.5];
  return { slot: panel.slot ?? 0, fit: 'cover', ax: anchor[0], ay: anchor[1], zoom: 1, panX: 0, panY: 0, flip: false, grade: 'inherit' };
}

export function cfgFor(panel) {
  if (!state.panelCfg[panel.id]) state.panelCfg[panel.id] = defaultPanelCfg(panel);
  return state.panelCfg[panel.id];
}

export function currentSize() {
  return EXPORT_SIZES.find((s) => s.key === state.sizeKey) ?? EXPORT_SIZES[0];
}

export function currentLayout() {
  return layoutById(state.layoutId);
}

// ---------------------------------------------------------------- geometry

// Scale a unit-space value to canvas pixels.
const sx = (v, W) => (v / UNIT) * W;
const sy = (v, H) => (v / UNIT) * H;

function panelBox(panel, W, H) {
  if (panel.shape === 'circle') {
    const cx = sx(panel.cx, W);
    const cy = sy(panel.cy, H);
    const r = sx(panel.r, Math.min(W, H));
    return { x: cx - r, y: cy - r, w: r * 2, h: r * 2, cx, cy, r };
  }
  const xs = panel.pts.map((p) => sx(p[0], W));
  const ys = panel.pts.map((p) => sy(p[1], H));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

function panelPointsAttr(panel, W, H) {
  return panel.pts.map((p) => `${fmt(sx(p[0], W))},${fmt(sy(p[1], H))}`).join(' ');
}

const fmt = (n) => String(Math.round(n * 100) / 100);

// Where a photo sits inside its panel box, from fit / anchor / zoom / pan.
// fit 'cover' fills the box (cropping); 'contain' shows the whole photo.
// ax/ay pick the anchor point (0, 0.5 or 1) the crop hangs from; pan nudges
// it, clamped so a cover photo never leaves a gap.
function photoRect(box, img, cfg) {
  const base = cfg.fit === 'contain'
    ? Math.min(box.w / img.w, box.h / img.h)
    : Math.max(box.w / img.w, box.h / img.h);
  const s = base * cfg.zoom;
  const w = img.w * s;
  const h = img.h * s;
  let x = box.x + (box.w - w) * cfg.ax + cfg.panX;
  let y = box.y + (box.h - h) * cfg.ay + cfg.panY;
  if (cfg.fit === 'cover') {
    x = Math.min(box.x, Math.max(box.x + box.w - w, x));
    y = Math.min(box.y, Math.max(box.y + box.h - h, y));
  }
  return { x, y, w, h };
}

// ---------------------------------------------------------------- filters

function gradeFilterDef(grade, uid) {
  if (!grade.matrix && !grade.transfer) return '';
  const parts = [`<filter id="grade-${uid}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">`];
  if (grade.matrix) parts.push(`<feColorMatrix type="matrix" values="${grade.matrix.join(' ')}"/>`);
  if (grade.transfer) {
    const { slope, intercept } = grade.transfer;
    parts.push(`<feComponentTransfer><feFuncR type="linear" slope="${slope}" intercept="${intercept}"/>`
      + `<feFuncG type="linear" slope="${slope}" intercept="${intercept}"/>`
      + `<feFuncB type="linear" slope="${slope}" intercept="${intercept}"/></feComponentTransfer>`);
  }
  parts.push('</filter>');
  return parts.join('');
}

function gradeFilterId(panelGradeId, globalGradeId, uid) {
  const id = panelGradeId === 'inherit' ? globalGradeId : panelGradeId;
  const grade = gradeById(id);
  if (!grade.matrix && !grade.transfer) return null;
  return { id, uid: `${uid}-${id}` };
}

// ---------------------------------------------------------------- panels

function photoPanelSVG(panel, box, W, H, uid) {
  const cfg = cfgFor(panel);
  const photo = state.photos[cfg.slot] ?? state.photos[0];
  const g = gradeFilterId(cfg.grade, state.gradeId, uid);
  const clip = panel.shape === 'circle'
    ? `<circle cx="${fmt(box.cx)}" cy="${fmt(box.cy)}" r="${fmt(box.r)}"/>`
    : `<polygon points="${panelPointsAttr(panel, W, H)}"/>`;
  let inner = '';
  if (photo && photo.w > 0) {
    const r = photoRect(box, photo, cfg);
    const transform = cfg.flip
      ? `translate(${fmt(r.x + r.w)} ${fmt(r.y)}) scale(-1 1)`
      : `translate(${fmt(r.x)} ${fmt(r.y)})`;
    const filterAttr = g ? ` filter="url(#grade-${g.uid})"` : '';
    inner = `<g${filterAttr}><image href="${photo.src}" x="0" y="0" width="${fmt(r.w)}" height="${fmt(r.h)}" transform="${transform}" preserveAspectRatio="none" data-panel="${panel.id}"/></g>`;
  } else {
    inner = `<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.w)}" height="${fmt(box.h)}" fill="#232a3d"/>`
      + `<text x="${fmt(box.cx)}" y="${fmt(box.cy)}" fill="#8b93a8" font-size="26" text-anchor="middle" font-family="sans-serif">loading photo…</text>`;
  }
  const edge = panel.shape === 'circle'
    ? `<circle cx="${fmt(box.cx)}" cy="${fmt(box.cy)}" r="${fmt(box.r)}" fill="none" stroke="#0a0f1e" stroke-width="5"/>`
    : `<polygon points="${panelPointsAttr(panel, W, H)}" fill="none" stroke="#0a0f1e" stroke-width="5" stroke-linejoin="round"/>`;
  return `<defs><clipPath id="clip-${uid}">${clip}</clipPath>${g ? gradeFilterDef(gradeById(g.id), g.uid) : ''}</defs>`
    + `<g clip-path="url(#clip-${uid})" data-panel="${panel.id}">${inner}</g>${edge}`;
}

function skyPanelMarkup(panel, box, W, H, uid) {
  const clip = panel.shape === 'circle'
    ? `<circle cx="${fmt(box.cx)}" cy="${fmt(box.cy)}" r="${fmt(box.r)}"/>`
    : `<polygon points="${panelPointsAttr(panel, W, H)}"/>`;
  return `<defs><clipPath id="clip-${uid}">${clip}</clipPath></defs>`
    + skyPanelSVG(box, `clip-${uid}`, state.gradeId, `${state.layoutId}:${panel.id}`);
}

// ---------------------------------------------------------------- type zones

function splitTitle(title, size, maxW) {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return [title.trim()];
  const est = (t) => t.length * size * 0.52;
  if (est(title) <= maxW) return [title.trim()];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const diff = Math.abs(est(a) - est(b));
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

function typeSVG(layout, W, H) {
  const pal = paletteFor(state.gradeId);
  const t = layout.title;
  const size = t.size * (W / UNIT) * state.titleScale;
  const maxW = t.maxW * (W / UNIT);
  const tx = sx(t.x, W);
  const ty = sy(t.y, H);
  const lines = splitTitle(state.title, size, maxW);
  const lineH = size * 1.04;
  const titleGroup = lines.map((line, i) => {
    const y = ty + i * lineH;
    return `<text class="ttl-line" x="${fmt(tx)}" y="${fmt(y)}" text-anchor="${t.align}" font-family="${FONT_FAMILY}" font-size="${fmt(size)}" fill="${state.titleColor}" stroke="#0a0f1e" stroke-width="${fmt(size * 0.09)}" paint-order="stroke" stroke-linejoin="round" filter="url(#titleGlow)" data-maxw="${fmt(maxW)}">${escapeXml(line)}</text>`;
  }).join('');
  const ribbon = layout.ribbon;
  const rx = sx(ribbon.x, W);
  const ry = sy(ribbon.y, H);
  const ribbonH = 44 * (W / UNIT);
  const ribbonTextSize = 30 * (W / UNIT);
  const tag = layout.tagline;
  const tagX = sx(tag.x, W);
  const tagY = sy(tag.y, H);
  const tagSize = 30 * (W / UNIT);
  const badge = badgePlacement(layout, W, H);
  const badgeR = 62 * (W / UNIT);
  const badgeSVG = state.badgeOn && badge ? `<g id="badgeGroup" transform="translate(${fmt(badge.x)} ${fmt(badge.y)})">`
    + `<circle r="${fmt(badgeR)}" fill="#10182b" opacity="0.92"/>`
    + `<circle r="${fmt(badgeR)}" fill="none" stroke="url(#badgeRing)" stroke-width="${fmt(5 * (W / UNIT))}"/>`
    + `<circle r="${fmt(badgeR - 9 * (W / UNIT))}" fill="none" stroke="${pal.horizon}" stroke-width="1.5" opacity="0.7"/>`
    + `<text y="${fmt(-4 * (W / UNIT))}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${fmt(52 * (W / UNIT))}" fill="#ffffff" stroke="#0a0f1e" stroke-width="3" paint-order="stroke">${BADGE_LINES[0]}</text>`
    + `<text y="${fmt(30 * (W / UNIT))}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${fmt(19 * (W / UNIT))}" letter-spacing="3" fill="${pal.horizon}">${BADGE_LINES[1]}</text>`
    + `</g>` : '';
  // The title is the poster's headline, so it gets the strongest treatment:
  // a deep drop shadow plus a halo in the active grade's accent colour, so
  // it reads at thumbnail size against any photo or sky behind it.
  const glowAccent = (gradeById(state.gradeId) ?? {}).accent ?? '#ff2d78';
  return `<defs>`
    + `<filter id="titleGlow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${fmt(8 * (W / UNIT))}" stdDeviation="${fmt(8 * (W / UNIT))}" flood-color="#000000" flood-opacity="0.6"/><feGaussianBlur stdDeviation="${fmt(8 * (W / UNIT))}" result="b"/><feFlood flood-color="${glowAccent}" flood-opacity="1"/><feComposite in2="b" operator="in" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
    + `<linearGradient id="badgeRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${pal.horizon}"/><stop offset="55%" stop-color="${pal.sun}"/><stop offset="100%" stop-color="#ff5ce1"/></linearGradient>`
    + `</defs>`
    + `<g id="titleGroup"><rect id="titleBack" rx="12" fill="#000000" opacity="0.42"/>${titleGroup}</g>`
    + `<g id="ribbonGroup"><rect id="ribbonRect" x="${fmt(rx - 40)}" y="${fmt(ry - ribbonH / 2)}" height="${fmt(ribbonH)}" rx="${fmt(ribbonH / 2)}" fill="#0a2436" opacity="0.82"/><rect id="ribbonEdge" x="${fmt(rx - 40)}" y="${fmt(ry - ribbonH / 2)}" height="${fmt(ribbonH)}" rx="${fmt(ribbonH / 2)}" fill="none" stroke="${pal.horizon}" stroke-width="2" opacity="0.8"/><text id="ribbonText" x="${fmt(rx)}" y="${fmt(ry + ribbonTextSize * 0.36)}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${fmt(ribbonTextSize)}" letter-spacing="2" fill="#ffffff">${escapeXml(state.subtitle)}</text></g>`
    + `<g id="tagGroup"><rect id="tagPill" rx="14" fill="#000000" opacity="0.5"/><text id="tagText" x="${fmt(tagX)}" y="${fmt(tagY)}" text-anchor="${tag.align}" font-family="${FONT_FAMILY}" font-size="${fmt(tagSize)}" fill="#ffffff" stroke="#0a0f1e" stroke-width="2" paint-order="stroke">${escapeXml(state.tagline)}</text></g>`
    + badgeSVG;
}

// Where the stamp badge goes. dx/dy are ABSOLUTE poster coordinates in unit
// space, and the named sky panel is where that point must land: sky panels
// hold only backdrop, never a face, so a badge parked there can never cover
// one. 'corner' badges use absolute coordinates too.
function badgePlacement(layout, W, H) {
  const b = layout.badge;
  if (!b) return null;
  if (b.mode === 'sky' && b.panel) {
    const panel = layout.panels.find((p) => p.id === b.panel);
    if (!panel || panel.kind !== 'sky') return null;
    return { x: sx(b.dx, W), y: sy(b.dy, H) };
  }
  if (b.mode === 'corner') return { x: sx(b.x, W), y: sy(b.y, H) };
  return null;
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------- render

// Build the whole poster as one SVG string at W x H pixels.
export function renderPosterSVG(W, H) {
  const layout = currentLayout();
  const pal = paletteFor(state.gradeId);
  const parts = [];
  parts.push(`<svg xmlns="${SVGNS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT_FAMILY}">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#0a0f1e"/>`);
  layout.panels.forEach((panel, i) => {
    const box = panelBox(panel, W, H);
    const uid = `${layout.id}-${panel.id}`;
    if (panel.kind === 'sky') parts.push(skyPanelMarkup(panel, box, W, H, uid));
    else parts.push(photoPanelSVG(panel, box, W, H, uid));
  });
  // A dark frame and a gradient neon edge line, drawn over the panels.
  parts.push(`<defs><linearGradient id="frameLine" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0%" stop-color="${pal.horizon}"/><stop offset="50%" stop-color="${pal.sun}"/><stop offset="100%" stop-color="#ff5ce1"/>`
    + `</linearGradient>`
    + `<radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75"><stop offset="60%" stop-color="#000000" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.26"/></radialGradient>`
    + `<pattern id="scanPat" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.4" fill="#000000" opacity="0.55"/></pattern></defs>`);
  parts.push(`<rect x="4" y="4" width="${W - 8}" height="${H - 8}" fill="none" stroke="#0a0f1e" stroke-width="8"/>`);
  parts.push(`<rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="url(#frameLine)" stroke-width="3" opacity="0.9"/>`);
  parts.push(typeSVG(layout, W, H));
  if (state.scanlines) parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#scanPat)" opacity="0.5"/>`);
  if (state.grainOn) parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#vignette)"/>`);
  parts.push('</svg>');
  return parts.join('');
}

// After a render, measure the real text and fit the backing shapes to it:
// shrink a title line that still overflows its max width, size the dark
// backing rect behind the title, the ribbon pill and the tagline pill.
export function fitType(svg) {
  const titleLines = [...svg.querySelectorAll('.ttl-line')];
  for (const line of titleLines) {
    const maxW = parseFloat(line.dataset.maxw || '0');
    if (!maxW) continue;
    let size = parseFloat(line.getAttribute('font-size') || '0');
    let guard = 0;
    while (size > 34 && line.getComputedTextLength() > maxW && guard < 24) {
      size -= 4;
      line.setAttribute('font-size', String(Math.round(size * 10) / 10));
      guard++;
    }
  }
  const group = svg.querySelector('#titleGroup');
  const back = svg.querySelector('#titleBack');
  if (group && back) {
    const b = group.getBBox();
    back.setAttribute('x', String(b.x - 22));
    back.setAttribute('y', String(b.y - 14));
    back.setAttribute('width', String(b.width + 44));
    back.setAttribute('height', String(b.height + 26));
  }
  const ribbonText = svg.querySelector('#ribbonText');
  const ribbonRect = svg.querySelector('#ribbonRect');
  const ribbonEdge = svg.querySelector('#ribbonEdge');
  if (ribbonText && ribbonRect) {
    const w = ribbonText.getComputedTextLength() + 64;
    const cx = parseFloat(ribbonText.getAttribute('x') || '0');
    for (const r of [ribbonRect, ribbonEdge]) {
      if (!r) continue;
      r.setAttribute('x', String(cx - w / 2));
      r.setAttribute('width', String(w));
    }
  }
  const tagText = svg.querySelector('#tagText');
  const tagPill = svg.querySelector('#tagPill');
  if (tagText && tagPill) {
    // The pill follows the text's box; the text itself stays where the layout
    // put it (its x/y are the anchor point, so moving it would shift it).
    const b = tagText.getBBox();
    tagPill.setAttribute('x', String(b.x - 18));
    tagPill.setAttribute('y', String(b.y - 10));
    tagPill.setAttribute('width', String(b.width + 36));
    tagPill.setAttribute('height', String(b.height + 20));
  }
}

// ---------------------------------------------------------------- photos

function loadPhoto(entry) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ...entry, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ ...entry, w: 0, h: 0 });
    img.src = entry.src;
  });
}

export async function loadSamples() {
  state.photos = [];
  for (const s of SAMPLE_PHOTOS) state.photos.push(await loadPhoto(s));
}

export function addUpload(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const entry = { id: `up-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ''), src: String(reader.result), w: img.naturalWidth, h: img.naturalHeight };
        state.photos.push(entry);
        resolve(entry);
      };
      img.onerror = () => resolve(null);
      img.src = String(reader.result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------- export

const dataUriCache = new Map();

async function toDataUri(url) {
  if (dataUriCache.has(url)) return dataUriCache.get(url);
  const res = await fetch(url);
  const blob = await res.blob();
  const uri = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  dataUriCache.set(url, uri);
  return uri;
}

let fontDataUri = null;
async function getFontDataUri() {
  if (fontDataUri) return fontDataUri;
  const res = await fetch('fonts/Anton-Regular.ttf');
  const buf = await res.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  fontDataUri = `data:font/ttf;base64,${btoa(binary)}`;
  return fontDataUri;
}

// The live SVG references local files; an SVG drawn through an <img> into a
// canvas may not load any of them, so the export inlines the font and every
// picture as a data URI first. Uploaded photos are data URIs already.
async function serializeForExport(W, H) {
  const live = document.getElementById('posterSvg');
  const clone = live.cloneNode(true);
  clone.setAttribute('xmlns', SVGNS);
  clone.setAttribute('width', String(W));
  clone.setAttribute('height', String(H));
  clone.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const style = document.createElementNS(SVGNS, 'style');
  style.textContent = `@font-face{font-family:'Anton';src:url(${await getFontDataUri()}) format('truetype');}`;
  clone.insertBefore(style, clone.firstChild);
  const imgs = [...clone.querySelectorAll('image')];
  for (const im of imgs) {
    const href = im.getAttribute('href');
    if (href && !href.startsWith('data:')) im.setAttribute('href', await toDataUri(href));
  }
  return new XMLSerializer().serializeToString(clone);
}

async function renderToCanvas(W, H) {
  const markup = await serializeForExport(W, H);
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadCanvas(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(false); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      resolve(true);
    }, 'image/png');
  });
}

function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

export async function exportOne(sizeKey) {
  const size = EXPORT_SIZES.find((s) => s.key === sizeKey) ?? EXPORT_SIZES[0];
  setStatus(`Rendering ${size.key}…`);
  drawStage(size.w, size.h);
  const canvas = await renderToCanvas(size.w, size.h);
  const ok = await downloadCanvas(canvas, `neon-heist-${size.key}.png`);
  setStatus(ok ? `Saved neon-heist-${size.key}.png` : 'Export failed — try again.');
  return ok;
}

export async function exportAll() {
  let done = 0;
  for (const size of EXPORT_SIZES) {
    setStatus(`Rendering… (${done + 1}/${EXPORT_SIZES.length})`);
    drawStage(size.w, size.h);
    const canvas = await renderToCanvas(size.w, size.h);
    await downloadCanvas(canvas, `neon-heist-${size.key}.png`);
    done++;
  }
  setStatus(`Saved ${done} PNGs.`);
  return done;
}

export async function copyPng() {
  const size = currentSize();
  setStatus('Rendering for clipboard…');
  drawStage(size.w, size.h);
  const canvas = await renderToCanvas(size.w, size.h);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) { setStatus('Copy failed — try again.'); return false; }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    setStatus('PNG copied to clipboard.');
    return true;
  } catch {
    setStatus('Clipboard blocked by the browser — use Export instead.');
    return false;
  }
}

// ---------------------------------------------------------------- studio UI

export function drawStage(W, H) {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const w = W ?? currentSize().w;
  const h = H ?? currentSize().h;
  stage.innerHTML = renderPosterSVG(w, h);
  const svg = stage.querySelector('svg');
  if (svg) {
    svg.id = 'posterSvg';
    fitType(svg);
  }
}

function el(id) { return document.getElementById(id); }

function buildLayoutGrid() {
  const grid = el('layoutGrid');
  grid.innerHTML = '';
  for (const l of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (l.id === state.layoutId ? ' on' : '');
    b.textContent = l.name;
    b.title = l.blurb;
    b.addEventListener('click', () => {
      state.layoutId = l.id;
      buildLayoutGrid();
      buildPanelList();
      drawStage();
      setStatus(`${l.name} — ${l.blurb}`);
    });
    grid.appendChild(b);
  }
}

function buildGradeGrid() {
  const grid = el('gradeGrid');
  grid.innerHTML = '';
  for (const g of GRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (g.id === state.gradeId ? ' on' : '');
    b.textContent = g.name;
    b.title = g.blurb;
    b.addEventListener('click', () => {
      state.gradeId = g.id;
      buildGradeGrid();
      drawStage();
      setStatus(`Grade: ${g.name} — ${g.blurb}`);
    });
    grid.appendChild(b);
  }
}

function buildSizeBtns() {
  const wrap = el('sizeBtns');
  wrap.innerHTML = '';
  for (const s of EXPORT_SIZES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (s.key === state.sizeKey ? ' on' : '');
    b.textContent = s.key;
    b.dataset.value = s.key;
    b.addEventListener('click', () => {
      state.sizeKey = s.key;
      buildSizeBtns();
      drawStage();
    });
    wrap.appendChild(b);
  }
}

function buildPhotoPickers() {
  const row = el('sampleRow');
  row.innerHTML = '';
  for (const p of state.photos) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = p.name;
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.name;
    b.appendChild(img);
    b.addEventListener('click', () => {
      const first = currentLayout().panels.find((x) => x.kind === 'photo');
      if (!first) return;
      cfgFor(first).slot = state.photos.indexOf(p);
      buildPanelList();
      drawStage();
      setStatus(`Hero photo: ${p.name}.`);
    });
    row.appendChild(b);
  }
}

function buildPanelList() {
  const list = el('panelList');
  list.innerHTML = '';
  const layout = currentLayout();
  const photos = layout.panels.filter((p) => p.kind === 'photo');
  for (const panel of photos) {
    const cfg = cfgFor(panel);
    const box = document.createElement('div');
    box.className = 'panel-card';
    const head = document.createElement('div');
    head.className = 'panel-head';
    head.textContent = `Panel ${panel.id} — ${photoName(cfg.slot)}`;
    box.appendChild(head);
    const mkRow = (label, control) => {
      const row = document.createElement('label');
      row.className = 'ctl-row';
      const span = document.createElement('span');
      span.textContent = label;
      row.appendChild(span);
      row.appendChild(control);
      box.appendChild(row);
      return row;
    };
    const photoSel = document.createElement('select');
    state.photos.forEach((p, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = p.name;
      if (i === cfg.slot) o.selected = true;
      photoSel.appendChild(o);
    });
    photoSel.addEventListener('change', () => { cfg.slot = Number(photoSel.value); head.textContent = `Panel ${panel.id} — ${photoName(cfg.slot)}`; drawStage(); });
    mkRow('Photo', photoSel);
    const fitSel = document.createElement('select');
    for (const f of [['cover', 'Fill panel'], ['contain', 'Whole photo']]) {
      const o = document.createElement('option');
      o.value = f[0];
      o.textContent = f[1];
      if (f[0] === cfg.fit) o.selected = true;
      fitSel.appendChild(o);
    }
    fitSel.addEventListener('change', () => { cfg.fit = fitSel.value; drawStage(); });
    mkRow('Fit', fitSel);
    const anchorSel = document.createElement('select');
    for (const a of [['0,0', 'Top left'], ['0.5,0', 'Top centre'], ['1,0', 'Top right'], ['0,0.5', 'Middle left'], ['0.5,0.5', 'Centre'], ['1,0.5', 'Middle right'], ['0,1', 'Bottom left'], ['0.5,1', 'Bottom centre'], ['1,1', 'Bottom right']]) {
      const o = document.createElement('option');
      o.value = a[0];
      o.textContent = a[1];
      if (Number(a[0].split(',')[0]) === cfg.ax && Number(a[0].split(',')[1]) === cfg.ay) o.selected = true;
      anchorSel.appendChild(o);
    }
    anchorSel.addEventListener('change', () => {
      const [ax, ay] = anchorSel.value.split(',').map(Number);
      cfg.ax = ax; cfg.ay = ay; drawStage();
    });
    mkRow('Anchor', anchorSel);
    const zoom = document.createElement('input');
    zoom.type = 'range'; zoom.min = '1'; zoom.max = '2.5'; zoom.step = '0.05'; zoom.value = String(cfg.zoom);
    zoom.addEventListener('input', () => { cfg.zoom = Number(zoom.value); drawStage(); });
    mkRow('Zoom', zoom);
    const flipBtn = document.createElement('button');
    flipBtn.type = 'button';
    flipBtn.className = 'mini';
    flipBtn.textContent = cfg.flip ? 'Flipped ✓' : 'Flip';
    flipBtn.addEventListener('click', () => { cfg.flip = !cfg.flip; flipBtn.textContent = cfg.flip ? 'Flipped ✓' : 'Flip'; drawStage(); });
    mkRow('Mirror', flipBtn);
    const gradeSel = document.createElement('select');
    const inherit = document.createElement('option');
    inherit.value = 'inherit';
    inherit.textContent = 'Use poster grade';
    gradeSel.appendChild(inherit);
    for (const g of GRADES) {
      const o = document.createElement('option');
      o.value = g.id;
      o.textContent = g.name;
      if (g.id === cfg.grade) o.selected = true;
      gradeSel.appendChild(o);
    }
    if (cfg.grade === 'inherit') inherit.selected = true;
    gradeSel.addEventListener('change', () => { cfg.grade = gradeSel.value; drawStage(); });
    mkRow('Grade', gradeSel);
    list.appendChild(box);
  }
}

function photoName(slot) {
  const p = state.photos[slot];
  return p ? p.name : '—';
}

function bindTextControls() {
  const title = el('titleInput');
  title.value = state.title;
  title.addEventListener('input', () => { state.title = title.value || 'UNTITLED'; drawStage(); });
  const sub = el('subtitleInput');
  sub.value = state.subtitle;
  sub.addEventListener('input', () => { state.subtitle = sub.value; drawStage(); });
  const tag = el('taglineInput');
  tag.value = state.tagline;
  tag.addEventListener('input', () => { state.tagline = tag.value; drawStage(); });
  const size = el('titleSize');
  size.value = String(state.titleScale);
  size.addEventListener('input', () => { state.titleScale = Number(size.value); drawStage(); });
  const colors = el('titleColors');
  for (const c of ['#ffffff', '#ffd76b', '#ff5ce1', '#38e1ff', '#0a0f1e']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (c === state.titleColor ? ' on' : '');
    b.style.background = c;
    b.title = c;
    b.addEventListener('click', () => {
      state.titleColor = c;
      [...colors.children].forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      drawStage();
    });
    colors.appendChild(b);
  }
  el('badgeToggle').checked = state.badgeOn;
  el('badgeToggle').addEventListener('change', (e) => { state.badgeOn = e.target.checked; drawStage(); });
  el('scanToggle').checked = state.scanlines;
  el('scanToggle').addEventListener('change', (e) => { state.scanlines = e.target.checked; drawStage(); });
  el('grainToggle').checked = state.grainOn;
  el('grainToggle').addEventListener('change', (e) => { state.grainOn = e.target.checked; drawStage(); });
}

function bindActions() {
  el('surpriseBtn').addEventListener('click', () => {
    const layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
    const grade = GRADES[1 + Math.floor(Math.random() * (GRADES.length - 1))];
    state.layoutId = layout.id;
    state.gradeId = grade.id;
    for (const panel of layout.panels.filter((p) => p.kind === 'photo')) {
      cfgFor(panel).slot = Math.floor(Math.random() * state.photos.length);
    }
    buildLayoutGrid();
    buildGradeGrid();
    buildPanelList();
    drawStage();
    setStatus(`Surprise me: ${layout.name} + ${grade.name}.`);
  });
  el('exportBtn').addEventListener('click', () => { exportOne(state.sizeKey); });
  el('exportAllBtn').addEventListener('click', () => { exportAll(); });
  el('copyBtn').addEventListener('click', () => { copyPng(); });
  el('photoUpload').addEventListener('change', async (e) => {
    const files = [...(e.target.files ?? [])];
    for (const f of files) {
      const added = await addUpload(f);
      if (added) setStatus(`Added photo: ${added.name}.`);
    }
    buildPhotoPickers();
    buildPanelList();
    drawStage();
    e.target.value = '';
  });
}

// Drag a photo panel to pan it. The drag moves only the <image> element's
// transform live; the state is committed and the poster re-rendered on
// pointer-up, so the element under the pointer is never replaced mid-drag.
function bindDragPan() {
  const stage = el('stage');
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    const g = e.target.closest?.('[data-panel]');
    if (!g) return;
    const panelId = g.dataset.panel;
    const layout = currentLayout();
    const panel = layout.panels.find((p) => p.id === panelId && p.kind === 'photo');
    if (!panel) return;
    const svg = stage.querySelector('svg');
    const rect = svg.getBoundingClientRect();
    drag = { panel, cfg: cfgFor(panel), startX: e.clientX, startY: e.clientY, panX: cfgFor(panel).panX, panY: cfgFor(panel).panY, scale: rect.width / currentSize().w };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / drag.scale;
    const dy = (e.clientY - drag.startY) / drag.scale;
    drag.cfg.panX = drag.panX + dx;
    drag.cfg.panY = drag.panY + dy;
    const img = stage.querySelector(`image[data-panel="${drag.panel.id}"]`);
    if (img) {
      const size = currentSize();
      const box = panelBox(drag.panel, size.w, size.h);
      const photo = state.photos[drag.cfg.slot] ?? state.photos[0];
      if (photo && photo.w > 0) {
        const r = photoRect(box, photo, drag.cfg);
        const transform = drag.cfg.flip
          ? `translate(${fmt(r.x + r.w)} ${fmt(r.y)}) scale(-1 1)`
          : `translate(${fmt(r.x)} ${fmt(r.y)})`;
        img.setAttribute('transform', transform);
      }
    }
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    drawStage();
    setStatus('Photo panned.');
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------- scenes

// A scene preset from the URL (?shot=cover&photo=vice-avenue&caption=...),
// used by the screenshot script. Cover scenes hide the editor chrome so the
// shot is just the poster; editor scenes show the full studio.
export function applyScene(params) {
  const shot = params.get('shot') || 'editor';
  const photo = params.get('photo');
  const caption = params.get('caption');
  const layout = params.get('layout');
  const grade = params.get('grade');
  const size = params.get('size');
  if (layout && layoutById(layout)) state.layoutId = layout;
  if (grade && gradeById(grade)) state.gradeId = grade;
  if (size && EXPORT_SIZES.some((s) => s.key === size)) state.sizeKey = size;
  if (caption) state.title = caption;
  if (photo) {
    const idx = state.photos.findIndex((p) => p.id === photo);
    if (idx >= 0) {
      // The requested photo goes to the largest photo panel (the hero); the
      // other panels take the remaining samples round-robin, so a cover
      // never repeats one face in every frame.
      const photoPanels = currentLayout().panels.filter((p) => p.kind === 'photo');
      const areas = photoPanels.map((p) => {
        const b = panelBox(p, currentSize().w, currentSize().h);
        return b.w * b.h;
      });
      const heroAt = areas.indexOf(Math.max(...areas));
      photoPanels.forEach((panel, i) => {
        cfgFor(panel).slot = i === heroAt ? idx : (idx + i + 1) % state.photos.length;
      });
    }
  }
  if (shot === 'cover') document.body.classList.add('shot-cover');
  buildLayoutGrid();
  buildGradeGrid();
  buildSizeBtns();
  buildPhotoPickers();
  buildPanelList();
  drawStage();
}

export function markReady() {
  window.__shotReady = true;
}

// ---------------------------------------------------------------- init

export async function initApp() {
  await loadSamples();
  bindTextControls();
  buildLayoutGrid();
  buildGradeGrid();
  buildSizeBtns();
  buildPhotoPickers();
  buildPanelList();
  bindActions();
  bindDragPan();
  const params = new URLSearchParams(location.search);
  if (params.has('shot')) applyScene(params);
  else drawStage();
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => { drawStage(); markReady(); });
    setTimeout(markReady, 2500);
  } else {
    markReady();
  }
}
