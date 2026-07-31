import { describe, it, expect, vi } from 'vitest';
import { PitwallApp } from '../src/main';
import { ReplaySource } from '../src/source/ReplaySource';
import type { CarEvent } from '../src/types';

function event(ts: number, over: Partial<CarEvent> = {}): CarEvent {
  return {
    ts, car_id: 'car-a', car_number: 12, car_class: 'P', model: 'claude-opus-5',
    kind: 'call', tokens: { prompt: 6_000, completion: 400, cache_read: 1_000 },
    cache_hit: true, cost_usd: 0.5, latency_ms: 0, status: 'ok', fuel_pct: 100,
    tyre_pct: 80, limit_window_minutes: 300, ...over,
  };
}

describe('앱 경로의 움직임', () => {
  it('이벤트 사이 프레임에도 차가 움직인다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const root = document.createElement('div');
    document.body.appendChild(root);

    // 원본 타임라인에서 2초 간격 호출 10건.
    const base = Date.parse('2026-07-30T10:00:00+09:00');
    const events = Array.from({ length: 10 }, (_, i) => event(base + i * 2_000));

     const app = new PitwallApp(root, {
       seed: 5, preset: 'sparse', speed: 30,
       source: new ReplaySource(events, 30),
     });
    app.start();

    const xy = () => {
      const g = root.querySelector('svg.track g.cold, svg.track g.car') as SVGGElement | null;
      return g?.style.transform ?? '';
    };

    // 이벤트가 흘러들도록 몇 프레임 돌린 뒤, 연속 프레임의 위치를 모은다.
    for (let t = 16; t <= 400; t += 16) app.frame(t);
    const seen: string[] = [];
    for (let t = 416; t <= 800; t += 16) { app.frame(t); seen.push(xy()); }

    const still = seen.filter((v, i) => i > 0 && v === seen[i - 1]!).length;
    expect(seen.filter(Boolean).length).toBeGreaterThan(10);
    // 절반 넘게 같은 자리면 정지 화면이다.
    expect(still).toBeLessThan(seen.length / 2);
  });
});
