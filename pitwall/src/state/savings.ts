import type { CarEvent } from '../types';
import { specOf } from '../config/models';

/**
 * 캐시가 아낀 돈.
 *
 * 실측에서 캐시 재전송이 전체 토큰의 **98~99%**인데, 화면에는 그 비율 한 칸이
 * 전부였다 — 가장 큰 숫자가 아무것도 말하지 않는 장식이었다. 비율은 크다는 사실만
 * 말하고 그게 좋은 일인지 나쁜 일인지는 말하지 않는다.
 *
 * 캐시로 읽은 토큰을 **정가로 냈다면** 얼마였을지와의 차액이 그 답이다.
 * 단가를 모르는 모델은 0이다 — 지어내지 않는다.
 */
export function cacheSavingOf(event: CarEvent): number {
  const cached = event.tokens.cache_read ?? 0;
  if (cached <= 0) return 0;
  const spec = specOf(event.model);
  if (!spec) return 0;
  const gap = spec.inputPerMtok - spec.cachedInputPerMtok;
  return Math.max(0, cached * gap / 1_000_000);
}
