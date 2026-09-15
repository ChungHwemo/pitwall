import { createPark } from './park.js';
import { createRace } from './sim.js';
import { createWorld } from './world.js';

const canvas = document.getElementById('view');
const park = createPark();
const raceApi = createRace(park, 4);
const world = createWorld(canvas, park);
world.bindRiders(raceApi.riders);

const keys = new Set();
const mouse = { x: 0, y: 0, down: false, dragging: false };
let mode = 'race';
let tool = 'raise';
let radius = 2.4;
let strength = 0.55;
let cam = 'chase';
let follow = 0;
let strokeOpen = false;
let dirty = false;

const hud = {
  mode: document.getElementById('mode'),
  count: document.getElementById('count'),
  tower: document.getElementById('tower'),
  clock: document.getElementById('clock'),
  help: document.getElementById('help'),
};

function inputFromKeys() {
  const throttle = keys.has('w') || keys.has('arrowup') ? 1 : 0;
  const brake = keys.has('s') || keys.has('arrowdown') ? 1 : 0;
  const steer = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  if (throttle || brake || steer) raceApi.setPlayer(raceApi.riders[follow].id);
  return { throttle, brake, steer };
}

function setMode(next) {
  mode = next;
  world.controls.enabled = next === 'sculpt';
  cam = next === 'sculpt' ? 'orbit' : cam === 'orbit' ? 'chase' : cam;
  document.body.dataset.mode = next;
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.classList.toggle('on', b.dataset.mode === next);
  }
}

function setTool(next) {
  tool = next;
  for (const b of document.querySelectorAll('[data-tool]')) {
    b.classList.toggle('on', b.dataset.tool === next);
  }
}

function fmt(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

function renderHud(snap) {
  const { race, order } = snap;
  hud.clock.textContent = race.phase === 'countdown' ? '' : fmt(race.time);
  if (race.phase === 'countdown') {
    const left = race.count;
    hud.count.textContent = left > 2 ? '3' : left > 1 ? '2' : left > 0.2 ? '1' : 'GO';
    hud.count.dataset.show = '1';
  } else if (race.phase === 'done' && race.winner) {
    hud.count.textContent = `WIN ${race.winner.name}`;
    hud.count.dataset.show = '1';
  } else {
    hud.count.dataset.show = '0';
  }
  hud.mode.textContent = mode === 'sculpt' ? 'SCULPT' : 'LIVE';
  hud.tower.innerHTML = order
    .map((r, i) => {
      const tag = r.player ? 'YOU' : r.skillName;
      const st = r.finished ? 'FIN' : r.crashed > 0 ? 'DNF' : r.airborne ? 'AIR' : r.state.toUpperCase();
      return `<li style="--c:${r.color}" class="${r.player ? 'you' : ''}">
        <b>${i + 1}</b><span class="num">${r.number}</span><span class="nm">${r.name}</span>
        <span class="sk">${tag}</span><span class="st">${st}</span>
        <span class="lp">L${Math.min(r.laps + 1, race.laps)}/${race.laps}</span>
      </li>`;
    })
    .join('');
}

function applySculpt() {
  const hit = world.pickTerrain(mouse.x, mouse.y);
  world.setBrush(hit, radius, mode === 'sculpt');
  if (mode !== 'sculpt' || !mouse.down || !hit) return;
  if (!strokeOpen) {
    park.beginStroke();
    strokeOpen = true;
  }
  if (tool === 'whoops') {
    const p = nearestS(hit.point.x, hit.point.z);
    park.stampWhoops(p);
    strokeOpen = false;
    mouse.down = false;
  } else if (tool === 'table') {
    park.stampTable(nearestS(hit.point.x, hit.point.z));
    strokeOpen = false;
    mouse.down = false;
  } else if (tool === 'berm') {
    park.stampBerm(nearestS(hit.point.x, hit.point.z));
    strokeOpen = false;
    mouse.down = false;
  } else {
    park.sculpt(hit.point.x, hit.point.z, radius, strength, tool);
  }
  dirty = true;
}

function nearestS(x, z) {
  let best = 0;
  let bestD = 1e9;
  for (let i = 0; i < 120; i++) {
    const s = i / 120;
    const p = park.pointAt(s);
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'tab') {
    e.preventDefault();
    follow = (follow + 1) % raceApi.riders.length;
    raceApi.setPlayer(raceApi.riders[follow].id);
  }
  if (k === 'c') cam = cam === 'chase' ? 'broadcast' : cam === 'broadcast' ? 'orbit' : 'chase';
  if (k === 'v') setMode(mode === 'race' ? 'sculpt' : 'race');
  if (k === 'r') raceApi.restart();
  if (k === ' ') {
    e.preventDefault();
    raceApi.race.paused = !raceApi.race.paused;
  }
  if (k === 'z' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    if (park.revertStroke()) dirty = true;
  }
  if (k === '[') radius = Math.max(0.8, radius - 0.3);
  if (k === ']') radius = Math.min(6, radius + 0.3);
  if (k === '1') setTool('raise');
  if (k === '2') setTool('lower');
  if (k === '3') setTool('smooth');
  if (k === 'h') hud.help.classList.toggle('hide');
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

canvas.addEventListener('pointerdown', (e) => {
  mouse.down = true;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  if (mode === 'sculpt') {
    world.controls.enabled = false;
    applySculpt();
  }
});
window.addEventListener('pointerup', () => {
  mouse.down = false;
  strokeOpen = false;
  if (mode === 'sculpt') world.controls.enabled = true;
});
canvas.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener('resize', () => world.resize());

document.querySelectorAll('[data-mode]').forEach((b) =>
  b.addEventListener('click', () => setMode(b.dataset.mode)),
);
document.querySelectorAll('[data-tool]').forEach((b) =>
  b.addEventListener('click', () => setTool(b.dataset.tool)),
);
document.getElementById('restart').addEventListener('click', () => raceApi.restart());
document.getElementById('undo').addEventListener('click', () => {
  if (park.revertStroke()) dirty = true;
});
document.getElementById('reset-dirt').addEventListener('click', () => {
  park.seedTerrain();
  dirty = true;
});

setMode('race');
setTool('raise');
{
  const skip = Number(new URLSearchParams(location.search).get('t') || 0);
  if (skip > 0) {
    raceApi.race.phase = 'green';
    raceApi.race.count = 0;
    for (let t = 0; t < skip; t += 1 / 30) raceApi.step(1 / 30, { throttle: 0, brake: 0, steer: 0 });
    cam = 'broadcast';
  }
  const snap = raceApi.snapshot();
  snap.poses.forEach((pose, i) => world.setBike(i, snap.riders[i], pose));
  if (cam === 'broadcast') world.broadcast(snap, true);
  else world.chase(snap.poses[follow], snap.riders[follow], 1);
  world.render();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  applySculpt();
  if (dirty) {
    world.syncTerrain();
    dirty = false;
  }
  const snap = raceApi.step(dt, inputFromKeys());
  snap.poses.forEach((pose, i) => world.setBike(i, snap.riders[i], pose));
  const gateOpen = snap.race.phase === 'countdown' ? 0 : Math.min(1, snap.race.time * 1.6);
  world.setGate(gateOpen);
  if (mode === 'sculpt' || cam === 'orbit') {
    world.controls.enabled = mode === 'sculpt' && !mouse.down;
    world.controls.update();
  } else if (cam === 'broadcast') {
    world.broadcast(snap);
  } else {
    const i = follow;
    world.chase(snap.poses[i], snap.riders[i], dt);
  }
  if (mode !== 'sculpt') world.setBrush(null, radius, false);
  renderHud(snap);
  world.render();
  document.title = 'READY ' + snap.race.phase;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
