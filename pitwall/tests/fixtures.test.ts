import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODEL_CATALOG, costUsd, specOf } from '../src/config/models';
import { isCarClass } from '../src/types';
import type { CarClass, CarEvent } from '../src/types';
import { applyEvent, emptyRaceState, IDLE_THRESHOLD_MS } from '../src/state/reducer';
import { DENSE_FROM } from '../src/render/towerRenderer';
import { PER_SET, busiestWindow } from '../scripts/pickWindow';

/**
 * 커밋된 데이터가 CarEvent 계약을 계속 지키는지 검사한다.
 * 계약이 바뀌면 fixture를 다시 뽑아야 하고, 이 테스트가 그걸 알려준다.
 *
 * 더미(busy/sparse/chaos, demo-*)와 **실기록**(real, real-busy)을 한 계약으로 검사한다.
 * 실기록만 두 가지가 다르다 — 모델 id에 날짜 접미사가 붙고(specOf가 정규화),
 * car_id가 hex 해시다. 계약을 그만큼만 넓히고 나머지는 똑같이 못박는다.
 */
const PRESETS = ['busy', 'sparse', 'chaos'] as const;
const FIXTURES = [
  'busy', 'sparse', 'chaos',
  'real', 'real-busy',
  'demo-small', 'demo', 'demo-large',
] as const;

function load(name: string): CarEvent[] {
  const path = resolve(import.meta.dirname, `../fixtures/events.${name}.jsonl`);
  return readFileSync(path, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as CarEvent);
}

describe.each(FIXTURES)('fixtures/events.%s.jsonl', (name) => {
  const events = load(name);

  it('비어 있지 않다', () => {
    expect(events.length).toBeGreaterThan(0);
  });

  it('모든 이벤트가 카탈로그의 모델을 쓴다', () => {
    // specOf는 날짜 별칭(claude-haiku-4-5-20251001)을 카탈로그 항목으로 정규화한다.
    // 실기록은 그 별칭을 그대로 쓰므로, 정확 일치만 보면 실기록이 "모르는 모델"로
    // 떨어져 비용이 0이 된다. 정규화된 매핑이 존재하는지로 검사한다.
    for (const e of events) expect(specOf(e.model), e.model).toBeDefined();
  });

  it('클래스가 유효하고 모델의 클래스와 일치한다', () => {
    for (const e of events) {
      expect(isCarClass(e.car_class)).toBe(true);
      expect(specOf(e.model)!.carClass).toBe(e.car_class);
    }
  });

  it('비용이 그 모델의 단가와 맞는다', () => {
    for (const e of events) {
      const spec = specOf(e.model)!;
      const cached = e.tokens.cache_read ?? 0;
      expect(e.cost_usd).toBeCloseTo(
        costUsd(spec, e.tokens.prompt - cached, cached,
          e.tokens.completion + (e.tokens.reasoning ?? 0)), 10);
    }
  });

  it('프롬프트·응답 본문이 들어 있지 않다', () => {
    // PRD PRIV-4. 더미에서도 본문 필드를 만들지 않는다 — fixture가 실 어댑터의
    // 참조 형태가 되기 때문이다. 실기록에서 본문이 새면 임포터가 어긴 것이다.
    for (const e of events) {
      expect(e).not.toHaveProperty('messages');
      expect(e).not.toHaveProperty('response');
      expect(e).not.toHaveProperty('proxy_server_request');
      expect(e).not.toHaveProperty('requester_ip_address');
    }
  });

  it('car_id가 원본 식별자처럼 보이지 않는다', () => {
    // PRIV-3: 사람 이름·이메일·사번이 새면 익명성이 깨진다.
    // 실기록은 hex 8자리 해시(car-d4a4f799), 시뮬 더미는 car-3자리, 데모 더미는
    // demo-3자리. 어느 쪽도 원본 식별자로 되돌릴 수 없는 익명 접두사다.
    for (const e of events) {
      expect(e.car_id).toMatch(/^(car|demo)-([0-9a-f]{8}|\d{3})$/);
    }
  });

  it('카넘버가 1..999 범위다', () => {
    for (const e of events) {
      expect(e.car_number).toBeGreaterThanOrEqual(1);
      expect(e.car_number).toBeLessThanOrEqual(999);
    }
  });

  it('시각이 단조 증가한다', () => {
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.ts).toBeGreaterThanOrEqual(events[i - 1]!.ts);
    }
  });
});

describe('프리셋 간 차이가 실제로 드러난다', () => {
  it('chaos의 에러율이 sparse보다 높다', () => {
    const rate = (n: string) => {
      const e = load(n);
      return e.filter((x) => x.status === 'error').length / e.length;
    };
    expect(rate('chaos')).toBeGreaterThan(rate('sparse'));
  });

  it('세 프리셋 모두 여러 공급자를 섞는다', () => {
    for (const name of PRESETS) {
      const providers = new Set(load(name).map(
        (e) => MODEL_CATALOG.find((m) => m.id === e.model)!.provider));
      expect(providers.size, `${name} 공급자 수`).toBeGreaterThanOrEqual(4);
    }
  });
});

/*
 * 데이터가 **화면 경로를 실제로 밟는가**.
 *
 * 계약을 지키는 것과 쓸모가 있는 것은 다르다. 실측 분포로 다시 잡으면서 활동을
 * 24시간에 흩뜨렸더니, 계정 40개짜리 데이터셋이 화면에 동시에 5대까지만 올려
 * 밀집 모드가 한 번도 안 돌았다 — 그걸 밟으라고 만든 데이터셋이었다.
 * 조용히 쓸모를 잃는 종류라 검사로 못박는다.
 *
 * **빌드가 실제로 심는 것**을 검사한다. 앱은 상한(PER_SET)을 넘는 파일에서
 * busiestWindow로 잘린 5,000건만 심는데, 전체 파일로 검사하면 잘린 구간이
 * 텅 비어도 이 테스트는 통과한다 — busiestWindow가 망가지는 걸 못 잡는다.
 * built()가 vite.config와 같은 규칙으로 자른다.
 *
 * 브라우저 재생으로는 못 잡는다. 헤드리스 가상 시간이 재생 57분에서 멈춰
 * 하루의 24%밖에 안 돈다. 여기서는 시계 없이 리듀서로 하루를 통과시킨다.
 */
describe('데이터가 화면 경로를 밟는가', () => {
  /** vite.config가 실제로 심는 것 — 상한을 넘으면 busiestWindow로 잘린 구간. */
  const built = (name: string): CarEvent[] => {
    const path = resolve(import.meta.dirname, `../fixtures/events.${name}.jsonl`);
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    if (lines.length <= PER_SET) return lines.map((l) => JSON.parse(l) as CarEvent);
    const w = busiestWindow(lines, PER_SET);
    return lines.slice(w.at, w.at + PER_SET).map((l) => JSON.parse(l) as CarEvent);
  };

  /** 타워 밀집: 하루를 리듀서로 통과시킨 뒤 **누적** distinct 차량 수. */
  const seen = (name: string): number => {
    let state = emptyRaceState(0);
    for (const e of built(name)) state = applyEvent(state, e);
    return state.cars.size;
  };

  /*
   * 트랙 밀집: **동시에** 활동 중인 차량 수의 최대치와 클래스별 최대치.
   *
   * 누적(seen)과는 다른 축이다 — 하루 동안 40대가 다녀가도 한 번에 한 대씩이면
   * 트랙은 늘 한산하고 레인은 갈리지 않는다. 리듀서와 같은 유휴 기준으로
   * (now - 마지막 호출 <= IDLE) 활동 중인 차량을 센다. 클래스는 reducer의
   * initialCar와 똑같이 첫 이벤트 기준으로 고정한다.
   */
  const maxConcurrent = (events: CarEvent[]): { total: number; byClass: Map<CarClass, number> } => {
    const firstClass = new Map<string, CarClass>();
    const last = new Map<string, number>();
    let total = 0;
    const byClass = new Map<CarClass, number>();
    for (const e of events) {
      if (!firstClass.has(e.car_id)) firstClass.set(e.car_id, e.car_class);
      last.set(e.car_id, e.ts);
      let live = 0;
      const perClass = new Map<CarClass, number>();
      for (const [id, ts] of last) {
        if (e.ts - ts > IDLE_THRESHOLD_MS) continue;
        live++;
        const c = firstClass.get(id)!;
        perClass.set(c, (perClass.get(c) ?? 0) + 1);
      }
      if (live > total) total = live;
      for (const [c, n] of perClass) {
        if (n > (byClass.get(c) ?? 0)) byClass.set(c, n);
      }
    }
    return { total, byClass };
  };

  const maxLane = (m: Map<CarClass, number>) => Math.max(0, ...m.values());

  it('대규모는 밀집 모드를 넘긴다 — 그러라고 있는 데이터셋이다', () => {
    expect(seen('demo-large'), '누적 차량').toBeGreaterThan(DENSE_FROM);
  });

  it('중규모도 넘긴다', () => {
    expect(seen('demo'), '누적 차량').toBeGreaterThan(DENSE_FROM);
  });

  it('소규모는 안 넘긴다 — 넘기면 세 벌을 둘 이유가 없다', () => {
    expect(seen('demo-small'), '누적 차량').toBeLessThanOrEqual(DENSE_FROM);
  });

  it('대규모는 동시 활동도 밀집 모드를 넘긴다 — 트랙이 실제로 붐빈다', () => {
    // 누적이 아니라 한 순간에 트랙 위에 있는 대수. busiestWindow가 하루의
    // 좁은 끝자락을 고르면 누적은 높아도 동시는 5대에 눌린다 — 그 회귀를 못박는다.
    expect(maxConcurrent(built('demo-large')).total, '동시 차량').toBeGreaterThan(DENSE_FROM);
  });

  it('real-busy는 레인 분리가 일어난다 — 그래서 두 벌을 둔다', () => {
    // 셋이 겹친 실제 하루. P 2대가 겹쳐 레인이 갈린다 — 그걸로 두 벌의 이유를 못박는다.
    const lane = maxConcurrent(built('real-busy')).byClass;
    expect(maxLane(lane), '같은 클래스 동시 최대').toBeGreaterThanOrEqual(2);
  });

  it('real은 누적 계정이 real-busy보다 적다 — 그래서 두 벌을 둔다', () => {
    // 예전에는 opus-4-6을 P로 잘못 붙여 "클래스가 갈려 레인 분리가 없다"고
    // 못박았다. 공식 단가($25 출력)는 H다. 솔과 opus가 둘 다 H면 같은 클래스
    // 동시 2대가 생긴다. 두 벌의 진짜 차이는 밀도다.
    expect(seen('real'), '누적 차량').toBeLessThan(seen('real-busy'));
  });

  /*
   * 무전과 피드의 스킬 칸이 같은 문자열만 반복하면 33종이 도는 화면과
   * 다르게 보인다. 예전 더미는 한 종류였다.
   */
  it('스킬이 실측만큼 다양하다', () => {
    const skills = new Set(load('demo-large').map((e) => e.skill).filter(Boolean));
    expect(skills.size).toBeGreaterThanOrEqual(20);
  });

  /** 에러 경로는 더미로만 검증된다 — 실기록은 54일 89,655건에 에러가 0이다. */
  it('정지 경로가 밟힌다 — 에러와 한도가 둘 다 나온다', () => {
    const events = load('demo-large');
    expect(events.some((e) => e.status === 'error')).toBe(true);
    expect(events.some((e) => (e.tyre_pct ?? 100) < 15)).toBe(true);
  });
});

/*
 * busiestWindow가 실제로 "가장 겹치는 연속 구간"을 고르는가.
 *
 * 이 함수가 조용히 마지막 구간으로 되돌아가면 계정 40개짜리가 다시 동시 5대로
 * 눌린다 — 화면은 통과하는 검사 뒤에서 거짓을 말한다. 합성 행렬로 못박는다.
 */
describe('busiestWindow', () => {
  const row = (id: string) => `{"car_id":"${id}"}`;

  it('흩어진 구간이 아니라 뭉친 구간을 고른다', () => {
    // 앞 절반은 한 계정만 반복(흩어짐), 뒤 절반은 서로 다른 셋(뭉침).
    const rows = [
      row('car-001'), row('car-001'), row('car-001'),
      row('car-002'), row('car-003'), row('car-004'),
    ];
    // size=3: 뒤쪽 창이 계정 3대로 최대. 마지막 구간을 잘라 쓰던 회귀를 잡는다.
    expect(busiestWindow(rows, 3).cars).toBe(3);
  });

  it('rows가 size보다 짧으면 통째로 쓰고 전체 계정 수를 센다', () => {
    const rows = [row('car-001'), row('car-002')];
    expect(busiestWindow(rows, 5)).toEqual({ at: 0, cars: 2 });
  });
});
