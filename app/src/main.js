// Neon Heist Canvas editor (rebuilt 2026-11-20, second recorded pass): wires the
// controls to the drawing engine, loads photos from the machine (or the three bundled
// samples), lets each panel be panned, zoomed, flipped, fitted, anchored and graded
// on its own, and exports the cover as a PNG. A `?shot=` query sets up a fixed scene
// for a screenshot instead.
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
  { caption: 'SUNBURST HEIST', subtitle: 'VICE CITY · EST. 2026', tagline: 'EVERY RAY A GETAWAY', layout: 'burst', grade: 'sunset', titlePos: 'bottom' },
  { caption: 'OCEAN DRIVE', subtitle: 'VICE CITY NIGHTS', tagline: 'NEON NEVER SLEEPS', layout: 'chevron', grade: 'neon', titlePos: 'bottom' },
];

const state = {
  layout: 'burst',
  grade: 'vice',
  size: '1080x1080',
  caption: 'SUNBURST HEIST',
  subtitle: 'VICE CITY · EST. 2026',
  tagline: 'EVERY RAY A GETAWAY',
  titlePos: 'bottom',
  titleScale: 1,
  captionColor: '#fff7d6',
  outline: true,
  badge: true,
  grain: true,
  scanlines: false,
  panels: Array.from({ length: 8 }, () => ({ img: null, zoom: 1, ox: 0, oy: 0, flip: false, fit: 'cover', grade: 'auto', anchor: 'center', pop: true })),
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

/** True when the active panel is the burst hub (the sun medallion, never a photo). */
function isHubPanel() {
  return state.layout === 'burst' && activePanel === panelCount() - 1;
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
    b.textContent = state.layout === 'burst' && i === panelCount() - 1 ? 'Sun medallion' : `Panel ${i + 1}`;
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
      if (isHubPanel()) {
        statusEl.textContent = 'The hub is the sun medallion — pick another panel for photos';
        return;
      }
      state.panels[activePanel].img = p.img;
      state.panels[activePanel].ox = 0;
      state.panels[activePanel].oy = 0;
      buildPhotoSelect();
      redraw();
    });
    thumbsEl.appendChild(b);
  });
}

/** Syncs the panel controls (zoom slider, fit, anchor, pop, photo + grade selects). */
function syncPanelControls() {
  const panel = state.panels[activePanel];
  zoomInput.value = String(panel.zoom);
  document.getElementById('zoomVal').textContent = `${panel.zoom.toFixed(1)}x`;
  document.getElementById('flip').textContent = panel.flip ? 'Unflip photo' : 'Flip photo';
  document.getElementById('fit').textContent = panel.fit === 'whole' ? 'Fit: whole photo' : 'Fit: fill panel';
  document.getElementById('pop').textContent = panel.pop === false ? 'Colour pop: off' : 'Colour pop: on';
  markActive('anchorBtns', panel.anchor || 'center');
  // The burst hub is the sun medallion: no photo, flip, fit or anchor applies to it.
  const hub = isHubPanel();
  panelPhotoSelect.disabled = hub;
  document.getElementById('flip').disabled = hub;
  document.getElementById('fit').disabled = hub;
  document.getElementById('pop').disabled = hub;
  document.querySelectorAll('#anchorBtns button').forEach((b) => { b.disabled = hub; });
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
  document.getElementById('scanlines').checked = state.scanlines;
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
  const count = panelCount();
  const empty = state.panels.slice(0, count).findIndex((p, i) => !p.img && !(state.layout === 'burst' && i === count - 1));
  const target = empty === -1 ? activePanel : empty;
  if (state.layout === 'burst' && target === count - 1) return; // hub stays the medallion
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
  // Fill any panel still empty by cycling the loaded photos, so every panel shows
  // art — except the burst hub, which stays the sun medallion.
  const count = panelCount();
  for (let i = 0; i < count; i++) {
    if (state.layout === 'burst' && i === count - 1) continue;
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
document.getElementById('samples').addEventListener('click', () => loadSamples(['pier', 'boulevard', 'neon']));
document.getElementById('surprise').addEventListener('click', () => {
  // Mix-and-match instead of a wholesale preset: text from one preset, layout,
  // grade and title position rolled independently — more distinct posters per click.
  const pick = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  const positions = ['bottom', 'top', 'diagonal'];
  Object.assign(state, {
    layout: layouts[Math.floor(Math.random() * layouts.length)],
    grade: grades[Math.floor(Math.random() * grades.length)],
    titlePos: positions[Math.floor(Math.random() * positions.length)],
    caption: pick.caption, subtitle: pick.subtitle, tagline: pick.tagline,
  });
  activePanel = 0;
  syncAll();
  redraw();
  statusEl.textContent = `Surprise: ${pick.caption} — ${LAYOUTS[state.layout].label}, ${GRADES[state.grade].label}`;
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
document.getElementById('anchorBtns').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  state.panels[activePanel].anchor = b.dataset.value;
  state.panels[activePanel].oy = 0;
  syncPanelControls();
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
document.getElementById('scanlines').addEventListener('change', (e) => {
  state.scanlines = e.target.checked;
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
document.getElementById('fit').addEventListener('click', () => {
  const panel = state.panels[activePanel];
  panel.fit = panel.fit === 'whole' ? 'cover' : 'whole';
  syncPanelControls();
  redraw();
});
document.getElementById('pop').addEventListener('click', () => {
  const panel = state.panels[activePanel];
  panel.pop = panel.pop === false;
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
  statusEl.textContent = `Rendering ${w}x${h}…`;
  // Let the status paint before the synchronous render, so the UI never looks frozen.
  requestAnimationFrame(() => setTimeout(() => {
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
  }, 30));
});

/** Copies the current cover PNG straight to the clipboard (Chrome). */
document.getElementById('copyPng').addEventListener('click', async () => {
  const [w, h] = SIZES[state.size];
  statusEl.textContent = `Rendering ${w}x${h} for clipboard…`;
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  const out = renderCover(w, h, state);
  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) {
    statusEl.textContent = 'Copy failed';
    return;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    statusEl.textContent = `Copied ${w}x${h} PNG to clipboard`;
  } catch {
    statusEl.textContent = 'Clipboard blocked by the browser — use Export PNG instead';
  }
});

/** One click renders and downloads all four post sizes, in order. */
document.getElementById('exportAll').addEventListener('click', async () => {
  const keys = Object.keys(SIZES);
  for (let i = 0; i < keys.length; i++) {
    const [w, h] = SIZES[keys[i]];
    statusEl.textContent = `Rendering ${w}x${h} (${i + 1}/${keys.length})…`;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    const out = renderCover(w, h, state);
    const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
    if (!blob) {
      statusEl.textContent = 'Export failed';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-heist-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    await new Promise((r) => setTimeout(r, 350));
  }
  statusEl.textContent = `Saved ${keys.length} PNGs (1080x1080, 1080x1350, 1080x1920, 1920x1080)`;
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
  if (scene.scanlines !== undefined) state.scanlines = scene.scanlines;
  activePanel = 0;
  if (scene.photos && scene.photos.length) {
    state.panels.forEach((p) => { p.img = null; p.ox = 0; p.oy = 0; p.grade = 'auto'; p.fit = 'cover'; p.anchor = 'center'; p.pop = true; });
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
  if (scene.panelFits) {
    scene.panelFits.forEach((f, i) => {
      if (state.panels[i] && (f === 'whole' || f === 'cover')) state.panels[i].fit = f;
    });
  }
  if (scene.panelAnchors) {
    scene.panelAnchors.forEach((a, i) => {
      if (state.panels[i] && (a === 'top' || a === 'center' || a === 'bottom')) state.panels[i].anchor = a;
    });
  }
  if (scene.panelPops) {
    scene.panelPops.forEach((p, i) => {
      if (state.panels[i] && typeof p === 'boolean') state.panels[i].pop = p;
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
  await loadSamples(['pier', 'boulevard', 'neon']);
  if (document.fonts) {
    document.fonts.load('100px Anton').then(redraw).catch(() => {});
  }
  redraw();
}
