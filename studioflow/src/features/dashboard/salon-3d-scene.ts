import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ChairState } from "./salon-model";

/** What the 3D room needs to know about each chair. */
export interface SceneChair {
  id: string;
  state: ChairState;
}
export interface Anchor {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}
export interface SalonScene {
  update(chairs: SceneChair[], waiting: number): void;
  select(id: string): void;
  resize(): void;
  dispose(): void;
}

const tones: Record<ChairState, number> = {
  busy: 0xd9b77a,
  late: 0xe0703a,
  due: 0x7fa7d9,
  free: 0x58b48a,
  break: 0x9c9284,
  off: 0x5a5148,
};

const mat = {
  leather: new THREE.MeshStandardMaterial({
    color: 0x161210,
    roughness: 0.42,
    metalness: 0.05,
  }),
  brass: new THREE.MeshStandardMaterial({
    color: 0xb08a4f,
    roughness: 0.28,
    metalness: 1,
  }),
  chrome: new THREE.MeshStandardMaterial({
    color: 0xd6d3cd,
    roughness: 0.18,
    metalness: 1,
  }),
  wood: new THREE.MeshStandardMaterial({
    color: 0x3a2a1e,
    roughness: 0.55,
    metalness: 0.05,
  }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x241a13, roughness: 0.6 }),
  marble: new THREE.MeshStandardMaterial({
    color: 0x1b1917,
    roughness: 0.18,
    metalness: 0.2,
  }),
  sofa: new THREE.MeshStandardMaterial({ color: 0x4a3122, roughness: 0.5 }),
  rug: new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.95 }),
  cape: new THREE.MeshStandardMaterial({ color: 0xf1ebe0, roughness: 0.8 }),
  apron: new THREE.MeshStandardMaterial({ color: 0x1e1915, roughness: 0.7 }),
  skin: new THREE.MeshStandardMaterial({ color: 0x8a6a52, roughness: 0.65 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x17120e, roughness: 0.8 }),
  pot: new THREE.MeshStandardMaterial({
    color: 0x141210,
    roughness: 0.35,
    metalness: 0.1,
  }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.6 }),
  leafLight: new THREE.MeshStandardMaterial({
    color: 0x5a8a4c,
    roughness: 0.6,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x9fb0ad,
    roughness: 0.05,
    metalness: 0.9,
  }),
  glow: new THREE.MeshStandardMaterial({
    color: 0xffd59a,
    emissive: 0xffc777,
    emissiveIntensity: 2.2,
  }),
};

const box = (w: number, h: number, d: number, m: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};
const cyl = (
  rt: number,
  rb: number,
  h: number,
  m: THREE.Material,
  seg = 24,
) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};
const at = <T extends THREE.Object3D>(
  o: T,
  x: number,
  y: number,
  z: number,
) => {
  o.position.set(x, y, z);
  return o;
};

/** Canvas texture: stone floor tiles. */
function floorTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d9ccb6";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? "#d2c4ac" : "#dccfb9";
      g.fillRect(i * 256 + 2, j * 256 + 2, 252, 252);
    }
  g.strokeStyle = "#b9a98f";
  g.lineWidth = 3;
  g.strokeRect(0, 0, 512, 512);
  g.beginPath();
  g.moveTo(256, 0);
  g.lineTo(256, 512);
  g.moveTo(0, 256);
  g.lineTo(512, 256);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
/** Canvas texture: dark wall with vertical wood slats. */
function wallTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1d1814";
  g.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 32) {
    g.fillStyle = x % 64 ? "#2a2119" : "#30261d";
    g.fillRect(x + 2, 0, 28, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** Canvas texture: the shop's sign. */
function signTexture(name: string, category: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#14100c";
  g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = "#b08a4f";
  g.lineWidth = 8;
  g.strokeRect(24, 24, 976, 464);
  const serif =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--serif")
      .trim() || "Georgia, serif";
  g.fillStyle = "#d9b77a";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const label = name.toUpperCase();
  let size = 120;
  g.font = `400 ${size}px ${serif}`;
  while (g.measureText(label).width > 860 && size > 40) {
    size -= 6;
    g.font = `400 ${size}px ${serif}`;
  }
  g.fillText(label, 512, 230);
  g.fillRect(372, 312, 280, 3);
  g.fillStyle = "#b8ad9c";
  g.font = `600 38px sans-serif`;
  g.fillText(
    (category || "Barbearia").toUpperCase().split("").join(" "),
    512,
    372,
  );
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A barber chair facing the mirror (-z). Placeholder until the Meshy model. */
function makeChair() {
  const g = new THREE.Group();
  g.add(at(cyl(0.32, 0.36, 0.06, mat.chrome, 32), 0, 0.03, 0));
  g.add(at(cyl(0.07, 0.07, 0.42, mat.chrome), 0, 0.27, 0));
  g.add(at(box(0.62, 0.16, 0.6, mat.leather), 0, 0.55, 0));
  g.add(at(box(0.62, 0.78, 0.13, mat.leather), 0, 1.0, 0.27));
  g.add(at(box(0.3, 0.2, 0.1, mat.leather), 0, 1.5, 0.27));
  g.add(at(box(0.62, 0.035, 0.035, mat.brass), 0, 1.4, 0.34));
  for (const side of [-1, 1]) {
    g.add(at(box(0.08, 0.07, 0.56, mat.leather), side * 0.36, 0.78, 0.02));
    g.add(at(box(0.04, 0.2, 0.04, mat.brass), side * 0.36, 0.66, -0.2));
  }
  g.add(at(box(0.46, 0.04, 0.2, mat.chrome), 0, 0.22, -0.42));
  return g;
}
/** Someone sitting under the cape, and the barber at the chair. */
function makeService() {
  const g = new THREE.Group();
  const cape = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 0.75, 28, 1, true),
    mat.cape,
  );
  cape.castShadow = true;
  g.add(at(cape, 0, 0.98, 0.03));
  g.add(
    at(
      new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), mat.skin),
      0,
      1.42,
      0.06,
    ),
  );
  g.add(
    at(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.135, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        mat.hair,
      ),
      0,
      1.45,
      0.07,
    ),
  );
  const barber = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.17, 0.78, 6, 16),
    mat.apron,
  );
  body.castShadow = true;
  barber.add(at(body, 0, 0.95, 0));
  barber.add(
    at(
      new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), mat.skin),
      0,
      1.62,
      0,
    ),
  );
  barber.add(
    at(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.125, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        mat.hair,
      ),
      0,
      1.65,
      0,
    ),
  );
  const arm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.05, 0.42, 4, 8),
    mat.apron,
  );
  arm.rotation.z = Math.PI / 2.6;
  barber.add(at(arm, -0.2, 1.25, -0.05));
  g.add(at(barber, 0.62, 0, 0.18));
  return g;
}
function makePlant(scale = 1) {
  const g = new THREE.Group();
  g.add(at(cyl(0.22, 0.17, 0.5, mat.pot), 0, 0.25, 0));
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      i % 2 ? mat.leaf : mat.leafLight,
    );
    leaf.scale.set(0.45, 1.6, 0.18);
    const a = (i / 9) * Math.PI * 2;
    leaf.position.set(
      Math.cos(a) * 0.16,
      0.75 + (i % 3) * 0.18,
      Math.sin(a) * 0.16,
    );
    leaf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}
function makeSofa() {
  const g = new THREE.Group();
  g.add(at(box(2.4, 0.42, 0.9, mat.sofa), 0, 0.25, 0));
  g.add(at(box(2.4, 0.55, 0.22, mat.sofa), 0, 0.68, 0.36));
  for (const side of [-1, 1])
    g.add(at(box(0.2, 0.62, 0.9, mat.sofa), side * 1.2, 0.36, 0));
  for (let i = -1; i <= 1; i++)
    g.add(at(box(0.74, 0.1, 0.7, mat.sofa), i * 0.76, 0.51, -0.05));
  return g;
}
function makeGuest() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.17, 0.42, 6, 14),
    mat.wood,
  );
  body.castShadow = true;
  g.add(at(body, 0, 0.88, 0.12));
  g.add(
    at(
      new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), mat.skin),
      0,
      1.32,
      0.12,
    ),
  );
  return g;
}

/**
 * The live salon as a real 3D room: stations with lit mirrors along the back
 * wall, the reception and the shop's sign on the right, the waiting sofa in
 * front. Renders only when something changes.
 */
export function createSalonScene(input: {
  canvas: HTMLCanvasElement;
  shopName: string;
  category: string;
  chairs: SceneChair[];
  waiting: number;
  onSelect: (id: string) => void;
  onAnchors: (anchors: Anchor[]) => void;
}): SalonScene {
  const { canvas } = input;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.35;

  const count = Math.max(1, Math.min(8, input.chairs.length));
  const W = Math.max(9, count * 1.9 + 4.6);
  const D = 7;
  const H = 3;

  // Room shell
  const floorMap = floorTexture();
  floorMap.repeat.set(W / 2.4, D / 2.4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({
      map: floorMap,
      roughness: 0.32,
      metalness: 0.05,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wallMap = wallTexture();
  wallMap.repeat.set(W / 2, 1);
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallMap,
    roughness: 0.7,
  });
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.12), wallMat);
  back.position.set(0, H / 2, -D / 2 - 0.06);
  back.receiveShadow = true;
  scene.add(back);
  const sideMap = wallTexture();
  sideMap.repeat.set(D / 2, 1);
  const right = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, H, D),
    new THREE.MeshStandardMaterial({ map: sideMap, roughness: 0.7 }),
  );
  right.position.set(W / 2 + 0.06, H / 2, 0);
  right.receiveShadow = true;
  scene.add(right);
  // Warm LED line along the top of both walls
  scene.add(at(box(W, 0.04, 0.04, mat.glow), 0, H - 0.05, -D / 2 + 0.03));
  scene.add(at(box(0.04, 0.04, D, mat.glow), W / 2 - 0.03, H - 0.05, 0));
  // Skirting
  scene.add(at(box(W, 0.14, 0.04, mat.woodDark), 0, 0.07, -D / 2 + 0.02));

  // Stations along the back wall
  const left = -W / 2 + 1.3;
  const span = W - 1.3 - 3.6;
  const step = count > 1 ? span / (count - 1) : 0;
  const stations: {
    id: string;
    x: number;
    z: number;
    group: THREE.Group;
    ring: THREE.Mesh;
    service: THREE.Group;
  }[] = [];
  const chairsRoot = new THREE.Group();
  scene.add(chairsRoot);
  for (let i = 0; i < count; i++) {
    const x = count > 1 ? left + step * i : left + span / 2;
    const z = -D / 2;
    scene.add(at(box(1.35, 0.86, 0.5, mat.wood), x, 0.43, z + 0.27));
    scene.add(at(box(1.4, 0.04, 0.54, mat.marble), x, 0.88, z + 0.27));
    const frame = at(box(1.06, 1.36, 0.04, mat.glow), x, 1.75, z + 0.03);
    scene.add(frame);
    scene.add(
      at(
        new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.28), mat.glass),
        x,
        1.75,
        z + 0.055,
      ),
    );
    for (let k = 0; k < 3; k++)
      scene.add(
        at(
          cyl(0.035, 0.035, 0.16, k % 2 ? mat.brass : mat.woodDark, 12),
          x - 0.4 + k * 0.12,
          0.98,
          z + 0.2,
        ),
      );
    const lamp = new THREE.PointLight(0xffc98a, 2.2, 3.2, 2);
    lamp.position.set(x, 1.8, z + 0.6);
    scene.add(lamp);
    const group = makeChair();
    group.position.set(x, 0, z + 1.45);
    group.userData.station = i;
    chairsRoot.add(group);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.6, 48),
      new THREE.MeshBasicMaterial({
        color: tones.free,
        transparent: true,
        opacity: 0.9,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.012, z + 1.45);
    scene.add(ring);
    const service = makeService();
    service.position.copy(group.position);
    service.visible = false;
    scene.add(service);
    stations.push({ id: "", x, z: z + 1.45, group, ring, service });
  }

  // Reception and sign on the right wall
  const desk = new THREE.Group();
  desk.add(at(box(0.75, 1.05, 2.3, mat.woodDark), 0, 0.52, 0));
  desk.add(at(box(0.82, 0.05, 2.38, mat.marble), 0, 1.07, 0));
  desk.add(at(box(0.04, 0.04, 2.2, mat.glow), -0.39, 0.12, 0));
  desk.add(at(box(0.04, 0.32, 0.5, mat.hair), 0.12, 1.28, -0.4));
  desk.position.set(W / 2 - 1.4, 0, -0.2);
  scene.add(desk);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.1),
    new THREE.MeshStandardMaterial({
      map: signTexture(input.shopName, input.category),
      roughness: 0.5,
      emissive: 0x2a1d10,
      emissiveIntensity: 0.4,
    }),
  );
  sign.rotation.y = -Math.PI / 2;
  sign.position.set(W / 2 - 0.01, 1.95, -0.2);
  scene.add(sign);
  // Product shelf by the corner
  for (let s = 0; s < 3; s++) {
    scene.add(
      at(box(0.3, 0.04, 1.3, mat.wood), W / 2 - 0.16, 0.9 + s * 0.45, -2.6),
    );
    for (let k = 0; k < 5; k++)
      scene.add(
        at(
          cyl(0.05, 0.05, 0.2, k % 2 ? mat.brass : mat.pot, 12),
          W / 2 - 0.16,
          1.02 + s * 0.45,
          -3.1 + k * 0.24,
        ),
      );
  }

  // Waiting area
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.3), mat.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.6, 0.006, D / 2 - 1.9);
  rug.receiveShadow = true;
  scene.add(rug);
  const sofa = makeSofa();
  sofa.position.set(-0.6, 0, D / 2 - 1.2);
  scene.add(sofa);
  const table = new THREE.Group();
  table.add(at(cyl(0.45, 0.45, 0.05, mat.marble, 32), 0, 0.42, 0));
  table.add(at(cyl(0.05, 0.12, 0.4, mat.brass), 0, 0.2, 0));
  table.position.set(-0.6, 0, D / 2 - 2.5);
  scene.add(table);
  const guests = new THREE.Group();
  scene.add(guests);
  scene.add(at(makePlant(1.25), -W / 2 + 0.55, 0, -D / 2 + 0.6));
  scene.add(at(makePlant(1.1), W / 2 - 0.6, 0, D / 2 - 0.7));
  scene.add(at(makePlant(0.95), -W / 2 + 0.6, 0, D / 2 - 0.9));

  // Light
  scene.add(new THREE.HemisphereLight(0xffeed6, 0x3a2e24, 1.1));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.1);
  sun.position.set(-W * 0.35, 9, D * 0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const shadow = sun.shadow.camera as THREE.OrthographicCamera;
  shadow.left = -W / 2 - 1;
  shadow.right = W / 2 + 1;
  shadow.top = D / 2 + 1;
  shadow.bottom = -D / 2 - 1;
  shadow.near = 1;
  shadow.far = 30;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // Camera from the front left, looking into the back right corner
  const camera = new THREE.PerspectiveCamera(34, 1.5, 0.1, 100);
  const target = new THREE.Vector3(W * 0.04, 0.7, -D * 0.12);
  camera.position.set(-W * 0.42, Math.max(6.2, W * 0.62), D * 1.32);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.2;
  const azimuth = controls.getAzimuthalAngle();
  controls.minAzimuthAngle = azimuth - 0.55;
  controls.maxAzimuthAngle = azimuth + 0.5;
  const distance = camera.position.distanceTo(target);
  controls.minDistance = distance * 0.6;
  controls.maxDistance = distance * 1.15;
  controls.update();

  let dirty = true;
  let selected = "";
  let frame = 0;
  const point = new THREE.Vector3();
  const anchors = () => {
    const rect = canvas.getBoundingClientRect();
    return stations
      .filter((s) => s.id)
      .map((s) => {
        point.set(s.x, 2.05, s.z);
        point.project(camera);
        return {
          id: s.id,
          x: ((point.x + 1) / 2) * rect.width,
          y: ((1 - point.y) / 2) * rect.height,
          visible: point.z < 1,
        };
      });
  };
  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (controls.update()) dirty = true;
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
    input.onAnchors(anchors());
  };
  const changed = () => {
    dirty = true;
  };
  controls.addEventListener("change", changed);

  function update(chairs: SceneChair[], waiting: number) {
    stations.forEach((station, i) => {
      const chair = chairs[i];
      station.id = chair?.id || "";
      station.group.visible = !!chair;
      const state = chair?.state || "off";
      const ring = station.ring.material as THREE.MeshBasicMaterial;
      ring.color.setHex(tones[state]);
      station.ring.visible = !!chair;
      station.ring.scale.setScalar(chair && chair.id === selected ? 1.18 : 1);
      station.service.visible = state === "busy" || state === "late";
    });
    guests.clear();
    for (let i = 0; i < Math.min(3, waiting); i++)
      guests.add(at(makeGuest(), -1.36 + i * 0.76, 0, D / 2 - 1.25));
    dirty = true;
  }
  function select(id: string) {
    selected = id;
    stations.forEach((s) =>
      s.ring.scale.setScalar(s.id && s.id === selected ? 1.18 : 1),
    );
    dirty = true;
  }
  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  // A click (not a drag) on a chair selects it.
  const ray = new THREE.Raycaster();
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = ray.intersectObjects(chairsRoot.children, true)[0];
    let node: THREE.Object3D | null = hit?.object || null;
    while (node && node.userData.station === undefined) node = node.parent;
    const station = node ? stations[node.userData.station as number] : null;
    if (station?.id) input.onSelect(station.id);
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);

  update(input.chairs, input.waiting);
  resize();
  loop();

  return {
    update,
    select,
    resize,
    dispose() {
      cancelAnimationFrame(frame);
      controls.removeEventListener("change", changed);
      controls.dispose();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material & { map?: THREE.Texture };
          if (!Object.values(mat).includes(m as THREE.MeshStandardMaterial)) {
            m.map?.dispose();
            m.dispose();
          }
        }
      });
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
