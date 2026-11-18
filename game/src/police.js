// Palmera PD: cruiser pursuit AI that scales with the wanted level, roadblocks
// at three stars, a helicopter with a spotlight at four, and the bust meter.
import * as THREE from '../vendor/three.module.min.js';
import { VROADS, HROADS } from './config.js';
import { createCar, stepCar } from './vehicles.js';
import { mulberry32 } from './random.js';

export function createPolice(scene) {
  const rng = mulberry32(99);
  const cruisers = [];
  let heli = null, heliPos = new THREE.Vector3(0, 60, 0);
  let bust = 0, roadblockAt = -1, flashT = 0;

  function roadPointNear(pos, dist) {
    const a = rng() * Math.PI * 2;
    let x = pos.x + Math.cos(a) * dist, z = pos.z + Math.sin(a) * dist;
    // snap to the nearest road so cruisers arrive on tarmac
    if (rng() > 0.5) { let best = VROADS[0]; for (const r of VROADS) if (Math.abs(r - x) < Math.abs(best - x)) best = r; x = best + (rng() > 0.5 ? 3.5 : -3.5); }
    else { let best = HROADS[0]; for (const r of HROADS) if (Math.abs(r - z) < Math.abs(best - z)) best = r; z = best + (3.5); }
    return { x: THREE.MathUtils.clamp(x, -240, 240), z: THREE.MathUtils.clamp(z, -188, 188) };
  }

  function spawnCruiser(pos, roadblock = false, bx = 0, bz = 0, heading = 0) {
    const ent = createCar(0xf2f2f4, { police: true, maxSpeed: 37.5, accel: 15 });
    if (roadblock) {
      ent.mesh.position.set(bx, 0, bz); ent.heading = heading; ent.parked = true; ent.roadblock = true;
    } else {
      const s = roadPointNear(pos, 82);
      ent.mesh.position.set(s.x, 0, s.z);
      ent.heading = Math.atan2(pos.x - s.x, pos.z - s.z);
    }
    ent.mesh.rotation.y = ent.heading;
    scene.add(ent.mesh); cruisers.push(ent); return ent;
  }

  function removeCruiser(ent) {
    scene.remove(ent.mesh);
    cruisers.splice(cruisers.indexOf(ent), 1);
  }

  function buildHeli() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x22303e, roughness: 0.4, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.0, 5.6), mat); body.castShadow = true; g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.6), new THREE.MeshStandardMaterial({ color: 0x9fc4de, roughness: 0.1 }));
    glass.position.set(0, 0.2, 2.6); g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), mat); tail.position.set(0, 0.3, -4.6); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: 0x111214 }));
    rotor.position.y = 1.35; g.add(rotor); g.userData.rotor = rotor;
    const skidM = new THREE.MeshStandardMaterial({ color: 0x555c64 });
    for (const s of [-1, 1]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 4.4), skidM); sk.position.set(s * 1.2, -1.25, 0); g.add(sk); }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(7.5, 26, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2bb, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = -14.4; g.add(cone);
    const spot = new THREE.SpotLight(0xffeebb, 900, 90, 0.32, 0.5, 1.4);
    spot.position.set(0, -1, 0); g.add(spot); g.add(spot.target); spot.target.position.set(0, -30, 2);
    g.userData.spot = spot;
    scene.add(g); return g;
  }

  /**
   * game: { playerPos, playerVel, playerSpeed, heat, colliders, allCars, onBusted }
   * returns { anySee, bust, active }
   */
  function update(dt, game) {
    const { playerPos, playerSpeed, heat } = game;
    flashT += dt;
    const target = heat < 0.5 ? 0 : Math.min(6, 1 + Math.ceil(heat));
    const drivers = cruisers.filter(c => !c.roadblock);
    if (drivers.length < target) spawnCruiser(playerPos);
    if (drivers.length > target + 1) {
      const far = drivers.reduce((a, b) => (a.mesh.position.distanceTo(playerPos) > b.mesh.position.distanceTo(playerPos) ? a : b));
      if (far.mesh.position.distanceTo(playerPos) > 60) removeCruiser(far);
    }
    // roadblock at 3 stars, once per heat episode
    if (heat >= 3 && roadblockAt < 3) {
      roadblockAt = 3;
      const fwdX = Math.sin(game.playerHeading || 0), fwdZ = Math.cos(game.playerHeading || 0);
      const bx = playerPos.x + fwdX * 58, bz = playerPos.z + fwdZ * 58;
      const alongX = Math.abs(fwdX) > Math.abs(fwdZ);
      for (const off of [-3.1, 3.1]) {
        spawnCruiser(playerPos, true, alongX ? bx : bx + off, alongX ? bz + off : bz, alongX ? 0 : Math.PI / 2);
      }
    }
    if (heat < 1.6 && roadblockAt >= 3) {
      roadblockAt = -1;
      for (const c of [...cruisers]) if (c.roadblock) removeCruiser(c);
    }
    // helicopter at 4 stars
    if (heat >= 4 && !heli) { heli = buildHeli(); heliPos.set(playerPos.x - 30, 30, playerPos.z - 20); }
    if (heat < 3.4 && heli) { scene.remove(heli); heli = null; }
    if (heli) {
      const want = new THREE.Vector3(playerPos.x - 13, 27, playerPos.z - 9);
      heliPos.lerp(want, Math.min(1, dt * 1.4));
      heli.position.copy(heliPos);
      heli.rotation.y = Math.atan2(playerPos.x - heliPos.x, playerPos.z - heliPos.z);
      heli.userData.rotor.rotation.y += dt * 28;
    }

    let anySee = !!heli, nearest = 1e9;
    for (const c of cruisers) {
      const p = c.mesh.position;
      const d = p.distanceTo(playerPos);
      nearest = Math.min(nearest, d);
      if (d < 78) anySee = true;
      // lightbar flash
      const bar = c.mesh.userData.lightbar;
      if (bar) {
        const ph = Math.sin(flashT * 11 + c.mesh.id) > 0;
        bar.children[1].material.color.setHex(ph ? 0xff2222 : 0x571111);
        bar.children[2].material.color.setHex(ph ? 0x113377 : 0x2255ff);
      }
      if (c.roadblock || c.driver) continue;
      // pursuit: aim at an intercept point
      const lead = THREE.MathUtils.clamp(d / 26, 0, 1.1);
      const tx = playerPos.x + game.playerVel.x * lead, tz = playerPos.z + game.playerVel.z * lead;
      const wantHeading = Math.atan2(tx - p.x, tz - p.z);
      let diff = wantHeading - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = THREE.MathUtils.clamp(-diff * 1.7, -1, 1);
      let throttle = Math.abs(diff) > 2.2 ? -0.7 : 1;
      if (d < 7 && playerSpeed < 3) throttle = 0.25;
      if (d > 130) throttle = 1;
      stepCar(c, dt, { throttle, steer }, game.colliders, game.allCars);
      if (d > 210) { const s = roadPointNear(playerPos, 85); p.set(s.x, 0, s.z); }
    }
    // bust meter
    if (nearest < 8.5 && playerSpeed < 2.6 && heat >= 0.5) bust += dt / 2.8;
    else bust -= dt / 2.4;
    bust = THREE.MathUtils.clamp(bust, 0, 1);
    if (bust >= 1) { bust = 0; game.onBusted(); }
    return { anySee, bust, active: cruisers.length };
  }

  return {
    update, cruisers,
    get heliPos() { return heli ? heliPos : null; },
    clearAll() { for (const c of [...cruisers]) removeCruiser(c); if (heli) { scene.remove(heli); heli = null; } bust = 0; roadblockAt = -1; },
  };
}
