import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RES, WORLD } from './park.js';

function dirtTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6a4530';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.random();
    ctx.fillStyle = `rgba(${90 + v * 70},${55 + v * 40},${30 + v * 20},${0.18 + v * 0.25})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(40,24,14,${0.08 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, Math.random() * 512);
    ctx.lineTo(Math.random() * 512, Math.random() * 512);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function bannerTexture(text, bg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#f4ead4';
  ctx.font = 'bold 64px ui-sans-serif, system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBike(color) {
  const g = new THREE.Group();
  const col = new THREE.Color(color);
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.45, metalness: 0.4 });
  const plastic = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.08 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });

  const wheelGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.12, 16);
  const front = new THREE.Mesh(wheelGeo, tire);
  front.rotation.z = Math.PI / 2;
  front.position.set(0, 0.29, 0.52);
  const rear = new THREE.Mesh(wheelGeo, tire);
  rear.rotation.z = Math.PI / 2;
  rear.position.set(0, 0.29, -0.5);
  g.add(front, rear);

  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), metal);
  fork.position.set(0, 0.5, 0.48);
  fork.rotation.x = 0.18;
  const swing = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.48), metal);
  swing.position.set(0, 0.28, -0.22);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.7), metal);
  frame.position.set(0, 0.48, 0);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.32), plastic);
  tank.position.set(0, 0.62, 0.06);
  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.28), plastic);
  fender.position.set(0, 0.62, 0.5);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.02), plastic);
  plate.position.set(0, 0.42, 0.7);
  g.add(fork, swing, frame, tank, fender, plate);

  const rider = new THREE.Group();
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.16), dark);
  hips.position.set(0, 0.72, -0.02);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.16), plastic);
  torso.position.set(0, 0.92, 0.02);
  torso.rotation.x = 0.35;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), plastic);
  helm.position.set(0, 1.16, 0.16);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.08), dark);
  visor.position.set(0, 1.16, 0.26);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.32), plastic);
  armL.position.set(0.16, 0.88, 0.22);
  armL.rotation.x = -0.6;
  const armR = armL.clone();
  armR.position.x = -0.16;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.08), dark);
  legL.position.set(0.1, 0.58, -0.08);
  const legR = legL.clone();
  legR.position.x = -0.1;
  rider.add(hips, torso, helm, visor, armL, armR, legL, legR);
  g.add(rider);

  for (const m of g.children) {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  }
  rider.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
    }
  });

  g.userData = { front, rear, rider, helm };
  g.scale.setScalar(1.45);
  return g;
}

function makeGate() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 });
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), wood);
  const postR = postL.clone();
  postL.position.set(-3.1, 1.1, 0);
  postR.position.set(3.1, 1.1, 0);
  const bars = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.08, 0.08), steel);
    bar.position.y = 0.25 + i * 0.22;
    bars.add(bar);
  }
  bars.position.z = 0.1;
  g.add(postL, postR, bars);
  g.userData = { bars };
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

export function createWorld(canvas, park) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b4d2);
  scene.fog = new THREE.Fog(0x87b4d2, 90, 180);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 220);
  {
    const s = park.pointAt(0.985);
    camera.position.set(s.x - s.tx * 9, park.heightAt(s.x, s.z) + 3.4, s.z - s.tz * 9);
    camera.lookAt(s.x + s.tx * 8, park.heightAt(s.x, s.z) + 0.8, s.z + s.tz * 8);
  }

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 1.25;
  controls.minDistance = 8;
  controls.maxDistance = 70;
  {
    const s = park.pointAt(0.985);
    controls.target.set(s.x + s.tx * 8, park.heightAt(s.x, s.z) + 0.8, s.z + s.tz * 8);
  }
  controls.enabled = false;

  const hemi = new THREE.HemisphereLight(0xe7f2ff, 0x6b4a32, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.8);
  sun.position.set(28, 42, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 110;
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.bias = -0.0007;
  scene.add(sun, sun.target);

  const geo = new THREE.PlaneGeometry(WORLD, WORLD, RES - 1, RES - 1);
  geo.rotateX(-Math.PI / 2);
  geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: dirtTexture(),
      vertexColors: true,
      roughness: 0.93,
      metalness: 0.0,
      color: 0xffffff,
    }),
  );
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  scene.add(terrain);



  const under = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD * 0.85, 48),
    new THREE.MeshStandardMaterial({ color: 0x3d2a1c, roughness: 1 }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = -0.4;
  under.receiveShadow = true;
  scene.add(under);

  function syncTerrain() {
    const pos = geo.attributes.position;
    const col = geo.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const { u, v } = { u: (x / WORLD + 0.5) * (RES - 1), v: (z / WORLD + 0.5) * (RES - 1) };
      const ix = clamp(Math.round(u), 0, RES - 1);
      const iz = clamp(Math.round(v), 0, RES - 1);
      const k = ix + iz * RES;
      pos.setY(i, park.heights[k]);
      const pk = park.pack[k];
      const fr = park.fresh[k];
      let r, gch, b;
      if (pk > 0.28) {
        r = 0.26 + fr * 0.12;
        gch = 0.16 + fr * 0.04;
        b = 0.1;
      } else {
        r = 0.72 + fr * 0.1;
        gch = 0.48;
        b = 0.3;
      }
      col.setXYZ(i, r, gch, b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
  syncTerrain();

  const start = park.pointAt(0);
  const gate = makeGate();
  gate.position.set(start.x, park.heightAt(start.x, start.z), start.z);
  gate.rotation.y = Math.atan2(start.tx, start.tz);
  scene.add(gate);

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(7.4, 1.6),
    new THREE.MeshStandardMaterial({ map: bannerTexture('MINI MX', '#7a1f1f'), roughness: 0.7 }),
  );
  banner.position.set(start.x - start.tx * 4, 4.2, start.z - start.tz * 4);
  banner.lookAt(start.x, 3.4, start.z);
  scene.add(banner);

  const finish = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 1.2),
    new THREE.MeshStandardMaterial({ map: bannerTexture('FINISH', '#111111'), roughness: 0.7 }),
  );
  finish.position.set(start.x + start.tx * 1.2, 3.4, start.z + start.tz * 1.2);
  finish.lookAt(start.x, 2.8, start.z);
  scene.add(finish);

  const hayMat = new THREE.MeshStandardMaterial({ color: 0xc4a44a, roughness: 0.9 });
  for (let i = 0; i < 18; i++) {
    const s = (i / 18 + 0.03) % 1;
    const p = park.pointAt(s);
    const bale = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), hayMat);
    const side = i % 2 === 0 ? 1 : -1;
    bale.position.set(
      p.x + p.nx * side * 4.4,
      park.heightAt(p.x + p.nx * side * 4.4, p.z + p.nz * side * 4.4) + 0.35,
      p.z + p.nz * side * 4.4,
    );
    bale.castShadow = true;
    bale.receiveShadow = true;
    scene.add(bale);
  }

  const bikes = [];
  const dusts = [];
  function makeDust() {
    const g = new THREE.BufferGeometry();
    const n = 80;
    const pos = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0xb08968,
      size: 0.28,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    scene.add(pts);
    return { pts, pos, n };
  }

  const brushRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.05, 40),
    new THREE.MeshBasicMaterial({ color: 0xf0c14a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  brushRing.rotation.x = -Math.PI / 2;
  brushRing.visible = false;
  scene.add(brushRing);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  function pickTerrain(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(terrain);
    return hits[0] || null;
  }

  function bindRiders(riders) {
    for (const b of bikes) scene.remove(b);
    bikes.length = 0;
    for (const d of dusts) scene.remove(d.pts);
    dusts.length = 0;
    for (const r of riders) {
      const bike = makeBike(r.color);
      scene.add(bike);
      bikes.push(bike);
      dusts.push(makeDust());
    }
  }

  function setBike(i, rider, pose) {
    const bike = bikes[i];
    if (!bike) return;
    const p = pose.p;
    fwd.set(p.tx, Math.sin(rider.pitch), p.tz).normalize();
    right.crossVectors(up, fwd).normalize();
    tmp.crossVectors(fwd, right).normalize();
    if (rider.crashed > 0) {
      right.applyAxisAngle(fwd, 1.2);
      tmp.crossVectors(fwd, right).normalize();
    }
    basis.makeBasis(right, tmp, fwd);
    bike.quaternion.setFromRotationMatrix(basis);
    bike.position.set(pose.x, rider.y, pose.z);
    const spin = rider.speed / 0.29;
    bike.userData.front.rotation.x -= spin * 0.016;
    bike.userData.rear.rotation.x -= spin * 0.016;
    bike.userData.rider.rotation.x = rider.airborne ? -0.12 : 0.08;

    const dust = dusts[i];
    const arr = dust.pos;
    const a = rider.speed > 5 ? rider.dust * (rider.airborne ? 0.15 : 1) : 0;
    dust.pts.material.opacity = a * 0.45;
    for (let k = 0; k < dust.n; k++) {
      const t = k / dust.n;
      arr[k * 3] = pose.x - p.tx * t * 2.2 + (Math.random() - 0.5) * 0.5;
      arr[k * 3 + 1] = rider.y + 0.1 + Math.random() * 0.4 * a;
      arr[k * 3 + 2] = pose.z - p.tz * t * 2.2 + (Math.random() - 0.5) * 0.5;
    }
    dust.pts.geometry.attributes.position.needsUpdate = true;
  }

  function chase(pose, rider, dt) {
    const p = pose.p;
    const desired = tmp.set(
      pose.x - p.tx * 7.2 + p.nx * 0.4,
      rider.y + 2.6,
      pose.z - p.tz * 7.2 + p.nz * 0.4,
    );
    camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    controls.target.set(pose.x + p.tx * 6, rider.y + 0.8, pose.z + p.tz * 6);
    camera.lookAt(controls.target);
  }

  function broadcast(snap, instant) {
    const hot = snap.riders.find((r) => r.airborne && r.crashed <= 0) || snap.order.find((r) => r.crashed <= 0) || snap.order[0];
    const i = snap.riders.indexOf(hot);
    const pose = snap.poses[i];
    const p = pose.p;
    const k = instant ? 1 : 0.1;
    camera.position.lerp(
      tmp.set(pose.x - p.tx * 11, hot.y + 5.4, pose.z - p.tz * 11),
      k,
    );
    camera.lookAt(pose.x + p.tx * 7, hot.y + 0.8, pose.z + p.tz * 7);
    controls.target.set(pose.x, hot.y + 0.6, pose.z);
  }

  function setGate(openT) {
    gate.userData.bars.position.y = openT * 2.4;
  }

  function setBrush(hit, radius, on) {
    brushRing.visible = on && !!hit;
    if (hit) {
      brushRing.position.copy(hit.point);
      brushRing.position.y += 0.05;
      const s = radius;
      brushRing.scale.set(s, s, s);
    }
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    terrain,
    canvas,
    resize,
    pickTerrain,
    syncTerrain,
    bindRiders,
    setBike,
    chase,
    broadcast,
    setGate,
    setBrush,
    render() {
      renderer.render(scene, camera);
    },
  };
}
