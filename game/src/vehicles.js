// Cars for Costa Palmera: a shared low-poly build (glasshouse, wheels pushed
// proud of the bodywork, underbody, bumpers, mirrors), arcade physics with
// circle-vs-AABB collision, and grid-following traffic AI.
import * as THREE from '../vendor/three.module.min.js';
import { VROADS, HROADS } from './config.js';
import { mulberry32, pick, range } from './random.js';

export const CAR_COLORS = [0xe8e0d0, 0x3ec6b8, 0xffc845, 0x7fb3d8, 0xc0c6cc, 0x8fbf6f, 0xd86a9a, 0x5a6e8c, 0xe07b39, 0x9a6fc0];

const tireGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14); tireGeom.rotateZ(Math.PI / 2);
const hubGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10); hubGeom.rotateZ(Math.PI / 2);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.92 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.35, metalness: 0.6 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc4de, roughness: 0.08, metalness: 0.25 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.9 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd6d9de, roughness: 0.3, metalness: 0.7 });

export function buildCarMesh(color, { police = false, hero = false } = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.5), paint);
  body.position.y = 0.58; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.34, 0.9), paint);
  nose.position.set(0, 0.48, 2.35); nose.castShadow = true; g.add(nose);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.52, 2.1), glassMat);
  glass.position.set(0, 1.12, -0.25); glass.castShadow = true; g.add(glass);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.09, 1.9), paint);
  roof.position.set(0, 1.4, -0.25); g.add(roof);
  const under = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 4.1), darkMat);
  under.position.y = 0.3; g.add(under);
  for (const s of [-1, 1]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.22, 0.24), chromeMat);
    bumper.position.set(0, 0.42, s * 2.42); g.add(bumper);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.2), paint);
    mirror.position.set(s * 1.02, 1.08, 0.72); g.add(mirror);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 6), chromeMat);
    pipe.rotation.x = Math.PI / 2; pipe.position.set(s * 0.55, 0.3, -2.5); g.add(pipe);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06),
      new THREE.MeshBasicMaterial({ color: s > 0 ? 0xfff2c0 : 0xff2a20 }));
    light.position.set(s * 0.58, 0.66, s > 0 ? 2.83 : -2.28); g.add(light);
  }
  if (police) {
    const bar = new THREE.Group();
    const baseBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.09, 0.34), darkMat); bar.add(baseBar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.33, 0.12, 0); bar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.set(0.33, 0.12, 0); bar.add(blue);
    bar.position.set(0, 1.52, -0.25); g.add(bar);
    g.userData.lightbar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.2, 4.0), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5 }));
    stripe.position.y = 0.6; g.add(stripe);
  }
  if (hero) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), darkMat);
    spoiler.position.set(0, 1.02, -2.2); g.add(spoiler);
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.08), darkMat);
      strut.position.set(s * 0.7, 0.88, -2.2); g.add(strut);
    }
  }
  const spin = [], steerPivots = [];
  for (const [sx, sz] of [[-1, 1.45], [1, 1.45], [-1, -1.45], [1, -1.45]]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.95, 0.42, sz);
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(tireGeom, tireMat); tire.castShadow = true; wheel.add(tire);
    const hub = new THREE.Mesh(hubGeom, hubMat); wheel.add(hub);
    pivot.add(wheel); g.add(pivot);
    spin.push(wheel); if (sz > 0) steerPivots.push(pivot);
  }
  g.userData.spin = spin; g.userData.steer = steerPivots;
  return g;
}

export function createCar(color, opts = {}) {
  const mesh = buildCarMesh(color, opts);
  return {
    mesh, heading: opts.heading || 0, speed: 0, radius: 1.75,
    police: !!opts.police, hero: !!opts.hero, parked: !!opts.parked,
    maxSpeed: opts.maxSpeed || 33, accel: opts.accel || 13,
    traffic: null, dead: false, brakeLight: 0,
  };
}

const _fwd = new THREE.Vector3();
/** Arcade step. control: {throttle -1..1, steer -1..1}. Returns crash speed (0 = none). */
export function stepCar(ent, dt, control, colliders, others) {
  const targetSteer = -control.steer * 0.5; // wheel yaw follows the heading change sign
  ent.steerVis = targetSteer;
  if (control.throttle > 0) ent.speed += ent.accel * control.throttle * dt;
  else if (control.throttle < 0) ent.speed += (ent.speed > 0.5 ? -22 : -7) * -control.throttle * dt;
  ent.speed -= ent.speed * 0.55 * dt;                       // drag
  if (!control.throttle) ent.speed -= Math.sign(ent.speed) * Math.min(Math.abs(ent.speed), 3.2 * dt);
  ent.speed = THREE.MathUtils.clamp(ent.speed, -9, ent.maxSpeed);
  const sf = THREE.MathUtils.clamp(ent.speed / 9, -1, 1);
  ent.heading -= control.steer * 1.65 * sf * dt * (Math.abs(ent.speed) > 0.4 ? 1 : 0);
  _fwd.set(Math.sin(ent.heading), 0, Math.cos(ent.heading));
  ent.mesh.position.addScaledVector(_fwd, ent.speed * dt);
  const p = ent.mesh.position;
  p.x = THREE.MathUtils.clamp(p.x, -252, 252); p.z = THREE.MathUtils.clamp(p.z, -196, 196);
  let crash = 0;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(p.x, c.maxX)), nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
    const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
    if (d2 < ent.radius * ent.radius) {
      const d = Math.sqrt(d2) || 0.001;
      if (d2 > 0.0001) { p.x = nx + dx / d * ent.radius; p.z = nz + dz / d * ent.radius; }
      else { p.z = c.maxZ + ent.radius; }
      crash = Math.max(crash, Math.abs(ent.speed)); ent.speed *= 0.35;
    }
  }
  for (const o of others) {
    if (o === ent || o.dead) continue;
    const dx = p.x - o.mesh.position.x, dz = p.z - o.mesh.position.z;
    const rr = ent.radius + o.radius, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2), push = (rr - d) / 2;
      p.x += dx / d * push; p.z += dz / d * push;
      if (!o.parked && !o.driver) { o.mesh.position.x -= dx / d * push; o.mesh.position.z -= dz / d * push; }
      crash = Math.max(crash, Math.abs(ent.speed - (o.speed || 0)) * 0.7);
      ent.speed *= 0.72; if (!o.parked) o.speed = (o.speed || 0) * 0.72;
    }
  }
  ent.mesh.rotation.y = ent.heading;
  ent.mesh.rotation.z = -control.steer * Math.min(Math.abs(ent.speed) / ent.maxSpeed, 1) * 0.045;
  ent.mesh.rotation.x = THREE.MathUtils.clamp(-(control.throttle || 0) * 0.012, -0.02, 0.02);
  const spinBy = ent.speed * dt / 0.42;
  for (const w of ent.mesh.userData.spin) w.rotation.x += spinBy;
  for (const pv of ent.mesh.userData.steer) pv.rotation.y = ent.steerVis || 0;
  return crash;
}

// ---------------- traffic ----------------
export function createTraffic(scene, rng, count = 16) {
  const cars = [];
  const roadsX = HROADS, roadsZ = VROADS;
  for (let i = 0; i < count; i++) {
    const ent = createCar(pick(rng, CAR_COLORS), { maxSpeed: 13 });
    const axis = rng() > 0.5 ? 'x' : 'z';
    const line = axis === 'x' ? pick(rng, roadsX) : pick(rng, roadsZ);
    const dir = rng() > 0.5 ? 1 : -1;
    const along = range(rng, -175, 175);
    ent.traffic = { axis, line, dir, along, speedT: range(rng, 9.5, 12.5), cool: 0 };
    placeTraffic(ent);
    scene.add(ent.mesh); cars.push(ent);
  }
  function placeTraffic(ent) {
    const tr = ent.traffic;
    if (tr.axis === 'x') {
      ent.mesh.position.set(tr.along || 0, 0, tr.line + 3.5 * tr.dir);
      ent.heading = tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      ent.mesh.position.set(tr.line - 3.5 * tr.dir, 0, tr.along || 0);
      ent.heading = tr.dir > 0 ? 0 : Math.PI;
    }
    ent.mesh.rotation.y = ent.heading;
  }
  function update(dt, colliders, allCars) {
    for (const ent of cars) {
      if (ent.driver || ent.dead) continue;
      const tr = ent.traffic, p = ent.mesh.position;
      tr.cool -= dt;
      // junction turn decisions
      const cross = tr.axis === 'x' ? roadsZ : roadsX;
      for (const c of cross) {
        const along = tr.axis === 'x' ? p.x : p.z;
        if (Math.abs(along - c) < 1.4 && tr.cool <= 0) {
          tr.cool = 3;
          if (rng() > 0.62) {
            const newLine = tr.axis === 'x' ? p.z + 0 : p.x + 0; // current cross position becomes new line base
            tr.axis = tr.axis === 'x' ? 'z' : 'x';
            tr.line = c; // turn onto the road we are crossing
            tr.dir = rng() > 0.5 ? 1 : -1;
            if (tr.axis === 'z') { p.x = tr.line - 3.5 * tr.dir; ent.heading = tr.dir > 0 ? 0 : Math.PI; }
            else { p.z = tr.line + 3.5 * tr.dir; ent.heading = tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
            void newLine;
          }
        }
      }
      // desired velocity along axis
      let want = tr.speedT;
      _fwd.set(Math.sin(ent.heading), 0, Math.cos(ent.heading));
      for (const o of allCars) {
        if (o === ent || o.dead) continue;
        const dx = o.mesh.position.x - p.x, dz = o.mesh.position.z - p.z;
        const ahead = dx * _fwd.x + dz * _fwd.z, side = Math.abs(dx * _fwd.z - dz * _fwd.x);
        if (ahead > 0 && ahead < 9 && side < 2.1) { want = Math.min(want, Math.max(0, (o.speed || 0)) * (ahead < 5 ? 0.4 : 0.85)); }
      }
      ent.speed += THREE.MathUtils.clamp(want - ent.speed, -18 * dt, 6 * dt);
      p.addScaledVector(_fwd, ent.speed * dt);
      // stay on lane centre (soft)
      if (tr.axis === 'x') p.z += (tr.line + 3.5 * tr.dir - p.z) * Math.min(1, dt * 3);
      else p.x += (tr.line - 3.5 * tr.dir - p.x) * Math.min(1, dt * 3);
      if (p.x > 246 || p.x < -246 || p.z > 190 || p.z < -190) { // wrap to the far side
        if (tr.axis === 'x') p.x = -Math.sign(p.x) * 240; else p.z = -Math.sign(p.z) * 184;
      }
      ent.mesh.rotation.y = ent.heading;
      const spinBy = ent.speed * dt / 0.42;
      for (const w of ent.mesh.userData.spin) w.rotation.x += spinBy;
      // building overlap guard (junction turns can clip corners)
      for (const c of colliders) {
        const nx = Math.max(c.minX, Math.min(p.x, c.maxX)), nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        const dx = p.x - nx, dz = p.z - nz;
        if (dx * dx + dz * dz < ent.radius * ent.radius) { p.x = nx + (dx || 0.1) * 1.2; p.z = nz + (dz || 0.1) * 1.2; }
      }
    }
  }
  return { cars, update };
}

export function parkedSpots(rng) {
  const spots = [];
  const lots = [[-74, -148], [74, 0], [-148, 74]];
  for (const [cx, cz] of lots) {
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      spots.push({ x: cx - 20 + (i % 3) * 13 + range(rng, -1, 1), z: cz - 14 + Math.floor(i / 3) * 16, heading: Math.PI / 2 * Math.floor(rng() * 4) });
    }
  }
  for (let x = -160; x <= 170; x += 33) { // boulevard kerbside
    if (rng() > 0.4) spots.push({ x: x + range(rng, -3, 3), z: 101.8, heading: Math.PI / 2 });
    if (rng() > 0.55) spots.push({ x: x + 14, z: 120.4, heading: -Math.PI / 2 });
  }
  return spots;
}
