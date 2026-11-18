// People for Costa Palmera: a slim low-poly character (hips, neck, small head,
// shoes that swing with the legs) used for the player and every pedestrian,
// plus the sidewalk-walking pedestrian system with panic behaviour.
import * as THREE from '../vendor/three.module.min.js';
import { COLS, ROWS } from './config.js';
import { mulberry32, pick, range } from './random.js';

const SKINS = [0xe8b88a, 0xc98a5e, 0x8a5a34, 0xf0c8a0];
const SHIRTS = [0xff8ab0, 0x3ec6b8, 0xffc845, 0xe8e0d0, 0x7fb3d8, 0xff6b4a, 0x8fbf6f, 0xd8d3e8];
const PANTS = [0x2c3e50, 0x5a4632, 0xe8e0d0, 0x37474f, 0x7a2e3a];

export function buildPerson({ shirt = 0xff6b4a, pants = 0x2c3e50, skin = 0xc98a5e } = {}) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf0ede8, roughness: 0.6 });

  function limb(mat, w, len, d, x, y) {
    const geo = new THREE.BoxGeometry(w, len, d); geo.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); m.castShadow = true; g.add(m); return m;
  }
  const legL = limb(pantsMat, 0.15, 0.8, 0.17, -0.11, 0.84);
  const legR = limb(pantsMat, 0.15, 0.8, 0.17, 0.11, 0.84);
  for (const leg of [legL, legR]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.3), shoeMat);
    shoe.position.set(0, -0.78, 0.06); leg.add(shoe);
  }
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.22), pantsMat);
  hips.position.y = 0.9; hips.castShadow = true; g.add(hips);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.6, 0.23), shirtMat);
  torso.position.y = 1.3; torso.castShadow = true; g.add(torso);
  const armL = limb(shirtMat, 0.11, 0.62, 0.12, -0.29, 1.56);
  const armR = limb(shirtMat, 0.11, 0.62, 0.12, 0.29, 1.56);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.11), skinMat); handL.position.set(0, -0.64, 0); armL.add(handL);
  const handR = handL.clone(); armR.add(handR);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 6), skinMat);
  neck.position.y = 1.65; g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.29, 0.26), skinMat);
  head.position.y = 1.85; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.1, 0.28), new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 1 }));
  hair.position.y = 2.0; g.add(hair);
  g.userData.parts = { legL, legR, armL, armR };
  return g;
}

export function animatePerson(mesh, phase, amount) {
  const p = mesh.userData.parts;
  const s = Math.sin(phase) * 0.55 * amount;
  p.legL.rotation.x = s; p.legR.rotation.x = -s;
  p.armL.rotation.x = -s * 0.75; p.armR.rotation.x = s * 0.75;
}

export function createPedestrians(scene, rng, count = 22) {
  const peds = [];
  const loops = [];
  for (const cx of COLS) for (const cz of ROWS) loops.push({ type: 'block', cx, cz });
  loops.push({ type: 'prom' });
  for (let i = 0; i < count; i++) {
    const mesh = buildPerson({ shirt: pick(rng, SHIRTS), pants: pick(rng, PANTS), skin: pick(rng, SKINS) });
    const loop = pick(rng, loops);
    const ped = {
      mesh, loop, corner: Math.floor(rng() * 4), t: rng(),
      speed: range(rng, 1.1, 1.7), phase: rng() * 9, panicT: 0, panicFrom: null,
      pos: new THREE.Vector3(),
    };
    placeOnLoop(ped, rng);
    scene.add(mesh); peds.push(ped);
  }
  function loopPoint(ped, out) {
    if (ped.loop.type === 'prom') {
      const x = ped.corner % 2 === 0 ? -182 : 182;
      out.set(x, 0, 121.5 + (ped.lane || 0));
    } else {
      const o = 32, { cx, cz } = ped.loop;
      const pts = [[cx - o, cz - o], [cx + o, cz - o], [cx + o, cz + o], [cx - o, cz + o]];
      const [x, z] = pts[ped.corner % 4]; out.set(x, 0, z);
    }
    return out;
  }
  const _target = new THREE.Vector3();
  function placeOnLoop(ped, r) {
    ped.lane = range(r, -1.2, 1.2);
    loopPoint(ped, ped.pos);
    ped.pos.x += range(r, -6, 6); ped.pos.z += range(r, -2, 2);
    ped.mesh.position.copy(ped.pos);
  }
  function update(dt, threats) {
    for (const ped of peds) {
      // panic check
      for (const th of threats) {
        const d = ped.pos.distanceTo(th.pos);
        if (d < th.radius) { ped.panicT = 2.6; ped.panicFrom = th.pos; }
      }
      let speed = ped.speed, dirx, dirz;
      if (ped.panicT > 0) {
        ped.panicT -= dt; speed = 4.4;
        dirx = ped.pos.x - ped.panicFrom.x; dirz = ped.pos.z - ped.panicFrom.z;
        const l = Math.hypot(dirx, dirz) || 1; dirx /= l; dirz /= l;
      } else {
        loopPoint(ped, _target);
        dirx = _target.x - ped.pos.x; dirz = _target.z - ped.pos.z;
        const l = Math.hypot(dirx, dirz);
        if (l < 1.2) { ped.corner++; loopPoint(ped, _target); dirx = _target.x - ped.pos.x; dirz = _target.z - ped.pos.z; }
        const ll = Math.hypot(dirx, dirz) || 1; dirx /= ll; dirz /= ll;
      }
      ped.pos.x += dirx * speed * dt; ped.pos.z += dirz * speed * dt;
      ped.pos.x = THREE.MathUtils.clamp(ped.pos.x, -190, 190);
      ped.pos.z = THREE.MathUtils.clamp(ped.pos.z, -190, 124);
      ped.mesh.position.copy(ped.pos);
      ped.mesh.rotation.y = Math.atan2(dirx, dirz);
      ped.phase += dt * (3.4 + speed * 1.9);
      animatePerson(ped.mesh, ped.phase, THREE.MathUtils.clamp(speed / 2.4, 0.25, 1));
    }
  }
  return { peds, update };
}
