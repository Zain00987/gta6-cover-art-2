// Neon Heist Canvas editor: wires the controls to the drawing engine, loads photos
// from the machine (or the bundled samples), lets each panel be panned, zoomed, flipped
// and graded on its own, and exports the cover as a PNG. A `?shot=` query sets up a
// fixed scene for a screenshot instead.
import { drawCover, renderCover, GRADES, SIZES, LAYOUTS, layoutPanels, pointInPoly } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const taglineInput = document.getElementById('tagline');
const zoomInput = document.getElementById('zoom');
const capSizeInput = document.getElementById('capSize');
const panelPhotoSelect = document.getElementById('panelPhoto');
const panelGradeSelect = document.getElementById('panelGrade');
const thumbsEl = document.getElementById('thumbs');

export const PRESETS = [
  { caption: 'NEON HEIST', subtitle: 'LEONIDA · 2026', tagline: 'STEAL THE SUNSET', layout: 'hero', grade: 'vice', titlePos: 'bottom' },
  { caption: 'SUNSET HEIST', subtitle: 'VICE CITY NIGHTS', tagline: 'DRIVE FAST · LIVE LOUD', layout: 'triptych', grade: 'sunset', titlePos: 'bottom' },
  { caption: 'MIDNIGHT RUN', subtitle: 'NEON BOULEVARD', tagline: 'NO BRAKES AFTER DARK', layout: 'strips', grade: 'neon', titlePos: 'diagonal' },
  { caption: 'PALM & PISTOL', subtitle: 'MIAMI HEAT', tagline: 'EVERY SUNSET HAS A PRICE', layout: 'slant', grade: 'miami', titlePos: 'top' },
  { caption: 'KING OF VICE', subtitle: 'ONE CITY · ONE CROWN', tagline: 'BUILT IN THE HEAT', layout: 'quad', grade: 'sunset', titlePos: 'bottom' },
  { caption: 'SOLO RIDE', subtitle: 'LEONIDA', tagline: 'JUST ME AND THE COAST', layout: 'solo', grade: 'noir', titlePos: 'diagonal' },
];

const state = {
  layout: 'hero',
  grade: 'vice',
  size: '1080x1080',
  caption: 'NEON HEIST',
  subtitle: 'LEONIDA · 2026',
  tagline: 'STEAL THE SUNSET',
  titlePos: 'bottom',
  titleScale: 1,
  captionColor: '#fff7d6',
  outline: true,
  badge: true,
  grain: true,
  panels: Array.from({ length: 6 }, () => ({ img: null, zoom: 1, ox: 0, oy: 0, flip: false, grade: 'auto' })),
};

let photos = []; // { name, img } in load order
let activePanel = 0;
let dragging = null;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** How many panels the current layout shows. */
function panelCount() {
  return layoutPanels(state.layout, 100, 100).length;
}

/** Redraws the preview at the chosen export size. */
function redraw() {
  const [w, h] = SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state);
}

/** Marks the active choice in a group of buttons carrying data-value. */
function markActive(groupId, value) {
  document.querySelectorAll(`#${groupId} button`).forEach((b) => {
    b.classList.toggle('active', b.dataset.value === value);
  });
}

/** Rebuilds the panel picker buttons for the current layout. */
function buildPanelButtons() {
  const wrap = document.getElementById('panelBtns');
  wrap.innerHTML = '';
  for (let i = 0; i < panelCount(); i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `Panel ${i + 1}`;
    b.classList.toggle('active', i === activePanel);
    b.addEventListener('click', () => {
      activePanel = i;
      syncPanelControls();
      buildPanelButtons();
    });
    wrap.appendChild(b);
  }
}

/** Rebuilds the photo picker for the active panel. */
function buildPhotoSelect() {
  panelPhotoSelect.innerHTML = '';
  const none = document.createElement('option');
  none.value = '-1';
  none.textContent = 'Sky backdrop (sun + palms)';
  panelPhotoSelect.appendChild(none);
  photos.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = p.name;
    panelPhotoSelect.appendChild(o);
  });
  const current = state.panels[activePanel].img;
  const idx = photos.findIndex((p) => p.img === current);
  panelPhotoSelect.value = String(idx);
}

/** Rebuilds the per-panel grade picker. */
function buildGradeSelect() {
  panelGradeSelect.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = 'Match cover grade';
  panelGradeSelect.appendChild(auto);
  Object.entries(GRADES).forEach(([key, g]) => {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = g.label;
    panelGradeSelect.appendChild(o);
  });
  panelGradeSelect.value = state.panels[activePanel].grade || 'auto';
}

/** Rebuilds the photo thumbnail strip. */
function buildThumbs() {
  thumbsEl.innerHTML = '';
  photos.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = p.name;
    const img = document.createElement('img');
    img.src = p.img.src;
    img.alt = p.name;
    b.appendChild(img);
    b.addEventListener('click', () => {
      state.panels[activePanel].img = p.img;
      state.panels[activePanel].ox = 0;
      state.panels[activePanel].oy = 0;
      buildPhotoSelect();
      redraw();
    });
    thumbsEl.appendChild(b);
  });
}

/** Syncs the panel controls (zoom slider, photo + grade selects) with the active panel. */
function syncPanelControls() {
  const panel = state.panels[activePanel];
  zoomInput.value = String(panel.zoom);
  document.getElementById('zoomVal').textContent = `${panel.zoom.toFixed(1)}x`;
  document.getElementById('flip').textContent = panel.flip ? 'Unflip photo' : 'Flip photo';
  buildPhotoSelect();
  buildGradeSelect();
}

/** Syncs every control group with the current state. */
function syncAll() {
  markActive('layoutBtns', state.layout);
  markActive('gradeBtns', state.grade);
  markActive('sizeBtns', state.size);
  markActive('posBtns', state.titlePos);
  markActive('colorBtns', state.captionColor);
  document.getElementById('outline').checked = state.outline;
  document.getElementById('badge').checked = state.badge;
  document.getElementById('grain').checked = state.grain;
  captionInput.value = state.caption;
  subtitleInput.value = state.subtitle;
  taglineInput.value = state.tagline;
  capSizeInput.value = String(state.titleScale);
  document.getElementById('capSizeVal').textContent = `${Math.round(state.titleScale * 100)}%`;
  buildPanelButtons();
  syncPanelControls();
  buildThumbs();
}

/** Assigns a photo to the first panel that has none, or to the active panel. */
function placePhoto(img) {
  const empty = state.panels.slice(0, panelCount()).findIndex((p) => !p.img);
  const target = empty === -1 ? activePanel : empty;
  state.panels[target].img = img;
  state.panels[target].ox = 0;
  state.panels[target].oy = 0;
}

/** Adds files from the machine as photos. */
async function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const img = await loadImage(URL.createObjectURL(file));
      photos.push({ name: file.name, img });
      placePhoto(img);
    } catch {
      statusEl.textContent = `Could not read ${file.name}`;
    }
  }
  buildThumbs();
  buildPhotoSelect();
  redraw();
}

/** Loads bundled sample photos by name (samples/<name>.jpg). */
async function loadSamples(names) {
  for (const name of names) {
    if (photos.some((p) => p.name === `${name}.jpg`)) continue;
    try {
      const img = await loadImage(`samples/${name}.jpg`);
      photos.push({ name: `${name}.jpg`, img });
      placePhoto(img);
    } catch {
      statusEl.textContent = `Sample ${name}.jpg did not load`;
    }
  }
  // Fill any panel still empty by cycling the loaded photos, so every panel shows art.
  const count = panelCount();
  for (let i = 0; i < count; i++) {
    if (!state.panels[i].img && photos.length) {
      state.panels[i].img = photos[i % photos.length].img;
    }
  }
  buildThumbs();
  buildPhotoSelect();
  redraw();
}

/** Which panel lies under a point on the canvas (canvas pixels). */
function panelAt(x, y) {
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  // Later panels are drawn on top, so check them first.
  for (let i = panels.length - 1; i >= 0; i--) {
    if (pointInPoly(x, y, panels[i].poly)) return i;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const i = panelAt(x, y);
  if (i === -1) return;
  activePanel = i;
  buildPanelButtons();
  syncPanelControls();
  dragging = { x: e.clientX, y: e.clientY, ox: state.panels[i].ox, oy: state.panels[i].oy };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  const panel = state.panels[activePanel];
  panel.ox = dragging.ox + (e.clientX - dragging.x) * scale;
  panel.oy = dragging.oy + (e.clientY - dragging.y) * scale;
  redraw();
});

canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('pointercancel', () => { dragging = null; });

document.getElementById('photos').addEventListener('change', (e) => {
  addFiles([...e.target.files]);
  e.target.value = '';
});
document.getElementById('samples').addEventListener('click', () => loadSamples(['pier', 'boulevard']));
document.getElementById('surprise').addEventListener('click', () => {
  const pick = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  Object.assign(state, {
    layout: pick.layout, grade: pick.grade, titlePos: pick.titlePos,
    caption: pick.caption, subtitle: pick.subtitle, tagline: pick.tagline,
  });
  activePanel = 0;
  syncAll();
  redraw();
  statusEl.textContent = `Surprise: ${pick.caption} — ${LAYOUTS[pick.layout].label}, ${GRADES[pick.grade].label}`;
});
document.getElementById('layoutBtns').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.layout = b.dataset.value;
  activePanel = 0;
  syncAll();
  redraw();
});
document.getElementById('gradeBtns').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.grade = b.dataset.value;
  syncAll();
  redraw();
});
document.getElementById('sizeBtns').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.size = b.dataset.value;
  syncAll();
  redraw();
});
document.getElementById('posBtns').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.titlePos = b.dataset.value;
  syncAll();
  redraw();
});
document.getElementById('colorBtns').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.captionColor = b.dataset.value;
  syncAll();
  redraw();
});
document.getElementById('outline').addEventListener('change', (e) => {
  state.outline = e.target.checked;
  redraw();
});
document.getElementById('badge').addEventListener('change', (e) => {
  state.badge = e.target.checked;
  redraw();
});
document.getElementById('grain').addEventListener('change', (e) => {
  state.grain = e.target.checked;
  redraw();
});
captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  redraw();
});
taglineInput.addEventListener('input', () => {
  state.tagline = taglineInput.value;
  redraw();
});
capSizeInput.addEventListener('input', () => {
  state.titleScale = Number(capSizeInput.value);
  document.getElementById('capSizeVal').textContent = `${Math.round(state.titleScale * 100)}%`;
  redraw();
});
zoomInput.addEventListener('input', () => {
  state.panels[activePanel].zoom = Number(zoomInput.value);
  document.getElementById('zoomVal').textContent = `${state.panels[activePanel].zoom.toFixed(1)}x`;
  redraw();
});
panelPhotoSelect.addEventListener('change', () => {
  const idx = Number(panelPhotoSelect.value);
  const panel = state.panels[activePanel];
  panel.img = idx === -1 ? null : photos[idx].img;
  panel.ox = 0;
  panel.oy = 0;
  redraw();
});
panelGradeSelect.addEventListener('change', () => {
  state.panels[activePanel].grade = panelGradeSelect.value;
  redraw();
});
document.getElementById('flip').addEventListener('click', () => {
  const panel = state.panels[activePanel];
  panel.flip = !panel.flip;
  syncPanelControls();
  redraw();
});
document.getElementById('recenter').addEventListener('click', () => {
  const panel = state.panels[activePanel];
  panel.ox = 0;
  panel.oy = 0;
  panel.zoom = 1;
  syncPanelControls();
  redraw();
});
document.getElementById('export').addEventListener('click', () => {
  const [w, h] = SIZES[state.size];
  const out = renderCover(w, h, state);
  out.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = 'Export failed';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-heist-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    statusEl.textContent = `Saved neon-heist-${w}x${h}.png`;
  }, 'image/png');
});

/** Applies a shot scene (layout, grade, size, photos, type) then draws it. */
async function applyShot(scene) {
  if (scene.layout && LAYOUTS[scene.layout]) state.layout = scene.layout;
  if (scene.grade && GRADES[scene.grade]) state.grade = scene.grade;
  if (scene.size && SIZES[scene.size]) state.size = scene.size;
  if (scene.caption !== undefined) state.caption = scene.caption;
  if (scene.subtitle !== undefined) state.subtitle = scene.subtitle;
  if (scene.tagline !== undefined) state.tagline = scene.tagline;
  if (scene.titlePos) state.titlePos = scene.titlePos;
  if (scene.captionColor) state.captionColor = scene.captionColor;
  if (scene.badge !== undefined) state.badge = scene.badge;
  activePanel = 0;
  if (scene.photos && scene.photos.length) {
    state.panels.forEach((p) => { p.img = null; p.ox = 0; p.oy = 0; p.grade = 'auto'; });
    await loadSamples(scene.photos);
  }
  if (scene.panelPhotos) {
    // Explicit per-panel assignment: a name puts that photo in, empty means sky.
    scene.panelPhotos.forEach((name, i) => {
      const panel = state.panels[i];
      if (!panel) return;
      if (!name) {
        panel.img = null;
      } else {
        const found = photos.find((p) => p.name === `${name}.jpg` || p.name === name);
        if (found) panel.img = found.img;
      }
      panel.ox = 0;
      panel.oy = 0;
    });
  }
  if (scene.panelGrades) {
    // Per-panel grades go on last: loadSamples resets panels to 'auto'.
    scene.panelGrades.forEach((g, i) => {
      if (g && GRADES[g]) state.panels[i].grade = g;
    });
  }
  if (scene.panelPans) {
    scene.panelPans.forEach(([ox, oy], i) => {
      if (!state.panels[i]) return;
      if (Number.isFinite(ox)) state.panels[i].ox = ox;
      if (Number.isFinite(oy)) state.panels[i].oy = oy;
    });
  }
  if (scene.panelZooms) {
    scene.panelZooms.forEach((z, i) => {
      if (state.panels[i] && Number.isFinite(z) && z >= 1 && z <= 3) state.panels[i].zoom = z;
    });
  }
  syncAll();
  redraw();
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  await runShot(shot, params, applyShot, redraw);
} else {
  syncAll();
  await loadSamples(['pier', 'boulevard']);
  if (document.fonts) {
    document.fonts.load('100px Anton').then(redraw).catch(() => {});
  }
  redraw();
}
