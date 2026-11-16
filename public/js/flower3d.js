// Flor 3D da marca (Three.js), modelada por código a partir da logo:
// pétalas creme e haste bronze. Desabrocha conforme a rolagem, inclina com o cursor e gira ao arrastar.
import * as THREE from '/vendor/three/three.module.js';
import { reducedMotion, clamp } from './core.js';

const CREAM = new THREE.Color('#f6efe2');
const CREAM_WARM = new THREE.Color('#e3cda4');
const BRONZE = '#b07a3e';

/** Geometria de uma pétala: eixo Y = comprimento; +Z é o verso (a ponta curva para trás). */
function petalGeometry({ length = 1.25, width = 0.95, curl = 0.42, cup = 0.3, seed = 0 }) {
  const NU = 14, NV = 22;
  const positions = [], colors = [], indices = [];
  const color = new THREE.Color();
  for (let j = 0; j <= NV; j++) {
    const v = j / NV;
    const profile = 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.78)), 0.85) + 0.025 * (1 - v);
    for (let i = 0; i <= NU; i++) {
      const u = (i / NU) * 2 - 1;
      const x = u * profile * width;
      const y = v * length;
      const ruffle = 0.045 * Math.sin(u * 5 + seed) * Math.sin(v * 8 + seed * 1.7) * v;
      const z = curl * Math.pow(v, 2.3) * length - cup * u * u * profile + ruffle;
      positions.push(x, y, z);
      const vein = 1 - 0.07 * Math.abs(Math.sin(u * 13 + seed)) * (1 - v * 0.6);
      color.copy(CREAM_WARM).lerp(CREAM, Math.pow(v, 0.55)).multiplyScalar(vein);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildFlower() {
  const flower = new THREE.Group();
  const petalMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.62, metalness: 0.02 });
  const petals = [];

  const ring = (count, opts, closed, opened, offset) => {
    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = offset + (i / count) * Math.PI * 2;
      const mesh = new THREE.Mesh(petalGeometry({ ...opts, seed: i * 2.1 + offset }), petalMaterial);
      pivot.add(mesh);
      flower.add(pivot);
      petals.push({ mesh, closed, opened, phase: i * 0.9 + offset });
    }
  };
  ring(5, { length: 1.3, width: 1.0, curl: 0.42, cup: 0.3 }, 0.3, 1.2, 0);
  ring(3, { length: 0.95, width: 0.72, curl: 0.3, cup: 0.36 }, 0.16, 0.82, Math.PI / 5);

  // estames
  const stamenMaterial = new THREE.MeshStandardMaterial({ color: '#c79a48', roughness: 0.5 });
  const filament = new THREE.CylinderGeometry(0.012, 0.016, 0.5, 6);
  filament.translate(0, 0.25, 0);
  const anther = new THREE.SphereGeometry(0.04, 10, 8);
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Group();
    s.rotation.y = (i / 6) * Math.PI * 2;
    const stem = new THREE.Mesh(filament, stamenMaterial);
    stem.rotation.x = 0.32;
    const tip = new THREE.Mesh(anther, stamenMaterial);
    tip.position.set(0, 0.5 * Math.cos(0.32), 0.5 * Math.sin(0.32));
    s.add(stem, tip);
    flower.add(s);
  }

  // haste bronze, com a curva da logo
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.05, 0),
    new THREE.Vector3(0.04, -0.7, 0.06),
    new THREE.Vector3(-0.08, -1.5, 0.16),
    new THREE.Vector3(-0.3, -2.3, 0.1),
    new THREE.Vector3(-0.42, -2.9, -0.05),
  ]);
  const stemMesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 40, 0.036, 8, false),
    new THREE.MeshStandardMaterial({ color: BRONZE, roughness: 0.38, metalness: 0.45 })
  );
  flower.add(stemMesh);

  return { flower, petals };
}

export function initFlower(canvas, fallbackImg) {
  const wrap = canvas.parentElement;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    canvas.hidden = true;
    fallbackImg.hidden = false;
    wrap.querySelector('.flower__hint')?.remove();
    return;
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.15, 6.2);

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x1c2f4d, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0xe24d7f, 26, 12, 1.6); // luz de contorno no rosa da marca
  rim.position.set(-2.6, 0.4, 1.6);
  scene.add(rim);
  const fill = new THREE.PointLight(0x7fb0ff, 8, 12, 1.8);
  fill.position.set(2.4, -1.6, 2);
  scene.add(fill);

  const { flower, petals } = buildFlower();
  const rig = new THREE.Group(); // recebe a interação do usuário
  flower.rotation.x = 1.02; // vira a flor de frente para a câmera, vista levemente de cima
  flower.position.y = 0.55;
  rig.add(flower);
  scene.add(rig);

  const state = { openness: reducedMotion ? 1 : 0.1, targetOpen: 1, pointerX: 0, pointerY: 0, spin: 0, velocity: 0, dragging: false, lastX: 0, visible: false, scrollTurn: 0 };

  function resize() {
    const w = wrap.clientWidth, hgt = wrap.clientHeight;
    if (!w || !hgt) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    // em telas estreitas afasta a câmera para a flor caber inteira
    camera.position.z = camera.aspect < 1 ? 7.4 : 6.2;
    camera.updateProjectionMatrix();
  }

  function readScroll() {
    const rect = wrap.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = clamp((vh - rect.top) / (vh + rect.height), 0, 1); // 0 ao entrar por baixo, 1 ao sair por cima
    state.targetOpen = clamp((progress - 0.12) / 0.38, 0, 1);
    state.scrollTurn = progress * Math.PI * 1.1;
  }

  function applyPose(time) {
    const ease = state.openness * state.openness * (3 - 2 * state.openness);
    for (const p of petals) {
      const breathe = reducedMotion ? 0 : Math.sin(time * 0.0011 + p.phase) * 0.035;
      p.mesh.rotation.x = p.closed + (p.opened - p.closed) * ease + breathe;
    }
    flower.rotation.y = state.spin + state.scrollTurn + (reducedMotion ? 0.5 : time * 0.00016);
    rig.rotation.y += (state.pointerX * 0.45 - rig.rotation.y) * 0.06;
    rig.rotation.x += (state.pointerY * 0.28 - rig.rotation.x) * 0.06;
    rig.position.y = reducedMotion ? 0 : Math.sin(time * 0.0009) * 0.06;
  }

  function frame(time) {
    if (!state.visible) return;
    readScroll();
    state.openness += (state.targetOpen - state.openness) * 0.06;
    if (!state.dragging) {
      state.spin += state.velocity;
      state.velocity *= 0.94;
    }
    applyPose(time);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  resize();
  new ResizeObserver(resize).observe(wrap);

  if (reducedMotion) {
    readScroll();
    applyPose(0);
    renderer.render(scene, camera);
    new ResizeObserver(() => renderer.render(scene, camera)).observe(wrap);
    return;
  }

  new IntersectionObserver(([entry]) => {
    const was = state.visible;
    state.visible = entry.isIntersecting;
    if (state.visible && !was) requestAnimationFrame(frame);
  }, { rootMargin: '10% 0px' }).observe(wrap);

  // cursor inclina a flor
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const rect = wrap.getBoundingClientRect();
    state.pointerX = clamp(((e.clientX - rect.left) / rect.width - 0.5) * 2, -1.5, 1.5);
    state.pointerY = clamp(((e.clientY - rect.top) / rect.height - 0.5) * 2, -1.5, 1.5);
  }, { passive: true });

  // arrastar gira (com inércia)
  wrap.addEventListener('pointerdown', (e) => {
    state.dragging = true;
    state.lastX = e.clientX;
    state.velocity = 0;
    wrap.setPointerCapture?.(e.pointerId);
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const dx = e.clientX - state.lastX;
    state.lastX = e.clientX;
    state.spin += dx * 0.012;
    state.velocity = dx * 0.012;
  });
  const release = () => (state.dragging = false);
  wrap.addEventListener('pointerup', release);
  wrap.addEventListener('pointercancel', release);
}
