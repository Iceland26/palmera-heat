// Keyboard + mouse state for Costa Palmera. Held keys live in a Set; one-shot
// presses are queued so a tap between frames is never lost.
export function createInput() {
  const held = new Set();
  const pressed = new Set();
  const mouse = { dx: 0, dy: 0, down: false, clicked: false };

  window.addEventListener('keydown', (e) => {
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });
  window.addEventListener('mousemove', (e) => { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; });
  window.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });

  return {
    held,
    mouse,
    down: (code) => held.has(code),
    /** true once per physical press */
    tap(code) { const t = pressed.has(code); pressed.delete(code); return t; },
    takeMouse() { const m = { dx: mouse.dx, dy: mouse.dy, clicked: mouse.clicked }; mouse.dx = 0; mouse.dy = 0; mouse.clicked = false; return m; },
    clearTaps() { pressed.clear(); },
  };
}
