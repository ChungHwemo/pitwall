import type { CarEvent } from '../types';

/**
 * 화면에서 고를 수 있는 기록 한 벌.
 *
 * 예전에는 빌드마다 한 벌만 심었다. 무엇을 보고 있는지 화면만 봐서는 알 수 없었고,
 * 바꾸려면 다시 빌드해야 했다 — 실기록과 지어낸 데이터를 헷갈리면 그게 가장 나쁜
 * 종류의 오해다. 그래서 `synthetic`을 데이터에 붙여 화면이 항상 밝히게 한다.
 */
export interface Dataset {
  id: string;
  label: string;
  /** 지어낸 데이터인가. 화면이 이걸 숨기면 안 된다 */
  synthetic: boolean;
  events: CarEvent[];
}

/** 마지막으로 고른 데이터셋. 다시 열 때 그대로 뜬다. */
export const DATASET_KEY = 'pitwall.dataset';

/**
 * 실시간을 가리키는 id.
 *
 * 네이티브 껍데기가 있을 때만 실제로 동작한다. 브라우저에서 고르면 아무 이벤트도
 * 안 들어오는데, 그건 고장이 아니라 그 환경에 로그를 읽을 수단이 없다는 뜻이다.
 */
export const LIVE_ID = 'live';

/**
 * 저장된 선택이 있으면 그걸 쓴다. 없으면 환경이 정한다.
 *
 * 브라우저 기본은 데모 — 실시간 항목을 골라도 브리지가 없어 LIVE라고 가장하면
 * 안 된다. 네이티브는 브리지가 있으므로 첫 실행의 기본은 실시간이다. 예전에
 * `datasets[1]`(첫 데모)을 모든 환경의 기본으로 둬서, 앱을 켜도 LIVE가 안 붙었다.
 */
export function pickDataset<T extends { id: string }>(
  datasets: readonly T[],
  storedId: string | null,
  native: boolean,
): T | undefined {
  if (storedId !== null && storedId !== '') {
    const hit = datasets.find((d) => d.id === storedId);
    if (hit !== undefined) return hit;
  }
  if (native) return datasets.find((d) => d.id === LIVE_ID) ?? datasets[0];
  return datasets.find((d) => d.id !== LIVE_ID) ?? datasets[0];
}
