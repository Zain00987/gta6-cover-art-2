// Neon Heist Canvas — the composer. It turns the studio's state (layout,
// caption, one photo setup per slot) into a single SVG poster string. The
// editor shows that string live; the exporter rasterises the very same
// string, so what you see is exactly what the PNG holds.

import { PALETTE, layoutById, gradeById } from './presets.js';
import { sunsetDefs, sunsetGroup } from './sunset.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wedgeD(cx, cy, r, a0, a1) {
  const rad = (a) => (a * Math.PI) / 180;
  const p0 = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0))];
  const p1 = [cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))];
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${cx.toFixed(1)} ${cy.toFixed(1)} L ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${large} 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} Z`;
}

// The clip element for a slot, in poster pixels, plus its bounding box.
function slotClip(slot, W, H) {
  const s = slot.shape;
  if (s.type === 'rect') {
    const x = s.x * W, y = s.y * H, w = s.w * W, h = s.h * H;
    return { el: `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`, box: { x, y, w, h } };
  }
  if (s.type === 'poly') {
    const pts = s.points.map(([px, py]) => `${(px * W).toFixed(1)},${(py * H).toFixed(1)}`).join(' ');
    const xs = s.points.map(([px]) => px * W), ys = s.points.map(([, py]) => py * H);
    return { el: `<polygon points="${pts}"/>`, box: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } };
  }
  if (s.type === 'circle') {
    const cx = s.cx * W, cy = s.cy * H, r = s.r * Math.min(W, H);
    return { el: `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/>`, box: { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r } };
  }
  const cx = s.cx * W, cy = s.cy * H, r = s.r * Math.min(W, H);
  return { el: `<path d="${wedgeD(cx, cy, r, s.a0, s.a1)}"/>`, box: { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r } };
}

// Where a photo lands inside a slot box: fit cover or contain, anchored at
// (ax, ay), zoomed, panned and optionally flipped.
function placePhoto(box, photo, setup) {
  const base = setup.fit === 'contain'
    ? Math.min(box.w / photo.iw, box.h / photo.ih)
    : Math.max(box.w / photo.iw, box.h / photo.ih);
  const scale = base * setup.zoom;
  const dw = photo.iw * scale;
  const dh = photo.ih * scale;
  const ox = box.x + (box.w - dw) * setup.ax + setup.panX * box.w;
  const oy = box.y + (box.h - dh) * setup.ay + setup.panY * box.h;
  const flip = setup.flip ? ` transform="translate(${(2 * (ox + dw / 2)).toFixed(1)} 0) scale(-1 1)"` : '';
  return { x: ox, y: oy, w: dw, h: dh, flip };
}

function gradeFilterDef(grade, tag) {
  const slope = grade.contrast * grade.brightness;
  const intercept = (1 - grade.contrast) * 0.5 * grade.brightness;
  return [
    `<filter id="${tag}-grade-${grade.id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">`,
    `  <feColorMatrix type="saturate" values="${grade.saturate}"/>`,
    `  <feComponentTransfer>`,
    `    <feFuncR type="linear" slope="${slope.toFixed(3)}" intercept="${intercept.toFixed(3)}"/>`,
    `    <feFuncG type="linear" slope="${slope.toFixed(3)}" intercept="${intercept.toFixed(3)}"/>`,
    `    <feFuncB type="linear" slope="${slope.toFixed(3)}" intercept="${intercept.toFixed(3)}"/>`,
    `  </feComponentTransfer>`,
    `</filter>`,
  ].join('\n');
}

function titleGroup(box, title, subtitle, tag) {
  const text = (title || 'YOUR TITLE').toUpperCase();
  const sub = (subtitle || '').toUpperCase();
  // Anton capitals run wide: budget 0.62em per character and a vertical
  // budget that leaves the subtitle its own band, so a long title never
  // clips at the slot's edges.
  const budget = sub ? box.h * 0.46 : box.h * 0.66;
  const size = Math.min(budget, box.w / Math.max(1, text.length * 0.62));
  const cx = box.x + box.w / 2;
  const stroke = Math.max(1.5, size * 0.07);
  const subSize = Math.min(box.h * 0.18, box.w / Math.max(1, sub.length * 0.7));
  const titleY = sub ? box.y + box.h * 0.48 : box.y + box.h * 0.62;
  const subY = box.y + box.h * 0.86;
  return [
    `<g font-family="Anton, 'Arial Narrow', sans-serif" text-anchor="middle">`,
    `  <rect x="${(box.x + box.w * 0.05).toFixed(1)}" y="${(box.y + box.h * 0.08).toFixed(1)}" width="${(box.w * 0.9).toFixed(1)}" height="${(box.h * 0.84).toFixed(1)}" fill="${PALETTE.ink}" opacity="0.3"/>`,
    `  <text x="${cx.toFixed(1)}" y="${titleY.toFixed(1)}" font-size="${size.toFixed(1)}" letter-spacing="${(size * 0.02).toFixed(1)}" fill="${PALETTE.paper}" stroke="${PALETTE.coral}" stroke-width="${stroke.toFixed(1)}" paint-order="stroke" filter="url(#${tag}-title-shadow)">${esc(text)}</text>`,
    `  <rect x="${(cx - box.w * 0.15).toFixed(1)}" y="${(titleY + size * 0.16).toFixed(1)}" width="${(box.w * 0.3).toFixed(1)}" height="${Math.max(2, size * 0.05).toFixed(1)}" fill="${PALETTE.coral}"/>`,
    sub ? `  <text x="${cx.toFixed(1)}" y="${subY.toFixed(1)}" font-size="${subSize.toFixed(1)}" letter-spacing="${(subSize * 0.14).toFixed(1)}" fill="${PALETTE.teal}">${esc(sub)}</text>` : '',
    `</g>`,
  ].join('\n');
}

// Build the whole poster as one SVG string. `state` is the studio state,
// `size` is {w, h} in pixels, `tag` keeps gradient/filter ids unique.
export function buildPosterSVG(state, size, tag = 'p1') {
  const { w: W, h: H } = size;
  const layout = layoutById(state.layoutId);
  const border = Math.max(2, W * 0.003);
  const parts = [];
  parts.push(`<svg xmlns="${SVG_NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  parts.push('<defs>');
  parts.push(sunsetDefs(tag));
  for (const grade of new Set(layout.slots.map((s) => (state.slots[s.id]?.gradeId ?? 'neon-punch')))) {
    parts.push(gradeFilterDef(gradeById(grade), tag));
  }
  for (const slot of layout.slots) {
    const { el } = slotClip(slot, W, H);
    parts.push(`<clipPath id="${tag}-clip-${slot.id}">${el}</clipPath>`);
  }
  parts.push('</defs>');
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${PALETTE.ink}"/>`);

  for (const slot of layout.slots) {
    const { el, box } = slotClip(slot, W, H);
    const setup = state.slots[slot.id];
    parts.push(`<g clip-path="url(#${tag}-clip-${slot.id})" data-slot="${slot.id}">`);
    if (slot.kind === 'sky') {
      parts.push(sunsetGroup(tag, box.x, box.y, box.w, box.h));
    } else if (slot.kind === 'title') {
      parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${PALETTE.purple}"/>`);
      parts.push(sunsetGroup(tag, box.x, box.y, box.w, box.h));
      parts.push(titleGroup(box, state.title, state.subtitle, tag));
    } else if (setup?.photo) {
      const grade = gradeById(setup.gradeId);
      const p = placePhoto(box, setup.photo, setup);
      parts.push(`<image href="${esc(setup.photo.src)}" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" preserveAspectRatio="none" filter="url(#${tag}-grade-${grade.id})"${p.flip}/>`);
      parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${grade.tint}" opacity="${grade.tintOpacity}"/>`);
    } else {
      parts.push(sunsetGroup(tag, box.x, box.y, box.w, box.h));
      parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="none" stroke="${PALETTE.paper}" stroke-opacity="0.35" stroke-width="${border}" stroke-dasharray="${(W * 0.012).toFixed(0)} ${(W * 0.008).toFixed(0)}"/>`);
    }
    parts.push('</g>');
    parts.push(`<g fill="none" stroke="${PALETTE.ink}" stroke-width="${border}">${el}</g>`);
  }

  if (state.tag !== false) {
    const tagSize = Math.max(13, W * 0.018);
    const label = 'LEONIDA • VI';
    const tw = label.length * tagSize * 0.62 + tagSize * 1.4;
    const th = tagSize * 2.1;
    parts.push(`<g font-family="Anton, 'Arial Narrow', sans-serif" text-anchor="middle">`);
    parts.push(`  <rect x="${(W - tw - 10).toFixed(1)}" y="10" width="${tw.toFixed(1)}" height="${th.toFixed(1)}" rx="${(th / 2).toFixed(1)}" fill="${PALETTE.ink}" fill-opacity="0.8" stroke="${PALETTE.coral}" stroke-width="2"/>`);
    parts.push(`  <text x="${(W - tw / 2 - 10).toFixed(1)}" y="${(10 + th * 0.68).toFixed(1)}" font-size="${tagSize.toFixed(1)}" letter-spacing="${(tagSize * 0.08).toFixed(1)}" fill="${PALETTE.paper}">${label}</text>`);
    parts.push('</g>');
  }
  parts.push(`<rect x="${(border / 2).toFixed(1)}" y="${(border / 2).toFixed(1)}" width="${(W - border).toFixed(1)}" height="${(H - border).toFixed(1)}" fill="none" stroke="${PALETTE.purple}" stroke-width="${border}"/>`);
  parts.push('</svg>');
  return parts.join('\n');
}
