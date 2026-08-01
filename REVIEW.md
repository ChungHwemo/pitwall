# PITWALL 리뷰

다른 작성자가 의견을 남기는 곳입니다. 여기에 적고 커밋하면, 세션에서 **"리뷰 확인해"** 라고
말하면 에이전트가 읽고 항목별로 처리·반박·보류를 보고합니다.

자동으로 감시하지 않습니다. 말할 때 읽습니다.

## 쓰는 법

- 아래 표에 한 줄씩 추가합니다. 표만 채워도 됩니다.
- **코드 특정 줄**에 대한 지적이면 여기보다 GitHub PR 리뷰 코멘트가 정확합니다.
- **재현 절차가 있는 버그**면 GitHub 이슈가 낫습니다 (`gh issue create`).
- 상태 칸은 비워 두십시오. 에이전트가 채웁니다.

## 상태 값

| 값 | 뜻 |
|---|---|
| (빈칸) | 아직 안 읽음 |
| `확인` | 읽고 사실 확인됨 |
| `반영` | 고쳤음 — 커밋 해시 함께 |
| `반박` | 다르게 판단함 — 근거 함께 |
| `보류` | 맞지만 지금 안 함 — 이유 함께 |
| `불가` | 지금 데이터·환경으로는 검증 불가 |

**반박도 정상입니다.** 근거 없이 동의하지 않습니다. 측정으로 확인되면 반영하고,
아니면 왜 아닌지 씁니다.

## 의견

| # | 작성자 | 날짜 | 화면/파일 | 의견 | 근거·재현 | 우선순위 | 상태 |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | bart | 2026-07-31 | 트랙 (src/render/trackRenderer.ts · src/render/projection.ts · src/track/spacing.ts · src/track/trackModel.ts) | 차량이 트랙 위에서 부드럽게 흐르지 않고 스팟(지점)에서 스팟으로 튀듯 움직인다. 부드러운 이동으로 개선을 검토하자는 제안. | 코드상 `Projector`(속도추정 + LERP 0.12 + MAX_FRAME_STEP 0.4%/프레임)로 보간이 이미 구현돼 있고, `main.ts`의 `render()`가 매 rAF 프레임 `trackModel`이 그대로여도 무조건 호출된다 — 설계상으로는 이벤트 사이에도 계속 미끄러져야 한다. 그런데도 튀어 보이는 원인 후보 3가지를 코드 읽기로 확인함 (실측·화면 녹화로 어느 것이 지배적인지는 미확인): (1) `spreadProgress`(spacing.ts)가 `buildTrackModel` 재계산 때마다 같은 레인 전체를 다시 정렬·재배치한다 — 정작 이벤트가 안 난 차의 목표 진행률(anchor)도 이웃 차의 사건 때문에 바뀔 수 있어, projector가 새 anchor를 매끄럽게 쫓아가더라도 "이 차가 왜 지금 움직이나"가 사건과 안 맞아 보일 수 있다. (2) 실측 이벤트당 프롬프트 토큰 중앙값(139,120)이 한 바퀴 분량(LAP_TOKENS=50,000)보다 커서, 호출 한 번이 앵커를 몇 바퀴치 앞으로 밀 수 있다 — `MAX_LEAD`가 "직전 한 걸음"만큼은 허용하므로 그 폭이 크면 따라잡는 구간이 상대적으로 빠르고 도드라져 보일 수 있다. (3) hot↔cold 전환 시 한쪽은 `spreadProgress` 보정값을, 다른 쪽은 원본 `progressOf` 값을 anchor로 써서 전환 순간 목표가 불연속적으로 바뀔 수 있다. 실측: 후보 ①·③ 기각(실측 2~3대 환경에선 밀집 불가), ② Projector 고정점이 지배 — 보간 목표를 속도 전방투영 위치로 수정, 밀집 창 정지 40.1%→26.3% | P1 | 반영 (c77e025) |
| 3 | bart | 2026-07-31 | 트랙 뷰 전반 (src/track/circuitShape.ts · src/track/layout.ts · src/track/trackModel.ts · src/render/*) | 데이터 형태는 유지한 채 현재 2D 뷰를 3D, 나아가 실제 3D 모바일 게임처럼 조작 가능한 구조로 갈 수 있는지 논의. | 층별로 재사용성이 갈린다. (a) 완전 재사용 — `types.ts`(`CarEvent`/`RaceState`)·`state/reducer.ts`는 렌더러를 전혀 모르는 순수 계층이라 손댈 이유가 없다. (b) 재사용 가능한 좋은 경계 — `track/trackModel.ts`·`render/projection.ts`·`track/layout.ts`의 레인 배정은 픽셀이 아니라 추상 스칼라(`progress` 0..1 · `laneLine` -1..1 · `heat`)로 동작해, "이 스칼라를 3D 트랜스폼으로 바꾸는 함수"만 새로 만들면 재사용된다. (c) 사실상 재작성 — `circuitShape.ts`의 `project()`는 위경도를 `{x,y}` 평면에 투영하고 고도 개념이 없으며, `layout.ts:152`의 `positionAt()`도 진행 방향의 2D 법선 벡터로 오프셋을 계산하는 순수 평면 함수다. `render/*` 전부는 SVG DOM 노드 풀링에 강하게 결합돼 있고 `CHECKLIST.md`에 기록된 성능 성과(레이아웃 스래싱 0, "no SVG transform 속성" 게이트)가 이 구조 특유의 것이라 WebGL/3D 엔진으로 가면 새로 짜야 한다. 추가로 두 가지 비-기술적 충돌: "런타임 의존성 0개"·24kB 단일 파일 빌드가 README/PITWALL.md에 명시된 핵심 성과인데 3D 엔진(Three.js 등)은 이 원칙과 정면 충돌하고, "곁눈질이지 응시가 아니다"·"체류 시간이 길면 실패"라는 하드 룰이 "게임처럼 조작"이 요구하는 적극적 개입(카메라 조작·터치 입력)과 방향이 반대다. 버벅임 원인은 렌더러가 아닌 보간 고정점으로 실측 확인(c77e025) — three.js는 불필요. 3D 전환은 v1.5 이후 열린 예산 결정으로 보류 | P3 | 보류 |
| 4 | bart | 2026-07-31 | #3 정정 | #3의 비-기술적 충돌 두 가지를 저자가 정정함. (1) "런타임 의존성 0개/24kB"는 못 박은 원칙이 아니라 아직 개발 중이라 그런 현재 상태다 — 3D 전환의 "충돌"이 아니라 그때 다시 잡을 열린 예산 결정이다. (2) "3D 모바일 게임처럼"은 사람이 조작하는 게 아니라 F1 중계처럼 트랙 상황은 항상 보이고 이벤트에 따라 카메라가 자동 전환되는 것이다. | (2)를 반영하면 오히려 기존 구조와 더 잘 맞는다 — `director/director.ts`가 이미 에러·한도·핀 점수로 카메라 슬롯을 자동 선별하고 있고(PITWALL.md의 "카메라 슬롯 3~5개 자동 선별"), 이 스코어링이 지금은 데이터 카드 출력으로 쓰이지만 3D에서는 "어느 차로 컷을 넘길까"로 그대로 확장 가능한 기존 개념이다. 사람 조작이 없으므로 "곁눈질" 철학과도 충돌하지 않는다. 다만 잔여 고려사항 하나: 실제 방송 연출(컷 타이밍·앵글 선택)은 원래 시청 시간을 늘리려는 문법이라, 자동이어도 화면이 더 몰입감 있어지면 "체류 시간이 길면 실패" 하드 룰과 미묘하게 당길 수 있다 — 막을 이유는 아니고 3D 전환 시 "곁눈질에 맞는 컷 리듬"을 별도로 정의할 필요가 있다는 정도. | P3 | 확인 |
| 5 | bart | 2026-08-01 | 하루 요약 카드 (`pitwall/src/render/summaryRenderer.ts` · `PITWALL.md` §5 화면) | tokscale의 GitHub식 contribution grid를 계정 × 날짜 토큰 강도 그리드로 축소해 하루 요약 카드에 추가한다. | tokscale README §Features, §Frontend Visualization의 2D contribution graph와 날짜별 상세를 근거로 한다. PITWALL `summaryRenderer.ts`의 체커기 이후 조직 단위 카드에 고정 DOM/SVG 그리드로 착지한다. 계정은 해시 카넘버로만 표시하고 색상만으로 상태를 말하지 않으며, 트랙 위 텍스트 라벨과 순위 UI는 추가하지 않는다. 현재 카드의 작업 토큰·캐시 재전송·비용·완주/리타이어·클래스·에러 행은 유지한다. | P2 | 반영 (미커밋 — 2026-08-01 구현·검증) |
| 6 | bart | 2026-08-01 | 하루 요약 카드/HUD (`pitwall/src/render/summaryRenderer.ts` · `pitwall/src/types.ts`) | tokscale처럼 reasoning tokens를 cache read/write와 분리해 토큰 세부 분해에 추가한다. | tokscale README §Features의 Detailed breakdowns와 §Data Sources의 `tokens.reasoning`, `tokens.cache.read/write`를 근거로 한다. PITWALL은 이미 `summaryRenderer.ts`에서 작업 토큰과 캐시 재전송을 분리해 Q10을 해소했으므로 그 축은 보존하고, `types.ts` 데이터 계약과 카드/HUD의 별도 reasoning 값만 추가 검토한다. 합계로 생산성·낭비 점수를 만들거나 개인 간 비교로 정렬하지 않는다. | P2 | 반영 (미커밋 — 2026-08-01 구현·검증) |
| 7 | bart | 2026-08-01 | 근무일 타임라인 (`PITWALL.md` §5 · `pitwall/src/render/hudRenderer.ts`) | tokscale의 Hourly/Profile view를 시간대별 토큰 열 프로파일 곡선으로 축소해 포메이션 랩부터 체커기까지의 타임라인에 겹친다. | tokscale README §TUI Features의 Daily/Hourly view와 §Configuration의 Minutely opt-in을 근거로 한다. PITWALL은 `PITWALL.md` §5에 근무일 타임라인과 최근 30분 스파크라인이 이미 있으므로, 고정 영역의 작은 hour-of-day 곡선만 추가한다. 키보드 탭 전환·Minutely 진단 화면·드릴다운은 앰비언트 곁눈질과 충돌하므로 가져오지 않는다. | P3 | 반영 (미커밋 — 2026-08-01 구현·검증) |
| 8 | bart | 2026-08-01 | 단가 설정 (`pitwall.settings.json` · `pitwall/src/config/models.ts`) | tokscale의 custom-pricing.json처럼 모델별 로컬 단가 override를 둔다. | tokscale README §Pricing Lookup, §Custom Pricing Overrides의 JSON override, cache-read 단가, 잘못된 값 검증을 근거로 한다. PITWALL의 `src/config/models.ts` verified catalog와 설정 계층에 로컬 보정 파일을 읽는 자리를 둔다. `PITWALL.md`의 dev-time 갱신·판독 나이 표시와 맞춰 적용 출처를 밝히고, LiteLLM/OpenRouter 런타임 fetch는 outbound-0 때문에 추가하지 않는다. | P3 | 반영 (미커밋 — 2026-08-01 구현·검증) |
| 9 | bart | 2026-08-01 | 하루 요약 카드 (`pitwall/src/render/summaryRenderer.ts` · `PITWALL.md` §5 화면) | tokscale Wrapped의 한 장 요약 문법을 하루 단위 체커기 카드에 적용한다. | tokscale README §Wrapped 2025의 `wrapped` 명령과 total tokens, top models, messages, cost, active days, streak, contribution graph 구성을 근거로 한다. PITWALL `summaryRenderer.ts`가 이미 체커기 이후 여는 고정 카드이므로, 조직 단위 숫자와 강도 그리드를 정리한 로컬 SVG/HTML 결과만 추가한다. 연간 공유 PNG, top 순위, public profile, leaderboard는 기본 익명·개인 간 순위 금지·outbound-0 하드 룰 때문에 만들지 않는다. | P3 | 반영 (미커밋 — 2026-08-01 구현·검증) |

## 우선순위 기준

- `P0` — 화면이 거짓을 말함 (틀린 숫자, 없는 사실 주장)
- `P1` — 곁눈질로 안 읽힘
- `P2` — 읽히지만 불편함
- `P3` — 취향·선호

## 지금 상태 요약

측정으로 확인된 것과 아직 아닌 것은 `PITWALL.md`에 있습니다.
현재 실행 데이터는 두 가지입니다.

| 명령 | 내용 |
|---|---|
| `npm run build:app:real` | 이 기기의 **실제** 로그 (계정 2, 오늘) |
| `npm run build:app` | 기본 빌드에 **지어낸** 데모 · 소규모/중규모/대규모 데이터셋 3벌을 심은 macOS 앱. 생성은 `npm run make:demo:all` |

데모는 실측 분포로 만듭니다 — 작업 토큰 중앙 2,107, 캐시 재전송 비중 96.0%,
호출 간격 중앙 2.3초, p99 172초. 근거는 `scripts/makeDemo.ts` 머리말에 있습니다.
지어낸 데이터이므로 실기록과 섞지 않습니다.
