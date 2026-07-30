import type { CarEvent, CarState, RacePhase } from '../types';

export interface RadioMessage {
  id: string;
  carNumber: number;
  text: string;
  severity: 'info' | 'warn' | 'critical';
  ts: number;
}

let counter = 0;
function nextId(): string {
  return `radio-${++counter}`;
}

/**
 * 룰 기반 템플릿만 쓴다. LLM을 부르지 않고 프롬프트·응답 본문을 읽지 않는다.
 * 다른 차량과 비교하는 문장을 만들지 않는다 (PRD §10.3).
 */
export function eventRadio(event: CarEvent): RadioMessage | null {
  const base = { id: nextId(), carNumber: event.car_number, ts: event.ts };

  switch (event.kind) {
    case 'error':
      return { ...base, severity: 'warn', text: `문제 발생 — ${event.error_code ?? 'unknown'}` };
    case 'retire':
      return { ...base, severity: 'critical', text: 'RETIRED — 한도 소진' };
    case 'pit_in':
      return { ...base, severity: 'info', text: 'BOX BOX — 피트인' };
    case 'pit_out':
      return { ...base, severity: 'info', text: '피트 아웃 — 코스 복귀' };
    case 'limit_warn':
      return { ...base, severity: 'warn', text: `연료 ${Math.round(event.fuel_pct)}% — 관리 필요` };
    default:
      return null;
  }
}

/**
 * 상태 변화로 만드는 무전.
 *
 * `eventRadio`는 호출 하나만 보므로 실데이터에서는 영원히 침묵한다 —
 * 실측 오늘치 2,039건이 전부 `call`이고 에러는 0건이었다. 사람이 알고 싶은
 * 사건은 호출 하나가 아니라 **상태가 바뀌는 순간**이다.
 *
 * 처음 등장한 차는 사건이 아니다. 아무것도 안 바뀌면 침묵한다 — 같은 줄을
 * 반복하는 무전은 읽히지 않는다.
 */
export function stateRadio(prev: CarState | undefined, next: CarState): RadioMessage | null {
  if (!prev) return null;
  const base = { id: nextId(), carNumber: next.car_number, ts: next.last_event_ts };

  if (prev.model !== next.model) {
    return { ...base, severity: 'info', text: `모델 교체 — ${prev.model} → ${next.model}` };
  }

  const was = prev.tyre_pct;
  const now = next.tyre_pct;
  if (was !== undefined && now !== undefined) {
    if (was >= LIMIT_BOX_PCT && now < LIMIT_BOX_PCT) {
      return { ...base, severity: 'warn', text: `BOX BOX — 한도 ${Math.round(now)}% 남음` };
    }
    if (was < LIMIT_BOX_PCT && now >= LIMIT_BOX_PCT) {
      return { ...base, severity: 'info', text: '한도 회복 — 코스 복귀' };
    }
  }

  if (next.error_count > prev.error_count) {
    return { ...base, severity: 'warn', text: `문제 발생 — 누적 ${next.error_count}건` };
  }

  return null;
}

/** 이 아래로 내려가면 피트행이다. 트랙 모델의 `limitWarnPct`와 같은 선. */
const LIMIT_BOX_PCT = 15;

const PHASE_TEXT: Partial<Record<RacePhase, { text: string; severity: RadioMessage['severity'] }>> = {
  formation: { text: '포메이션 랩 — 그리드 정렬', severity: 'info' },
  racing: { text: 'GREEN GREEN GREEN — 레이스 시작', severity: 'info' },
  lunch_pit: { text: '피트 윈도우 오픈 — 드라이버 체인지', severity: 'info' },
  final_call: { text: '잔여 5분 — 마지막 스틴트', severity: 'info' },
  chequered: { text: 'CHEQUERED FLAG — 세션 종료', severity: 'info' },
};

export function phaseRadio(phase: RacePhase, prev: RacePhase, now: number): RadioMessage | null {
  if (phase === prev) return null;
  const entry = PHASE_TEXT[phase];
  if (!entry) return null;
  return { id: nextId(), carNumber: 0, text: entry.text, severity: entry.severity, ts: now };
}
