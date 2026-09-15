/** Four riders, skill-differentiated arcade MX. */

export const SKILLS = {
  PRO: {
    maxSpeed: 17.4,
    accel: 11.5,
    brake: 14,
    jump: 0.62,
    landing: 0.58,
    recovery: 0.55,
    skim: 0.82,
    wobble: 0.05,
    line: -0.45,
  },
  VET: {
    maxSpeed: 15.2,
    accel: 9.4,
    brake: 12,
    jump: 0.48,
    landing: 0.44,
    recovery: 0.9,
    skim: 0.55,
    wobble: 0.14,
    line: 0.15,
  },
  AM: {
    maxSpeed: 13.1,
    accel: 7.8,
    brake: 10,
    jump: 0.36,
    landing: 0.3,
    recovery: 1.35,
    skim: 0.28,
    wobble: 0.28,
    line: 0.7,
  },
  NOV: {
    maxSpeed: 11.0,
    accel: 6.2,
    brake: 8,
    jump: 0.22,
    landing: 0.2,
    recovery: 1.9,
    skim: 0.08,
    wobble: 0.48,
    line: -0.2,
  },
};

export const RIDER_DEFS = [
  { id: 'kim', number: 12, name: 'KIM', skillName: 'PRO', color: '#c41e3a' },
  { id: 'park', number: 27, name: 'PARK', skillName: 'VET', color: '#1e5aa8' },
  { id: 'lee', number: 44, name: 'LEE', skillName: 'AM', color: '#d9a116' },
  { id: 'cho', number: 91, name: 'CHO', skillName: 'NOV', color: '#2f8f57' },
];

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function makeRider(def, park, index) {
  const skill = SKILLS[def.skillName];
  const gap = (2.6 * (index + 1)) / park.pathLength;
  const s0 = (1 - gap) % 1;
  return {
    ...def,
    skill,
    s: s0,
    lat: skill.line,
    speed: 0,
    y: 0,
    vy: 0,
    pitch: 0,
    roll: 0,
    airborne: false,
    crashed: 0,
    laps: 0,
    lastS: s0,
    started: false,
    finished: false,
    finishTime: 0,
    state: 'idle',
    dust: 0,
    player: false,
  };
}

const TRACK_SOFT = 2.15;

export function createRace(park, laps = 4) {
  const riders = RIDER_DEFS.map((d, i) => makeRider(d, park, i));
  const race = {
    phase: 'countdown',
    time: 0,
    count: 3,
    laps,
    winner: null,
    paused: false,
  };

  function placeOnGround(r) {
    const p = park.pointAt(r.s);
    const x = p.x + p.nx * r.lat;
    const z = p.z + p.nz * r.lat;
    r.y = park.heightAt(x, z);
    r.vy = 0;
    r.airborne = false;
    r.pitch = Math.atan(park.slopeAlong(r.s));
    r.roll = 0;
    return { x, z, p };
  }

  for (const r of riders) placeOnGround(r);

  function whoopiness(s) {
    let flips = 0;
    let prev = park.slopeAlong(s);
    for (let k = 1; k <= 8; k++) {
      const sl = park.slopeAlong(s + (k * 0.9) / park.pathLength);
      if (prev > 0.12 && sl < -0.08) flips++;
      prev = sl;
    }
    return flips;
  }

  function stepRider(r, dt, input) {
    if (r.finished) return placeOnGround(r);

    if (r.crashed > 0) {
      r.crashed -= dt;
      r.speed *= 0.2;
      r.state = 'crash';
      r.roll = 1.25;
      r.dust = 0.4;
      if (r.crashed <= 0) {
        r.lat = r.skill.line;
        r.speed = 2.5;
        r.roll = 0;
        r.state = 'run';
      }
      return placeOnGround(r);
    }

    const p = park.pointAt(r.s);
    const x = p.x + p.nx * r.lat;
    const z = p.z + p.nz * r.lat;
    const ground = park.heightAt(x, z);
    const slope = park.slopeAlong(r.s);
    const look = park.slopeAlong(r.s + 2.4 / park.pathLength);
    const lookFar = park.slopeAlong(r.s + 4.2 / park.pathLength);

    let steer = 0;
    let throttle = 0.72;
    let brake = 0;
    if (r.player && input) {
      throttle = input.throttle;
      brake = input.brake;
      steer = input.steer;
    } else {
      const targetLat = r.skill.line + Math.sin(race.time * 1.7 + r.number) * r.skill.wobble;
      steer = clamp(targetLat - r.lat, -1, 1);
      const curve = Math.abs(look) + Math.abs(lookFar);
      throttle = clamp(1 - curve * 0.55, 0.25, 1);
      if (slope > 0.35) throttle = 1;
      if (whoopiness(r.s) >= 3 && r.skill.skim < 0.4) brake = 0.35;
    }

    const desired = r.skill.maxSpeed * throttle;
    if (r.speed < desired) r.speed += r.skill.accel * dt * (0.55 + throttle);
    else r.speed -= r.skill.brake * dt * 0.55;
    r.speed -= brake * r.skill.brake * dt;
    r.speed += -slope * 3.4 * dt;
    if (!r.airborne && whoopiness(r.s) >= 3) {
      r.speed -= (1 - r.skill.skim) * 6.5 * dt;
    }
    r.speed = clamp(r.speed, 0.4, r.skill.maxSpeed + 2);

    r.lat += steer * (r.player ? 4.8 : 2.6) * dt;
    r.lat = clamp(r.lat, -3.4, 3.4);
    if (Math.abs(r.lat) > TRACK_SOFT) r.speed *= 0.985;

    const lip = slope > 0.26 && look < -0.08;
    if (!r.airborne && lip && r.speed > 6.5) {
      r.airborne = true;
      r.vy = r.speed * (0.28 + r.skill.jump) * Math.min(slope, 0.9);
      r.state = 'jump';
    }

    if (r.airborne) {
      r.vy -= 18.5 * dt;
      r.y += r.vy * dt;
      r.pitch += (Math.atan2(r.vy, Math.max(r.speed, 1)) - r.pitch) * 0.12;
      if (r.y <= ground && r.vy <= 0) {
        const err = Math.abs(r.pitch - Math.atan(slope));
        if (err > r.skill.landing && r.speed > 7) {
          r.crashed = r.skill.recovery;
          r.speed = 0;
          r.airborne = false;
          r.y = ground;
          r.state = 'crash';
        } else {
          r.airborne = false;
          r.y = ground;
          r.vy = 0;
          r.state = 'run';
          r.dust = 1;
        }
      }
    } else {
      r.y = ground;
      r.vy = 0;
      r.pitch += (Math.atan(slope) - r.pitch) * 0.2;
      r.roll += ((r.lat - r.skill.line) * -0.18 - r.roll) * 0.15;
      r.state = r.speed < 3 ? 'idle' : 'run';
      r.dust = clamp(r.speed / r.skill.maxSpeed, 0, 1) * 0.55;
    }

    const ds = r.speed * dt / park.pathLength;
    r.lastS = r.s;
    r.s = (r.s + ds) % 1;
    if (r.s < r.lastS - 0.5) {
      if (!r.started) {
        r.started = true;
      } else {
        r.laps += 1;
      }
      if (r.laps >= race.laps && !r.finished) {
        r.finished = true;
        r.finishTime = race.time;
        r.speed = 0;
        if (!race.winner) race.winner = r;
      }
    }

    const q = park.pointAt(r.s);
    return {
      x: q.x + q.nx * r.lat,
      z: q.z + q.nz * r.lat,
      p: q,
      ground: park.heightAt(q.x + q.nx * r.lat, q.z + q.nz * r.lat),
    };
  }

  function step(dt, input) {
    if (race.paused) return snapshot();
    if (race.phase === 'done') {
      for (const r of riders) placeOnGround(r);
      return snapshot();
    }
    if (race.phase === 'countdown') {
      race.count -= dt;
      for (const r of riders) placeOnGround(r);
      if (race.count <= 0) {
        race.phase = 'green';
        race.time = 0;
      }
      return snapshot();
    }
    race.time += dt;
    const poses = riders.map((r) => stepRider(r, dt, r.player ? input : null));
    for (let i = 0; i < riders.length; i++) {
      for (let j = i + 1; j < riders.length; j++) {
        const a = poses[i];
        const b = poses[j];
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.15 && d > 1e-4) {
          const push = (1.15 - d) * 0.5;
          riders[i].lat += (dx * push) / d * 0.15;
          riders[j].lat -= (dx * push) / d * 0.15;
        }
      }
    }
    if (riders.every((r) => r.finished) || (race.winner && race.time - race.winner.finishTime > 8)) {
      race.phase = 'done';
    }
    return snapshot(poses);
  }

  function snapshot(poses) {
    const order = [...riders].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.laps !== b.laps) return b.laps - a.laps;
      return b.s - a.s;
    });
    return {
      race,
      riders,
      order,
      poses: poses || riders.map((r) => {
        const p = park.pointAt(r.s);
        return { x: p.x + p.nx * r.lat, z: p.z + p.nz * r.lat, p, ground: r.y };
      }),
    };
  }

  function restart() {
    riders.forEach((r, i) => {
      const fresh = makeRider(RIDER_DEFS[i], park, i);
      Object.assign(r, fresh, { player: r.player });
      placeOnGround(r);
    });
    race.phase = 'countdown';
    race.time = 0;
    race.count = 3;
    race.winner = null;
    race.paused = false;
  }

  function setPlayer(id) {
    for (const r of riders) r.player = r.id === id;
  }

  return { riders, race, step, restart, setPlayer, snapshot };
}
