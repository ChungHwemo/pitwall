import type { CarEvent } from '../types';
import type { EventSource } from './EventSource';
import { toCarEvent } from './claudeCodeImport';
import { accountCar, codexEvent, grokEvent, copilotEvents } from './agentLogs';

/**
 * 로그를 **지금** 읽는 소스.
 *
 * 재생은 빌드 시점에 심은 하루를 되돌릴 뿐이라 방금 태운 토큰이 화면에 오지
 * 않는다. 여기서는 네이티브 껍데기가 `~/.claude`·`~/.codex`·`~/.grok`을 따라가며
 * **새로 붙은 줄을 그대로** 넘겨주고, 파싱은 재생·임포트와 같은 파서가 한다 —
 * 파서를 두 벌로 만들면 두 화면이 서로 다른 사실을 말하기 시작한다.
 *
 * **원본 식별자는 여기서 끝난다.** 계정 uuid는 해시로만 이벤트에 남는다 (PRIV-3).
 */

export type LiveVendor = 'claude' | 'codex' | 'grok' | 'copilot';

export interface LiveAccounts {
  /** `~/.claude.json`의 `oauthAccount.accountUuid`. 이메일은 읽지 않는다 */
  claudeAccountUuid?: string;
  /** `~/.codex/auth.json`의 `tokens.account_id` */
  codexAccountId?: string;
}

/**
 * 벤더가 알려준 한도 스냅샷 (`fixtures/limits.json`과 같은 모양).
 *
 * Codex·Grok은 자기 로그에 한도를 적지만 Claude는 안 적는다 — 서버가 계산한
 * 값이라 OAuth 사용량 엔드포인트로만 온다. 실시간 화면에서 그 게이지가 비면
 * "한도 미제공"이 뜨는데, 값이 없는 게 아니라 **경로가 없는** 것이다.
 */
export interface VendorLimitSnapshot {
  vendor: string;
  fetchedAt: number;
  windows: { utilization: number; window_minutes: number; resets_at: string | null }[];
}

/** 한 프레임에 내보낼 최대 이벤트 수. 밀린 줄로 프레임을 굶기지 않는다. */
const DEFAULT_DRAIN = 64;

export class LiveSource implements EventSource {
  private onEvent: ((event: CarEvent) => void) | null = null;
  private queue: CarEvent[] = [];
  /** 벤더별 현재 모델. tail은 줄을 나눠 주므로 상태를 여기서 들고 있어야 한다. */
  private model: Partial<Record<LiveVendor, string>> = {};
  private limits = new Map<string, { utilization: number; window_minutes: number; resets_at: string | null; fetchedAt: number }>();

  private accounts: LiveAccounts;

  constructor(accounts: LiveAccounts = {}, private readonly drainPerTick: number = DEFAULT_DRAIN) {
    this.accounts = accounts;
  }

  /**
   * 껍데기는 페이지가 뜬 뒤에 계정을 알려준다. 소스를 그때 만들면 첫 줄을
   * 놓치므로 먼저 만들어 두고 여기서 채운다.
   */
  configure(accounts: LiveAccounts): void {
    this.accounts = { ...this.accounts, ...accounts };
  }

  /** 벤더별 한도 스냅샷. 로그가 스스로 들고 온 값은 덮지 않는다. */
  setLimits(snapshots: VendorLimitSnapshot[]): void {
    this.limits.clear();
    for (const snap of snapshots) {
      // 창이 여럿이면 짧은 쪽이 먼저 막는다.
      const shortest = [...snap.windows].sort((a, b) => a.window_minutes - b.window_minutes)[0];
      if (shortest) this.limits.set(snap.vendor, { ...shortest, fetchedAt: snap.fetchedAt });
    }
  }

  /** 로그에 한도가 없던 이벤트에만 스냅샷을 입힌다. */
  private withLimit(vendor: LiveVendor, event: CarEvent): CarEvent {
    if (event.tyre_pct !== undefined) return event;
    const limit = this.limits.get(vendor);
    if (!limit) return event;
    const resets = limit.resets_at === null ? NaN : Date.parse(limit.resets_at);
    return {
      ...event,
      tyre_pct: Math.max(0, 100 - limit.utilization),
      limit_window_minutes: limit.window_minutes,
      limit_resets_at: Number.isFinite(resets) ? resets : undefined,
      limit_observed_at: limit.fetchedAt,
    };
  }

  /** 네이티브 껍데기가 새 줄을 밀어 넣는다. 파싱 실패는 조용히 버린다. */
  ingest(vendor: LiveVendor, lines: string[]): void {
    for (const line of lines) {
      if (!line.trim()) continue;
      let row: unknown;
      try { row = JSON.parse(line); } catch { continue; }
      for (const e of this.parse(vendor, row)) this.queue.push(this.withLimit(vendor, e));
    }
  }

  private parse(vendor: LiveVendor, row: unknown): CarEvent[] {
    if (vendor === 'claude') {
      const account = this.accounts.claudeAccountUuid === undefined
        ? undefined
        : { accountUuid: this.accounts.claudeAccountUuid };
      const e = toCarEvent(
        typeof row === 'object' && row !== null ? { ...row, account } : row);
      return e ? [e] : [];
    }

    if (vendor === 'codex') {
      // 모델은 `turn_context`에 있고 사용량은 `token_count`에 있다. 다른 줄이다.
      const payload = (row as Record<string, unknown>)?.payload as Record<string, unknown> | undefined;
      const named = (payload?.ctx as Record<string, unknown> | undefined)?.model ?? payload?.model;
      if (typeof named === 'string' && named.startsWith('gpt-')) this.model.codex = named;
      const car = accountCar('codex', this.accounts.codexAccountId ?? 'codex');
      const e = codexEvent(row, { car, model: this.model.codex });
      return e ? [e] : [];
    }

    if (vendor === 'grok') {
      const ctx = (row as Record<string, unknown>)?.ctx as Record<string, unknown> | undefined;
      const named = ctx?.model ?? ctx?.current_model_id;
      if (typeof named === 'string' && named.startsWith('grok-')) this.model.grok = named;
      const e = grokEvent(row, { car: accountCar('grok', 'grok'), model: this.model.grok });
      return e ? [e] : [];
    }

    return copilotEvents(row, { car: accountCar('copilot', 'copilot') });
  }

  start(onEvent: (event: CarEvent) => void): void {
    this.onEvent = onEvent;
  }

  stop(): void {
    this.onEvent = null;
  }

  setSpeed(): void {
    // 실시간에는 배속이 없다. 지금 일어나는 일이 지금 나온다.
  }

  tick(nowMs: number): void {
    const emit = this.onEvent;
    if (!emit) return;

    const batch = this.queue.splice(0, this.drainPerTick);
    for (const e of batch) {
      // 리듀서의 유휴 판정은 내부 시계를 쓴다. 표시용 원본 시각은 따로 남긴다.
      emit({ ...e, ts: nowMs, wall_ts: e.wall_ts ?? e.ts });
    }
  }

  /** 실시간은 지금이 곧 시계다. */
  replayClock(): Date {
    return new Date();
  }

  /** 대기 중인 줄 수. 껍데기가 너무 빨리 밀어 넣는지 보는 용도. */
  get pending(): number {
    return this.queue.length;
  }
}
