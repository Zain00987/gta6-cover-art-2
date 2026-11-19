// Fixed scenes for screenshots: ?shot=cover shows the cover alone, ?shot=editor shows the
// page with photos loaded. Query knobs: layout, grade, size, photo (comma list of sample
// names), panelPhoto (comma list, one per panel; empty = sky backdrop), panelGrade (comma
// list of per-panel grades), panelPan (semicolon list of "ox,oy" canvas-pixel pans, one
// per panel — used to frame faces in wide/short panels), panelZoom (comma list of zooms),
// caption, subtitle, tagline, titlePos, capColor, badge.
// window.__shotReady is set once painted.
export async function runShot(shot, query, apply, redraw) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const scene = {
    layout: query.get('layout') ?? undefined,
    grade: query.get('grade') ?? undefined,
    size: query.get('size') ?? undefined,
    photos: (query.get('photo') ?? 'pier').split(',').map((s) => s.trim()).filter(Boolean),
    panelPhotos: query.get('panelPhoto')
      ? query.get('panelPhoto').split(',').map((s) => s.trim())
      : undefined,
    panelGrades: query.get('panelGrade')
      ? query.get('panelGrade').split(',').map((s) => s.trim())
      : undefined,
    panelPans: query.get('panelPan')
      ? query.get('panelPan').split(';').map((s) => s.split(',').map(Number))
      : undefined,
    panelZooms: query.get('panelZoom')
      ? query.get('panelZoom').split(',').map(Number)
      : undefined,
    caption: query.get('caption') ?? undefined,
    subtitle: query.get('subtitle') ?? undefined,
    tagline: query.get('tagline') ?? undefined,
    titlePos: query.get('titlePos') ?? undefined,
    captionColor: query.get('capColor') ?? undefined,
    badge: query.get('badge') === '0' ? false : undefined,
  };
  await apply(scene);
  if (document.fonts) {
    try {
      await document.fonts.load('100px Anton');
      await document.fonts.ready;
    } catch { /* fall back to the system font stack */ }
  }
  redraw();
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  window.__shotReady = true;
}
