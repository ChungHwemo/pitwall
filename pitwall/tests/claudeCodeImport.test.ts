import { describe, it, expect } from 'vitest';
import { toCarEvent, CAR_SALT } from '../src/source/claudeCodeImport';

/** 실제 트랜스크립트 한 줄의 형태 (본문 포함). */
function line(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'assistant',
    timestamp: '2026-07-29T22:31:13.928Z',
    sessionId: 'sess-abc',
    cwd: '/Users/me/Documents/project-a',
    gitBranch: 'main',
    requestId: 'req-1',
    message: {
      model: 'claude-opus-5',
      role: 'assistant',
      // 본문 — 절대 CarEvent로 넘어오면 안 된다.
      content: [{ type: 'text', text: '비밀 프롬프트 내용과 응답' }],
      usage: {
        input_tokens: 2,
        cache_creation_input_tokens: 44_761,
        cache_read_input_tokens: 0,
        output_tokens: 312,
      },
    },
    ...over,
  };
}

describe('toCarEvent', () => {
  it('usage가 있는 줄을 CarEvent로 바꾼다', () => {
    const e = toCarEvent(line())!;
    expect(e.model).toBe('claude-opus-5');
    expect(e.ts).toBe(Date.parse('2026-07-29T22:31:13.928Z'));
    expect(e.session_id).toBe('sess-abc');
  });

  it('usage가 없는 줄은 건너뛴다', () => {
    expect(toCarEvent({ type: 'user', message: { role: 'user' } })).toBeNull();
    expect(toCarEvent({})).toBeNull();
  });

  it('prompt 토큰은 입력·캐시 읽기·캐시 생성의 합이다', () => {
    const e = toCarEvent(line())!;
    expect(e.tokens.prompt).toBe(2 + 44_761 + 0);
    expect(e.tokens.completion).toBe(312);
  });

  it('캐시 읽기가 있으면 cache_hit이다', () => {
    const hit = line({ message: { model: 'claude-opus-5', usage: {
      input_tokens: 5, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0, output_tokens: 10 } } });
    expect(toCarEvent(hit)!.cache_hit).toBe(true);
    expect(toCarEvent(line())!.cache_hit).toBe(false);
  });

  it('카탈로그에 있는 모델이면 그 단가로 비용을 낸다', () => {
    const e = toCarEvent(line())!;
    // opus-5: 입력 $5 / 출력 $25 per Mtok
    expect(e.cost_usd).toBeCloseTo((44_763 * 5 + 312 * 25) / 1_000_000, 12);
  });

  it('카탈로그에 없는 모델은 비용을 0으로 두고 지어내지 않는다', () => {
    const e = toCarEvent(line({ message: { model: 'some-unknown-model', usage: {
      input_tokens: 100, output_tokens: 50 } } }))!;
    expect(e.cost_usd).toBe(0);
    expect(e.model).toBe('some-unknown-model');
  });

  it('본문·경로·브랜치를 CarEvent에 담지 않는다', () => {
    // PRIV-4/PRIV-8. 원본에 있다고 가져오지 않는다.
    const json = JSON.stringify(toCarEvent(line()));
    expect(json).not.toContain('비밀 프롬프트');
    expect(json).not.toContain('content');
    expect(json).not.toContain('project-a');
    expect(json).not.toContain('gitBranch');
    expect(json).not.toContain('requestId');
  });

  it('car_id는 경로 원문이 아니라 해시다', () => {
    const e = toCarEvent(line())!;
    expect(e.car_id).not.toContain('/Users/me');
    expect(e.car_id).toMatch(/^car-[0-9a-f]{8}$/);
  });

  it('같은 프로젝트는 같은 차량, 다른 프로젝트는 다른 차량이다', () => {
    const a = toCarEvent(line())!;
    const b = toCarEvent(line())!;
    const c = toCarEvent(line({ cwd: '/Users/me/Documents/project-b' }))!;
    expect(a.car_id).toBe(b.car_id);
    expect(a.car_id).not.toBe(c.car_id);
  });

  it('카넘버는 1..999이며 car_id에서 결정론적으로 나온다', () => {
    const e = toCarEvent(line())!;
    expect(e.car_number).toBeGreaterThanOrEqual(1);
    expect(e.car_number).toBeLessThanOrEqual(999);
    expect(toCarEvent(line())!.car_number).toBe(e.car_number);
  });

  it('솔트를 바꾸면 car_id가 달라진다 — 해시가 고정 매핑이 아니다', () => {
    const withSalt = toCarEvent(line(), 'other-salt')!;
    expect(withSalt.car_id).not.toBe(toCarEvent(line(), CAR_SALT)!.car_id);
  });

  it('클래스는 모델 카탈로그에서 나온다', () => {
    expect(toCarEvent(line())!.car_class).toBe('H');
    const sonnet = line({ message: { model: 'claude-sonnet-5', usage: { input_tokens: 1, output_tokens: 1 } } });
    expect(toCarEvent(sonnet)!.car_class).toBe('P');
  });

  it('타이어는 넣지 않는다 — 소스가 없다', () => {
    expect(toCarEvent(line())!.tyre_pct).toBeUndefined();
  });

  it('깨진 타임스탬프는 건너뛴다', () => {
    expect(toCarEvent(line({ timestamp: 'not-a-date' }))).toBeNull();
  });
});

describe('모델 별칭', () => {
  it('날짜가 붙은 id도 카탈로그 단가를 쓴다', () => {
    // 실제 응답은 claude-haiku-4-5-20251001 처럼 날짜 별칭으로 온다.
    const dated = line({ message: { model: 'claude-haiku-4-5-20251001', usage: {
      input_tokens: 1_000_000, output_tokens: 0 } } });
    expect(toCarEvent(dated)!.cost_usd).toBeCloseTo(1, 9);   // haiku 입력 $1/Mtok
    expect(toCarEvent(dated)!.car_class).toBe('P');
  });

  it('날짜가 아닌 접미사는 별칭으로 보지 않는다', () => {
    const other = line({ message: { model: 'claude-opus-5-turbo', usage: {
      input_tokens: 1_000_000, output_tokens: 0 } } });
    expect(toCarEvent(other)!.cost_usd).toBe(0);
  });
});
