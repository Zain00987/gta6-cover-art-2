// Neon Heist Canvas — the exporter. It rasterises the composer's SVG into
// a PNG at any post size. An SVG drawn into a canvas cannot fetch anything,
// so the font and every photo are inlined as data: URIs first: the font as
// a base64 @font-face, each photo fetched and re-encoded. What the canvas
// draws is therefore exactly the poster the editor shows.

import { buildPosterSVG } from './composer.js';
import { EXPORT_SIZES } from './presets.js';

let fontFaceCache = null;

async function fontFace() {
  if (fontFaceCache) return fontFaceCache;
  const buf = await (await fetch('fonts/Anton-Regular.ttf')).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  fontFaceCache = `<style>@font-face{font-family:'Anton';src:url(data:font/ttf;base64,${btoa(bin)}) format('truetype');font-weight:400;font-style:normal;}</style>`;
  return fontFaceCache;
}

async function toDataURL(url) {
  const blob = await (await fetch(url)).blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`could not read ${url}`));
    reader.readAsDataURL(blob);
  });
}

// Replace every non-data image href in the SVG with a data: URI, and inject
// the font, so the SVG is fully self-contained before it is rasterised.
async function inlinePoster(svg) {
  const hrefs = [...new Set([...svg.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))]
    .filter((u) => !u.startsWith('data:'));
  let out = svg;
  for (const href of hrefs) {
    const data = await toDataURL(href);
    out = out.split(`href="${href}"`).join(`href="${data}"`);
  }
  const face = await fontFace();
  out = out.replace(/(<svg[^>]*>)/, `$1${face}`);
  return out;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('poster image failed to load'));
    img.src = url;
  });
}

export async function posterToPng(state, size) {
  const svg = buildPosterSVG(state, size, `x-${size.w}x${size.h}`);
  const ready = await inlinePoster(svg);
  const url = URL.createObjectURL(new Blob([ready], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size.w, size.h);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function exportOne(state, size, onStatus) {
  onStatus?.(`Rendering ${size.w} × ${size.h}…`);
  const blob = await posterToPng(state, size);
  download(blob, `neon-heist-${size.w}x${size.h}.png`);
  onStatus?.(`Saved neon-heist-${size.w}x${size.h}.png (${(blob.size / 1024).toFixed(0)} KiB)`);
  return blob;
}

export async function exportAll(state, onStatus) {
  const blobs = [];
  for (const size of EXPORT_SIZES) {
    const blob = await exportOne(state, size, onStatus);
    blobs.push({ size, blob });
    await sleep(400);
  }
  onStatus?.(`Batch done: ${blobs.length} PNGs exported`);
  return blobs;
}

export async function copyPoster(state, size, onStatus) {
  onStatus?.('Copying PNG to clipboard…');
  const blob = await posterToPng(state, size);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  onStatus?.(`Copied ${size.w} × ${size.h} PNG to the clipboard`);
  return blob;
}
