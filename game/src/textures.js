// Procedural canvas textures — every surface in Costa Palmera is painted here,
// no image files. Facades come in pairs: a colour map and an emissive map that
// carries only the lit windows, so the city glows at golden hour.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32 } from './random.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function grain(g, w, h, rng, n, alpha, dark = true) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(rng() * 60);
    g.fillStyle = dark && rng() > 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(${200 + v},${200 + v},${200 + v},${alpha * 0.7})`;
    g.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
  }
}

export function asphaltTexture() {
  const c = canvas(256, 256), g = c.getContext('2d'), rng = mulberry32(41);
  g.fillStyle = '#33373c'; g.fillRect(0, 0, 256, 256);
  grain(g, 256, 256, rng, 2600, 0.16);
  // oil-wear patches
  for (let i = 0; i < 9; i++) {
    const x = rng() * 256, y = rng() * 256, r = 18 + rng() * 46;
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, 'rgba(12,12,16,0.34)'); gr.addColorStop(1, 'rgba(12,12,16,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // hairline cracks
  g.strokeStyle = 'rgba(10,10,12,0.5)'; g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    g.beginPath(); let x = rng() * 256, y = rng() * 256; g.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += (rng() - 0.5) * 44; y += (rng() - 0.5) * 44; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c, 1, 1);
}

export function parkingTexture() {
  const c = canvas(256, 256), g = c.getContext('2d'), rng = mulberry32(97);
  g.fillStyle = '#3a3e44'; g.fillRect(0, 0, 256, 256);
  grain(g, 256, 256, rng, 2200, 0.15);
  // painted bays
  g.strokeStyle = 'rgba(240,240,235,0.85)'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 8); g.lineTo(i * 64, 104); g.stroke(); }
  g.beginPath(); g.moveTo(0, 104); g.lineTo(256, 104); g.stroke();
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 152); g.lineTo(i * 64, 248); g.stroke(); }
  g.beginPath(); g.moveTo(0, 152); g.lineTo(256, 152); g.stroke();
  return tex(c, 1, 1);
}

export function sidewalkTexture() {
  const c = canvas(128, 128), g = c.getContext('2d'), rng = mulberry32(7);
  g.fillStyle = '#9a8f80'; g.fillRect(0, 0, 128, 128);
  grain(g, 128, 128, rng, 700, 0.12);
  g.strokeStyle = 'rgba(70,62,52,0.65)'; g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 126);
  return tex(c, 1, 1);
}

export function sandTexture() {
  const c = canvas(128, 128), g = c.getContext('2d'), rng = mulberry32(23);
  g.fillStyle = '#e8cf9e'; g.fillRect(0, 0, 128, 128);
  grain(g, 128, 128, rng, 900, 0.1);
  return tex(c, 6, 1);
}

export function seaTexture() {
  const c = canvas(256, 256), g = c.getContext('2d'), rng = mulberry32(59);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2a86a8'); grad.addColorStop(1, '#155e7c');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,220,170,0.20)'; g.lineWidth = 2;
  for (let i = 0; i < 42; i++) {
    const y = rng() * 256, x = rng() * 200, len = 14 + rng() * 42;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
  }
  const t = tex(c, 10, 10); return t;
}

const FACADE_BASES = [
  ['#d9b48f', '#8a6a4a'], ['#e8e0d0', '#9a8f7c'], ['#c96f4a', '#7c4028'],
  ['#7fb3b0', '#4a7a78'], ['#e5cfa3', '#a8895c'], ['#b85c48', '#74382a'],
];
export function facadeTextures(seed) {
  const rng = mulberry32(seed);
  const [base, trim] = FACADE_BASES[seed % FACADE_BASES.length];
  const c = canvas(256, 512), g = c.getContext('2d');
  const e = canvas(256, 512), eg = e.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 512);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, 256, 512);
  grain(g, 256, 512, rng, 1500, 0.08);
  g.fillStyle = trim; g.fillRect(0, 0, 256, 14); g.fillRect(0, 498, 256, 14);
  const cols = 6, rows = 11, ww = 24, wh = 26, gx = (256 - cols * ww) / (cols + 1), gy = (512 - rows * wh) / (rows + 1);
  for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
    const x = gx + col * (ww + gx), y = gy + r * (wh + gy);
    const lit = rng() > 0.42;
    g.fillStyle = lit ? '#ffd98f' : '#2c3844'; g.fillRect(x, y, ww, wh);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, ww, 3);
    if (lit) { eg.fillStyle = rng() > 0.3 ? '#ffb45e' : '#ffcf8f'; eg.fillRect(x, y, ww, wh); }
  }
  const map = tex(c), emis = tex(e);
  return { map, emis };
}

export function signTexture(lines, bg, fg, w = 512, h = 128) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const size = lines.length > 1 ? h / (lines.length + 1.4) : h * 0.52;
  g.font = `900 ${Math.floor(size)}px Arial, sans-serif`;
  lines.forEach((ln, i) => g.fillText(ln, w / 2, h * (lines.length > 1 ? (i + 1) / (lines.length + 0.6) : 0.52)));
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

export function roofTexture() {
  const c = canvas(128, 128), g = c.getContext('2d'), rng = mulberry32(3);
  g.fillStyle = '#6b5a4a'; g.fillRect(0, 0, 128, 128);
  grain(g, 128, 128, rng, 800, 0.14);
  return tex(c, 1, 1);
}
