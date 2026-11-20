// Neon Heist Canvas — the code-drawn sunset. Every sky panel is painted
// from these shapes alone: a three-stop sky, a striped synthwave sun and
// two palm silhouettes. No image is ever used for a sky.

import { PALETTE } from './presets.js';

// One palm tree as a single path, drawn in a local box 0..100 wide and
// 0..120 tall, rooted at (50, 120). Trunk bends right; seven fronds fan
// out from the crown. Fill it with the night colour and it reads as a
// silhouette against any sky.
export function palmPath() {
  return [
    'M46 120 C48 92 46 66 40 44',
    'L46 44 C50 66 54 92 56 120 Z',
    'M40 44 C26 30 12 28 2 34 C14 38 26 42 38 50 Z',
    'M40 44 C30 26 16 18 4 20 C16 28 28 36 38 50 Z',
    'M42 42 C40 24 30 10 16 6 C28 16 36 28 40 46 Z',
    'M44 42 C46 22 40 6 26 0 C36 12 42 26 44 44 Z',
    'M46 42 C52 22 62 8 78 4 C66 14 56 28 48 46 Z',
    'M48 44 C60 28 74 22 88 24 C74 30 60 38 50 50 Z',
    'M48 46 C62 34 78 32 92 38 C78 42 64 46 50 52 Z',
  ].join(' ');
}

// The <defs> block every poster carries: sky gradient, sun gradient, title
// shadow. `tag` keeps ids unique per poster instance.
export function sunsetDefs(tag) {
  return [
    `<linearGradient id="${tag}-sky" x1="0" y1="0" x2="0" y2="1">`,
    `  <stop offset="0" stop-color="${PALETTE.orange}"/>`,
    `  <stop offset="0.52" stop-color="${PALETTE.magenta}"/>`,
    `  <stop offset="1" stop-color="${PALETTE.purple}"/>`,
    `</linearGradient>`,
    `<radialGradient id="${tag}-sun" cx="0.5" cy="0.42" r="0.55">`,
    `  <stop offset="0" stop-color="#fff3c4"/>`,
    `  <stop offset="0.45" stop-color="${PALETTE.orange}"/>`,
    `  <stop offset="0.85" stop-color="${PALETTE.coral}"/>`,
    `  <stop offset="1" stop-color="${PALETTE.coral}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `<filter id="${tag}-title-shadow" x="-20%" y="-20%" width="140%" height="160%">`,
    `  <feDropShadow dx="0" dy="6" stdDeviation="0" flood-color="${PALETTE.purple}" flood-opacity="0.85"/>`,
    `</filter>`,
  ].join('\n');
}

// Paint a sunset into the box (x, y, w, h) in poster pixels. The sun sits
// a third of the way down; three sky-coloured slats cut its lower half so
// it reads as a striped retro sun; palms anchor the two bottom corners.
export function sunsetGroup(tag, x, y, w, h) {
  const sunR = Math.min(w, h) * 0.21;
  const sunCx = x + w * 0.5;
  const sunCy = y + h * 0.34;
  const palmH = h * 0.42;
  const palmW = palmH * (100 / 120);
  const slats = [0.02, 0.1, 0.2].map((dy, i) => {
    const sy = sunCy + sunR * dy;
    const half = Math.sqrt(Math.max(0, sunR * sunR - (sy - sunCy) * (sy - sunCy)));
    const sh = 2 + i * 2.5;
    return `<rect x="${(sunCx - half).toFixed(1)}" y="${sy.toFixed(1)}" width="${(half * 2).toFixed(1)}" height="${sh.toFixed(1)}" fill="url(#${tag}-sky)"/>`;
  }).join('\n');
  return [
    `<g>`,
    `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${tag}-sky)"/>`,
    `  <circle cx="${sunCx.toFixed(1)}" cy="${sunCy.toFixed(1)}" r="${sunR.toFixed(1)}" fill="url(#${tag}-sun)" stroke="${PALETTE.magenta}" stroke-width="${Math.max(1.5, sunR * 0.03).toFixed(1)}"/>`,
    slats,
    `  <g transform="translate(${(x + w * 0.02).toFixed(1)} ${(y + h - palmH).toFixed(1)}) scale(${(palmW / 100).toFixed(3)} ${(palmH / 120).toFixed(3)})" fill="${PALETTE.purple}">`,
    `    <path d="${palmPath()}"/>`,
    `  </g>`,
    `  <g transform="translate(${(x + w * 0.98 - palmW * 0.9).toFixed(1)} ${(y + h - palmH * 0.9).toFixed(1)}) scale(${(-palmW * 0.9 / 100).toFixed(3)} ${(palmH * 0.9 / 120).toFixed(3)})" fill="${PALETTE.ink}">`,
    `    <path d="${palmPath()}"/>`,
    `  </g>`,
    `</g>`,
  ].join('\n');
}
