// DOM HUD: cash, wanted stars, bust meter, health, speedo, objective card,
// subtitles, toasts, crosshair and the live circular minimap.
import { VROADS, HROADS, BOULEVARD_Z, SEA_Z } from './config.js';

const el = (id) => document.getElementById(id);

export function createHUD() {
  const hud = el('hud'), cashEl = el('cash'), starsEl = el('stars'), bustFill = el('bustfill');
  const bustWrap = el('bustwrap'), bustLabel = el('bustlabel');
  const objTitle = el('objtitle'), objText = el('objective'), objDist = el('objdist');
  const healthFill = el('healthfill'), speedEl = el('speed');
  const subEl = el('subtitle'), toastEl = el('toast'), cross = el('crosshair');
  const mm = el('minimap').getContext('2d');
  let subT = 0, toastT = 0, lastStars = -1;

  function setStars(heat) {
    const n = Math.ceil(heat - 0.001);
    if (n === lastStars) return; lastStars = n;
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '<span class="off">★</span>';
    starsEl.innerHTML = s;
  }

  function drawMinimap(st) {
    const S = 168, C = S / 2, scale = S / 460;
    mm.clearRect(0, 0, S, S);
    mm.save();
    mm.beginPath(); mm.arc(C, C, C - 2, 0, 7); mm.clip();
    mm.fillStyle = '#1d6f8e'; mm.fillRect(0, 0, S, S);
    const px = st.player.x, pz = st.player.z;
    const X = (wx) => C + (wx - px) * scale, Y = (wz) => C + (wz - pz) * scale;
    mm.fillStyle = '#4c4438'; mm.fillRect(X(-192), Y(-192), 384 * scale, 310 * scale);
    mm.fillStyle = '#e8cf9e'; mm.fillRect(X(-260), Y(126), 520 * scale, (SEA_Z - 126) * scale);
    mm.strokeStyle = 'rgba(230,225,210,0.5)'; mm.lineWidth = 2;
    for (const x of VROADS) { mm.beginPath(); mm.moveTo(X(x), Y(-192)); mm.lineTo(X(x), Y(118)); mm.stroke(); }
    for (const z of HROADS) { mm.beginPath(); mm.moveTo(X(-192), Y(z)); mm.lineTo(X(192), Y(z)); mm.stroke(); }
    mm.strokeStyle = '#ffc845'; mm.beginPath(); mm.moveTo(X(-192), Y(BOULEVARD_Z)); mm.lineTo(X(240), Y(BOULEVARD_Z)); mm.stroke();
    // traffic
    mm.fillStyle = 'rgba(255,255,255,0.55)';
    for (const c of st.traffic) { mm.beginPath(); mm.arc(X(c.x), Y(c.z), 2, 0, 7); mm.fill(); }
    // police
    for (const c of st.police) {
      mm.fillStyle = st.flash ? '#ff3b30' : '#3e7bff';
      mm.beginPath(); mm.arc(X(c.x), Y(c.z), 3, 0, 7); mm.fill();
    }
    // mission marker
    if (st.marker) {
      mm.fillStyle = '#ffc845'; mm.save();
      mm.translate(X(st.marker.x), Y(st.marker.z)); mm.rotate(Math.PI / 4);
      mm.fillRect(-4, -4, 8, 8); mm.restore();
    }
    // player arrow
    mm.save(); mm.translate(C, C); mm.rotate(st.heading);
    mm.fillStyle = '#fff'; mm.beginPath();
    mm.moveTo(0, -7); mm.lineTo(4.6, 5); mm.lineTo(0, 2.4); mm.lineTo(-4.6, 5); mm.closePath(); mm.fill();
    mm.restore();
    mm.restore();
  }

  return {
    show() { hud.classList.remove('hidden'); },
    hide() { hud.classList.add('hidden'); },
    setCash(n) { cashEl.textContent = '$' + n.toLocaleString('en-US'); },
    setStars,
    setBust(x) {
      bustFill.style.width = (x * 100).toFixed(0) + '%';
      bustWrap.style.opacity = x > 0.02 ? 1 : 0.25; bustLabel.style.opacity = x > 0.02 ? 1 : 0.3;
    },
    setHealth(f) { healthFill.style.width = (Math.max(0, f) * 100).toFixed(0) + '%'; },
    setSpeed(kmh) { speedEl.textContent = Math.round(Math.abs(kmh)); },
    setObjective(title, text, dist) {
      objTitle.textContent = title; objText.textContent = text;
      objDist.textContent = dist != null && dist > 12 ? Math.round(dist) + ' m' : '';
    },
    subtitle(name, text, dur = 4) {
      subEl.innerHTML = name ? `<b>${name}</b> — ${text}` : text;
      subT = dur;
    },
    toast(text, dur = 2.6) { toastEl.textContent = text; toastEl.style.opacity = 1; toastT = dur; },
    setCrosshair(on) { cross.classList.toggle('hidden', !on); },
    drawMinimap,
    update(dt) {
      if (subT > 0) { subT -= dt; if (subT <= 0) subEl.innerHTML = ''; }
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.style.opacity = 0; }
    },
  };
}
