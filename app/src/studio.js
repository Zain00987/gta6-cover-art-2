// Neon Heist Canvas — the studio. It owns the editor state, wires every
// control to it, and re-renders the composer's poster on every change.
// Photos come from the user's machine (never uploaded anywhere) or from
// the three built-in samples; each panel slot keeps its own photo setup
// (fit, anchor, zoom, pan, flip, grade) so every panel is tuned alone.

import {
  LAYOUTS, GRADES, EXPORT_SIZES, SAMPLE_PHOTOS, CAPTION_IDEAS,
  layoutById, gradeById,
} from './presets.js';
import { buildPosterSVG } from './composer.js';
import { exportOne, exportAll, copyPoster, posterToPng } from './exporter.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function defaultSetup() {
  return { photo: null, fit: 'cover', ax: 0.5, ay: 0.5, zoom: 1, panX: 0, panY: 0, flip: false, gradeId: 'neon-punch' };
}

const state = {
  title: 'SUNSET HEIST',
  subtitle: 'VICE CITY',
  layoutId: 'tri-split',
  sizeId: 'square',
  tag: true,
  selectedSlot: null,
  slots: {},
};

function currentSize() {
  if (state.sizeOverride) return state.sizeOverride;
  return EXPORT_SIZES.find((s) => s.id === state.sizeId) ?? EXPORT_SIZES[0];
}

function ensureSlots() {
  const layout = layoutById(state.layoutId);
  for (const slot of layout.slots) {
    if (!state.slots[slot.id]) state.slots[slot.id] = defaultSetup();
  }
  for (const id of Object.keys(state.slots)) {
    if (!layout.slots.some((s) => s.id === id)) delete state.slots[id];
  }
  if (state.selectedSlot && !state.slots[state.selectedSlot]) state.selectedSlot = null;
}

function loadImageSize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ src, iw: img.naturalWidth, ih: img.naturalHeight });
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

async function assignPhoto(slotId, src) {
  const photo = await loadImageSize(src);
  state.slots[slotId].photo = photo;
}

function setStatus(text) {
  $('status-line').textContent = text;
}

function render() {
  ensureSlots();
  $('poster-holder').innerHTML = buildPosterSVG(state, currentSize(), 'live');
  document.querySelectorAll('#layout-row button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layoutId);
  });
  document.querySelectorAll('#size-row button').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.sizeId);
  });
  renderInspector();
}

function renderInspector() {
  const box = $('panel-box');
  const setup = state.selectedSlot ? state.slots[state.selectedSlot] : null;
  if (!setup) {
    box.innerHTML = '<p class="hint">Click a panel on the poster to tune it: grade, crop, zoom, pan and flip.</p>';
    return;
  }
  const slot = layoutById(state.layoutId).slots.find((s) => s.id === state.selectedSlot);
  box.innerHTML = `
    <p class="hint">Panel <b>${slot.id}</b> · ${slot.kind === 'sky' ? 'sky panel (code-drawn sunset)' : slot.kind === 'title' ? 'title panel' : 'photo panel'}</p>
    <div class="row-label">Grade</div>
    <div class="chips" id="grade-row">${GRADES.map((g) => `<button data-grade="${g.id}" class="${setup.gradeId === g.id ? 'active' : ''}" title="${g.blurb}">${g.name}</button>`).join('')}</div>
    <div class="row-label">Fit</div>
    <select id="fit-select">
      <option value="cover" ${setup.fit === 'cover' ? 'selected' : ''}>Cover — fill the panel</option>
      <option value="contain" ${setup.fit === 'contain' ? 'selected' : ''}>Contain — show the whole photo</option>
    </select>
    <div class="row-label">Anchor</div>
    <div class="anchor-grid">${[0, 0.5, 1].map((ay) => [0, 0.5, 1].map((ax) => `<button data-ax="${ax}" data-ay="${ay}" class="${setup.ax === ax && setup.ay === ay ? 'active' : ''}">${ax === 0 ? '◀' : ax === 1 ? '▶' : '●'}${ay === 0 ? '▲' : ay === 1 ? '▼' : ''}</button>`).join('')).join('')}</div>
    <label>Zoom <input type="range" id="zoom-range" min="1" max="2.5" step="0.05" value="${setup.zoom}"></label>
    <label>Pan X <input type="range" id="panx-range" min="-0.3" max="0.3" step="0.01" value="${setup.panX}"></label>
    <label>Pan Y <input type="range" id="pany-range" min="-0.3" max="0.3" step="0.01" value="${setup.panY}"></label>
    <button id="flip-btn">${setup.flip ? 'Unflip photo' : 'Flip photo'}</button>
    <button id="clear-btn">Remove photo (sunset instead)</button>`;
  box.querySelectorAll('#grade-row button').forEach((b) => {
    b.onclick = () => { setup.gradeId = b.dataset.grade; render(); };
  });
  box.querySelector('#fit-select').onchange = (e) => { setup.fit = e.target.value; render(); };
  box.querySelectorAll('.anchor-grid button').forEach((b) => {
    b.onclick = () => { setup.ax = Number(b.dataset.ax); setup.ay = Number(b.dataset.ay); render(); };
  });
  box.querySelector('#zoom-range').oninput = (e) => { setup.zoom = Number(e.target.value); render(); };
  box.querySelector('#panx-range').oninput = (e) => { setup.panX = Number(e.target.value); render(); };
  box.querySelector('#pany-range').oninput = (e) => { setup.panY = Number(e.target.value); render(); };
  box.querySelector('#flip-btn').onclick = () => { setup.flip = !setup.flip; render(); };
  box.querySelector('#clear-btn').onclick = () => { setup.photo = null; render(); };
}

function buildControlRows() {
  $('sample-row').innerHTML = SAMPLE_PHOTOS.map((p) =>
    `<button data-sample="${p.id}"><img src="${p.src}" alt="${p.name}"><span>${p.name}</span></button>`).join('');
  $('sample-row').querySelectorAll('button').forEach((b) => {
    b.onclick = async () => {
      const photo = SAMPLE_PHOTOS.find((p) => p.id === b.dataset.sample);
      const target = state.selectedSlot ?? firstPhotoSlot();
      if (!target) return;
      await assignPhoto(target, photo.src);
      setStatus(`${photo.name} placed in panel ${target}`);
      render();
    };
  });
  $('layout-row').innerHTML = LAYOUTS.map((l) =>
    `<button data-layout="${l.id}" title="${l.blurb}">${l.name}</button>`).join('');
  $('layout-row').querySelectorAll('button').forEach((b) => {
    b.onclick = () => { state.layoutId = b.dataset.layout; state.selectedSlot = null; render(); };
  });
  $('size-row').innerHTML = EXPORT_SIZES.map((s) =>
    `<button data-size="${s.id}">${s.label}</button>`).join('');
  $('size-row').querySelectorAll('button').forEach((b) => {
    b.onclick = () => { state.sizeId = b.dataset.size; render(); };
  });
}

function firstPhotoSlot() {
  return layoutById(state.layoutId).slots.find((s) => s.kind === 'photo')?.id ?? null;
}

function wireStatic() {
  $('title-input').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  $('subtitle-input').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  $('photo-upload').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const target = state.selectedSlot ?? firstPhotoSlot();
    if (!target) return;
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    await assignPhoto(target, dataUrl);
    setStatus(`${file.name} placed in panel ${target} — it never leaves your machine`);
    render();
  });
  $('surprise-btn').onclick = async () => {
    state.layoutId = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)].id;
    state.title = CAPTION_IDEAS[Math.floor(Math.random() * CAPTION_IDEAS.length)];
    state.subtitle = ['VICE CITY', 'LEONIDA', 'EST. 2026', 'NEON NIGHTS'][Math.floor(Math.random() * 4)];
    ensureSlots();
    const photos = [...SAMPLE_PHOTOS].sort(() => Math.random() - 0.5);
    let i = 0;
    for (const slot of layoutById(state.layoutId).slots) {
      if (slot.kind !== 'photo') continue;
      const setup = state.slots[slot.id];
      setup.gradeId = GRADES[Math.floor(Math.random() * GRADES.length)].id;
      setup.zoom = 1 + Math.random() * 0.4;
      await assignPhoto(slot.id, photos[i++ % photos.length].src);
    }
    $('title-input').value = state.title;
    $('subtitle-input').value = state.subtitle;
    setStatus('Surprise! New layout, caption, grades and photos.');
    render();
  };
  $('poster-holder').addEventListener('click', (e) => {
    const g = e.target.closest('[data-slot]');
    if (!g) return;
    state.selectedSlot = g.dataset.slot;
    render();
  });
  $('export-one').onclick = async () => {
    try {
      const blob = await exportOne(state, currentSize(), setStatus);
      $('export-preview').src = URL.createObjectURL(blob);
    } catch (err) { setStatus(`Export failed: ${err.message}`); }
  };
  $('export-all').onclick = async () => {
    try {
      const blobs = await exportAll(state, setStatus);
      $('export-preview').src = URL.createObjectURL(blobs[0].blob);
    } catch (err) { setStatus(`Batch export failed: ${err.message}`); }
  };
  $('copy-btn').onclick = async () => {
    try { await copyPoster(state, currentSize(), setStatus); }
    catch (err) { setStatus(`Copy failed (clipboard needs a secure context): ${err.message}`); }
  };
}

// Screenshot modes, driven by the query string (see shots.json):
//   ?shot=cover  — poster only, full viewport, for the cover screenshots.
//   ?shot=editor — the full editor with a photo loaded.
//   ?shot=export — the editor, plus it exports once and shows the PNG.
async function applyShotMode() {
  const shot = params.get('shot');
  const pic = params.get('pic');
  const title = params.get('title');
  const layout = params.get('layout');
  const w = Number(params.get('w') ?? 0);
  const h = Number(params.get('h') ?? 0);
  if (title) { state.title = decodeURIComponent(title); $('title-input').value = state.title; }
  if (layout) state.layoutId = layout;
  ensureSlots();
  const photoSlots = layoutById(state.layoutId).slots.filter((s) => s.kind === 'photo');
  const sample = SAMPLE_PHOTOS.find((p) => p.id === pic) ?? SAMPLE_PHOTOS[0];
  for (let i = 0; i < photoSlots.length; i++) {
    const pick = SAMPLE_PHOTOS[(SAMPLE_PHOTOS.indexOf(sample) + i) % SAMPLE_PHOTOS.length];
    await assignPhoto(photoSlots[i].id, pick.src);
  }
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    if (w > 0 && h > 0) {
      state.sizeOverride = { id: 'custom', label: `${w} × ${h}`, w, h };
    }
    render();
    document.title = 'Neon Heist Canvas — cover';
    return;
  }
  if (shot === 'export') {
    render();
    try {
      const blob = await posterToPng(state, currentSize());
      $('export-preview').src = URL.createObjectURL(blob);
      setStatus(`Exported ${currentSize().w} × ${currentSize().h} PNG (${(blob.size / 1024).toFixed(0)} KiB) — ready to download`);
    } catch (err) { setStatus(`Export failed: ${err.message}`); }
    return;
  }
  render();
  setStatus('Ready — pick a photo, a layout, a caption, then export.');
}

async function boot() {
  buildControlRows();
  wireStatic();
  ensureSlots();
  if (params.get('shot')) {
    await applyShotMode();
    return;
  }
  const photoSlots = layoutById(state.layoutId).slots.filter((s) => s.kind === 'photo');
  for (let i = 0; i < photoSlots.length; i++) {
    await assignPhoto(photoSlots[i].id, SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length].src);
  }
  state.selectedSlot = firstPhotoSlot();
  render();
  setStatus('Ready — pick a photo, a layout, a caption, then export.');
}

boot();
