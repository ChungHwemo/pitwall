import type { CarEvent, RacePhase } from '../types';

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
