// Costa Palmera's world: golden-hour sky, the road grid, buildings, palms,
// lamps, beach, sea, pier and harbour — plus the static collider list the
// physics steps test against. Static dressing is merged or instanced so the
// whole city draws in a few dozen calls.
import * as THREE from '../vendor/three.module.min.js';
import { PITCH, BLOCK, COLS, ROWS, VROADS, HROADS, BOULEVARD_Z, BEACH_Z, SEA_Z, GARAGE_POS, YACHT_POS } from './config.js';
import * as T from './textures.js';
import { mulberry32, range } from './random.js';

// Merge non-indexed geometries (with per-part vertex colours) into one.
function mergeColored(parts) {
  let total = 0;
  const prepped = parts.map(({ geom, matrix, color }) => {
    const g = geom.toNonIndexed();
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count; total += n;
    const col = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const itemSize = name === 'uv' ? 2 : 3;
    const arr = new Float32Array(total * itemSize);
    let off = 0;
    for (const g of prepped) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
  }
  return out;
}
const M4 = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);

export function createWorld(scene) {
  const rng = mulberry32(7);
  const colliders = [];   // {minX,maxX,minZ,maxZ} buildings & big props
  const group = new THREE.Group(); scene.add(group);

  // ---------- sky, fog, lights ----------
  const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 512;
  const sg = skyC.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, '#2c5d94');
  grad.addColorStop(0.34, '#6fa3d8');
  grad.addColorStop(0.455, '#c9d9e8');
  grad.addColorStop(0.50, '#ffc98a');   // warm band straddling the horizon (v=0.5)
  grad.addColorStop(0.545, '#ff8c4a');  // ember at the horizon line
  grad.addColorStop(0.60, '#b8622f');
  grad.addColorStop(1.00, '#4a2413');
  sg.fillStyle = grad; sg.fillRect(0, 0, 4, 512);
  const skyTex = new THREE.CanvasTexture(skyC); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 14),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(sky);
  scene.fog = new THREE.Fog(0xf2a56e, 150, 1150);

  const hemi = new THREE.HemisphereLight(0xbdd7f2, 0x8a5c34, 0.85); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
  sun.shadow.camera.far = 700; sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  const SUN_OFF = new THREE.Vector3(-190, 150, 240); // low in the south-west: long golden shadows
  function setSunTarget(x, z) {
    sun.position.set(x + SUN_OFF.x, SUN_OFF.y, z + SUN_OFF.z);
    sun.target.position.set(x, 0, z);
  }
  setSunTarget(0, 60);

  // ---------- ground & roads ----------
  const asphalt = T.asphaltTexture(), parking = T.parkingTexture(), walk = T.sidewalkTexture();
  const sandT = T.sandTexture(), seaT = T.seaTexture(), roofT = T.roofTexture();
  const base = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshStandardMaterial({ color: 0x77694f, roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.position.y = -0.08; base.receiveShadow = true; group.add(base);

  const cityBase = new THREE.Mesh(new THREE.PlaneGeometry(384, 310),
    new THREE.MeshStandardMaterial({ map: walk, roughness: 1 }));
  cityBase.material.map = walk.clone(); cityBase.material.map.repeat.set(48, 39); cityBase.material.map.needsUpdate = true;
  cityBase.rotation.x = -Math.PI / 2; cityBase.position.set(0, 0, -37); cityBase.receiveShadow = true; group.add(cityBase);

  function roadPlane(w, l, x, z, repX, repY) {
    const t = asphalt.clone(); t.needsUpdate = true; t.repeat.set(repX, repY);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ map: t, roughness: 0.94 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true; group.add(m);
  }
  for (const x of VROADS) roadPlane(14, 310, x, -37, 1, 22);
  for (const z of HROADS) roadPlane(z === BOULEVARD_Z ? 452 : 384, 14, z === BOULEVARD_Z ? 34 : 0, z, z === BOULEVARD_Z ? 32 : 27, 1);

  // edge lines + centre dashes (instanced thin boxes)
  const lineGeo = BOX(1, 0.012, 1);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xe9e4d8 });
  const edges = [];
  for (const x of VROADS) { edges.push([x - 6.6, -37, 0.22, 306]); edges.push([x + 6.6, -37, 0.22, 306]); }
  for (const z of HROADS) { edges.push([0, z - 6.6, 380, 0.22]); edges.push([0, z + 6.6, 380, 0.22]); }
  const edgeMesh = new THREE.InstancedMesh(lineGeo, lineMat, edges.length);
  edges.forEach(([x, z, w, l], i) => edgeMesh.setMatrixAt(i, M4(x, 0.035, z, 0, w, 1, l)));
  group.add(edgeMesh);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffc845 });
  const dashes = [];
  for (let x = -222; x <= 240; x += 7) dashes.push([x, BOULEVARD_Z]);
  const dashMesh = new THREE.InstancedMesh(lineGeo, dashMat, dashes.length);
  dashes.forEach(([x, z], i) => dashMesh.setMatrixAt(i, M4(x, 0.035, z, 0, 2.6, 1, 0.3)));
  group.add(dashMesh);

  // zebra crossings at every junction
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xf4f1e8 });
  const zebras = [];
  for (const x of VROADS) for (const z of HROADS) {
    for (let s = -2; s <= 2; s++) zebras.push([x + s * 2.4, z - 8.6, 1.3, 3.4]);
    for (let s = -2; s <= 2; s++) zebras.push([x - 8.6, z + s * 2.4, 3.4, 1.3]);
  }
  const zebraMesh = new THREE.InstancedMesh(lineGeo, zebraMat, zebras.length);
  zebras.forEach(([x, z, w, l], i) => zebraMesh.setMatrixAt(i, M4(x, 0.033, z, 0, w, 1, l)));
  group.add(zebraMesh);

  // ---------- blocks & buildings ----------
  const facades = [];
  for (let i = 0; i < 6; i++) {
    const f = T.facadeTextures(i);
    facades.push(new THREE.MeshStandardMaterial({
      map: f.map, emissiveMap: f.emis, emissive: 0xffc27d, emissiveIntensity: 1.15, roughness: 0.85,
    }));
  }
  const roofMat = new THREE.MeshStandardMaterial({ map: roofT, roughness: 1 });
  const unitBox = BOX(1, 1, 1);
  function building(x, z, w, h, d, fi) {
    const mats = [facades[fi], facades[fi], roofMat, roofMat, facades[fi], facades[fi]];
    const m = new THREE.Mesh(unitBox, mats);
    m.scale.set(w, h, d); m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true; group.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  }
  function slab(x, z, mat) {
    const t = mat === parking ? parking.clone() : walk.clone();
    t.needsUpdate = true; if (mat === parking) t.repeat.set(2, 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.045, z); m.receiveShadow = true; group.add(m);
  }
  const LOT_BLOCKS = new Set(['-74,-148', '74,0', '-148,74']);
  for (const cx of COLS) for (const cz of ROWS) {
    const key = cx + ',' + cz;
    const isGarage = cx === GARAGE_POS.x && cz === 74, isYacht = cx === YACHT_POS.x && cz === 74, isClinic = cx === -74 && cz === 74;
    if (LOT_BLOCKS.has(key)) { slab(cx, cz, parking); continue; }
    slab(cx, cz, walk);
    if (isGarage || isYacht || isClinic) continue; // dressed below
    const n = 2 + Math.floor(rng() * 3);
    const spots = [[-15, -15], [15, -15], [-15, 15], [15, 15]].sort(() => rng() - 0.5);
    for (let i = 0; i < n; i++) {
      const [ox, oz] = spots[i];
      const w = range(rng, 17, 26), d = range(rng, 17, 26);
      const coastal = cz === 74 ? 0.55 : 1;
      const h = range(rng, 13, 46) * coastal * (cz === -148 ? 1.25 : 1);
      building(cx + ox + range(rng, -2, 2), cz + oz + range(rng, -2, 2), w, h, d, Math.floor(rng() * 6));
    }
  }

  // ---------- signs ----------
  function sign(lines, bg, fg, w, h, x, y, z, ry) {
    const t = T.signTexture(lines, bg, fg, 512, Math.floor(512 * h / w));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; group.add(m); return m;
  }
  // Sol's Garage: low wide shed on block (0,74), open front facing the boulevard
  const garageMat = new THREE.MeshStandardMaterial({ color: 0xc7512f, roughness: 0.8 });
  const garage = new THREE.Mesh(BOX(36, 9, 18), garageMat);
  garage.position.set(0, 4.5, 80); garage.castShadow = true; garage.receiveShadow = true; group.add(garage);
  colliders.push({ minX: -18, maxX: 18, minZ: 71, maxZ: 89 });
  const garageRoof = new THREE.Mesh(BOX(38, 0.7, 20), roofMat); garageRoof.position.set(0, 9.3, 80); group.add(garageRoof);
  sign(["SOL'S GARAGE"], '#20242c', '#ffb340', 17, 3.4, 0, 7.6, 89.2, 0);
  sign(['REPAIRS • TUNES • CASH FOR CARS'], '#20242c', '#ffe4c4', 15, 2.0, 0, 4.6, 89.2, 0);
  // Marlin Yacht Club on block (148,74)
  const club = new THREE.Mesh(BOX(30, 7, 16), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.85 }));
  club.position.set(148, 3.5, 80); club.castShadow = true; club.receiveShadow = true; group.add(club);
  colliders.push({ minX: 133, maxX: 163, minZ: 72, maxZ: 88 });
  sign(['MARLIN YACHT CLUB'], '#123a4d', '#ffd98f', 15, 3, 148, 6, 88.2, 0);
  // Palmera PD on block (-148,-148)
  building(-156, -156, 22, 15, 18, 1);
  sign(['PALMERA PD'], '#1c2f4a', '#dfe9f5', 11, 2.4, -144.7, 9, -156, Math.PI / 2);
  // Clinica on block (-74,74): a low white block with a red-cross sign
  const clinic = new THREE.Mesh(BOX(26, 8, 14), new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.85 }));
  clinic.position.set(-74, 4, 82); clinic.castShadow = true; clinic.receiveShadow = true; group.add(clinic);
  colliders.push({ minX: -87, maxX: -61, minZ: 75, maxZ: 89 });
  sign(['CLINICA +'], '#e8e0d0', '#c0392b', 10, 2.4, -74, 6.2, 89.2, 0);

  // billboards
  function billboard(lines, bg, fg, x, z, ry) {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 0.7, metalness: 0.4 });
    for (const dx of [-3.4, 3.4]) { const p = new THREE.Mesh(CYL(0.22, 0.22, 7), poleMat); p.position.set(dx, 3.5, 0); p.castShadow = true; g.add(p); }
    const t = T.signTexture(lines, bg, fg, 1024, 320);
    const panel = new THREE.Mesh(BOX(11, 3.4, 0.3), new THREE.MeshBasicMaterial({ map: t }));
    panel.position.y = 8.4; g.add(panel);
    const back = new THREE.Mesh(BOX(11, 3.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a3f46 }));
    back.position.set(0, 8.4, -0.2); g.add(back);
    g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
    colliders.push({ minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1 });
  }
  billboard(['RADIO SOL 98.1', 'PALMERA • FM'], '#7c1f3d', '#ffd98f', -96, 122.5, Math.PI);
  billboard(['PALMERA COLA', 'ICE COLD • 24H'], '#14424f', '#bff0e8', 120, 122.5, Math.PI);

  // ---------- street furniture (merged, vertex-coloured) ----------
  const furn = [];
  const drumCols = [0x3a6ea8, 0xb8502f, 0x707880];
  function crates(x, z, n) {
    for (let i = 0; i < n; i++) {
      const s = range(rng, 1.1, 1.9);
      furn.push({ geom: BOX(s, s, s), matrix: M4(x + range(rng, -2.4, 2.4), s / 2 + (i > 2 ? 1.4 : 0), z + range(rng, -2, 2), rng() * 3), color: i % 2 ? 0x9a7443 : 0x7c5a30 });
    }
    for (let i = 0; i < 2; i++) furn.push({ geom: CYL(0.42, 0.42, 1.05, 9), matrix: M4(x + range(rng, -3, 3), 0.53, z + range(rng, -2.4, 2.4)), color: drumCols[i % 3] });
  }
  crates(24, 82, 4); crates(-25, 84, 3);            // garage yard
  crates(196, 100, 6); crates(206, 122, 5); crates(188, 122, 4); // harbour
  crates(128, 92, 3);                              // yacht club
  // promenade planters + benches
  for (let x = -180; x <= 184; x += 24) {
    furn.push({ geom: BOX(3.4, 0.9, 1.1), matrix: M4(x, 0.45, 121.5), color: 0xb8a888 });
    furn.push({ geom: BOX(3.0, 0.5, 0.8), matrix: M4(x, 1.05, 121.5), color: 0x3f7a3a });
    furn.push({ geom: BOX(2.2, 0.14, 0.55), matrix: M4(x + 6, 0.62, 121.8), color: 0x8a5f36 });
    furn.push({ geom: BOX(2.2, 0.5, 0.1), matrix: M4(x + 6, 0.3, 122.05), color: 0x6e4a2a });
  }
  const furnMesh = new THREE.Mesh(mergeColored(furn), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  furnMesh.castShadow = true; furnMesh.receiveShadow = true; group.add(furnMesh);

  // ---------- lamps (instanced poles + glowing heads + light pools) ----------
  const lampPos = [];
  for (const x of VROADS) for (let z = -178; z <= 104; z += 37) lampPos.push([x + (Math.round((z + 178) / 37) % 2 ? 8 : -8), z]);
  for (const z of HROADS) for (let x = -178; x <= 178; x += 37) lampPos.push([x, z + (Math.round((x + 178) / 37) % 2 ? 8 : -8)]);
  const poleGeom = mergeColored([
    { geom: CYL(0.09, 0.13, 5.4, 6), matrix: M4(0, 2.7, 0), color: 0x3c4148 },
    { geom: BOX(0.14, 0.14, 1.5), matrix: M4(0, 5.35, 0.6), color: 0x3c4148 },
  ]);
  const poles = new THREE.InstancedMesh(poleGeom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), lampPos.length);
  const heads = new THREE.InstancedMesh(BOX(0.34, 0.16, 0.6), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), lampPos.length);
  const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(3.4, 14),
    new THREE.MeshBasicMaterial({ color: 0xffbe78, transparent: true, opacity: 0.13, depthWrite: false }), lampPos.length);
  lampPos.forEach(([x, z], i) => {
    poles.setMatrixAt(i, M4(x, 0, z));
    heads.setMatrixAt(i, M4(x, 5.32, z + 1.2));
    const pm = M4(x, 0.05, z + 1.2); pm.multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)); pools.setMatrixAt(i, pm);
  });
  poles.castShadow = true; group.add(poles, heads, pools);

  // ---------- palms (instanced) ----------
  const palmParts = [
    { geom: CYL(0.16, 0.3, 5.6, 7), matrix: M4(0, 2.8, 0), color: 0x8a6a48 },
  ];
  for (let k = 0; k < 7; k++) {
    const frond = new THREE.ConeGeometry(0.34, 3.1, 4);
    frond.translate(0, 1.55, 0); frond.rotateZ(1.92); frond.rotateY(k * Math.PI * 2 / 7); frond.translate(0, 5.5, 0);
    palmParts.push({ geom: frond, color: 0x3e8f3e });
  }
  palmParts.push({ geom: new THREE.SphereGeometry(0.34, 6, 5), matrix: M4(0.2, 5.25, 0.1), color: 0x6e4a2a });
  const palmGeom = mergeColored(palmParts);
  const palmSpots = [];
  for (let x = -186; x <= 190; x += 12.5) palmSpots.push([x + range(rng, -1.5, 1.5), 123.5]);
  for (let x = -170; x <= 180; x += 25) palmSpots.push([x, 101.5]);
  for (let i = 0; i < 16; i++) palmSpots.push([range(rng, -185, 185), range(rng, 129, 143)]);
  palmSpots.push([70, -88], [60, -64], [88, -64], [70, -40]);
  const palms = new THREE.InstancedMesh(palmGeom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    const s = range(rng, 0.85, 1.25);
    palms.setMatrixAt(i, M4(x, 0, z, rng() * 6.3, s, s * range(rng, 0.9, 1.15), s));
  });
  palms.castShadow = true; group.add(palms);

  // ---------- beach, sea, pier, boats ----------
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(560, 30), new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.012, 133); sand.receiveShadow = true; group.add(sand);
  const prom = new THREE.Mesh(new THREE.PlaneGeometry(452, 8), new THREE.MeshStandardMaterial({ color: 0xa89a82, roughness: 1 }));
  prom.rotation.x = -Math.PI / 2; prom.position.set(34, 0.015, 122); prom.receiveShadow = true; group.add(prom);
  const seaMat = new THREE.MeshStandardMaterial({ map: seaT, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.96 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1500, 560), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.25, SEA_Z + 278); group.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(560, 5),
    new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.4, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.03, SEA_Z + 1); group.add(foam);

  const umbCols = [0xff5a48, 0xffc845, 0x3ec6b8, 0xff8ab0];
  const umbGeom = mergeColored([
    { geom: CYL(0.05, 0.05, 2.3, 6), matrix: M4(0, 1.15, 0), color: 0xe8e0d0 },
    { geom: new THREE.ConeGeometry(1.7, 0.55, 9), matrix: M4(0, 2.35, 0), color: 0xffffff },
  ]);
  const umbSpots = [];
  for (let i = 0; i < 15; i++) umbSpots.push([range(rng, -180, 185), range(rng, 129, 141)]);
  const umbrellas = new THREE.InstancedMesh(umbGeom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), umbSpots.length);
  umbSpots.forEach(([x, z], i) => { umbrellas.setMatrixAt(i, M4(x, 0, z, rng() * 6)); umbrellas.setColorAt(i, new THREE.Color(umbCols[i % 4])); });
  umbrellas.castShadow = true; group.add(umbrellas);

  // pier deck + posts
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.95 });
  const deck = new THREE.Mesh(BOX(7, 0.5, 52), pierMat);
  deck.position.set(60, 0.9, SEA_Z + 24); deck.castShadow = true; deck.receiveShadow = true; group.add(deck);
  // no collider for the pier: the deck is drivable/walkable (groundY lifts actors onto it)
  const postGeom = CYL(0.22, 0.22, 2.4, 6);
  const posts = new THREE.InstancedMesh(postGeom, pierMat, 12);
  for (let i = 0; i < 12; i++) posts.setMatrixAt(i, M4(60 + (i % 2 ? 3.2 : -3.2), 0, SEA_Z + 4 + Math.floor(i / 2) * 9.4));
  group.add(posts);

  // boats (bob in update)
  const boats = [];
  function boat(x, z, ry, hullCol) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(BOX(3.2, 1.1, 8.5), new THREE.MeshStandardMaterial({ color: hullCol, roughness: 0.5 }));
    hull.position.y = 0.4; hull.castShadow = true; g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 4), hull.material);
    bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.42); bow.position.set(0, 0.4, 5.4); g.add(bow);
    const cabin = new THREE.Mesh(BOX(2.2, 1.1, 3), new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.6 }));
    cabin.position.set(0, 1.4, -0.6); cabin.castShadow = true; g.add(cabin);
    g.position.set(x, 0, z); g.rotation.y = ry; group.add(g); boats.push(g); return g;
  }
  boat(48, 178, 0.3, 0xe8e0d0); boat(74, 186, -0.2, 0x3ec6b8); boat(196, 172, 0.9, 0xff8ab0); boat(222, 184, 0.4, 0xffc845);

  // harbour warehouse
  building(222, 62, 30, 12, 24, 3);
  sign(['PALMERA HARBOUR'], '#123a4d', '#ffd98f', 14, 2.8, 222, 8, 74.2, 0);

  let t = 0;
  function update(dt) {
    t += dt;
    sea.position.y = -0.25 + Math.sin(t * 0.55) * 0.13;
    seaT.offset.y = t * 0.006; seaT.offset.x = Math.sin(t * 0.11) * 0.02;
    foam.material.opacity = 0.3 + Math.sin(t * 0.9) * 0.14;
    foam.position.z = SEA_Z + 1 + Math.sin(t * 0.55) * 0.7;
    boats.forEach((b, i) => { b.position.y = Math.sin(t * 0.8 + i * 1.7) * 0.14; b.rotation.z = Math.sin(t * 0.6 + i) * 0.02; });
  }

  return { update, colliders, setSunTarget, group };
}
