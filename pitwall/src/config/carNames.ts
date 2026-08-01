/**
 * 계정 표시 이름 — 이 기기에만 산다.
 *
 * 기본은 익명이다. 화면은 카넘버 + 등급으로만 계정을 말하고, 이름은 없다
 * (PRD 하드 룰). 하지만 자기 세컨드 모니터에서 자기 팀을 볼 때 `#017`보다
 * "결제팀 배치"가 곁눈질에 빨리 걸린다 — 그래서 **사용자가 직접** 붙일 수
 * 있게 한다. 붙인 이름은 라벨일 뿐 정렬 키가 아니다: 타워는 여전히 카넘버
 * 오름차순이고, 이름은 순위를 만들지 않는다 (PRIV-5).
 *
 * 연봉(`SALARY_STORAGE_KEY`)과 같은 규칙을 따른다: 전용 localStorage 키,
 * 로드/세이브 함수, **네트워크 호출 없음**. 조직 설정 파일
 * (`pitwall.settings.json` / `PitwallSettings`)에는 절대 들어가지 않는다 —
 * 이름은 개인의 로컬 라벨이지 조직이 배포하는 값이 아니다 (PRIV-1·PRIV-6).
 *
 * `car_id`로만 키를 잡는다. 카넘버는 데이터셋마다 1–999로 새로 매겨지는
 * 파생값이라 키가 될 수 없다 — 계정의 안정된 정체는 `car_id`다.
 */

export const CAR_NAMES_STORAGE_KEY = 'pitwall.carNames';

/** 이름 한도. 타워 한 칸을 넘기지 않는 길이. */
export const CAR_NAME_MAX_LENGTH = 16;

/**
 * localStorage에서 이름 표를 읽는다.
 *
 * localStorage는 사용자가 직접 손댈 수 있는 곳이고 옛 버전이 남긴 쓰레기가
 * 있을 수도 있다 — 문자열이 아닌 값, 공백뿐인 이름, 빈 문자열은 걸러낸다.
 * 깨진 JSON에도 던지지 않고 빈 표를 돌려준다. 이 함수는 절대 예외를 던지지
 * 않는다 — 렌더 루프가 이걸 부르므로 한 번의 파싱 실패가 화면을 멈추면 안 된다.
 */
export function loadCarNames(): Record<string, string> {
  const raw = localStorage.getItem(CAR_NAMES_STORAGE_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [carId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (trimmed === '') continue;
      out[carId] = trimmed;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * 이름 표를 localStorage에만 저장한다. 서버로 보내지 않는다 (PRD PRIV-6).
 * 이 파일에 네트워크 호출을 추가하면 안 된다.
 */
export function saveCarNames(names: Record<string, string>): void {
  localStorage.setItem(CAR_NAMES_STORAGE_KEY, JSON.stringify(names));
}

/**
 * 화면에 쓸 계정 표시 문자열.
 *
 * 이름이 있으면 그 이름을, 없으면 기존 카넘버 표시를 **바이트 그대로** 돌려준다.
 * 익명이 기본이므로 이름을 안 붙인 계정은 지금과 한 글자도 달라지면 안 된다.
 *
 * @param format 'bare' = 타워(`17`), 'padded' = 피드·라디오(`#017`)
 */
export function carDisplayName(
  names: Record<string, string>, carId: string, carNumber: number,
  format: 'bare' | 'padded',
): string {
  const name = names[carId];
  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed !== '') return trimmed;
  }
  return format === 'padded'
    ? `#${String(carNumber).padStart(3, '0')}`
    : String(carNumber);
}
