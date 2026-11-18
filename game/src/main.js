// Costa Palmera — boot and the one loop. States: menu, play, pause, busted,
// wasted. ?shot=cover|chase|foot|city&seed=N stages a screenshot scene instead
// of the menu. window.__timeScale scales simulation time (playtest hook) and
// window.__game exposes the live state for headless checks.
import * as THREE from '../vendor/three.module.min.js';
import { COLS, VROADS, HROADS, GARAGE_POS, PRECINCT_POS } from './config.js';
import { createInput } from './input.js';
import { createWorld } from './world.js';
import { createTraffic, createCar, stepCar, parkedSpots, CAR_COLORS } from './vehicles.js';
import { buildPerson, animatePerson, createPedestrians } from './people.js';
import { createPolice } from './police.js';
import { createHUD } from './hud.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';
import { mulberry32, pick } from './random.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
window.__timeScale = 1;

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3200);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const world = createWorld(scene);
const rng = mulberry32(1234);
const traffic = createTraffic(scene, rng, 16);
const peds = createPedestrians(scene, rng, 22);
const police = createPolice(scene);
const hud = createHUD();
const audio = createAudio();
const input = createInput();

const allCars = [...traffic.cars];
for (const s of parkedSpots(rng)) {
  const ent = createCar(pick(rng, CAR_COLORS), { parked: true, heading: s.heading });
  ent.mesh.position.set(s.x, 0, s.z); ent.mesh.rotation.y = s.heading;
  scene.add(ent.mesh); allCars.push(ent);
}
const hero = createCar(0xff6b4a, { hero: true, heading: Math.PI / 2, maxSpeed: 36 });
hero.mesh.position.set(16, 0, 100.5); hero.mesh.rotation.y = Math.PI / 2;
scene.add(hero.mesh); allCars.push(hero);

const playerMesh = buildPerson({ shirt: 0xff6b4a, pants: 0x2c3e50, skin: 0xc98a5e });
scene.add(playerMesh);
const player = {
  pos: new THREE.Vector3(4, 0, 101), heading: Math.PI, health: 100, cash: 120,
  car: null, walkPhase: 0, lastDamage: -99, speedVis: 0,
};
let heat = 0, calmT = 0, state = 'menu', endKind = null, completeShown = false;
let camYaw = 0, camPitch = 0.3, time = 0, saveT = 0, pendingBust = false; // camYaw = player heading + PI
const threats = [];   // {pos, radius, ttl}
const tracers = [];   // {line, ttl, max}
const rivals = [];

function groundY(x, z) { return (x > 56.5 && x < 63.5 && z > 146 && z < 198) ? 1.15 : 0; }
function addHeat(x) { heat = THREE.MathUtils.clamp(heat + x, 0, 5); }
function playerPos() { return player.car ? player.car.mesh.position : player.pos; }
function playerVelOf(prev, dt) { const p = playerPos(); return new THREE.Vector3((p.x - prev.x) / Math.max(dt, 0.001), 0, (p.z - prev.z) / Math.max(dt, 0.001)); }

function persist() {
  writeSave({ cash: player.cash, mission: missions.index, health: Math.round(player.health), x: Math.round(player.pos.x), z: Math.round(player.pos.z), done: missions.finished });
}

// ---------------- rivals (mission 4) ----------------
function spawnRival(x, z) {
  const mesh = buildPerson({ shirt: 0x22242c, pants: 0x14161c, skin: 0xe8b88a });
  mesh.position.set(x, 0, z); scene.add(mesh);
  const r = { mesh, pos: mesh.position, health: 100, dead: false, fireT: 0.8 + rng() * 0.8, phase: rng() * 9 };
  rivals.push(r); return r;
}
function clearRivals() {
  for (const r of rivals) if (!r.dead) scene.remove(r.mesh);
  rivals.length = 0;
}
function damagePlayer(n) {
  if (state !== 'play') return;
  player.health -= n; player.lastDamage = time;
  document.getElementById('dmg').style.opacity = 0.85;
  if (player.health <= 0) { player.health = 0; endRun('wasted'); }
}
function spawnTracer(a, b, color = 0xffe9a0) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
  scene.add(line); tracers.push({ line, ttl: 0.07, max: 0.07 });
}
function raySphere(o, d, c, r) {
  const ox = c.x - o.x, oy = c.y - o.y, oz = c.z - o.z;
  const tca = ox * d.x + oy * d.y + oz * d.z;
  if (tca < 0) return null;
  const d2 = ox * ox + oy * oy + oz * oz - tca * tca;
  if (d2 > r * r) return null;
  return tca - Math.sqrt(r * r - d2);
}

// ---------------- missions api ----------------
const api = {
  distTo(x, z) { const p = playerPos(); return Math.hypot(p.x - x, p.z - z); },
  playerCar: () => player.car,
  subtitle: (n, t, d) => hud.subtitle(n, t, d),
  toast: (t) => hud.toast(t),
  reward(n) { player.cash += n; audio.cashSound(); persist(); },
  addHeat, setHeat(x) { heat = x; }, getHeat: () => heat,
  spawnCar(x, z, heading, color, opts) {
    const e = createCar(color, { ...opts, heading });
    e.mission = true; // story cars are handed over, never "stolen"
    e.mesh.position.set(x, 0, z); e.mesh.rotation.y = heading;
    scene.add(e.mesh); allCars.push(e); return e;
  },
  spawnRivals: (pts) => pts.map(([x, z]) => spawnRival(x, z)),
  clearRivals,
};
const missions = createMissions(api);

// ---------------- enter / exit cars ----------------
function retargetTraffic(ent) {
  // a stolen traffic car rejoins the grid from wherever it was left
  let bestV = VROADS[0], bestH = HROADS[0];
  for (const r of VROADS) if (Math.abs(r - ent.mesh.position.x) < Math.abs(bestV - ent.mesh.position.x)) bestV = r;
  for (const r of HROADS) if (Math.abs(r - ent.mesh.position.z) < Math.abs(bestH - ent.mesh.position.z)) bestH = r;
  const dv = Math.abs(bestV - ent.mesh.position.x), dh = Math.abs(bestH - ent.mesh.position.z);
  if (dh <= dv) ent.traffic = { axis: 'x', line: bestH, dir: Math.cos(ent.heading) >= 0 ? (Math.sin(ent.heading) > 0 ? 1 : 1) : -1, speedT: 11, cool: 2 };
  else ent.traffic = { axis: 'z', line: bestV, dir: Math.cos(ent.heading) >= 0 ? 1 : -1, speedT: 11, cool: 2 };
  if (ent.traffic.axis === 'x') ent.traffic.dir = Math.sin(ent.heading) >= 0 ? 1 : -1;
}
function enterCar(ent) {
  player.car = ent; ent.driver = true; ent.parked = false;
  playerMesh.visible = false;
  audio.startEngine();
  if (ent !== hero && !ent.police && !ent.mission) {
    const witnessed = police.cruisers.length > 0 || peds.peds.some(pd => pd.pos.distanceTo(ent.mesh.position) < 24);
    if (witnessed) { addHeat(0.6); hud.subtitle('', 'Witnessed! Someone saw you take that car.', 3); }
  }
  hud.toast(ent === hero ? 'YOUR COUPE' : 'CAR TAKEN');
}
function exitCar() {
  const ent = player.car; if (!ent) return;
  ent.driver = false; ent.speed = 0;
  const h = ent.heading, rx = -Math.cos(h), rz = Math.sin(h);
  player.pos.set(ent.mesh.position.x + rx * 2.4, 0, ent.mesh.position.z + rz * 2.4);
  player.pos.y = groundY(player.pos.x, player.pos.z);
  player.heading = h; player.car = null;
  playerMesh.visible = true;
  audio.stopEngine();
  if (ent.traffic) retargetTraffic(ent);
  persist();
}
function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of allCars) {
    if (c.dead || c.driver) continue;
    const d = c.mesh.position.distanceTo(player.pos);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// ---------------- shooting ----------------
function tryShoot() {
  audio.shot();
  const origin = camera.position.clone();
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  let bestT = 75, hitRival = null, hitCar = null;
  const hitPoint = origin.clone().addScaledVector(dir, 75);
  for (const r of rivals) {
    if (r.dead) continue;
    const c = r.pos.clone(); c.y += 1.25;
    const t = raySphere(origin, dir, c, 1.0);
    if (t && t < bestT) { bestT = t; hitRival = r; hitPoint.copy(origin).addScaledVector(dir, t); }
  }
  if (!hitRival) for (const c of allCars) {
    const ctr = c.mesh.position.clone(); ctr.y += 0.8;
    const t = raySphere(origin, dir, ctr, 2.2);
    if (t && t < bestT) { bestT = t; hitCar = c; hitPoint.copy(origin).addScaledVector(dir, t); }
  }
  const muzzle = player.pos.clone(); muzzle.y += 1.35;
  spawnTracer(muzzle, hitPoint);
  if (hitRival) {
    hitRival.health -= 40;
    if (hitRival.health <= 0 && !hitRival.dead) {
      hitRival.dead = true;
      hitRival.mesh.rotation.x = -Math.PI / 2; hitRival.mesh.position.y = 0.3;
      hud.toast('TARGET DOWN');
    }
  }
  if (hitCar && hitCar.police) addHeat(0.3);
  const witnessed = police.cruisers.some(c => c.mesh.position.distanceTo(player.pos) < 70)
    || peds.peds.some(pd => pd.pos.distanceTo(player.pos) < 26);
  addHeat(witnessed ? 0.45 : 0.12);
  threats.push({ pos: player.pos.clone(), radius: 27, ttl: 0.2 });
}

// ---------------- run state ----------------
function endRun(kind) {
  if (state !== 'play') return;
  state = kind; endKind = kind;
  if (player.car) { const ent = player.car; ent.driver = false; ent.speed = 0; player.car = null; playerMesh.visible = true; audio.stopEngine(); }
  audio.setSiren(false);
  const title = document.getElementById('endtitle'), sub = document.getElementById('endsub');
  if (kind === 'busted') {
    const fine = Math.min(player.cash, 50 + Math.round(player.cash * 0.1));
    player.cash -= fine;
    title.textContent = 'BUSTED'; title.style.color = '#7fb3d8';
    sub.textContent = `Palmera PD walks you out of the precinct ${fine > 0 ? `and keeps $${fine} for their trouble` : 'with a warning'}. Your heat is gone. Your pride is not.`;
  } else if (kind === 'wasted') {
    title.textContent = 'WASTED'; title.style.color = '#ff5f45';
    sub.textContent = 'You wake up outside the Clinica with a bandage, a bill and a story nobody believes.';
  } else {
    title.textContent = 'PALMERA IS YOURS'; title.style.color = '#ffb340';
    sub.textContent = 'Five jobs, one sunset. The garage, the harbour and the club all know your name now. Free roam — the city stays open.';
  }
  document.getElementById('endov').classList.remove('hidden');
  hud.hide();
}
function respawn() {
  document.getElementById('endov').classList.add('hidden');
  hud.show();
  if (endKind === 'busted') { player.pos.set(PRECINCT_POS.x + 6, 0, PRECINCT_POS.z); heat = 0; police.clearAll(); }
  else if (endKind === 'wasted') { player.pos.set(-74, 0, 100); heat = Math.max(0, heat - 1); }
  player.health = 100; player.heading = Math.PI / 2;
  state = 'play'; endKind = null; persist();
}
function newGame() {
  clearSave();
  player.cash = 120; player.health = 100; heat = 0; completeShown = false;
  player.pos.set(4, 0, 101); player.heading = Math.PI;
  if (player.car) exitCarSilent();
  police.clearAll(); clearRivals();
  missions.start(0);
  beginPlay();
}
function exitCarSilent() {
  if (!player.car) return;
  player.car.driver = false; player.car.speed = 0; player.car = null;
  playerMesh.visible = true; audio.stopEngine();
}
function continueGame() {
  const s = loadSave();
  if (s) {
    player.cash = s.cash; player.health = s.health ?? 100;
    player.pos.set(s.x ?? 4, 0, s.z ?? 101);
    missions.start(Math.min(s.mission ?? 0, missions.count));
    if (s.done) completeShown = true;
  } else missions.start(0);
  beginPlay();
}
function beginPlay() {
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('pauseov').classList.add('hidden');
  hud.show(); state = 'play';
  audio.unlock();
}

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-resume').addEventListener('click', () => { document.getElementById('pauseov').classList.add('hidden'); state = 'play'; });
document.getElementById('btn-quit').addEventListener('click', () => {
  document.getElementById('pauseov').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  hud.hide(); state = 'menu';
});
document.getElementById('btn-respawn').addEventListener('click', respawn);
if (loadSave()) document.getElementById('btn-continue').classList.remove('hidden');

renderer.domElement.addEventListener('mousedown', () => {
  if (state !== 'play') return;
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch { /* lock refused: mouse-look still works unlocked */ }
});

// ---------------- per-frame updates ----------------
const _prevPos = new THREE.Vector3().copy(player.pos);
const _camTarget = new THREE.Vector3();
let menuAngle = 0;

function updatePlayer(dt) {
  const m = input.takeMouse();
  camYaw -= m.dx * 0.0031;
  camPitch = THREE.MathUtils.clamp(camPitch + m.dy * 0.0022, -0.12, 0.95);
  if (input.tap('KeyP') || input.tap('Escape')) {
    state = 'pause';
    document.getElementById('pausestats').textContent = `Cash $${player.cash} · ${missions.finished ? 'Story complete' : 'Job ' + (missions.index + 1) + ' of ' + missions.count}`;
    document.getElementById('pauseov').classList.remove('hidden');
    persist();
    try { document.exitPointerLock(); } catch { /* ignore */ }
    return;
  }
  if (input.tap('KeyM')) hud.toast(audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON', 1.2);
  if (input.tap('KeyE')) {
    if (player.car) exitCar();
    else { const c = nearestCar(3.6); if (c) enterCar(c); }
  }

  if (player.car) {
    const ent = player.car;
    const throttle = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) + (input.down('KeyS') || input.down('ArrowDown') ? -1 : 0);
    const steer = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    const sand = ent.mesh.position.z > 124 && ent.mesh.position.z < 148 && !(ent.mesh.position.x > 56 && ent.mesh.position.x < 64);
    const ctl = { throttle: sand ? throttle * 0.55 : throttle, steer };
    const crash = stepCar(ent, dt, ctl, world.colliders, allCars);
    if (crash > 13) {
      if (police.cruisers.some(c => c.mesh.position.distanceTo(ent.mesh.position) < 55)) addHeat(0.25);
      if (crash > 22) damagePlayer(4);
    }
    ent.mesh.position.y += (groundY(ent.mesh.position.x, ent.mesh.position.z) - ent.mesh.position.y) * Math.min(1, dt * 6);
    if (ent.mesh.position.z > 147 && !(ent.mesh.position.x > 56 && ent.mesh.position.x < 64)) ent.mesh.position.z = 147;
    player.pos.copy(ent.mesh.position);
    player.heading = ent.heading;
    player.speedVis = ent.speed;
    audio.engine(Math.abs(ent.speed) / ent.maxSpeed, Math.abs(throttle));
    hud.setCrosshair(false);
  } else {
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const spd = run ? 7.6 : 4.3;
    let ix = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    let iz = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const moving = ix !== 0 || iz !== 0;
    if (moving) {
      const len = Math.hypot(ix, iz); ix /= len; iz /= len;
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wx = ix * cos - iz * sin, wz = -ix * sin - iz * cos;
      // camera forward on ground is (-sin(camYaw), -cos(camYaw)) in world xz from behind-player framing:
      const fx = -sin, fz = -cos, rxv = -fz, rzv = fx;
      const mx = fx * iz + rxv * ix, mz = fz * iz + rzv * ix;
      void wx; void wz;
      player.pos.x += mx * spd * dt; player.pos.z += mz * spd * dt;
      const targetHeading = Math.atan2(mx, mz);
      let dh = targetHeading - player.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      player.heading += dh * Math.min(1, dt * 12);
      player.walkPhase += dt * (run ? 11 : 8.5);
    }
    // collisions: buildings then cars
    for (const c of world.colliders) {
      const nx = Math.max(c.minX, Math.min(player.pos.x, c.maxX)), nz = Math.max(c.minZ, Math.min(player.pos.z, c.maxZ));
      const dx = player.pos.x - nx, dz = player.pos.z - nz, d2 = dx * dx + dz * dz;
      if (d2 < 0.2 && d2 > 0.00001) { const d = Math.sqrt(d2); player.pos.x = nx + dx / d * 0.45; player.pos.z = nz + dz / d * 0.45; }
      else if (d2 <= 0.00001) player.pos.z = c.maxZ + 0.45;
    }
    for (const c of allCars) {
      const dx = player.pos.x - c.mesh.position.x, dz = player.pos.z - c.mesh.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 4.4 && d2 > 0.0001) { const d = Math.sqrt(d2); player.pos.x = c.mesh.position.x + dx / d * 2.1; player.pos.z = c.mesh.position.z + dz / d * 2.1; }
    }
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, -190, 238);
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, -190, 196);
    if (!(player.pos.x > 56.5 && player.pos.x < 63.5) && player.pos.z > 146.5) player.pos.z = 146.5;
    player.pos.y = groundY(player.pos.x, player.pos.z);
    player.speedVis = moving ? spd : 0;
    animatePerson(playerMesh, player.walkPhase, moving ? 1 : 0);
    if (m.clicked) tryShoot();
    hud.setCrosshair(true);
  }
  playerMesh.position.copy(player.pos);
  playerMesh.rotation.y = player.heading;
  if (player.health < 100 && time - player.lastDamage > 6) player.health = Math.min(100, player.health + 4 * dt);
}

function updateRivals(dt) {
  for (const r of rivals) {
    if (r.dead) continue;
    const d = r.pos.distanceTo(player.pos);
    r.mesh.rotation.y = Math.atan2(player.pos.x - r.pos.x, player.pos.z - r.pos.z);
    animatePerson(r.mesh, r.phase += dt * 2, 0.15);
    if (state !== 'play' || d > 38) continue;
    r.fireT -= dt;
    if (r.fireT <= 0) {
      r.fireT = 0.85 + rng() * 0.6;
      audio.shot();
      const a = r.pos.clone(); a.y += 1.35;
      const b = player.pos.clone(); b.y += 1.1;
      if (rng() > 0.45) { b.x += (rng() - 0.5) * 3; b.z += (rng() - 0.5) * 3; }
      spawnTracer(a, b, 0xff7a5e);
      const hitP = THREE.MathUtils.clamp(0.55 - d * 0.008, 0.16, 0.5);
      if (rng() < hitP) damagePlayer(6);
      threats.push({ pos: r.pos.clone(), radius: 20, ttl: 0.2 });
    }
  }
}

function updateCamera(dt) {
  const p = playerPos();
  if (player.car) {
    const h = player.car.heading;
    camYaw += (((h + Math.PI) - camYaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 3.2);
    const fx = Math.sin(h), fz = Math.cos(h);
    _camTarget.set(p.x - fx * 10.8, 3.9, p.z - fz * 10.8);
    camera.position.lerp(_camTarget, Math.min(1, dt * 5));
    if (camera.position.y < 0.7) camera.position.y = 0.7;
    camera.lookAt(p.x + fx * 7, 1.3, p.z + fz * 7);
    const targetFov = 62 + Math.abs(player.car.speed) / player.car.maxSpeed * 9;
    if (Math.abs(camera.fov - targetFov) > 0.2) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  } else {
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    _camTarget.set(player.pos.x + fx * -6.8 * Math.cos(camPitch * 0.6), 2.1 + camPitch * 4.2, player.pos.z + fz * -6.8 * Math.cos(camPitch * 0.6));
    camera.position.lerp(_camTarget, Math.min(1, dt * 14));
    if (camera.position.y < 0.6) camera.position.y = 0.6;
    camera.lookAt(player.pos.x - fx * 3, 1.55, player.pos.z - fz * 3);
    if (Math.abs(camera.fov - 62) > 0.2) { camera.fov += (62 - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  }
}

let lastView = null, lastInfo = { bust: 0, active: 0, anySee: false };

/** One simulation step of at most 1/30 s. The render rate never slows the
 *  simulation: frame() runs as many of these as the elapsed time demands. */
function stepPlay(dt) {
  time += dt;
  _prevPos.copy(playerPos());
  updatePlayer(dt);
  if (state !== 'play') return; // paused mid-update
  const vel = playerVelOf(_prevPos, dt);
  traffic.update(dt, world.colliders, allCars);
  for (let i = threats.length - 1; i >= 0; i--) { threats[i].ttl -= dt; if (threats[i].ttl <= 0) threats.splice(i, 1); }
  const activeThreats = threats.slice();
  if (player.car && Math.abs(player.car.speed) > 7) activeThreats.push({ pos: player.car.mesh.position, radius: 8 });
  peds.update(dt, activeThreats);
  const info = police.update(dt, {
    playerPos: playerPos(), playerVel: vel, playerSpeed: Math.abs(player.speedVis),
    playerHeading: player.heading, heat, colliders: world.colliders, allCars,
    onBusted: () => { pendingBust = true; },
  });
  lastInfo = info;
  if (info.anySee) calmT = 0; else { calmT += dt; if (calmT > 9) heat = Math.max(0, heat - dt * 0.085); }
  audio.setSiren(heat >= 0.5 && info.active > 0);
  audio.tickSiren(dt);
  updateRivals(dt);
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i]; t.ttl -= dt;
    t.line.material.opacity = Math.max(0, t.ttl / t.max);
    if (t.ttl <= 0) { scene.remove(t.line); t.line.geometry.dispose(); tracers.splice(i, 1); }
  }
  lastView = missions.update(dt);
  if (missions.finished && !completeShown) { completeShown = true; persist(); endRun('complete'); }
  if (pendingBust) { pendingBust = false; endRun('busted'); }
  world.setSunTarget(playerPos().x, playerPos().z);
  world.update(dt);
  saveT += dt;
  if (saveT > 6) { saveT = 0; persist(); }
}

function frame() {
  requestAnimationFrame(frame);
  const realDt = Math.min(clock.getDelta(), 1.0);
  const rawDt = Math.min(realDt, 0.05);
  const dmgEl = document.getElementById('dmg');
  if (dmgEl.style.opacity > 0) dmgEl.style.opacity = Math.max(0, parseFloat(dmgEl.style.opacity) - rawDt * 1.6);

  if (state === 'menu') {
    menuAngle += rawDt * 0.05;
    const cx = Math.sin(menuAngle) * 58, cz = 96 + Math.cos(menuAngle) * 30;
    camera.position.set(cx, 15 + Math.sin(menuAngle * 2) * 2, cz);
    camera.lookAt(0, 2, 88);
    world.setSunTarget(0, 92);
    world.update(rawDt);
    traffic.update(rawDt, world.colliders, allCars);
    peds.update(rawDt, []);
    renderer.render(scene, camera);
    return;
  }
  if (state === 'pause' || state === 'busted' || state === 'wasted' || state === 'complete') {
    renderer.render(scene, camera);
    return;
  }

  // state === 'play': simulate the full elapsed time in fixed substeps, so a
  // slow renderer (or a fast-forward test hook) never slows the game world.
  const total = realDt * (window.__timeScale || 1);
  const steps = Math.min(150, Math.max(1, Math.ceil(total / (1 / 30))));
  const h = total / steps;
  for (let s = 0; s < steps && state === 'play'; s++) stepPlay(h);
  if (state !== 'play') { renderer.render(scene, camera); return; }

  updateCamera(rawDt);
  if (lastView) hud.setObjective(lastView.title, lastView.objective, lastView.marker ? api.distTo(lastView.marker.x, lastView.marker.z) : null);
  else hud.setObjective('FREE ROAM', 'Palmera is yours. Cruise the boulevard.', null);
  hud.setCash(player.cash);
  hud.setStars(heat);
  hud.setBust(lastInfo.bust);
  hud.setHealth(player.health / 100);
  hud.setSpeed(player.car ? player.car.speed * 3.6 : 0);
  hud.update(rawDt);
  hud.drawMinimap({
    player: playerPos(), heading: player.heading,
    traffic: traffic.cars.map(c => c.mesh.position),
    police: [...police.cruisers.map(c => c.mesh.position), ...(police.heliPos ? [police.heliPos] : [])],
    marker: lastView ? lastView.marker : null,
    flash: Math.sin(time * 6) > 0,
  });
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();

// ---------------- screenshot mode ----------------
if (shotName) {
  document.getElementById('menu').classList.add('hidden');
  const staged = [];
  const G = {
    scene, hud, hero, world,
    setPlayerVisible(b) { playerMesh.visible = b; },
    placePlayer(x, z, heading) { player.pos.set(x, 0, z); player.heading = heading; playerMesh.position.copy(player.pos); playerMesh.rotation.y = heading; },
    extraCar(color, opts) { const e = createCar(color, opts); scene.add(e.mesh); allCars.push(e); staged.push(e); return e; },
    cruiserAt(x, z, heading) { const e = createCar(0xf2f2f4, { police: true }); e.mesh.position.set(x, 0, z); e.heading = heading; e.mesh.rotation.y = heading; scene.add(e.mesh); allCars.push(e); staged.push(e); return e; },
    teleportPed(i, x, z) { const pd = peds.peds[i % peds.peds.length]; pd.pos.set(x, 0, z); pd.mesh.position.copy(pd.pos); },
    setSun(x, z) { world.setSunTarget(x, z); },
  };
  const cam = stageShot(shotName, G);
  camera.position.copy(cam.pos);
  camera.lookAt(cam.look);
  let frames = 0;
  (function shotLoop() {
    requestAnimationFrame(shotLoop);
    const dt = Math.min(clock.getDelta(), 0.05) * (window.__timeScale || 1);
    world.update(dt);
    peds.update(dt * 0.6, []);
    for (const e of staged) if (e.speed) for (const w of e.mesh.userData.spin) w.rotation.x += e.speed * dt / 0.42;
    if (hero.speed) for (const w of hero.mesh.userData.spin) w.rotation.x += hero.speed * dt / 0.42;
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    renderer.render(scene, camera);
    if (++frames === 40) window.__shotReady = true;
  })();
} else {
  requestAnimationFrame(frame);
}

window.__game = {
  player, missions, traffic, police, allCars, hero,
  get heat() { return heat; }, setHeat: (v) => { heat = v; },
  get state() { return state; },
  newGame, continueGame,
  enterNearest: () => { const c = nearestCar(4); if (c) { enterCar(c); return true; } return false; },
  teleport(x, z) { player.pos.set(x, 0, z); if (player.car) player.car.mesh.position.set(x, 0, z); },
};
