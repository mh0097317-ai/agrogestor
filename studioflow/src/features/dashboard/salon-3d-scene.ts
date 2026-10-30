import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ChairState } from "./salon-model";

/** What the 3D room needs to know about each chair. */
export interface SceneChair {
  id: string;
  state: ChairState;
}
/** Where an HTML label goes over the canvas, in canvas pixels. */
export interface Anchor {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}
export type SalonArea = "reception" | "waiting";
export interface SalonScene {
  update(chairs: SceneChair[], waiting: number): void;
  /** Highlights a chair; with focus the camera glides to it. */
  select(id: string, focus?: boolean): void;
  resetCamera(): void;
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

/** Small seeded random, so the textures look the same on every visit. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Everything the scene creates goes through here, so geometry is shared
 * between identical parts and all of it is released on dispose.
 */
function makeKit() {
  const geometries = new Map<string, THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const geo = <G extends THREE.BufferGeometry>(key: string, make: () => G) => {
    let g = geometries.get(key);
    if (!g) {
      g = make();
      geometries.set(key, g);
    }
    return g as G;
  };
  const material = <M extends THREE.Material>(m: M) => {
    materials.add(m);
    return m;
  };
  const texture = <T extends THREE.Texture>(t: T) => {
    textures.add(t);
    return t;
  };
  const canvasTexture = (
    w: number,
    h: number,
    draw: (g: CanvasRenderingContext2D) => void,
    color = true,
  ) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!);
    const t = texture(new THREE.CanvasTexture(c));
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = shadow;
    o.receiveShadow = true;
    return o;
  };
  const box = (w: number, h: number, d: number, m: THREE.Material) =>
    mesh(
      geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
      m,
    );
  const rbox = (w: number, h: number, d: number, m: THREE.Material, r = 0.03) =>
    mesh(
      geo(
        `r${w},${h},${d},${r}`,
        () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)),
      ),
      m,
    );
  const cyl = (
    rt: number,
    rb: number,
    h: number,
    m: THREE.Material,
    seg = 24,
  ) =>
    mesh(
      geo(
        `c${rt},${rb},${h},${seg}`,
        () => new THREE.CylinderGeometry(rt, rb, h, seg),
      ),
      m,
    );
  const ball = (r: number, m: THREE.Material, seg = 20) =>
    mesh(
      geo(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, seg * 0.75)),
      m,
    );
  const dome = (r: number, m: THREE.Material) =>
    mesh(
      geo(
        `d${r}`,
        () => new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 1.9),
      ),
      m,
    );
  const capsule = (r: number, length: number, m: THREE.Material) =>
    mesh(
      geo(
        `p${r},${length}`,
        () => new THREE.CapsuleGeometry(r, length, 6, 14),
      ),
      m,
    );
  return {
    geo,
    material,
    texture,
    canvasTexture,
    mesh,
    box,
    rbox,
    cyl,
    ball,
    dome,
    capsule,
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
type Kit = ReturnType<typeof makeKit>;

const at = <T extends THREE.Object3D>(
  o: T,
  x: number,
  y: number,
  z: number,
) => {
  o.position.set(x, y, z);
  return o;
};

/** Polished porcelain floor: large warm tiles with faint veins. */
function floorMap(k: Kit) {
  return k.canvasTexture(1024, 1024, (g) => {
    const rand = seeded(7);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const tone = 196 + Math.floor(rand() * 12);
        g.fillStyle = `rgb(${tone}, ${tone - 12}, ${tone - 30})`;
        g.fillRect(i * 512, j * 512, 512, 512);
        for (let n = 0; n < 260; n++) {
          g.fillStyle = `rgba(${rand() > 0.5 ? "255,248,236" : "120,100,80"},${0.03 + rand() * 0.04})`;
          const r = 8 + rand() * 40;
          g.beginPath();
          g.arc(i * 512 + rand() * 512, j * 512 + rand() * 512, r, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = "rgba(255, 250, 240, 0.22)";
        g.lineWidth = 1.4;
        for (let v = 0; v < 3; v++) {
          g.beginPath();
          let x = i * 512 + rand() * 512;
          let y = j * 512;
          g.moveTo(x, y);
          while (y < j * 512 + 512) {
            x += (rand() - 0.5) * 50;
            y += 20 + rand() * 30;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      }
    g.fillStyle = "#8f7f68";
    g.fillRect(0, 0, 1024, 3);
    g.fillRect(0, 511, 1024, 3);
    g.fillRect(0, 0, 3, 1024);
    g.fillRect(511, 0, 3, 1024);
  });
}
/** Vertical wood slats for the walls. */
function slatMap(k: Kit) {
  return k.canvasTexture(512, 512, (g) => {
    const rand = seeded(3);
    g.fillStyle = "#120e0b";
    g.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 32) {
      const base = 38 + Math.floor(rand() * 14);
      g.fillStyle = `rgb(${base + 14}, ${base}, ${base - 12})`;
      g.fillRect(x + 4, 0, 24, 512);
      for (let n = 0; n < 10; n++) {
        g.fillStyle = `rgba(0,0,0,${0.06 + rand() * 0.08})`;
        g.fillRect(x + 4 + rand() * 22, 0, 1 + rand() * 2, 512);
      }
    }
  });
}
/** Dark wood grain for cabinets. */
function grainMap(k: Kit) {
  return k.canvasTexture(512, 256, (g) => {
    const rand = seeded(11);
    g.fillStyle = "#3b2a1e";
    g.fillRect(0, 0, 512, 256);
    for (let n = 0; n < 90; n++) {
      g.strokeStyle = `rgba(${rand() > 0.5 ? "20,12,8" : "90,64,44"},${0.25 + rand() * 0.3})`;
      g.lineWidth = 0.6 + rand() * 1.8;
      g.beginPath();
      const y = rand() * 256;
      g.moveTo(0, y);
      g.bezierCurveTo(170, y + (rand() - 0.5) * 18, 340, y + (rand() - 0.5) * 18, 512, y);
      g.stroke();
    }
  });
}
/** Black marble with warm veins, for counter tops and the logo wall. */
function marbleMap(k: Kit, seed: number) {
  return k.canvasTexture(512, 512, (g) => {
    const rand = seeded(seed);
    g.fillStyle = "#151311";
    g.fillRect(0, 0, 512, 512);
    for (let v = 0; v < 9; v++) {
      g.strokeStyle = `rgba(${rand() > 0.4 ? "214,190,150" : "245,240,230"},${0.18 + rand() * 0.3})`;
      g.lineWidth = 0.6 + rand() * 1.6;
      g.beginPath();
      let x = rand() * 512;
      let y = 0;
      g.moveTo(x, y);
      while (y < 512) {
        x += (rand() - 0.45) * 60;
        y += 14 + rand() * 26;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}
/** Soft round glow, for halos behind mirrors and under the chairs. */
function haloMap(k: Kit) {
  return k.canvasTexture(128, 128, (g) => {
    const gradient = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.45, "rgba(255,255,255,0.35)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 128, 128);
  });
}
/** The shop's sign: name, category and a small scissors mark, in gold. */
function signMap(k: Kit, name: string, category: string) {
  return k.canvasTexture(1024, 1024, (g) => {
    g.clearRect(0, 0, 1024, 1024);
    const serif =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--serif")
        .trim() || "Georgia, serif";
    g.strokeStyle = g.fillStyle = "#e2c28a";
    g.lineWidth = 14;
    g.lineCap = "round";
    // Scissors
    g.beginPath();
    g.arc(430, 300, 46, 0, Math.PI * 2);
    g.moveTo(640, 300);
    g.arc(594, 300, 46, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(462, 268);
    g.lineTo(640, 110);
    g.moveTo(562, 268);
    g.lineTo(384, 110);
    g.stroke();
    g.textAlign = "center";
    g.textBaseline = "middle";
    const label = name.toUpperCase();
    let size = 140;
    g.font = `400 ${size}px ${serif}`;
    while (g.measureText(label).width > 900 && size > 48) {
      size -= 6;
      g.font = `400 ${size}px ${serif}`;
    }
    g.fillText(label, 512, 520);
    g.fillRect(392, 620, 240, 4);
    g.font = `600 44px sans-serif`;
    g.fillText(
      (category || "Barbearia").toUpperCase().split("").join(" "),
      512,
      690,
    );
  });
}

function makeMaterials(k: Kit, maps: ReturnType<typeof makeMaps>) {
  const std = (p: THREE.MeshStandardMaterialParameters) =>
    k.material(new THREE.MeshStandardMaterial(p));
  const phys = (p: THREE.MeshPhysicalMaterialParameters) =>
    k.material(new THREE.MeshPhysicalMaterial(p));
  const glow = (color: number, intensity: number) =>
    std({ color, emissive: color, emissiveIntensity: intensity });
  return {
    leather: phys({
      color: 0x161210,
      roughness: 0.42,
      clearcoat: 0.5,
      clearcoatRoughness: 0.35,
    }),
    sofa: phys({
      color: 0x6a3a22,
      roughness: 0.48,
      clearcoat: 0.45,
      clearcoatRoughness: 0.4,
    }),
    brass: std({ color: 0xc19a5b, roughness: 0.26, metalness: 1 }),
    chrome: std({ color: 0xe1ded8, roughness: 0.14, metalness: 1 }),
    black: std({ color: 0x0f0d0c, roughness: 0.5, metalness: 0.2 }),
    wood: std({ map: maps.grain, roughness: 0.5 }),
    woodDark: std({ color: 0x211812, roughness: 0.55 }),
    slats: std({ map: maps.slats, roughness: 0.62 }),
    marble: phys({
      map: maps.marble,
      roughness: 0.16,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
    }),
    marbleWall: std({ map: maps.marbleWall, roughness: 0.3 }),
    rug: std({ color: 0x2b2420, roughness: 0.95 }),
    rugEdge: std({ color: 0x5a4632, roughness: 0.9 }),
    cape: std({ color: 0x23201d, roughness: 0.78 }),
    apron: std({ color: 0x141110, roughness: 0.75 }),
    shoe: std({ color: 0x120f0d, roughness: 0.35 }),
    pants: std({ color: 0x1f2024, roughness: 0.8 }),
    shirts: [0xefe8dc, 0x4d5d6c, 0x6c6648, 0x8a4630, 0x2d3a33].map((color) =>
      std({ color, roughness: 0.82 }),
    ),
    skins: [0xc99a78, 0x8d5f43, 0xe2b996, 0x6a4330, 0xb0805e].map((color) =>
      std({ color, roughness: 0.6 }),
    ),
    hair: std({ color: 0x15100c, roughness: 0.85 }),
    pot: std({ color: 0x121110, roughness: 0.3, metalness: 0.1 }),
    soil: std({ color: 0x2a1f17, roughness: 1 }),
    leaf: std({ color: 0x35602f, roughness: 0.55, side: THREE.DoubleSide }),
    leafLight: std({ color: 0x5b8b47, roughness: 0.55, side: THREE.DoubleSide }),
    mirror: std({
      color: 0xb8c4c1,
      roughness: 0.03,
      metalness: 1,
      envMapIntensity: 1.6,
    }),
    led: glow(0xffc98a, 2.6),
    ledSoft: glow(0xffb866, 1.1),
    screen: glow(0x8fb8e0, 0.9),
    phone: glow(0xcfe3ff, 0.8),
    bottleAmber: std({ color: 0x8a4c18, roughness: 0.12, metalness: 0.3 }),
    slab: std({ color: 0x241c16, roughness: 0.7 }),
    cap: std({ color: 0x3a2e24, roughness: 0.6 }),
    sign: std({
      map: maps.sign,
      emissiveMap: maps.sign,
      emissive: 0xffd9a0,
      emissiveIntensity: 1.3,
      transparent: true,
      roughness: 0.4,
    }),
  };
}
type Materials = ReturnType<typeof makeMaterials>;

function makeMaps(k: Kit, name: string, category: string) {
  return {
    floor: floorMap(k),
    slats: slatMap(k),
    grain: grainMap(k),
    marble: marbleMap(k, 5),
    marbleWall: marbleMap(k, 9),
    halo: haloMap(k),
    sign: signMap(k, name, category),
  };
}

/** A mirror outline: straight sides with a round top. */
function arch(w: number, h: number) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, -h / 2);
  s.lineTo(r, -h / 2);
  s.lineTo(r, h / 2 - r);
  s.absarc(0, h / 2 - r, r, 0, Math.PI, false);
  s.lineTo(-r, -h / 2);
  return s;
}

/** A barber chair facing the mirror (-z). */
function makeChair(k: Kit, m: Materials) {
  const g = new THREE.Group();
  const base = k.mesh(
    k.geo(
      "chairBase",
      () =>
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0.34, 0),
            new THREE.Vector2(0.35, 0.02),
            new THREE.Vector2(0.3, 0.06),
            new THREE.Vector2(0.09, 0.09),
            new THREE.Vector2(0.065, 0.12),
            new THREE.Vector2(0, 0.12),
          ],
          40,
        ),
    ),
    m.chrome,
  );
  g.add(base);
  g.add(at(k.cyl(0.055, 0.065, 0.34, m.chrome), 0, 0.28, 0));
  g.add(at(k.rbox(0.1, 0.03, 0.18, m.black, 0.01), 0.22, 0.1, 0.12));
  g.add(at(k.box(0.5, 0.04, 0.5, m.chrome), 0, 0.47, 0));
  g.add(at(k.rbox(0.62, 0.15, 0.58, m.leather, 0.06), 0, 0.57, 0));
  const back = k.rbox(0.58, 0.74, 0.13, m.leather, 0.06);
  back.rotation.x = 0.12;
  g.add(at(back, 0, 1.02, 0.3));
  g.add(at(k.box(0.5, 0.025, 0.02, m.brass), 0, 1.3, 0.4));
  g.add(at(k.cyl(0.018, 0.018, 0.16, m.chrome, 12), 0, 1.44, 0.39));
  g.add(at(k.rbox(0.3, 0.16, 0.11, m.leather, 0.05), 0, 1.56, 0.39));
  for (const side of [-1, 1]) {
    g.add(at(k.rbox(0.09, 0.07, 0.54, m.leather, 0.03), side * 0.37, 0.8, 0.03));
    g.add(at(k.cyl(0.016, 0.016, 0.2, m.chrome, 10), side * 0.37, 0.67, -0.18));
    g.add(at(k.cyl(0.016, 0.016, 0.2, m.chrome, 10), side * 0.37, 0.67, 0.2));
    g.add(at(k.cyl(0.03, 0.03, 0.07, m.brass, 16), side * 0.37, 0.8, -0.26));
  }
  const rest = k.rbox(0.44, 0.03, 0.2, m.chrome, 0.012);
  g.add(at(rest, 0, 0.22, -0.46));
  const stem = k.cyl(0.018, 0.018, 0.36, m.chrome, 10);
  stem.rotation.x = -0.9;
  g.add(at(stem, 0, 0.36, -0.32));
  return g;
}

interface Person {
  root: THREE.Group;
  arm: THREE.Group;
  elbow: THREE.Group;
  other: THREE.Group;
  phase: number;
}
/** A simple, well-proportioned person facing -z. */
function makePerson(
  k: Kit,
  m: Materials,
  look: { skin: number; shirt: number; apron?: boolean },
  pose: "stand" | "sit",
): Person {
  const root = new THREE.Group();
  const skin = m.skins[look.skin % m.skins.length];
  const shirt = m.shirts[look.shirt % m.shirts.length];
  const sit = pose === "sit";
  if (!sit) {
    for (const side of [-1, 1]) {
      root.add(at(k.rbox(0.11, 0.08, 0.26, m.shoe, 0.035), side * 0.1, 0.04, -0.03));
      root.add(at(k.capsule(0.068, 0.7, m.pants), side * 0.1, 0.46, 0));
    }
    root.add(at(k.rbox(0.32, 0.2, 0.2, m.pants, 0.07), 0, 0.88, 0));
  } else {
    root.add(at(k.rbox(0.34, 0.14, 0.44, m.pants, 0.06), 0, 0.5, -0.14));
    for (const side of [-1, 1]) {
      root.add(at(k.capsule(0.06, 0.3, m.pants), side * 0.09, 0.27, -0.36));
      root.add(at(k.rbox(0.1, 0.07, 0.24, m.shoe, 0.03), side * 0.09, 0.035, -0.42));
    }
  }
  const hip = sit ? 0.56 : 0.88;
  const torso = k.capsule(0.155, 0.34, shirt);
  torso.scale.set(1.14, 1, 0.74);
  if (sit) torso.rotation.x = 0.1;
  root.add(at(torso, 0, hip + 0.32, sit ? 0.03 : 0));
  if (look.apron) {
    root.add(at(k.rbox(0.35, 0.72, 0.035, m.apron, 0.015), 0, hip + 0.14, -0.115));
    root.add(at(k.box(0.36, 0.025, 0.2, m.apron), 0, hip + 0.04, 0));
  }
  const shoulders = hip + 0.52;
  root.add(at(k.cyl(0.048, 0.054, 0.1, skin, 14), 0, shoulders + 0.08, 0));
  const head = k.ball(0.108, skin);
  head.scale.set(1, 1.12, 1.04);
  root.add(at(head, 0, shoulders + 0.22, -0.01));
  const hair = k.dome(0.114, m.hair);
  hair.scale.set(1, 1.05, 1.08);
  root.add(at(hair, 0, shoulders + 0.245, 0.012));
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.215, shoulders - 0.02, 0);
    arm.rotation.z = side * 0.07;
    arm.add(at(k.capsule(0.048, 0.22, shirt), 0, -0.14, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    elbow.add(at(k.capsule(0.041, 0.2, skin), 0, -0.12, 0));
    elbow.add(at(k.ball(0.045, skin, 12), 0, -0.26, 0));
    arm.add(elbow);
    root.add(arm);
    return { arm, elbow };
  });
  return {
    root,
    arm: arms[1].arm,
    elbow: arms[1].elbow,
    other: arms[0].arm,
    phase: Math.random() * Math.PI * 2,
  };
}

/** Customer under the cape, sitting in the barber chair. */
function makeCustomer(k: Kit, m: Materials, skin: number) {
  const g = new THREE.Group();
  const cape = k.mesh(
    k.geo(
      "cape",
      () =>
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0.001, 0),
            new THREE.Vector2(0.38, 0),
            new THREE.Vector2(0.4, 0.06),
            new THREE.Vector2(0.36, 0.3),
            new THREE.Vector2(0.27, 0.58),
            new THREE.Vector2(0.12, 0.74),
            new THREE.Vector2(0.055, 0.78),
          ],
          32,
        ),
    ),
    m.cape,
  );
  cape.scale.set(1, 1, 0.85);
  g.add(at(cape, 0, 0.62, 0.05));
  g.add(at(k.rbox(0.38, 0.12, 0.4, m.cape, 0.05), 0, 0.72, -0.24));
  for (const side of [-1, 1]) {
    const shin = k.capsule(0.055, 0.3, m.pants);
    shin.rotation.x = 0.35;
    g.add(at(shin, side * 0.09, 0.44, -0.44));
    g.add(at(k.rbox(0.1, 0.07, 0.22, m.shoe, 0.03), side * 0.09, 0.27, -0.53));
  }
  const tone = m.skins[skin % m.skins.length];
  g.add(at(k.cyl(0.046, 0.05, 0.1, tone, 14), 0, 1.42, 0.05));
  const head = k.ball(0.104, tone);
  head.scale.set(1, 1.12, 1.04);
  g.add(at(head, 0, 1.55, 0.04));
  const hair = k.dome(0.11, m.hair);
  g.add(at(hair, 0, 1.58, 0.06));
  return g;
}

/** A mirror station on the back wall: cabinet, marble top, lit arched mirror. */
function makeStation(k: Kit, m: Materials, maps: ReturnType<typeof makeMaps>) {
  const g = new THREE.Group();
  g.add(at(k.box(1.36, 0.08, 0.44, m.black), 0, 0.04, 0.24));
  g.add(at(k.box(1.36, 0.76, 0.48, m.wood), 0, 0.46, 0.25));
  for (const side of [-1, 1]) {
    g.add(at(k.rbox(0.6, 0.3, 0.025, m.woodDark, 0.01), side * 0.33, 0.62, 0.5));
    g.add(at(k.rbox(0.6, 0.3, 0.025, m.woodDark, 0.01), side * 0.33, 0.28, 0.5));
    g.add(at(k.box(0.2, 0.018, 0.02, m.brass), side * 0.33, 0.7, 0.52));
    g.add(at(k.box(0.2, 0.018, 0.02, m.brass), side * 0.33, 0.36, 0.52));
  }
  g.add(at(k.rbox(1.42, 0.05, 0.54, m.marble, 0.012), 0, 0.865, 0.26));
  // Grooming products and a dryer on the counter
  const bottles: [number, THREE.Material, number][] = [
    [-0.5, m.bottleAmber, 0.18],
    [-0.4, m.black, 0.22],
    [-0.31, m.brass, 0.14],
    [0.46, m.bottleAmber, 0.16],
  ];
  for (const [x, mat, h] of bottles) {
    g.add(at(k.cyl(0.035, 0.035, h, mat, 14), x, 0.89 + h / 2, 0.2));
    g.add(at(k.cyl(0.015, 0.015, 0.04, m.black, 8), x, 0.91 + h, 0.2));
  }
  g.add(at(k.rbox(0.2, 0.06, 0.12, m.black, 0.02), 0.28, 0.92, 0.26));
  // Backlight, brass frame and the mirror
  const w = 0.96;
  const h = 1.36;
  const halo = new THREE.Mesh(
    k.geo("haloPlane", () => new THREE.PlaneGeometry(1.9, 2.3)),
    k.material(
      new THREE.MeshBasicMaterial({
        map: maps.halo,
        color: 0xffb768,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  g.add(at(halo, 0, 1.8, 0.012));
  g.add(
    at(
      k.mesh(
        k.geo("mirrorLed", () => new THREE.ShapeGeometry(arch(w + 0.2, h + 0.2), 24)),
        m.led,
        false,
      ),
      0,
      1.8,
      0.02,
    ),
  );
  const frameShape = arch(w + 0.09, h + 0.09);
  frameShape.holes.push(arch(w, h));
  g.add(
    at(
      k.mesh(
        k.geo(
          "mirrorFrame",
          () =>
            new THREE.ExtrudeGeometry(frameShape, {
              depth: 0.03,
              bevelEnabled: true,
              bevelThickness: 0.01,
              bevelSize: 0.008,
              bevelSegments: 2,
              curveSegments: 24,
            }),
        ),
        m.brass,
      ),
      0,
      1.8,
      0.04,
    ),
  );
  g.add(
    at(
      k.mesh(
        k.geo("mirrorGlass", () => new THREE.ShapeGeometry(arch(w, h), 24)),
        m.mirror,
        false,
      ),
      0,
      1.8,
      0.05,
    ),
  );
  return g;
}

function makePlant(k: Kit, m: Materials, scale = 1, seed = 1) {
  const rand = seeded(seed);
  const g = new THREE.Group();
  g.add(at(k.cyl(0.2, 0.15, 0.46, m.pot, 28), 0, 0.23, 0));
  g.add(at(k.cyl(0.18, 0.18, 0.02, m.soil, 20), 0, 0.45, 0));
  const leafGeo = k.geo("leaf", () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.13, 0.25, 0, 0.62);
    s.quadraticCurveTo(-0.13, 0.25, 0, 0);
    const geometry = new THREE.ShapeGeometry(s, 8);
    // Bend each leaf a little so it catches the light.
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setZ(i, y * y * 0.35);
    }
    geometry.computeVertexNormals();
    return geometry;
  });
  for (let i = 0; i < 14; i++) {
    const leaf = k.mesh(leafGeo, rand() > 0.45 ? m.leaf : m.leafLight);
    const a = (i / 14) * Math.PI * 2 + rand() * 0.4;
    const lift = 0.25 + rand() * 0.75;
    leaf.position.set(0, 0.45 + rand() * 0.18, 0);
    leaf.rotation.set(0, a, 0);
    leaf.rotateX(-lift);
    leaf.scale.setScalar(0.8 + rand() * 0.7);
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}

/** Chesterfield sofa facing -z, three seats. */
function makeSofa(k: Kit, m: Materials) {
  const g = new THREE.Group();
  g.add(at(k.rbox(2.3, 0.3, 0.86, m.sofa, 0.08), 0, 0.27, 0));
  g.add(at(k.rbox(2.3, 0.58, 0.24, m.sofa, 0.1), 0, 0.65, 0.33));
  for (const side of [-1, 1]) {
    g.add(at(k.rbox(0.24, 0.5, 0.92, m.sofa, 0.1), side * 1.18, 0.4, 0));
    g.add(at(k.cyl(0.13, 0.13, 0.92, m.sofa, 20), side * 1.18, 0.66, 0).rotateX(Math.PI / 2));
  }
  for (let i = -1; i <= 1; i++)
    g.add(at(k.rbox(0.72, 0.12, 0.68, m.sofa, 0.05), i * 0.73, 0.48, -0.06));
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 2; j++)
      g.add(at(k.ball(0.014, m.black, 8), -0.96 + i * 0.24, 0.62 + j * 0.16, 0.205));
  for (const x of [-1.1, 1.1])
    for (const z of [-0.35, 0.35])
      g.add(at(k.cyl(0.03, 0.02, 0.1, m.brass, 10), x, 0.05, z));
  return g;
}

/** Leather armchair facing -z. */
function makeArmchair(k: Kit, m: Materials) {
  const g = new THREE.Group();
  g.add(at(k.rbox(0.82, 0.3, 0.8, m.sofa, 0.08), 0, 0.26, 0));
  g.add(at(k.rbox(0.82, 0.5, 0.2, m.sofa, 0.09), 0, 0.62, 0.3));
  for (const side of [-1, 1])
    g.add(at(k.rbox(0.18, 0.46, 0.8, m.sofa, 0.08), side * 0.38, 0.4, 0));
  g.add(at(k.rbox(0.5, 0.1, 0.6, m.sofa, 0.04), 0, 0.45, -0.06));
  for (const x of [-0.34, 0.34])
    for (const z of [-0.32, 0.32])
      g.add(at(k.cyl(0.025, 0.018, 0.1, m.brass, 10), x, 0.05, z));
  return g;
}
/** Floor lamp with a warm lit shade. */
function makeLamp(k: Kit, m: Materials) {
  const g = new THREE.Group();
  g.add(at(k.cyl(0.16, 0.18, 0.03, m.black, 24), 0, 0.015, 0));
  g.add(at(k.cyl(0.014, 0.014, 1.5, m.brass, 10), 0, 0.77, 0));
  g.add(at(k.cyl(0.13, 0.22, 0.26, m.ledSoft, 28), 0, 1.6, 0));
  return g;
}

/** Someone waiting on the sofa, looking at the phone. */
function makeGuest(k: Kit, m: Materials, look: number) {
  const p = makePerson(k, m, { skin: look + 1, shirt: look + 2 }, "sit");
  for (const arm of [p.arm, p.other]) {
    arm.rotation.x = 0.35;
    arm.children[1].rotation.x = 1.25;
  }
  const phone = k.rbox(0.08, 0.15, 0.012, m.phone, 0.006);
  phone.rotation.x = -0.9;
  p.root.add(at(phone, 0, 0.84, -0.27));
  return p;
}

/**
 * The live salon as a real 3D room: mirror stations along the back wall, the
 * reception and the shop's sign on the right, the waiting area in front.
 * It renders only when something moves, pauses when it is not on screen and
 * keeps the people moving gently unless the visitor asked for less motion.
 */
export function createSalonScene(input: {
  canvas: HTMLCanvasElement;
  shopName: string;
  category: string;
  chairs: SceneChair[];
  waiting: number;
  onSelect: (id: string) => void;
  onArea: (area: SalonArea) => void;
  onAnchors: (anchors: Anchor[]) => void;
  onFailure: () => void;
}): SalonScene {
  const { canvas } = input;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const k = makeKit();
  const maps = makeMaps(k, input.shopName, input.category);
  const m = makeMaterials(k, maps);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.42;

  const count = Math.max(1, Math.min(8, input.chairs.length));
  const W = Math.max(9.5, count * 1.85 + 5);
  const D = 5.8;
  const H = 3;

  // Room shell, cut away like a model on the table
  const floorTexture = maps.floor;
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(W / 2.4, D / 2.4);
  const floor = k.mesh(
    k.geo("floor", () => new THREE.PlaneGeometry(W, D)),
    k.material(
      new THREE.MeshStandardMaterial({
        map: floorTexture,
        roughness: 0.2,
        metalness: 0.05,
      }),
    ),
    false,
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(at(k.box(W + 0.18, 0.28, D + 0.18, m.slab), 0.09, -0.141, -0.09));
  maps.slats.wrapS = maps.slats.wrapT = THREE.RepeatWrapping;
  maps.slats.repeat.set(W / 1.6, 1.4);
  const back = k.box(W + 0.18, H, 0.18, m.slats);
  scene.add(at(back, 0.09, H / 2, -D / 2 - 0.09));
  const sideSlats = k.material(m.slats.clone());
  sideSlats.map = k.texture(maps.slats.clone());
  sideSlats.map.repeat.set(D / 1.6, 1.4);
  sideSlats.map.needsUpdate = true;
  scene.add(at(k.box(0.18, H, D, sideSlats), W / 2 + 0.09, H / 2, 0));
  scene.add(at(k.box(W + 0.2, 0.04, 0.2, m.cap), 0.1, H + 0.02, -D / 2 - 0.09));
  scene.add(at(k.box(0.2, 0.04, D, m.cap), W / 2 + 0.09, H + 0.02, 0));
  // Warm cove light along the top and a dark skirting
  scene.add(at(k.box(W, 0.03, 0.03, m.led), 0, H - 0.12, -D / 2 + 0.02));
  scene.add(at(k.box(0.03, 0.03, D, m.led), W / 2 - 0.02, H - 0.12, 0));
  scene.add(at(k.box(W, 0.1, 0.03, m.black), 0, 0.05, -D / 2 + 0.015));
  scene.add(at(k.box(0.03, 0.1, D, m.black), W / 2 - 0.015, 0.05, 0));

  // Stations along the back wall
  const left = -W / 2 + 1.25;
  const span = W - 1.25 - 4.2;
  const step = count > 1 ? span / (count - 1) : 0;
  const chairZ = -D / 2 + 1.5;
  interface Station {
    id: string;
    state: ChairState;
    x: number;
    chair: THREE.Group;
    ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    pool: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    customer: THREE.Group;
    barber: Person;
  }
  const stations: Station[] = [];
  const pickable: THREE.Object3D[] = [];
  for (let i = 0; i < count; i++) {
    const x = count > 1 ? left + step * i : left + span / 2;
    scene.add(at(makeStation(k, m, maps), x, 0, -D / 2));
    if (i < count - 1 || count === 1) {
      const between = count > 1 ? x + step / 2 : x + 1.1;
      scene.add(at(k.box(0.025, H - 0.5, 0.025, m.ledSoft), between, H / 2 - 0.05, -D / 2 + 0.015));
    }
    const lamp = new THREE.PointLight(0xffc98a, 2.6, 3.6, 2);
    lamp.position.set(x, 1.9, -D / 2 + 0.7);
    scene.add(lamp);
    const chair = makeChair(k, m);
    chair.position.set(x, 0, chairZ);
    chair.userData.station = i;
    scene.add(chair);
    pickable.push(chair);
    const ring = new THREE.Mesh(
      k.geo("ring", () => new THREE.RingGeometry(0.5, 0.57, 64)),
      k.material(
        new THREE.MeshBasicMaterial({
          color: tones.free,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
      ),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.01, chairZ);
    scene.add(ring);
    const pool = new THREE.Mesh(
      k.geo("pool", () => new THREE.PlaneGeometry(1.5, 1.5)),
      k.material(
        new THREE.MeshBasicMaterial({
          map: maps.halo,
          color: tones.free,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.008, chairZ);
    scene.add(pool);
    const customer = makeCustomer(k, m, i * 2 + 1);
    customer.position.copy(chair.position);
    customer.visible = false;
    scene.add(customer);
    const barber = makePerson(k, m, { skin: i, shirt: i, apron: true }, "stand");
    barber.root.visible = false;
    scene.add(barber.root);
    stations.push({
      id: "",
      state: "off",
      x,
      chair,
      ring,
      pool,
      customer,
      barber,
    });
  }

  // Reception against the right wall, with the lit logo wall behind it
  const deskX = W / 2 - 1.55;
  const deskZ = 0.15;
  const reception = new THREE.Group();
  reception.add(at(k.box(0.7, 0.98, 2.4, m.woodDark), 0, 0.49, 0));
  for (let i = 0; i < 15; i++)
    reception.add(at(k.box(0.03, 0.86, 0.09, m.wood), -0.36, 0.5, -1.12 + i * 0.16));
  reception.add(at(k.box(0.02, 0.02, 2.36, m.led), -0.37, 0.95, 0));
  reception.add(at(k.box(0.02, 0.02, 2.36, m.led), -0.35, 0.02, 0));
  reception.add(at(k.rbox(0.86, 0.05, 2.52, m.marble, 0.012), -0.04, 1.0, 0));
  reception.add(at(k.rbox(0.03, 0.34, 0.54, m.black, 0.01), 0.08, 1.32, -0.45));
  const screen = k.box(0.005, 0.3, 0.5, m.screen);
  reception.add(at(screen, 0.096, 1.32, -0.45));
  reception.add(at(k.cyl(0.02, 0.02, 0.12, m.chrome, 10), 0.12, 1.08, -0.45));
  reception.add(at(k.rbox(0.18, 0.012, 0.44, m.chrome, 0.004), 0.2, 1.03, -0.45));
  reception.add(at(makePlant(k, m, 0.42, 4), 0, 1.02, 0.9));
  reception.userData.area = "reception";
  reception.position.set(deskX, 0, deskZ);
  scene.add(reception);
  pickable.push(reception);
  const receptionist = makePerson(k, m, { skin: 2, shirt: 4 }, "stand");
  receptionist.root.rotation.y = Math.PI / 2;
  receptionist.root.position.set(deskX + 0.72, 0, deskZ - 0.3);
  receptionist.arm.rotation.x = 0.9;
  receptionist.other.rotation.x = 0.9;
  scene.add(receptionist.root);
  scene.add(at(k.box(0.05, 2.3, 2.8, m.marbleWall), W / 2 - 0.03, 1.4, deskZ));
  for (const z of [-1.42, 1.42])
    scene.add(at(k.box(0.03, 2.3, 0.03, m.led), W / 2 - 0.06, 1.4, deskZ + z));
  const sign = new THREE.Mesh(
    k.geo("sign", () => new THREE.PlaneGeometry(1.9, 1.9)),
    m.sign,
  );
  sign.rotation.y = -Math.PI / 2;
  sign.position.set(W / 2 - 0.06, 1.75, deskZ);
  scene.add(sign);
  const signLight = new THREE.PointLight(0xffc98a, 2.2, 3.2, 2);
  signLight.position.set(W / 2 - 0.8, 1.9, deskZ);
  scene.add(signLight);

  // Backlit product shelves in the back corner
  const shelfZ = -D / 2 + 1.25;
  scene.add(at(k.box(0.04, 2.0, 1.5, m.ledSoft), W / 2 - 0.02, 1.35, shelfZ));
  scene.add(at(k.box(0.3, 2.1, 0.05, m.woodDark), W / 2 - 0.15, 1.35, shelfZ - 0.78));
  scene.add(at(k.box(0.3, 2.1, 0.05, m.woodDark), W / 2 - 0.15, 1.35, shelfZ + 0.78));
  const productMats = [m.bottleAmber, m.black, m.brass, m.chrome];
  for (let s = 0; s < 4; s++) {
    const y = 0.55 + s * 0.48;
    scene.add(at(k.box(0.3, 0.035, 1.5, m.wood), W / 2 - 0.15, y, shelfZ));
    for (let i = 0; i < 6; i++) {
      const h = 0.12 + ((i + s) % 3) * 0.04;
      scene.add(
        at(
          k.cyl(0.04, 0.04, h, productMats[(i + s) % 4], 14),
          W / 2 - 0.17,
          y + 0.02 + h / 2,
          shelfZ - 0.6 + i * 0.24,
        ),
      );
    }
  }
  const shelfLight = new THREE.PointLight(0xffb866, 1.6, 2.6, 2);
  shelfLight.position.set(W / 2 - 0.7, 1.5, shelfZ);
  scene.add(shelfLight);

  // Waiting area: rug, chesterfield sofa, coffee table and a planter
  const cx = -0.5;
  const cz = D / 2 - 1.45;
  const waiting = new THREE.Group();
  waiting.userData.area = "waiting";
  waiting.add(at(k.box(3.3, 0.012, 2.5, m.rugEdge), 0, 0.006, 0));
  waiting.add(at(k.box(3.14, 0.014, 2.34, m.rug), 0, 0.008, 0));
  const sofa = makeSofa(k, m);
  sofa.rotation.y = Math.PI / 2;
  sofa.position.set(0.95, 0, 0);
  waiting.add(sofa);
  const table = new THREE.Group();
  table.add(at(k.cyl(0.46, 0.46, 0.04, m.marble, 40), 0, 0.42, 0));
  table.add(at(k.cyl(0.47, 0.47, 0.015, m.brass, 40), 0, 0.395, 0));
  table.add(at(k.cyl(0.04, 0.16, 0.38, m.black, 16), 0, 0.2, 0));
  table.add(at(k.rbox(0.28, 0.04, 0.2, m.cape, 0.008), -0.1, 0.46, 0.05));
  table.add(at(k.rbox(0.24, 0.035, 0.18, m.rugEdge, 0.008), -0.08, 0.497, 0.03));
  table.add(at(k.cyl(0.05, 0.04, 0.12, m.pot, 14), 0.18, 0.5, -0.12));
  table.position.set(-0.35, 0, 0);
  waiting.add(table);
  waiting.add(at(k.box(0.36, 0.42, 2.3, m.woodDark), 1.75, 0.21, 0));
  waiting.add(at(k.box(0.3, 0.02, 2.24, m.soil), 1.75, 0.42, 0));
  for (let i = 0; i < 4; i++)
    waiting.add(at(makePlant(k, m, 0.55, 20 + i), 1.75, 0.2, -0.85 + i * 0.57));
  const guests = [0, 1, 2].map((i) => {
    const p = makeGuest(k, m, i);
    p.root.rotation.y = Math.PI / 2;
    p.root.position.set(0.92, 0, -0.73 + i * 0.73);
    p.root.visible = false;
    waiting.add(p.root);
    return p;
  });
  waiting.position.set(cx, 0, cz);
  scene.add(waiting);
  pickable.push(waiting);

  // Lounge corner at the front left: two armchairs, side table and a lamp
  const lounge = new THREE.Group();
  for (const [z, turn] of [
    [-0.72, -0.45],
    [0.72, 0.45],
  ]) {
    const seat = makeArmchair(k, m);
    seat.rotation.y = -Math.PI / 2 + turn;
    lounge.add(at(seat, 0, 0, z));
  }
  lounge.add(at(k.cyl(0.24, 0.24, 0.03, m.marble, 32), 0.15, 0.5, 0));
  lounge.add(at(k.cyl(0.03, 0.14, 0.48, m.brass, 16), 0.15, 0.24, 0));
  lounge.add(at(k.cyl(0.06, 0.05, 0.1, m.pot, 14), 0.1, 0.57, 0.05));
  lounge.add(at(makeLamp(k, m), -0.45, 0, 1.15));
  lounge.position.set(-W / 2 + 1.05, 0, cz - 0.1);
  scene.add(lounge);
  // A product podium between the sofa and the reception
  const podium = new THREE.Group();
  podium.add(at(k.cyl(0.36, 0.38, 0.86, m.black, 32), 0, 0.43, 0));
  podium.add(at(k.cyl(0.4, 0.4, 0.04, m.brass, 32), 0, 0.88, 0));
  podium.add(at(k.box(0.025, 0.025, 0.01, m.led), 0, 0.6, -0.39));
  const goods = [m.bottleAmber, m.black, m.brass, m.chrome, m.bottleAmber];
  goods.forEach((mat, i) => {
    const a = (i / goods.length) * Math.PI * 2;
    const h = 0.14 + (i % 2) * 0.06;
    podium.add(at(k.cyl(0.045, 0.045, h, mat, 14), Math.cos(a) * 0.22, 0.9 + h / 2, Math.sin(a) * 0.22));
  });
  podium.add(at(k.cyl(0.05, 0.05, 0.26, m.chrome, 14), 0, 1.03, 0));
  const gap = deskX - 0.45 - (cx + 1.95);
  if (gap > 1) scene.add(at(podium, cx + 1.95 + gap / 2, 0, cz + 0.55));

  scene.add(at(makePlant(k, m, 1.5, 2), -W / 2 + 0.5, 0, -D / 2 + 0.55));
  scene.add(at(makePlant(k, m, 1.3, 3), W / 2 - 0.55, 0, D / 2 - 0.6));

  // Light: a soft sky, one sun for the shadows, warm lamps at each mirror
  scene.add(new THREE.HemisphereLight(0xfff1de, 0x2c2219, 0.75));
  const sun = new THREE.DirectionalLight(0xffe6c4, 1.7);
  sun.position.set(-W * 0.3, 10, D * 0.85);
  sun.castShadow = true;
  const touch = matchMedia("(pointer: coarse)").matches;
  sun.shadow.mapSize.setScalar(touch ? 1024 : 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  const shadow = sun.shadow.camera;
  shadow.left = -W / 2 - 1;
  shadow.right = W / 2 + 1;
  shadow.top = D / 2 + 1.5;
  shadow.bottom = -D / 2 - 1.5;
  shadow.near = 1;
  shadow.far = 30;
  scene.add(sun);

  // Camera from the front left, looking into the back right corner
  const point = new THREE.Vector3();
  const camera = new THREE.PerspectiveCamera(30, 1.5, 0.1, 100);
  const home = new THREE.Vector3(0.1, 0.7, -0.1);
  const view = new THREE.Vector3(-0.4, 0.62, 0.68).normalize();
  const homePosition = home.clone().addScaledVector(view, 16);
  camera.position.copy(homePosition);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(home);
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = 1.18;
  const azimuth = controls.getAzimuthalAngle();
  controls.minAzimuthAngle = azimuth - 0.6;
  controls.maxAzimuthAngle = azimuth + 0.5;
  // The whole model, slab included, fits the frame at any width.
  const corners = [-1, 1].flatMap((sx) =>
    [-0.28, H].flatMap((y) =>
      [-1, 1].map(
        (sz) => new THREE.Vector3((sx * (W + 0.36)) / 2, y, (sz * (D + 0.36)) / 2),
      ),
    ),
  );
  // Room above the back wall for the chair labels, when they sit there.
  const labelRoom = new THREE.Vector3(-W / 2, H + 1.1, -D / 2);
  const fit = () => {
    let d = homePosition.distanceTo(home);
    for (let i = 0; i < 6; i++) {
      camera.position.copy(home).addScaledVector(view, d);
      camera.lookAt(home);
      camera.updateMatrixWorld();
      let edge = 0;
      for (const c of canvas.clientWidth < 560
        ? corners
        : [...corners, labelRoom]) {
        point.copy(c).project(camera);
        edge = Math.max(edge, Math.abs(point.x), Math.abs(point.y));
      }
      d *= edge / 0.94;
    }
    homePosition.copy(home).addScaledVector(view, d);
    controls.minDistance = d * 0.42;
    controls.maxDistance = d * 1.08;
  };
  // On touch screens a vertical swipe keeps scrolling the page; sideways
  // turns the room and two fingers zoom.
  canvas.style.touchAction = "pan-y";
  controls.update();

  let disposed = false;
  let onScreen = true;
  let frame = 0;
  let last = 0;
  let selected = "";
  let glide: { target: THREE.Vector3; position: THREE.Vector3 } | null = null;
  const tone = new THREE.Color();
  const workers = () =>
    !reduced &&
    (stations.some((s) => s.barber.root.visible) || receptionist.root.visible);

  const project = (id: string, x: number, y: number, z: number, w: number, h: number) => {
    point.set(x, y, z).project(camera);
    return {
      id,
      x: ((point.x + 1) / 2) * w,
      y: ((1 - point.y) / 2) * h,
      visible: point.z < 1,
    };
  };
  const anchors = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    return [
      ...stations
        .filter((s) => s.id)
        .map((s) =>
          // Narrow rooms: each small label right above its chair.
          w < 560
            ? project(s.id, s.x, 1.95, chairZ, w, h)
            : project(s.id, s.x, H + 0.12, -D / 2, w, h),
        ),
      project("reception", W / 2, H + 0.12, deskZ, w, h),
      project("waiting", cx - 1.2, 0.05, cz + 1.2, w, h),
    ];
  };

  const request = () => {
    if (disposed || frame || !onScreen || document.visibilityState === "hidden")
      return;
    frame = requestAnimationFrame(render);
  };
  function animate(time: number) {
    for (const s of stations) {
      const b = s.barber;
      if (!b.root.visible) continue;
      const t = time + b.phase;
      if (s.state === "busy" || s.state === "late") {
        // Working on the customer's hair: arm up, scissors snipping.
        b.arm.rotation.x = 1.15 + Math.sin(t * 0.9) * 0.12;
        b.elbow.rotation.x = 0.75 + Math.sin(t * 6.5) * 0.14;
        b.other.rotation.x = 0.7 + Math.sin(t * 0.7) * 0.08;
        b.root.rotation.y = b.root.userData.facing + Math.sin(t * 0.45) * 0.1;
      } else {
        b.arm.rotation.x = 0.05 + Math.sin(t * 0.8) * 0.03;
        b.elbow.rotation.x = 0.1;
        b.other.rotation.x = 0.05;
        b.root.rotation.y = b.root.userData.facing + Math.sin(t * 0.3) * 0.05;
      }
    }
    const typing = Math.sin(time * 9) * 0.05;
    receptionist.elbow.rotation.x = 0.55 + typing;
    receptionist.other.children[1].rotation.x = 0.55 - typing;
  }
  function render(now: number) {
    frame = 0;
    if (disposed) return;
    let moving = false;
    if (glide) {
      const delta = glide.target.clone().sub(controls.target);
      const step = glide.position.clone().sub(camera.position);
      if (delta.length() > 0.01 || step.length() > 0.01) {
        const f = reduced ? 1 : 0.12;
        controls.target.addScaledVector(delta, f);
        camera.position.addScaledVector(step, f);
        moving = true;
      } else glide = null;
    }
    for (const s of stations) {
      tone.setHex(tones[s.state]);
      const ring = s.ring.material.color;
      if (Math.abs(ring.r - tone.r) + Math.abs(ring.g - tone.g) + Math.abs(ring.b - tone.b) > 0.004) {
        ring.lerp(tone, reduced ? 1 : 0.16);
        s.pool.material.color.copy(ring);
        moving = true;
      }
    }
    const changed = controls.update();
    const live = workers();
    if (live) animate(now / 1000);
    // People move at 30 frames a second; the camera at full speed.
    if (live && !moving && !changed && now - last < 32) {
      request();
      return;
    }
    last = now;
    renderer.render(scene, camera);
    input.onAnchors(anchors());
    if (changed || moving || live) request();
  }
  controls.addEventListener("change", request);
  const cancelGlide = () => {
    glide = null;
  };
  controls.addEventListener("start", cancelGlide);

  function update(chairs: SceneChair[], waitingCount: number) {
    stations.forEach((s, i) => {
      const chair = chairs[i];
      s.id = chair?.id || "";
      s.state = chair?.state || "off";
      s.chair.visible = !!chair;
      s.ring.visible = s.pool.visible = !!chair;
      const working = s.state === "busy" || s.state === "late" || s.state === "due";
      s.customer.visible = working;
      const b = s.barber;
      b.root.visible = !!chair && (working || s.state === "free");
      if (working) {
        // Beside the chair, turned to the customer.
        b.root.position.set(s.x + 0.56, 0, chairZ + 0.14);
        b.root.userData.facing = Math.PI / 2 - 0.35;
      } else {
        // Waiting by the counter for the next customer.
        b.root.position.set(s.x - 0.62, 0, chairZ - 0.35);
        b.root.userData.facing = -Math.PI / 2 - 0.6;
      }
      b.root.rotation.y = b.root.userData.facing;
      b.arm.rotation.x = b.elbow.rotation.x = b.other.rotation.x = 0;
    });
    guests.forEach((g, i) => {
      g.root.visible = i < waitingCount;
    });
    applySelection();
    request();
  }
  function applySelection() {
    for (const s of stations) {
      const on = !!s.id && s.id === selected;
      s.ring.scale.setScalar(on ? 1.16 : 1);
      s.pool.material.opacity = on ? 0.7 : 0.3;
    }
  }
  function select(id: string, focus = false) {
    selected = id;
    applySelection();
    const s = stations.find((station) => station.id === id);
    if (focus && s) {
      const target = new THREE.Vector3(s.x, 0.9, chairZ).lerp(home, 0.35);
      glide = {
        target,
        position: target
          .clone()
          .add(homePosition.clone().sub(home).multiplyScalar(0.62)),
      };
    }
    request();
  }
  function resetCamera() {
    glide = { target: home.clone(), position: homePosition.clone() };
    request();
  }
  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    fit();
    glide = null;
    controls.target.copy(home);
    camera.position.copy(homePosition);
    controls.update();
    request();
  }

  // A click (not a drag) picks a chair, the reception or the waiting area.
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pick = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    let node: THREE.Object3D | null =
      ray.intersectObjects(pickable, true)[0]?.object || null;
    while (node && node.userData.station === undefined && !node.userData.area)
      node = node.parent;
    if (!node) return null;
    if (node.userData.area)
      return { kind: "area" as const, area: node.userData.area as SalonArea };
    const station = stations[node.userData.station as number];
    return station?.id ? { kind: "chair" as const, id: station.id } : null;
  };
  let down: { x: number; y: number } | null = null;
  let hoverAt = 0;
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    const start = down;
    down = null;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6)
      return;
    const hit = pick(e);
    if (hit?.kind === "chair") input.onSelect(hit.id);
    else if (hit?.kind === "area") input.onArea(hit.area);
  };
  const onCancel = () => {
    down = null;
  };
  const onMove = (e: PointerEvent) => {
    if (e.buttons || e.timeStamp - hoverAt < 60) return;
    hoverAt = e.timeStamp;
    canvas.style.cursor = pick(e) ? "pointer" : "";
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    input.onFailure();
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      cancelAnimationFrame(frame);
      frame = 0;
    } else request();
  };
  const observer = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) request();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  observer.observe(canvas);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("webglcontextlost", onLost);
  document.addEventListener("visibilitychange", onVisibility);

  update(input.chairs, input.waiting);
  resize();

  return {
    update,
    select,
    resetCamera,
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("webglcontextlost", onLost);
      controls.removeEventListener("change", request);
      controls.removeEventListener("start", cancelGlide);
      controls.dispose();
      k.dispose();
      sun.shadow.dispose();
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      scene.clear();
    },
  };
}
