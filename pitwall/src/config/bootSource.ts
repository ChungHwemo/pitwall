export type BootSourceKind = 'live' | 'replay' | 'sim';

/** 실시간 선택은 시뮬레이터로 떨어지지 않는다. 브리지가 없어도 빈 LIVE다. */
export function bootSourceKind(opts: {
  wantsLive: boolean;
  recordedCount: number;
}): BootSourceKind {
  if (opts.wantsLive) return 'live';
  if (opts.recordedCount > 0) return 'replay';
  return 'sim';
}
