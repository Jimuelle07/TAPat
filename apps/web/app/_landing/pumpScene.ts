// The hero's fuel-pump payment panel in three.js: pump display, keypad, receipt slot and a tap-to-pay reader, with the
// driver's card springing onto the reader glass. Loaded on demand by TapStage, so three.js never blocks the first paint.
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  VSMShadowMap,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";

export type SceneChoice = { id: string; amount: string; last4: string; approved: boolean; short: string };
export type SceneFonts = { serif: string; sans: string; mono: string };
export type PumpScene = {
  /** Plays a tap that started at `at` (a performance.now() time); `instant` jumps straight to the answer. */
  tap(choice: SceneChoice, instant: boolean, at?: number): void;
  dispose(): void;
};

const INK = "#1D3A2F";
const CREAM = "#F5E9D6";
const GLASS = "#0E1A15";
/** Seconds into a tap when the reader answers; matches TapStage's READ_MS. */
const ANSWER_AT = 1.1;

/** Damped spring from 0 to 1, the same shape as Remotion's spring(). */
function spring(t: number, damping: number, stiffness: number) {
  if (t <= 0) return 0;
  const w = Math.sqrt(stiffness);
  const z = damping / (2 * w);
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function slab(w: number, h: number, r: number, depth: number, material: Material) {
  const g = new ExtrudeGeometry(roundedRect(w, h, r), { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  return new Mesh(g, material);
}

function place<T extends Object3D>(o: T, x: number, y: number, z: number) {
  o.position.set(x, y, z);
  return o;
}

type Canvas2D = { c: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: CanvasTexture };

function canvasTexture(w: number, h: number): Canvas2D {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, g, tex };
}

export function createPumpScene(canvas: HTMLCanvasElement, first: SceneChoice, fonts: SceneFonts, reduced: boolean): PumpScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return null; // No WebGL: the stage keeps its keys and receipt, just without the 3D panel.
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;

  const scene = new Scene();
  const cam = new PerspectiveCamera(32, 1, 0.1, 50);
  cam.position.set(0, 0.3, 8.4);
  cam.lookAt(0, -0.2, 0);

  // Physical light units: the mock's legacy intensities times pi.
  scene.add(new HemisphereLight(0xfff8ec, 0x9c8f73, 0.85 * Math.PI));
  // Key light high and in front: the panel's shadow falls behind it, the card's lands on the reader and tightens as it nears.
  const key = new DirectionalLight(0xffffff, 0.85 * Math.PI);
  key.position.set(-1.2, 6.5, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  key.shadow.radius = 8;
  key.shadow.blurSamples = 20;
  key.shadow.bias = -0.0006;
  scene.add(key);
  const rim = new DirectionalLight(0xfbf5ea, 0.35 * Math.PI);
  rim.position.set(4, 2, -3);
  scene.add(rim);

  // An invisible floor that only takes shadow, so the page itself is the ground the panel stands on.
  const floor = new Mesh(new PlaneGeometry(14, 14), new ShadowMaterial({ opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.485;
  floor.receiveShadow = true;
  scene.add(floor);

  const rig = new Group();
  rig.position.set(-0.05, 0.05, 0);
  rig.rotation.y = -0.26;
  scene.add(rig);

  const dark = new MeshStandardMaterial({ color: 0x0e1a15, roughness: 0.14, metalness: 0.25 });
  const steel = new MeshStandardMaterial({ color: 0x8f8a7e, roughness: 0.3, metalness: 0.7 });
  // Printed surfaces take light and shadow like the metal around them; screens add a glow of their own.
  const decal = (w: number, h: number, t: Canvas2D, alpha = false, glow = false) =>
    new Mesh(
      new PlaneGeometry(w, h),
      new MeshLambertMaterial({ map: t.tex, transparent: alpha, emissive: glow ? 0xffffff : 0x000000, emissiveMap: glow ? t.tex : null, emissiveIntensity: glow ? 0.6 : 0 }),
    );

  rig.add(slab(3.8, 3.0, 0.16, 0.18, new MeshStandardMaterial({ color: 0xede2cc, roughness: 0.55, metalness: 0.15 })));
  const screwGeo = new CylinderGeometry(0.055, 0.055, 0.04, 20);
  for (const [x, y] of [[-1.75, 1.35], [1.75, 1.35], [-1.75, -1.35], [1.75, -1.35]]) {
    const screw = place(new Mesh(screwGeo, steel), x, y, 0.135);
    screw.rotation.x = Math.PI / 2;
    rig.add(screw);
  }

  const disp = canvasTexture(512, 220);
  rig.add(place(slab(1.2, 0.55, 0.06, 0.04, dark), -1.05, 0.95, 0.17));
  rig.add(place(decal(1.12, 0.48, disp, false, true), -1.05, 0.95, 0.223));

  rig.add(place(slab(1.2, 1.6, 0.08, 0.04, new MeshStandardMaterial({ color: 0x22302a, roughness: 0.6 })), -1.05, -0.25, 0.17));
  const keyGeo = new BoxGeometry(0.28, 0.2, 0.08);
  const keyMat = new MeshStandardMaterial({ color: 0xd3cab6, roughness: 0.32, metalness: 0.55 });
  for (const dx of [-0.34, 0, 0.34]) for (const dy of [0.51, 0.17, -0.17, -0.51]) rig.add(place(new Mesh(keyGeo, keyMat), -1.05 + dx, -0.25 + dy, 0.26));
  const legends = canvasTexture(512, 683);
  rig.add(place(decal(1.2, 1.6, legends, true), -1.05, -0.25, 0.302));

  rig.add(place(new Mesh(new BoxGeometry(1.0, 0.07, 0.06), dark), -1.05, -1.28, 0.12));

  rig.add(place(slab(1.7, 2.5, 0.14, 0.14, new MeshStandardMaterial({ color: 0x1d3a2f, roughness: 0.4, metalness: 0.1 })), 0.8, 0.05, 0.22));
  const bezel = canvasTexture(512, 768);
  rig.add(place(decal(1.6, 2.4, bezel), 0.8, 0.05, 0.322));
  rig.add(place(slab(1.22, 1.3, 0.1, 0.06, dark), 0.8, 0.12, 0.385));
  const face = canvasTexture(512, 546);
  rig.add(place(decal(1.1, 1.18, face, false, true), 0.8, 0.12, 0.448));

  rig.traverse((o) => {
    if (o instanceof Mesh) {
      o.receiveShadow = true;
      if (!(o.material as Material).transparent) o.castShadow = true;
    }
  });

  // Contact shadow where the panel's base meets the floor: darkest at the line of contact, gone within a hand's width.
  const ao = canvasTexture(256, 256);
  ao.g.setTransform(1, 0, 0, 0.25, 0, 96);
  const fall = ao.g.createRadialGradient(128, 128, 0, 128, 128, 128);
  fall.addColorStop(0, "rgba(14,26,21,0.75)");
  fall.addColorStop(0.35, "rgba(14,26,21,0.32)");
  fall.addColorStop(1, "rgba(14,26,21,0)");
  ao.g.fillStyle = fall;
  ao.g.fillRect(0, 0, 256, 256);
  const contact = new Mesh(new PlaneGeometry(4.6, 4.6), new MeshBasicMaterial({ map: ao.tex, transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  rig.add(place(contact, 0, -1.528, 0));

  const card = new Group();
  rig.add(card);
  card.add(slab(1.6, 1.0, 0.12, 0.02, new MeshStandardMaterial({ color: 0xf7eedd, roughness: 0.5 })));
  const cardFace = canvasTexture(512, 320);
  // ShapeGeometry UVs are in shape units; this maps the card's 1.6 x 1.0 onto the whole texture.
  cardFace.tex.repeat.set(1 / 1.6, 1);
  cardFace.tex.offset.set(0.5, 0.5);
  card.add(place(new Mesh(new ShapeGeometry(roundedRect(1.6, 1.0, 0.12), 12), new MeshStandardMaterial({ map: cardFace.tex, roughness: 0.5 })), 0, 0, 0.045));
  card.traverse((o) => {
    if (o instanceof Mesh) o.castShadow = true;
  });

  let choice = first;
  let tapAt: number | null = null;
  let shown = "";

  function drawStatic() {
    let g = cardFace.g;
    const grad = g.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, "#D6C8AB");
    grad.addColorStop(0.22, "#F2E9D6");
    grad.addColorStop(0.42, "#FBF5EA");
    grad.addColorStop(0.72, "#EEE3CD");
    grad.addColorStop(1, "#D2C3A6");
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = INK;
    g.strokeStyle = INK;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.font = `italic 800 96px ${fonts.serif}`;
    g.fillText("TAPat", 40, 150);
    g.lineWidth = 10;
    g.lineCap = "round";
    for (const r of [26, 50, 74]) {
      g.beginPath();
      g.arc(400, 104, r, -0.85, 0.85);
      g.stroke();
    }
    g.font = `500 34px ${fonts.mono}`;
    g.fillText(`•••• ${choice.last4}`, 40, 266);
    cardFace.tex.needsUpdate = true;

    g = disp.g;
    g.fillStyle = GLASS;
    g.fillRect(0, 0, 512, 220);
    g.fillStyle = CREAM;
    g.globalAlpha = 0.7;
    g.font = `600 26px ${fonts.sans}`;
    g.textAlign = "left";
    g.fillText("STATION A", 30, 50);
    g.textAlign = "right";
    g.fillText("SAMPLE", 482, 50);
    g.globalAlpha = 1;
    g.font = `500 88px ${fonts.mono}`;
    g.fillText(choice.amount, 482, 170);
    disp.tex.needsUpdate = true;

    g = legends.g;
    g.clearRect(0, 0, 512, 683);
    g.fillStyle = INK;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const rows = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["CLR", "0", "OK"]];
    rows.forEach((row, ri) =>
      row.forEach((label, ci) => {
        g.font = `700 ${label.length > 1 ? 30 : 46}px ${fonts.sans}`;
        g.fillText(label, [111, 256, 401][ci], [124, 269, 414, 559][ri]);
      }),
    );
    legends.tex.needsUpdate = true;

    g = bezel.g;
    g.fillStyle = INK;
    g.fillRect(0, 0, 512, 768);
    g.strokeStyle = CREAM;
    g.fillStyle = CREAM;
    g.lineCap = "round";
    g.lineWidth = 8;
    for (const r of [14, 26, 38]) {
      g.beginPath();
      g.arc(70, 92, r, -0.85, 0.85);
      g.stroke();
    }
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.font = `800 62px ${fonts.sans}`;
    g.fillText("TAP TO PAY", 128, 116);
    g.textAlign = "center";
    g.font = `700 32px ${fonts.sans}`;
    g.fillText("Capped. Checked. On-chain.", 256, 646);
    g.font = `italic 800 52px ${fonts.serif}`;
    g.fillText("TAPat", 256, 722);
    bezel.tex.needsUpdate = true;
    shown = "";
  }

  /** The reader glass: four status lights, the contactless mark, and its answer. */
  function drawFace(state: "ready" | "reading" | "ok" | "no", lit: number) {
    const g = face.g;
    g.fillStyle = GLASS;
    g.fillRect(0, 0, 512, 546);
    [136, 212, 288, 364].forEach((x, i) => {
      g.save();
      if (i < lit) {
        g.shadowColor = CREAM;
        g.shadowBlur = 22;
      }
      g.fillStyle = i < lit ? CREAM : "#2E3B35";
      g.beginPath();
      g.arc(x, 62, 13, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });
    g.strokeStyle = CREAM;
    g.fillStyle = CREAM;
    g.lineCap = "round";
    g.lineJoin = "round";
    const cx = 256;
    const cy = 262;
    g.lineWidth = 7;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(cx, cy, 116, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
    g.lineWidth = 13;
    g.beginPath();
    if (state === "ok") {
      g.moveTo(cx - 48, cy + 2);
      g.lineTo(cx - 12, cy + 38);
      g.lineTo(cx + 52, cy - 36);
      g.stroke();
    } else if (state === "no") {
      g.moveTo(cx - 40, cy - 40);
      g.lineTo(cx + 40, cy + 40);
      g.moveTo(cx + 40, cy - 40);
      g.lineTo(cx - 40, cy + 40);
      g.stroke();
    } else {
      for (const r of [30, 58, 86]) {
        g.beginPath();
        g.arc(cx - 40, cy, r, -0.8, 0.8);
        g.stroke();
      }
    }
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.font = `800 38px ${fonts.sans}`;
    const head = { ready: "TAP CARD", reading: `READING …${choice.last4}`, ok: `PAID ${choice.amount}`, no: "DECLINED" }[state];
    g.fillText(head, 256, 446);
    g.globalAlpha = 0.75;
    g.font = `500 26px ${fonts.sans}`;
    const sub = { ready: "Hold the card to the reader", reading: "Hold the card still", ok: "Authorized by Noir", no: `${choice.short} · 0 tx` }[state];
    g.fillText(sub, 256, 490);
    g.globalAlpha = 0.45;
    g.fillRect(156, 516, 200, 4);
    g.globalAlpha = 1;
    face.tex.needsUpdate = true;
  }

  function frame(now: number) {
    const t = tapAt === null ? -1 : (now - tapAt) / 1000;
    const k = spring(t, 14, 120) - spring(t - 1.15, 16, 90);
    const L = (a: number, b: number) => a + (b - a) * k;
    const idle = reduced ? 0 : 1;
    const bob = Math.sin(now / 650) * 0.05 * idle * (1 - k);
    let shake = 0;
    if (!choice.approved && t > ANSWER_AT && t < ANSWER_AT + 0.5) shake = Math.sin((t - ANSWER_AT) * 48) * 0.07 * (1 - (t - ANSWER_AT) / 0.5);
    // The rest pose stays well inside the frame, so the card's corners never meet the canvas edge.
    card.position.set(L(1.2, 0.8) + shake, L(-0.75, 0.12) + bob, L(1.3, 0.62));
    card.rotation.set(L(-0.4, 0), L(-0.55, 0) + Math.sin(now / 1300) * 0.06 * idle * (1 - k), L(0.28, 0));
    const state = t < 0.35 ? "ready" : t < ANSWER_AT ? "reading" : choice.approved ? "ok" : "no";
    const lit = state === "ready" ? 1 : state === "reading" ? Math.min(4, 1 + Math.floor((t - 0.35) / 0.2)) : state === "ok" ? 4 : 0;
    if (state + lit !== shown) {
      shown = state + lit;
      drawFace(state, lit);
    }
    renderer.render(scene, cam);
  }

  // Draw only while on screen. Between taps the card's idle drift runs at half rate to save battery.
  let raf = 0;
  let visible = true;
  let tick = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    const busy = tapAt !== null && now - tapAt < 3000;
    if (!busy && tick++ % 2 === 1) return;
    frame(now);
  };
  const renderOnce = () => frame(performance.now());

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    if (reduced) renderOnce();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
  });
  io.observe(canvas);

  // The browser can drop the WebGL context (GPU reset, too many tabs). three.js rebuilds its state on restore;
  // the canvas textures just need re-uploading.
  const onLost = (e: Event) => e.preventDefault();
  const onRestored = () => {
    drawStatic();
    if (reduced) renderOnce();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  drawStatic();
  resize();
  if (reduced) renderOnce();
  else raf = requestAnimationFrame(loop);
  void document.fonts?.ready.then(() => {
    drawStatic();
    if (reduced) renderOnce();
  });

  return {
    tap(next, instant, at = performance.now()) {
      choice = next;
      tapAt = instant ? -1e9 : at;
      drawStatic();
      if (reduced) renderOnce();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      scene.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const m = o.material as Material & { map?: { dispose(): void } | null };
          m.map?.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
