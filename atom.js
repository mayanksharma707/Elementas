// atom.js — 3D atom viewer built with Three.js
//
// NOTE: this exact code is embedded directly inside index.html (inside an
// inline <script type="module"> tag), not loaded via <script src="atom.js">.
// That's intentional: browsers block loading *local* JS module files over
// the file:// protocol (a security rule), which would break the 3D view
// the moment you just double-click index.html instead of using a server.
// An inline module script doesn't hit that restriction, so this file exists
// as a readable, syntax-highlighted copy — edit it, then copy the change
// into the matching <script type="module"> block in index.html.
//
// Exposes window.AtomViewer.{render, dispose, toggleAnimation, setSpeed, resetView}

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let state = null; // holds the currently-mounted scene so we can tear it down cleanly

function dispose() {
  if (!state) return;
  cancelAnimationFrame(state.frameId);
  state.resizeObserver.disconnect();
  state.controls.dispose();
  state.scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose());
    }
  });
  state.renderer.dispose();
  if (state.renderer.domElement.parentNode) {
    state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
  }
  state = null;
}

function render(container, elementData, colorHex) {
  dispose();
  container.innerHTML = "";

  const width = container.clientWidth || 320;
  const height = container.clientHeight || width;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.8;

  const accent = new THREE.Color(colorHex || "#4ea1f2");

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.PointLight(0xffffff, 1.3);
  key.position.set(6, 5, 8);
  scene.add(key);
  const fill = new THREE.PointLight(accent, 0.6);
  fill.position.set(-6, -3, -6);
  scene.add(fill);

  // --- nucleus: size grows gently with atomic number ---
  const nucleusRadius = 0.55 + Math.min(elementData.number, 118) / 118 * 0.4;
  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(nucleusRadius, 32, 32),
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.4,
      roughness: 0.35,
      metalness: 0.25,
    })
  );
  scene.add(nucleus);

  // --- electron shells: one tilted ring + orbiting electrons per shell ---
  const shells = elementData.shells && elementData.shells.length ? elementData.shells : [1];
  const baseRadius = nucleusRadius + 0.9;
  const shellGap = 0.62;
  const ringMat = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.32 });
  const electronGeo = new THREE.SphereGeometry(0.095, 16, 16);
  const electronMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: accent,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });

  const shellGroup = new THREE.Group();
  scene.add(shellGroup);

  const shellObjs = shells.map((count, i) => {
    const radius = baseRadius + i * shellGap;
    const curvePoints = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0)
      .getPoints(96)
      .map((p) => new THREE.Vector3(p.x, p.y, 0));
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(curvePoints), ringMat);

    const pivot = new THREE.Group();
    const tiltX = (i * 0.55) % Math.PI;
    const tiltZ = (i * 0.37) % Math.PI;
    pivot.rotation.set(tiltX, 0, tiltZ);
    ring.rotation.set(tiltX, 0, tiltZ);
    shellGroup.add(ring);
    shellGroup.add(pivot);

    const electrons = [];
    for (let k = 0; k < count; k++) {
      const angle = (Math.PI * 2 * k) / count;
      const mesh = new THREE.Mesh(electronGeo, electronMat);
      pivot.add(mesh);
      electrons.push({ mesh, angle });
    }

    return { radius, electrons, baseSpeed: 0.55 / (i + 1) };
  });

  const outerRadius = baseRadius + (shells.length - 1) * shellGap;
  const camDist = Math.min(Math.max(outerRadius * 2.15, 4.5), 22);
  camera.position.set(0, camDist * 0.25, camDist);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.minDistance = camDist * 0.35;
  controls.maxDistance = camDist * 2.2;
  controls.update();
  controls.saveState(); // so resetView() returns to this framing, not Three.js defaults

  function animate() {
    state.frameId = requestAnimationFrame(animate);
    if (state.playing) {
      nucleus.rotation.y += 0.003 * state.speed;
      shellObjs.forEach((s) => {
        s.electrons.forEach((e) => {
          e.angle += s.baseSpeed * 0.02 * state.speed;
          e.mesh.position.set(Math.cos(e.angle) * s.radius, Math.sin(e.angle) * s.radius, 0);
        });
      });
    }
    controls.update();
    renderer.render(scene, camera);
  }

  const resizeObserver = new ResizeObserver((entries) => {
    const { width: w, height: h } = entries[0].contentRect;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  state = { renderer, scene, camera, controls, frameId: 0, resizeObserver, playing: true, speed: 1 };
  animate();
}

function toggleAnimation() {
  if (!state) return true;
  state.playing = !state.playing;
  state.controls.autoRotate = state.playing;
  return state.playing;
}

function setSpeed(multiplier) {
  if (!state) return;
  state.speed = multiplier;
}

function resetView() {
  if (!state) return;
  state.controls.reset();
}

window.AtomViewer = { render, dispose, toggleAnimation, setSpeed, resetView };
