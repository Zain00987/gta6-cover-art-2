// Neon Heist Canvas — entry point.
// This module starts the studio and, when the page is opened with a ?shot=
// query, applies that scene preset and raises the flag the screenshot script
// waits for. All of the app's behaviour lives in poster.js; this file only
// wires the start-up order.

import { initApp, markReady } from './poster.js';

function start() {
  initApp().then(() => {
    // initApp already raises __shotReady once the fonts arrive; this is the
    // backstop so a shot never waits forever on a slow font.
    setTimeout(markReady, 3000);
  }).catch((err) => {
    console.error(err);
    const status = document.getElementById('status');
    if (status) status.textContent = `Could not start the studio: ${err.message}`;
    markReady();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
