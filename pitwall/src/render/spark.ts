import type { CarEvent } from '../types';
import { workOf } from '../state/reducer';

/**
 * 최근 소진을 한 줄 막대로.
 *
 * F1 타이밍 타워의 섹터 블록·랩타임 자리다. 누적 숫자는 "얼마 썼나"에는 답해도
 * "지금 빠른가"에는 답하지 못한다 — 그건 모양으로 읽어야 곁눈질에 걸린다.
 *
 * 글자로 그린다. 줄마다 SVG를 붙이면 노드가 계정 수만큼 곱해지는데, 여기서
 * 필요한 해상도는 여덟 단계면 충분하다.
 */

/** 낮은 것부터. 공백은 "그 칸에 아무 일도 없었다"는 뜻이고 막대가 아니다. */
export const SPARK_CHARS = '▁▂▃▄▅▆▇█';

/**
 * @param events  그 계정의 최근 호출 (정렬 안 돼 있어도 된다)
 * @param now     기준 시각. 이벤트 ts와 같은 시간축이어야 한다
 * @param windowMs 되돌아볼 길이
 * @param buckets  칸 수
 */
export function sparkline(
  events: CarEvent[], now: number, windowMs: number, buckets: number,
): string {
  const bins = new Array<number>(buckets).fill(0);
  const width = windowMs / buckets;
  const from = now - windowMs;

  for (const e of events) {
    if (e.ts <= from || e.ts > now) continue;
    // 캐시 재전송은 일이 아니다 — 거리와 같은 기준을 쓴다.
    const i = Math.min(buckets - 1, Math.floor((e.ts - from) / width));
    bins[i]! += workOf(e);
  }

  const peak = Math.max(...bins);
  if (peak <= 0) return ' '.repeat(buckets);

  return bins
    .map((v) => {
      if (v <= 0) return ' ';
      const step = Math.ceil((v / peak) * SPARK_CHARS.length) - 1;
      return SPARK_CHARS[Math.max(0, Math.min(SPARK_CHARS.length - 1, step))]!;
    })
    .join('');
}
