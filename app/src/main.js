// Neon Heist Canvas — studio UI wiring (my own code).
// Loads the sample photos, binds every control to the poster state, handles
// panel picking (polygon hit-test), drag-to-pan, wheel zoom, file upload and
// drop, "Surprise me", and the four-size PNG export + batch + clipboard.
// Shot mode (?shot=cover|editor|export) presets a poster for screenshots and
// sets window.__posterReady once the first frame is painted.
import {
  GRADES, GRADE_IDS, LAYOUTS, ROLES, TITLES, SUBTITLES, QUOTES, TAGLINES,
  defaultState, layoutOf, panelAt, renderPoster, renderToCanvas, downloadCanvas,
} from './poster.js';

const $ = (id) => document.getElementById(id);
const canvas = $('poster');
const ctx = canvas.getContext('2d');
const state = defaultState();
const images = new Map(); // src -> HTMLImageElement
const uploaded = new Map(); // objectURL/dataURL -> HTMLImageElement (same map, keyed by src)
let dragging = null; // { panel, lastX, lastY }
let statusTimer = null;

function setStatus(text) {
  const el = $('status');
  if (el) el.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { if (el) el.textContent = ''; }, 6000);
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (images.has(src)) return resolve(images.get(src));
    const img = new Image();
    img.onload = () => { images.set(src, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAllPhotos() {
  const srcs = [...new Set(state.panels.map((p) => p.src).filter(Boolean))];
  await Promise.all(srcs.map(loadImage));
}

function draw() {
  renderPoster(ctx, canvas.width, canvas.height, state, images, { showSelection: true });
}

function renderNow() {
  draw();
  window.__posterReady = true;
}

// ---------------------------------------------------------------- control builders
function buildChips() {
  const layoutRow = $('layoutRow');
  for (const layout of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = layout.name;
    b.dataset.layout = layout.id;
    b.addEventListener('click', () => {
      state.layout = layout.id;
      // The hero panel index moves with the layout; keep the same role selected.
      state.selected = layout.panels.findIndex((p) => p.hero);
      syncPanelControls();
      syncChips();
      draw();
    });
    layoutRow.appendChild(b);
  }
  const gradeRow = $('gradeRow');
  for (const id of GRADE_IDS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.grade = id;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = `linear-gradient(90deg, ${GRADES[id].sky[0]}, ${GRADES[id].sky[1]})`;
    b.appendChild(dot);
    b.appendChild(document.createTextNode(GRADES[id].name));
    b.addEventListener('click', () => {
      state.grade = id;
      syncChips();
      draw();
    });
    gradeRow.appendChild(b);
  }
}

function syncChips() {
  document.querySelectorAll('#layoutRow button').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('#gradeRow button').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
}

function syncPanelControls() {
  const panel = state.panels[state.selected];
  if (!panel) return;
  $('selectedName').textContent = panel.role;
  $('role').value = panel.role;
  $('panelGrade').value = panel.grade || '';
  $('zoom').value = String(panel.zoom);
}

function syncTextControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('quote').value = state.quote;
  $('gazette').value = state.gazette;
  $('tagline').value = state.tagline;
  $('billing').value = state.billing;
}

// ---------------------------------------------------------------- panel picking & pan/zoom
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

canvas.addEventListener('pointerdown', (event) => {
  const { x, y } = canvasPoint(event);
  const hit = panelAt(state, x, y, canvas.width, canvas.height);
  if (hit < 0) return;
  state.selected = hit;
  syncPanelControls();
  dragging = { panel: hit, lastX: x, lastY: y };
  canvas.setPointerCapture(event.pointerId);
  draw();
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const { x, y } = canvasPoint(event);
  const panel = state.panels[dragging.panel];
  const layout = layoutOf(state);
  const pts = layout.panels[dragging.panel].pts;
  const xs = pts.map((p) => p[0] * canvas.width);
  const ys = pts.map((p) => p[1] * canvas.height);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  panel.panX = Math.max(-0.6, Math.min(0.6, panel.panX + ((x - dragging.lastX) / w) * 1.6));
  panel.panY = Math.max(-0.6, Math.min(0.6, panel.panY + ((y - dragging.lastY) / h) * 1.6));
  dragging.lastX = x;
  dragging.lastY = y;
  draw();
});

canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('pointercancel', () => { dragging = null; });

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const { x, y } = canvasPoint(event);
  const hit = panelAt(state, x, y, canvas.width, canvas.height);
  const index = hit >= 0 ? hit : state.selected;
  const panel = state.panels[index];
  if (!panel) return;
  state.selected = index;
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * factor));
  syncPanelControls();
  draw();
}, { passive: false });

// Drop an image file straight onto a panel to fill it.
canvas.addEventListener('dragover', (event) => event.preventDefault());
canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  const { x, y } = canvasPoint(event);
  const hit = panelAt(state, x, y, canvas.width, canvas.height);
  if (hit >= 0) state.selected = hit;
  assignUpload(file);
});

function assignUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const src = String(reader.result);
    loadImage(src).then(() => {
      state.panels[state.selected].src = src;
      state.panels[state.selected].zoom = 1.15;
      state.panels[state.selected].panX = 0;
      state.panels[state.selected].panY = 0;
      draw();
      setStatus('Photo placed in the selected panel.');
    });
  };
  reader.readAsDataURL(file);
}

// ---------------------------------------------------------------- controls
function bindControls() {
  $('upload').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) assignUpload(file);
    event.target.value = '';
  });

  document.querySelectorAll('.sample').forEach((b) => {
    b.addEventListener('click', async () => {
      const src = b.dataset.sample;
      await loadImage(src);
      const panel = state.panels[state.selected];
      panel.src = src;
      panel.role = b.dataset.role || panel.role;
      panel.zoom = 1.15; panel.panX = 0; panel.panY = 0;
      syncPanelControls();
      draw();
      setStatus(`Sample photo placed as ${panel.role}.`);
    });
  });

  $('role').addEventListener('input', (e) => {
    state.panels[state.selected].role = e.target.value.toUpperCase().slice(0, 24);
    $('selectedName').textContent = state.panels[state.selected].role;
    draw();
  });
  $('panelGrade').addEventListener('change', (e) => {
    state.panels[state.selected].grade = e.target.value;
    draw();
  });
  $('flip').addEventListener('click', () => {
    const p = state.panels[state.selected];
    p.flip = !p.flip;
    draw();
  });
  $('clearPhoto').addEventListener('click', () => {
    state.panels[state.selected].src = null;
    draw();
    setStatus('Panel is now a sky panel (sun, palms, glow).');
  });
  $('resetPan').addEventListener('click', () => {
    const p = state.panels[state.selected];
    p.zoom = 1.15; p.panX = 0; p.panY = 0;
    syncPanelControls();
    draw();
  });
  $('zoom').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    draw();
  });

  const textBindings = [
    ['title', 'title', (v) => v.toUpperCase()],
    ['subtitle', 'subtitle', (v) => v],
    ['quote', 'quote', (v) => v.toUpperCase()],
    ['gazette', 'gazette', (v) => v.toUpperCase()],
    ['tagline', 'tagline', (v) => v.toUpperCase()],
    ['billing', 'billing', (v) => v],
  ];
  for (const [id, key, clean] of textBindings) {
    $(id).addEventListener('input', (e) => {
      state[key] = clean(e.target.value);
      draw();
    });
  }

  $('surprise').addEventListener('click', () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const layout = pick(LAYOUTS);
    state.layout = layout.id;
    state.grade = pick(GRADE_IDS);
    state.title = pick(TITLES);
    state.subtitle = pick(SUBTITLES);
    const [q, g] = pick(QUOTES);
    state.quote = q;
    state.gazette = g;
    state.tagline = pick(TAGLINES);
    // Shuffle which photo sits where; roles follow the photos.
    const photos = [
      { src: 'samples/boss.jpg', role: 'THE BOSS' },
      { src: 'samples/driver.jpg', role: 'THE DRIVER' },
      { src: 'samples/lookout.jpg', role: 'THE LOOKOUT' },
    ];
    for (let i = photos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [photos[i], photos[j]] = [photos[j], photos[i]];
    }
    const slots = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 3);
    const skyRoles = ['THE FIXER', 'THE INSIDER', 'THE MECHANIC'];
    state.panels.forEach((p, i) => {
      const slot = slots.indexOf(i);
      if (slot >= 0) {
        p.src = photos[slot].src;
        p.role = photos[slot].role;
      } else {
        p.src = null;
        p.role = skyRoles[i % skyRoles.length];
      }
      p.zoom = 1.05 + Math.random() * 0.35;
      p.panX = (Math.random() - 0.5) * 0.3;
      p.panY = (Math.random() - 0.5) * 0.2;
    });
    state.selected = layout.panels.findIndex((p) => p.hero);
    syncTextControls();
    syncPanelControls();
    syncChips();
    draw();
    setStatus(`Surprise: ${layout.name} · ${GRADES[state.grade].name} · “${state.title}”.`);
  });

  const SIZES = {
    '1080x1080': [1080, 1080, 'square'],
    '1080x1350': [1080, 1350, 'portrait'],
    '1080x1920': [1080, 1920, 'story'],
    '1920x1080': [1920, 1080, 'wide'],
  };
  $('export').addEventListener('click', async () => {
    await loadAllPhotos();
    const [w, h, name] = SIZES[$('exportSize').value];
    const out = renderToCanvas(w, h, state, images);
    downloadCanvas(out, `neon-heist-canvas-${name}-${w}x${h}.png`);
    setStatus(`Exported PNG ${w} × ${h}.`);
  });
  $('batch').addEventListener('click', async () => {
    await loadAllPhotos();
    for (const [key, [w, h, name]] of Object.entries(SIZES)) {
      const out = renderToCanvas(w, h, state, images);
      downloadCanvas(out, `neon-heist-canvas-${name}-${w}x${h}.png`);
      await new Promise((r) => setTimeout(r, 250));
    }
    setStatus('Batch export done: all 4 sizes.');
  });
  $('copy').addEventListener('click', async () => {
    try {
      await loadAllPhotos();
      const [w, h] = SIZES[$('exportSize').value];
      const out = renderToCanvas(w, h, state, images);
      const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('PNG copied to clipboard.');
    } catch (err) {
      setStatus('Copy failed in this browser — use Export PNG instead.');
    }
  });
}

// ---------------------------------------------------------------- shot mode
function applyShotParams(params) {
  const shot = params.get('shot');
  if (!shot) return;
  document.body.classList.add(`shot-${shot}`);
  const photo = params.get('photo');
  const caption = params.get('caption');
  const layout = params.get('layout');
  const grade = params.get('grade');
  if (layout && LAYOUTS.some((l) => l.id === layout)) state.layout = layout;
  if (grade && GRADES[grade]) state.grade = grade;
  if (caption) state.title = caption.toUpperCase();
  if (photo) {
    const map = { boss: 'samples/boss.jpg', driver: 'samples/driver.jpg', lookout: 'samples/lookout.jpg' };
    const heroIndex = layoutOf(state).panels.findIndex((p) => p.hero);
    if (map[photo] && heroIndex >= 0) {
      // Swap the requested photo (and its role) into the hero panel, so no
      // person ever appears twice: the panel that held it gets the hero's old photo.
      const wanted = map[photo];
      const holder = state.panels.findIndex((p) => p.src === wanted);
      const heroRole = photo === 'boss' ? 'THE BOSS' : photo === 'driver' ? 'THE DRIVER' : 'THE LOOKOUT';
      if (holder >= 0 && holder !== heroIndex) {
        const oldSrc = state.panels[heroIndex].src;
        const oldRole = state.panels[heroIndex].role;
        state.panels[heroIndex].src = wanted;
        state.panels[heroIndex].role = heroRole;
        state.panels[holder].src = oldSrc;
        state.panels[holder].role = oldRole;
      } else {
        state.panels[heroIndex].src = wanted;
        state.panels[heroIndex].role = heroRole;
      }
    }
  }
  if (shot === 'cover' || shot === 'export') {
    // Poster renders carry no editor selection outline.
    state.selected = -1;
  }
  if (shot === 'export') {
    canvas.width = 1080;
    canvas.height = 1350;
  }
}

// ---------------------------------------------------------------- boot
async function boot() {
  buildChips();
  bindControls();
  syncChips();
  syncPanelControls();
  syncTextControls();
  const params = new URLSearchParams(window.location.search);
  applyShotParams(params);
  try {
    await document.fonts.load('100px "Bebas Neue"');
    await document.fonts.ready;
  } catch { /* fall back to system fonts; the poster still renders */ }
  await loadAllPhotos();
  draw();
  window.__posterReady = true;
}

boot().catch((err) => {
  console.error(err);
  const el = $('status');
  if (el) el.textContent = `Could not start the studio: ${err.message}`;
});
