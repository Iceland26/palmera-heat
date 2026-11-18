// Screenshot scenes behind ?shot=cover|chase|foot|city&seed=N. Each stages the
// real game world: the coral hero car, staged cruisers and traffic, walking
// pedestrians and a story-telling HUD, then returns the camera to hold.
// main.js renders the loop and sets window.__shotReady when the frame settles.
import * as THREE from '../vendor/three.module.min.js';
import { buildPerson } from './people.js';

function carAt(G, ent, x, z, heading, speed = 0) {
  ent.mesh.position.set(x, 0, z);
  ent.heading = heading; ent.mesh.rotation.y = heading;
  ent.speed = speed;
  return ent;
}

export function stageShot(name, G) {
  const { scene, hud, hero } = G;
  G.setPlayerVisible(false);
  hud.show();

  if (name === 'chase') {
    carAt(G, hero, 37, 44, 0, 15);
    G.cruiserAt(29.5, 58, -0.35); G.cruiserAt(45.5, 59, 0.3); G.cruiserAt(37.5, 64, 0.05);
    const flee = G.extraCar(0xffc845, {}); carAt(G, flee, 33.5, 16, 0.16, 13);
    G.teleportPed(0, 29, 30); G.teleportPed(1, 45, 31); G.teleportPed(2, 28.5, 47);
    hud.setCash(2310); hud.setStars(3); hud.setBust(0.35);
    hud.setObjective('JOB 3 · THREE-STAR GOODBYE', 'Lose the heat!', null);
    G.setSun(37, 40);
    return { pos: new THREE.Vector3(37 - 3.5, 4.6, 44 + 12.5), look: new THREE.Vector3(36, 1, 22) };
  }

  if (name === 'foot') {
    G.setPlayerVisible(true);
    G.placePlayer(5.5, 98.5, Math.PI);
    const sol = buildPerson({ shirt: 0x3ec6b8, pants: 0x37474f, skin: 0x8a5a34 });
    sol.position.set(-4.5, 0, 96.5); sol.rotation.y = 2.6; scene.add(sol);
    carAt(G, hero, 15, 100.5, Math.PI / 2, 0);
    const truck = G.extraCar(0x7fb3d8, {}); carAt(G, truck, -16, 101.5, Math.PI / 2, 0);
    G.teleportPed(3, -8, 102); G.teleportPed(4, 12, 121.5); G.teleportPed(5, -20, 121.8);
    hud.setCash(420); hud.setStars(0); hud.setBust(0);
    hud.setObjective('JOB 1 · FIRST WHEELS', 'Meet Sol Vega at his garage', null);
    hud.subtitle('SOL', 'My loaner coupe is sitting at the Yacht Club. Bring her home and we talk work.', 999);
    G.setSun(0, 92);
    return { pos: new THREE.Vector3(5.5 + 2.2, 2.7, 98.5 + 7.2), look: new THREE.Vector3(0, 2.2, 90) };
  }

  if (name === 'city') {
    const a = G.extraCar(0xe8e0d0, {}); carAt(G, a, 8, 40.5, Math.PI / 2, 11);
    const b = G.extraCar(0xd86a9a, {}); carAt(G, b, 33.5, 2, 0, 11);
    const c2 = G.extraCar(0x3ec6b8, {}); carAt(G, c2, 62, 33.5, -Math.PI / 2, 11);
    carAt(G, hero, 40.5, 60, Math.PI, 0);
    G.teleportPed(6, 31, 31); G.teleportPed(7, 43, 44); G.teleportPed(8, 30, 45);
    hud.setCash(870); hud.setStars(1); hud.setBust(0);
    hud.setObjective('JOB 2 · HARBOUR RUN', 'Deliver the package to Vista Plaza — fast', null);
    G.setSun(37, 37);
    return { pos: new THREE.Vector3(63, 17, 79), look: new THREE.Vector3(34, 0, 33) };
  }

  // cover (default): golden-hour boulevard chase
  carAt(G, hero, -26, 114.5, Math.PI / 2, 17);
  G.cruiserAt(-41, 117.5, Math.PI / 2 + 0.06);
  const oncoming = G.extraCar(0xe8e0d0, {}); carAt(G, oncoming, 42, 107.5, -Math.PI / 2, 12);
  const parked = G.extraCar(0x7fb3d8, {}); carAt(G, parked, 6, 120.6, -Math.PI / 2, 0);
  G.teleportPed(9, -12, 121.5); G.teleportPed(10, 2, 121.8); G.teleportPed(11, -38, 121.2);
  hud.setCash(1250); hud.setStars(2); hud.setBust(0.12);
  hud.setObjective('JOB 3 · THREE-STAR GOODBYE', 'Lose the heat!', null);
  G.setSun(-26, 108);
  return { pos: new THREE.Vector3(-26 - 10.5, 3.7, 114.5 - 2.5), look: new THREE.Vector3(-12, 1.2, 112) };
}
