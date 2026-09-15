/** Mini MX park: heightfield + closed loop + sculpt. No renderer. */

export const WORLD = 84;
export const RES = 144;
export const TRACK_HALF = 2.35;

const N = RES * RES;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function hash(ix, iz) {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function createPark() {
  const heights = new Float32Array(N);
  const pack = new Float32Array(N);
  const fresh = new Float32Array(N);
  let undo = null;
  let path = [];
  let pathLength = 1;
  const samples = 480;

  function ij(ix, iz) {
    return ix + iz * RES;
  }

  function xzToUv(x, z) {
    return {
      u: (x / WORLD + 0.5) * (RES - 1),
      v: (z / WORLD + 0.5) * (RES - 1),
    };
  }

  function heightAt(x, z) {
    const { u, v } = xzToUv(x, z);
    const x0 = Math.floor(u);
    const z0 = Math.floor(v);
    if (x0 < 0 || z0 < 0 || x0 >= RES - 1 || z0 >= RES - 1) return 0;
    const tx = u - x0;
    const tz = v - z0;
    const h00 = heights[ij(x0, z0)];
    const h10 = heights[ij(x0 + 1, z0)];
    const h01 = heights[ij(x0, z0 + 1)];
    const h11 = heights[ij(x0 + 1, z0 + 1)];
    return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
  }

  function packAt(x, z) {
    const { u, v } = xzToUv(x, z);
    const x0 = clamp(Math.round(u), 0, RES - 1);
    const z0 = clamp(Math.round(v), 0, RES - 1);
    return pack[ij(x0, z0)];
  }

  function normalAt(x, z) {
    const e = 0.45;
    const hL = heightAt(x - e, z);
    const hR = heightAt(x + e, z);
    const hD = heightAt(x, z - e);
    const hU = heightAt(x, z + e);
    const nx = hL - hR;
    const nz = hD - hU;
    const inv = 1 / Math.hypot(nx, 2 * e, nz);
    return { x: nx * inv, y: 2 * e * inv, z: nz * inv };
  }

  function setMax(ix, iz, h) {
    const k = ij(ix, iz);
    if (h > heights[k]) heights[k] = h;
  }

  function addGaussian(x, z, radius, amount, mode) {
    const { u, v } = xzToUv(x, z);
    const r = (radius / WORLD) * (RES - 1);
    const r2 = r * r;
    const x0 = clamp(Math.floor(u - r - 1), 0, RES - 1);
    const x1 = clamp(Math.ceil(u + r + 1), 0, RES - 1);
    const z0 = clamp(Math.floor(v - r - 1), 0, RES - 1);
    const z1 = clamp(Math.ceil(v + r + 1), 0, RES - 1);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const du = ix - u;
        const dv = iz - v;
        const d2 = du * du + dv * dv;
        if (d2 > r2) continue;
        const w = Math.exp(-d2 / (r2 * 0.32));
        const k = ij(ix, iz);
        if (mode === 'max') {
          const h = amount * w;
          if (h > heights[k]) heights[k] = h;
        } else if (mode === 'add') {
          heights[k] += amount * w;
          fresh[k] = clamp(fresh[k] + Math.abs(amount) * w * 0.35, 0, 1);
        } else if (mode === 'smooth') {
          heights[k] += (amount - heights[k]) * w * 0.18;
        }
      }
    }
  }

  function raiseRibbon(s0, s1, halfWidth, heightFn) {
    let span = s1 - s0;
    if (span <= 0) span += 1;
    const len = span * pathLength;
    const steps = Math.max(8, Math.ceil(len / 0.32));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const s = (s0 + (s1 - s0) * t + 1) % 1;
      const p = pointAt(s);
      const hPeak = heightFn(t);
      const latSteps = Math.max(4, Math.ceil((halfWidth * 2) / 0.32));
      for (let k = 0; k <= latSteps; k++) {
        const lat = -halfWidth + (k / latSteps) * halfWidth * 2;
        const fall = 1 - Math.abs(lat) / halfWidth;
        const h = hPeak * fall * fall;
        if (h <= 0.01) continue;
        addGaussian(p.x + p.nx * lat, p.z + p.nz * lat, 0.85, h, 'max');
      }
    }
  }

  function buildPath() {
    const ctrl = [
      [0.0, 24.0],
      [8.5, 23.2],
      [16.8, 18.5],
      [22.0, 10.2],
      [23.2, 1.0],
      [20.4, -9.5],
      [13.2, -18.0],
      [3.2, -22.6],
      [-7.4, -22.0],
      [-16.8, -16.4],
      [-22.4, -7.2],
      [-23.0, 3.2],
      [-18.6, 13.8],
      [-10.4, 21.2],
      [-3.2, 23.8],
    ];
    const n = ctrl.length;
    const raw = [];
    const seg = 24;
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n];
      const p1 = ctrl[i];
      const p2 = ctrl[(i + 1) % n];
      const p3 = ctrl[(i + 2) % n];
      for (let k = 0; k < seg; k++) {
        const t = k / seg;
        raw.push({
          x: catmull(p0[0], p1[0], p2[0], p3[0], t),
          z: catmull(p0[1], p1[1], p2[1], p3[1], t),
        });
      }
    }
    const cum = [0];
    for (let i = 1; i <= raw.length; i++) {
      const a = raw[i - 1];
      const b = raw[i % raw.length];
      cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    pathLength = cum[cum.length - 1];
    path = [];
    for (let i = 0; i < samples; i++) {
      const d = (i / samples) * pathLength;
      let lo = 0;
      let hi = cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= d) lo = mid;
        else hi = mid;
      }
      const span = cum[hi] - cum[lo] || 1;
      const t = (d - cum[lo]) / span;
      const a = raw[lo % raw.length];
      const b = raw[hi % raw.length];
      path.push({
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
      });
    }
    for (let i = 0; i < samples; i++) {
      const a = path[(i - 1 + samples) % samples];
      const b = path[(i + 1) % samples];
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const inv = 1 / (Math.hypot(tx, tz) || 1);
      tx *= inv;
      tz *= inv;
      path[i].tx = tx;
      path[i].tz = tz;
      path[i].nx = -tz;
      path[i].nz = tx;
      path[i].s = i / samples;
    }
  }

  function pointAt(s) {
    const u = ((s % 1) + 1) % 1;
    const f = u * samples;
    const i = Math.floor(f) % samples;
    const j = (i + 1) % samples;
    const t = f - Math.floor(f);
    const a = path[i];
    const b = path[j];
    return {
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      tx: a.tx + (b.tx - a.tx) * t,
      tz: a.tz + (b.tz - a.tz) * t,
      nx: a.nx + (b.nx - a.nx) * t,
      nz: a.nz + (b.nz - a.nz) * t,
      s: u,
    };
  }

  function slopeAlong(s, ds = 0.012) {
    const a = pointAt(s);
    const b = pointAt(s + ds);
    const ha = heightAt(a.x, a.z);
    const hb = heightAt(b.x, b.z);
    const dist = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
    return (hb - ha) / dist;
  }

  function paintPack() {
    pack.fill(0);
    for (let i = 0; i < samples; i++) {
      const p = path[i];
      const { u, v } = xzToUv(p.x, p.z);
      const r = (TRACK_HALF * 1.35 / WORLD) * (RES - 1);
      const r2 = r * r;
      const x0 = clamp(Math.floor(u - r - 1), 0, RES - 1);
      const x1 = clamp(Math.ceil(u + r + 1), 0, RES - 1);
      const z0 = clamp(Math.floor(v - r - 1), 0, RES - 1);
      const z1 = clamp(Math.ceil(v + r + 1), 0, RES - 1);
      for (let iz = z0; iz <= z1; iz++) {
        for (let ix = x0; ix <= x1; ix++) {
          const du = ix - u;
          const dv = iz - v;
          const d2 = du * du + dv * dv;
          if (d2 > r2) continue;
          const w = Math.exp(-d2 / (r2 * 0.42));
          const k = ij(ix, iz);
          if (w > pack[k]) pack[k] = w;
        }
      }
    }
  }

  function sculpt(x, z, radius, strength, tool) {
    if (tool === 'smooth') {
      const { u, v } = xzToUv(x, z);
      const r = (radius / WORLD) * (RES - 1);
      let sum = 0;
      let wsum = 0;
      const x0 = clamp(Math.floor(u - r), 0, RES - 1);
      const x1 = clamp(Math.ceil(u + r), 0, RES - 1);
      const z0 = clamp(Math.floor(v - r), 0, RES - 1);
      const z1 = clamp(Math.ceil(v + r), 0, RES - 1);
      for (let iz = z0; iz <= z1; iz++) {
        for (let ix = x0; ix <= x1; ix++) {
          const du = ix - u;
          const dv = iz - v;
          const d2 = du * du + dv * dv;
          if (d2 > r * r) continue;
          const w = Math.exp(-d2 / (r * r * 0.4));
          sum += heights[ij(ix, iz)] * w;
          wsum += w;
        }
      }
      const avg = wsum > 0 ? sum / wsum : 0;
      addGaussian(x, z, radius, avg, 'smooth');
      return;
    }
    const dir = tool === 'lower' ? -1 : 1;
    addGaussian(x, z, radius, strength * dir, 'add');
  }

  function beginStroke() {
    undo = new Float32Array(heights);
  }

  function revertStroke() {
    if (!undo) return false;
    heights.set(undo);
    undo = null;
    return true;
  }

  function stampWhoops(s0 = 0.1) {
    beginStroke();
    for (let k = 0; k < 6; k++) {
      const s = s0 + (k * 1.85) / pathLength;
      raiseRibbon(s, s + 1.1 / pathLength, TRACK_HALF + 0.55, () => 1.15);
    }
  }

  function stampTable(s0 = 0.34) {
    beginStroke();
    const rise = 2.4 / pathLength;
    const flat = 4.2 / pathLength;
    const down = 2.8 / pathLength;
    raiseRibbon(s0, s0 + rise, TRACK_HALF + 0.65, (t) => t * 2.45);
    raiseRibbon(s0 + rise, s0 + rise + flat, TRACK_HALF + 0.65, () => 2.45);
    raiseRibbon(s0 + rise + flat, s0 + rise + flat + down, TRACK_HALF + 0.65, (t) => 2.45 * (1 - t));
  }

  function stampBerm(s0 = 0.22) {
    beginStroke();
    const len = 9 / pathLength;
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = pointAt(s0 + len * t);
      const lat = TRACK_HALF * 0.55;
      addGaussian(p.x - p.nx * lat, p.z - p.nz * lat, 2.4, 2.15 * Math.sin(Math.PI * t), 'max');
    }
  }

  function seedTerrain() {
    heights.fill(0);
    fresh.fill(0);
    for (let iz = 0; iz < RES; iz++) {
      for (let ix = 0; ix < RES; ix++) {
        const x = (ix / (RES - 1) - 0.5) * WORLD;
        const z = (iz / (RES - 1) - 0.5) * WORLD;
        const r = Math.hypot(x, z) / (WORLD * 0.48);
        let h = (hash(ix, iz) - 0.5) * 0.12;
        if (r > 0.78) h += (r - 0.78) * (r - 0.78) * 18;
        if (r > 1.02) h += (r - 1.02) * 8;
        heights[ij(ix, iz)] = h;
      }
    }
    const bedSteps = Math.ceil(pathLength / 0.3);
    for (let i = 0; i <= bedSteps; i++) {
      const p = pointAt(i / bedSteps);
      addGaussian(p.x, p.z, TRACK_HALF * 1.25, 0.55, 'max');
    }
    raiseRibbon(0.0, 0.08, TRACK_HALF + 0.2, () => 0.12);
    stampWhoops(0.09);
    undo = null;
    stampBerm(0.21);
    undo = null;
    stampTable(0.33);
    undo = null;
    raiseRibbon(0.5, 0.5 + 3.6 / pathLength, TRACK_HALF + 0.4, (t) => (t < 0.4 ? t / 0.4 : 1) * 1.85);
    stampBerm(0.64);
    undo = null;
    raiseRibbon(0.8, 0.9, TRACK_HALF + 0.35, (t) => (1 - t) * 1.2);
    paintPack();
  }

  buildPath();
  seedTerrain();

  return {
    heights,
    pack,
    fresh,
    WORLD,
    RES,
    TRACK_HALF,
    get pathLength() {
      return pathLength;
    },
    heightAt,
    packAt,
    normalAt,
    pointAt,
    slopeAlong,
    sculpt,
    beginStroke,
    revertStroke,
    stampWhoops,
    stampTable,
    stampBerm,
    seedTerrain,
    paintPack,
    vertexXZ(i) {
      const ix = i % RES;
      const iz = Math.floor(i / RES);
      return {
        x: (ix / (RES - 1) - 0.5) * WORLD,
        z: (iz / (RES - 1) - 0.5) * WORLD,
      };
    },
  };
}
