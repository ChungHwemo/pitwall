import { describe, it, expect } from 'vitest';
import { toCarEvent } from '../src/source/claudeCodeImport';

function line(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    timestamp: '2026-07-29T22:31:13.928Z',
    sessionId: 'sess-1',
    cwd: '/Users/me/project-a',
    account: { accountUuid: 'acct-1111', emailAddress: 'me@example.com' },
    attributionAgent: 'general-purpose',
    attributionSkill: 'superpowers:test-driven-development',
    message: { model: 'claude-sonnet-5', usage: { input_tokens: 10, output_tokens: 5 } },
    ...over,
  };
}

describe('차량 = 계정', () => {
  it('같은 계정이면 프로젝트가 달라도 같은 차량이다', () => {
    const a = toCarEvent(line())!;
    const b = toCarEvent(line({ cwd: '/Users/me/project-b' }))!;
    expect(a.car_id).toBe(b.car_id);
  });

  it('계정이 다르면 다른 차량이다', () => {
    const a = toCarEvent(line())!;
    const b = toCarEvent(line({ account: { accountUuid: 'acct-2222' } }))!;
    expect(a.car_id).not.toBe(b.car_id);
  });

  it('계정 uuid도 이메일도 이벤트에 담기지 않는다', () => {
    const json = JSON.stringify(toCarEvent(line()));
    expect(json).not.toContain('acct-1111');
    expect(json).not.toContain('me@example.com');
    expect(json).not.toContain('example.com');
  });

  it('계정 정보가 없으면 익명 차량 하나로 접는다', () => {
    const e = toCarEvent(line({ account: undefined }))!;
    expect(e.car_id).toMatch(/^car-[0-9a-f]{8}$/);
  });
});

describe('에이전트 귀속', () => {
  it('어떤 에이전트가 돌렸는지 담는다', () => {
    expect(toCarEvent(line())!.agent).toBe('general-purpose');
  });

  it('스킬도 담는다', () => {
    expect(toCarEvent(line())!.skill).toBe('superpowers:test-driven-development');
  });

  it('귀속 정보가 없으면 비운다 — 지어내지 않는다', () => {
    const e = toCarEvent(line({ attributionAgent: undefined, attributionSkill: undefined }))!;
    expect(e.agent).toBeUndefined();
    expect(e.skill).toBeUndefined();
  });

  it('서브에이전트 여부를 담는다', () => {
    expect(toCarEvent(line({ isSidechain: true }))!.sidechain).toBe(true);
    expect(toCarEvent(line())!.sidechain).toBeUndefined();
  });
});

describe('실제 에러', () => {
  it('API 에러를 에러 이벤트로 옮긴다', () => {
    const e = toCarEvent(line({ isApiErrorMessage: true, error: 'rate_limit', apiErrorStatus: 429 }))!;
    expect(e.status).toBe('error');
    expect(e.kind).toBe('error');
    expect(e.error_code).toBe('rate_limit');
  });

  it('에러 코드가 없으면 상태 코드를 쓴다', () => {
    const e = toCarEvent(line({ isApiErrorMessage: true, apiErrorStatus: 529 }))!;
    expect(e.error_code).toBe('529');
  });

  it('평범한 호출은 ok다', () => {
    expect(toCarEvent(line())!.status).toBe('ok');
  });
});
