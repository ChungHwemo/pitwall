# [pitwall] junhoyeo/tokscale 코드·제품 분해

**작성일** 2026-08-01 · **대상** `junhoyeo/tokscale` (2026-08-01 확인) · **라이선스** MIT  
**목적** 토큰 사용량을 수집·집계·시각화하는 레퍼런스의 기능을 PITWALL의 하드 룰과 대조하고, 곁눈질용 하루 요약 화면에 가져올 수 있는 정보 표현만 확정한다.

> 저장소 사실은 GitHub API로 2026-08-01 확인했다. 기능·명령·데이터 필드는 저장소 README(`/tmp/tokscale-README.md`)를 대조했다. 아래 판정은 tokscale의 제품 전체를 채택한다는 뜻이 아니라, PITWALL의 데이터 표현과 검증 기법에 대한 판정이다.

---

## 0. 결론 먼저

| 대상 | tokscale의 실제 | PITWALL 판정 |
|---|---|---|
| 사용량 표시 | 40개가 넘는 코딩 에이전트의 로컬 기록을 읽어 TUI, JSON, 웹 그래프로 집계 | 파서·CLI·TUI는 가져오지 않는다. 하루 단위 강도 그리드와 세부 토큰 축만 가져온다 |
| 기여도 그래프 | GitHub식 2D 기여도 그래프, 웹에서는 3D 그래프 | **✅ 채택**, `summaryRenderer.ts`의 하루 요약 카드에 계정 × 날짜 토큰 강도 그리드로 제한 |
| 토큰 회계 | input, output, cache read/write, reasoning을 별도 추적 | **✅ 채택**, 기존 작업 토큰·캐시 재전송 분리를 보존하고 reasoning 축을 추가 검토 |
| 단가 | LiteLLM 실시간 가격, OpenRouter fallback, 1시간 디스크 캐시, JSON override | **⚠️ 부분**, 로컬 `pitwall.settings.json`의 커스텀 단가만 채택. 런타임 가격 조회는 기각 |
| 시간 집계 | Daily, Hourly, 선택형 Minutely와 시간대 프로파일 | **✅ 채택**, 근무일 타임라인에 시간대별 토큰 열 곡선으로 제한 |
| 결과물 | Wrapped 스타일 연간 요약 이미지 | **✅ 채택**, 하루 요약 카드의 정리 이미지 문법으로 축소 |
| 공유·경쟁 | 로그인, leaderboard, public profile, QR token, autosubmit | **❌ 기각**, 순위 UI, 기본 익명, k-익명성, outbound-0 위반 |
| 작업 귀속 | session/model grouping과 LLM 기반 task-attributed report | **⚠️ 부분**, `sessionId` join 패턴만 기록하고, 본문을 읽는 LLM 보고서는 기각 |
| 구현 기반 | Ratatui TUI, Rust native core, 40+ agent parser, 마우스·키보드 조작 | **❌ 기각**, PITWALL의 무의존 앰비언트 화면과 반대 |

**한 줄 요약:** tokscale은 “많은 로그를 정확히 모아 여러 방식으로 파고드는 도구”다. PITWALL은 그 중 **날짜별 강도, 캐시·reasoning 분해, 시간대 곡선, 로컬 단가 보정, 하루 요약 이미지**만 가져온다. leaderboard, LLM 귀속, TUI, 실시간 가격 조회는 가져오지 않는다.

---

## 1. 실제 구조와 범위

```text
tokscale/
├── crates/tokscale-cli   CLI·Ratatui TUI·보고서·설정
├── crates/tokscale-core  Rust 파싱·집계 네이티브 코어
└── packages/frontend     2D·3D 기여도 그래프와 social platform
```

Tokscale은 MIT 라이선스의 Rust workspace다. 2026-08-01 기준 GitHub API 확인값은 **4,730 stars**, 마지막 push는 **2026-07-31**이다. README는 “tokens are the new energy”라는 Kardashev scale 은유를 쓴다. 토큰 사용량을 행성·은하 규모의 에너지 소비처럼 보고, 여러 에이전트의 소비량을 한 장소에 모아 순위와 성장 곡선으로 보여주는 제품이다.

README의 지원 목록은 OpenCode, Claude Code, Codex, Copilot CLI, Cursor, Gemini CLI, Amp, Codebuff, Grok Build, Zed, Kiro 등을 포함해 40개가 넘는다. 저장 위치도 에이전트마다 SQLite, JSONL, JSON, CSV, 공식 API 캐시로 다르다. 모든 입력이 같은 품질의 로그는 아니다. 예를 들어 Warp/Oz는 토큰 transcript가 아니라 요청 수와 vendor-reported spend만 제공하고, 일부 클라이언트는 sync 후 로컬 cache를 읽는다.

PITWALL의 범위는 다르다. v1은 단일 HTML과 macOS WKWebView, 런타임 의존성 0개, 로컬 데이터, 곁눈질용 화면이다. 실제 LiteLLM 연동은 v1.5로 미뤄져 있고, 화면은 이름·순위·본문을 다루지 않는다. 그러므로 tokscale의 **수집기 숫자**를 경쟁하지 않고, 이미 들어온 PITWALL 이벤트를 어떻게 거짓 없이 압축해 보여줄지에 집중한다.

---

## 2. 기능 인벤토리와 판정

### 2.1 ✅ GitHub식 기여도 그래프를 하루 요약 카드로 채택

README의 Features와 Frontend Visualization은 GitHub식 기여도 그래프를 제공한다. TUI Stats는 날짜별 칸의 강도를 색 테마로 표시하고, 웹 frontend는 2D 그래프와 토큰 사용량에 높이를 대응한 3D 그래프를 제공한다. 날짜·플랫폼 필터, hover 상세, 날짜 클릭 후 source·model 상세도 붙어 있다.

**PITWALL 적용:** GitHub의 외형을 그대로 복사하지 않고, `pitwall/src/render/summaryRenderer.ts`의 체커기 이후 하루 요약 카드에 **계정 × 날짜 토큰 강도 그리드**를 둔다. 현재 카드는 작업 토큰, 캐시 재전송, 총 비용, 완주/리타이어, 클래스, 에러를 조직 단위로 보여준다. 여기에 날짜 칸의 강도를 더하면 하루의 분포를 글자와 숫자 목록보다 빨리 읽을 수 있다.

**근거:** 계정은 카넘버·해시로만 표시되고 순위가 아니며, 그리드는 SVG 또는 고정 DOM 칸으로 만들 수 있어 런타임 의존성이 없다. 트랙 위 텍스트 라벨 금지에도 걸리지 않는다. 반대로 토큰 높이를 3D로 만들거나 클릭 드릴다운을 기본 경로로 만들지는 않는다. 곁눈질 화면의 체류 시간을 늘리는 상호작용이기 때문이다.

**판정: ✅ 채택.** 채택 범위는 `summaryRenderer.ts`의 하루 요약 카드용 2D 강도 그리드다. 웹 3D 그래프는 채택하지 않는다.

### 2.2 ✅ cache read/write와 reasoning 토큰을 별도 축으로 채택

README의 Detailed breakdowns는 input, output, cache read/write, reasoning을 별도 추적한다고 명시한다. OpenCode 예시 메시지에는 `tokens.input`, `tokens.output`, `tokens.reasoning`, `tokens.cache.read`, `tokens.cache.write`가 각각 들어간다. Pricing 섹션도 cache read 할인, cache write, reasoning 가격, tiered pricing을 별도 항목으로 둔다.

**PITWALL 적용:** PITWALL은 이미 작업 토큰과 캐시 재전송을 분리한다. `summaryRenderer.ts`의 `작업 토큰`과 `캐시 재전송`은 “캐시를 거리로 세지 않는다”는 측정 원칙과 연결되어 있고, README의 실측 카드도 이 분리를 사용한다. 이 축은 유지한다. tokscale가 검증해 주는 추가 축은 **reasoning tokens**다. 현재 `CarEvent`와 하루 요약 카드에 reasoning이 없으므로, 데이터 계약이 이를 제공할 때 카드/HUD의 세부 분해에 별도 수치로 추가한다.

**근거:** reasoning을 작업 토큰에 몰아 넣으면 모델의 내부 추론량과 사용자에게 전달된 출력량을 구분할 수 없다. 반대로 캐시 read/write와 reasoning을 모두 총합의 새로운 “효율 점수”로 만들면 근거 없는 낭비 판정이 된다. 값은 분해해 보여주되 개인 간 비교나 생산성 점수로 정렬하지 않는다.

**판정: ✅ 채택.** 기존 캐시 분리는 유지하고 reasoning을 별도 축으로 등록한다. pricing 자체의 런타임 동기화는 2.6에서 부분 판정한다.

### 2.3 ✅ 시간대별 프로파일 곡선을 부분적으로 채택

TUI에는 Daily와 Hourly view가 있고, Overview에서는 `h`로 Daily/Hourly chart granularity를 전환한다. Hourly view는 Table/Profile을 전환할 수 있으며, Minutely view는 `minutelyTabEnabled` 설정으로 켜는 opt-in 진단 화면이다. Minutely는 데이터 로딩 비용 때문에 기본 비활성이다.

**PITWALL 적용:** `PITWALL.md` §5의 근무일 타임라인은 포메이션 랩, 스타트 라이트, 점심 피트, 체커기로 시간을 읽게 한다. 이 타임라인에 시간대별 토큰 열을 작은 **hour-of-day heat/profile curve**로 얹는다. 하루 전체 평균 하나보다 어느 시간대에 발열이 생겼는지를 빠르게 보여주고, 타임라인의 사건과 사용량을 같은 축에 놓을 수 있다.

**근거:** 시간대 곡선은 텍스트 라벨을 트랙 위에 얹지 않고, 카드나 HUD의 고정 영역에 둘 수 있다. P3인 이유는 현재 화면이 이미 최근 30분 스파크라인과 tok/분을 제공해 핵심 정보가 비어 있지 않기 때문이다. Minutely tab, 날짜 탐색, 키보드 전환은 앰비언트 화면을 TUI로 바꾸므로 기각한다.

**판정: ✅ 채택.** 시간대 요약 곡선만 채택하고, Minutely 진단 뷰와 Hourly 메뉴 탐색은 채택하지 않는다.

### 2.4 ✅ 로컬 커스텀 단가 override를 채택

README의 Pricing Lookup은 `tokscale pricing` 명령, LiteLLM·OpenRouter lookup, tiered pricing, cache token discount를 제공한다. `~/.config/tokscale/custom-pricing.json`에 모델별 input/output/cache read 단가를 넣는 override도 제공한다. override는 시작 시 한 번 읽고, 편집 후 재시작해야 하며, 잘못된 음수·비유한 값은 무시한다.

**PITWALL 적용:** `pitwall.settings.json` 설정 계층에 모델별 로컬 단가 override를 둘 수 있다. 현재 `src/config/models.ts`의 verified catalog는 빌드 시점 단가를 갖는다. 로컬 override는 그 값을 사용자가 명시적으로 보정하는 좁은 기능으로 두고, 화면에는 적용된 단가의 출처와 판독 시점을 남긴다.

**근거:** JSON 파일을 로컬에서 읽는 것은 outbound 요청 0건과 맞고, PITWALL의 설정 저장·데이터 출처 정직성 원칙과도 맞는다. 단, LiteLLM의 실시간 fetch, OpenRouter fallback, 1시간 디스크 캐시는 런타임 네트워크를 필요로 한다. PITWALL은 `npm run fetch:limits` 같은 dev-time 갱신과 빌드 시 스냅샷을 이미 사용하므로, 가격의 freshness는 그 경로에서 표시해야 한다.

**판정: ✅ 채택.** JSON override만 채택한다. 원격 가격 lookup과 polling은 2.6에서 기각한다.

### 2.5 ✅ Wrapped 스타일 하루 요약을 축소 채택

README의 Wrapped 2025는 `wrapped` 명령으로 연간 PNG를 만든다. total tokens, top models, top clients, messages, active days, cost, streak, contribution graph를 한 장에 담고 소셜 공유를 전제로 한다. `--clients`, `--agents`, `--year`, `--disable-pinned` 옵션이 있다.

**PITWALL 적용:** 같은 정보 구조를 연간 공유 카드가 아니라 **체커기 이후 하루 요약 이미지** 문법으로 축소한다. 현재 `SummaryRenderer`가 여는 카드에 총 작업 토큰, 캐시 재전송, 비용, 완주/리타이어, 클래스, 에러를 고정해 두므로, Wrapped의 시각적 계층과 강도 그리드만 보강 재료로 쓴다.

**근거:** 하루 요약은 PITWALL의 기존 제품 문법이고, 고정 DOM 노드 풀링과 잘 맞는다. 반면 top client 순위, streak 경쟁, 공유용 public profile로 확장하면 개인 간 정렬·순위 UI와 개인정보 규칙을 건드린다. `이미지 생성`도 런타임 외부 서비스가 아니라 로컬 SVG/HTML 렌더 결과를 저장하는 수준이어야 한다.

**판정: ✅ 채택.** Wrapped의 카드 구성 원리만 하루 요약에 채택하고, 연간·공유·순위 기능은 기각한다.

### 2.6 ⚠️ session grouping과 설정·렌더링 패턴은 부분 채택

Tokscale은 model, client+model, client+provider+model, workspace+model, session+model, client+session+model 그룹을 제공한다. `--json` 결과에는 `sessionId`가 들어가 downstream 도구가 특정 세션에 비용을 join할 수 있다. 이 데이터는 TUI, light table, JSON export에서 같은 집계를 재사용한다.

PITWALL의 벤치마크는 fine-grained attribution을 이미 보류했다. `attributionMcpTool` 커버리지는 2.3%, 스킬은 6.7%뿐이고, 프로젝트·세션을 쪼개면 화면이 작은 표본을 전체 사실처럼 말할 위험이 있다. 따라서 session-level grouping을 UI에 넣지 않는다. 다만 **join 가능한 익명 `sessionId`를 JSON 데이터 계약에서 유지하는 방식**은 향후 외부 분석이 필요할 때 참고한다. 본문이나 자연어 작업 제목은 수집하지 않는다.

README는 TUI 설정을 `~/.config/tokscale/settings.json`에 저장하고, zero-flicker rendering을 명시한다. PITWALL은 이미 localStorage에 데이터셋을 저장하고, 렌더러의 node pooling으로 zero-flicker에 가까운 동작을 구현하고 있다. 이 둘은 새 기능이 아니라 **이미 달성한 설계의 상호 검증**이다.

**판정: ⚠️ 부분.** session grouping은 JSON join 패턴만 참고하고 UI는 기각한다. settings persistence와 zero-flicker는 채택이 아니라 이미 달성된 동등 기능으로 기록한다.

### 2.7 ❌ TUI, Rust core, 40+ parser, 마우스·키보드 조작은 기각

Tokscale의 기본 실행은 Ratatui 기반 interactive TUI다. Overview, Usage, Models, Daily, Hourly, Stats, Agents, opt-in Minutely의 8개 view가 있고, `←/→/Tab`, `c/d/t`, `j`, `s`, `g`, `h`, `v`, `y`, `p`, `r`, `e`와 mouse support로 화면을 조작한다. `--light`는 표만 출력하는 별도 경로다. Rust native core는 병렬 파일 스캔과 SIMD JSON parsing으로 빠른 집계를 맡고, README는 대규모 입력에서 약 10배 처리 성능을 주장한다.

이 구조는 사용량을 **응시하고 탐색하는 분석 도구**다. PITWALL은 2초에서 3초 훑고 자기 일로 돌아오는 세컨드 모니터용 앰비언트 화면이다. 인터랙티브 view 전환, mouse, keyboard, Minutely drilldown을 넣으면 dwell-time rule을 깨뜨린다. Rust core와 40개가 넘는 parser도 현재 PITWALL의 단일 HTML·런타임 의존성 0개·한정된 데이터 계약과 맞지 않는다.

**판정: ❌ 기각.** tokscale의 빠른 로컬 집계는 외부 참고 사항일 뿐, PITWALL 런타임이나 화면 구조로 가져오지 않는다. 이 판정은 `REVIEW.md` #3의 3D·조작 논의와 같은 근거다.

### 2.8 ❌ leaderboard, public profile, QR, autosubmit은 기각

Tokscale Social은 GitHub OAuth login, `submit`, global leaderboard, public profile, API token QR code, token revocation을 제공한다. Autosubmit은 macOS launchd, Linux systemd/cron, Windows Task Scheduler로 주기적인 제출을 예약한다. README의 첫 화면도 `submit`으로 leaderboard와 public profile을 만들라고 안내한다.

**PITWALL 하드 룰과의 충돌:** PITWALL은 개인 간 정렬·순위 UI를 금지한다. 타이밍 타워를 만들지 않고 카넘버 고정순으로만 표시한다. 기본 익명, k-익명성 하한 10, 프롬프트·응답 본문 미수집, outbound-0 gate도 있다. 외부 제출과 autosubmit은 모두 네트워크 전송과 계정 자격 증명을 요구한다.

이는 `tokens.ci` 공개 순위표를 기각한 벤치마크 선례와 같다. 공유를 “선택 기능”으로 숨겨도 leaderboard 중심의 제품 의미가 PITWALL과 맞지 않는다.

**판정: ❌ 기각.** local-only 요약은 허용하지만, login·submit·profile·QR·autosubmit은 구현하지 않는다.

### 2.9 ❌ task-attributed LLM report는 기각

Tokscale의 `report`는 세션을 스캔해 SQLite wiki DB에 넣고, Apple FM·Claude·Codex·Gemini·Kiro·MiniMax 등의 summarizer backend로 세션 제목·분류·설명·복잡도를 만든다. 두 번째 LLM pass는 세션을 3개에서 8개의 상위 task cluster로 묶는다. 결과는 캐시되어 다음 실행에서 재사용된다.

**PITWALL 하드 룰과의 충돌:** 세션 본문을 LLM에 보내는 경로는 아웃바운드 요청 0건을 깨뜨린다. Apple FM 같은 로컬 backend를 택해도 prompt·response 본문이 PITWALL 스키마에 없고, 자연어 작업 제목은 계정·프로젝트를 재식별할 수 있다. 이미 벤치마크에서 세션·스킬 귀속은 표본 커버리지 부족으로 “무전 한 줄까지만” 보류했다.

**판정: ❌ 기각.** 요약은 집계된 숫자와 이미 존재하는 상태 이벤트에서만 만든다. LLM 호출이나 본문 보존은 추가하지 않는다.

### 2.10 ❌ 런타임 LiteLLM 가격 polling은 기각, 1시간 cache는 부분 참고

Tokscale은 LiteLLM 가격을 실시간으로 가져오고 1시간 디스크 캐시에 저장한다. OpenRouter endpoint를 fallback으로 쓰며, tiered pricing과 cache token discount, 최근 모델의 Cursor 가격도 제공한다. README의 가격 캐시 파일은 `pricing-litellm.json`, `pricing-openrouter.json`이다.

**PITWALL 하드 룰과의 충돌:** 런타임 outbound 요청 0건이다. 화면을 열었을 때 원격 가격을 폴링하면 오프라인 단일 파일과 dev-time 갱신이라는 운영 모델이 깨진다. PITWALL은 이미 `npm run fetch:limits`로 빌드 시 스냅샷을 갱신하고 가격 카탈로그를 `src/config/models.ts`에 둔다.

다만 1시간 TTL 자체는 재현 가능한 freshness 표시의 참고가 된다. 가격을 읽은 시각, 출처, override 적용 여부를 저장하고 오래되면 화면에 나이를 표시하는 식으로만 쓸 수 있다.

**판정: ❌ 런타임 polling 기각 / ⚠️ TTL·출처 표시는 부분 참고.** 실제 적용 항목은 2.4의 로컬 JSON override로 한정한다.

### 2.11 ❌ 기타 sync와 구독 quota는 기각

README에는 Cursor, Antigravity, Trae, Warp/Oz의 login·sync·cache 명령, provider별 subscription usage와 quota refresh가 있다. 이는 공식 API, local language server RPC, GraphQL API, credentials 또는 vendor-reported quota를 필요로 한다.

PITWALL v1은 LiteLLM 실연동도 v1.5로 미루고, live source도 네이티브 브리지에서만 연결한다. provider 계정 로그인, quota endpoint 호출, vendor 계정 전환을 화면에 넣으면 데이터 출처와 privacy 경계가 바뀐다. 한도는 빌드 시점 snapshot을 쓰고 판독 나이를 밝힌다는 현재 규칙을 유지한다.

**판정: ❌ 기각.** 로컬 로그가 제공하는 한도와 이벤트만 표시한다. sync·quota fetch는 별도 서버/연동 범위로 미룬다.

---

## 3. 채택 항목 요약

| 항목 | PITWALL 착지 | 판정 | 우선순위 |
|---|---|---|---|
| GitHub식 기여도 강도 그리드 | 하루 요약 카드, 계정 × 날짜 | ✅ 채택 | P2 |
| reasoning 토큰 분리 | 하루 요약 카드/HUD 세부 토큰 | ✅ 채택 | P2 |
| 시간대별 프로파일 곡선 | 근무일 타임라인과 요약 영역 | ✅ 채택 | P3 |
| 커스텀 단가 override | `pitwall.settings.json` 로컬 모델 가격 | ✅ 채택 | P3 |
| Wrapped 스타일 하루 요약 | `summaryRenderer.ts` 체커기 카드 | ✅ 채택 | P3 |
| `sessionId` JSON join 패턴 | 외부 분석용 익명 데이터 계약 | ⚠️ 부분 | 보류 |
| zero-flicker·설정 저장 | 기존 node pooling·localStorage | ⚠️ 이미 달성 | 해당 없음 |
| TUI·Rust·40+ parser·조작 | 구현·런타임 | ❌ 기각 | 해당 없음 |
| leaderboard·profile·QR·autosubmit | social platform | ❌ 기각 | 해당 없음 |
| LLM task report | 세션 본문 요약 | ❌ 기각 | 해당 없음 |
| LiteLLM polling·provider sync | 런타임 네트워크 | ❌ 기각 | 해당 없음 |

적용 가능한 다섯 항목은 `REVIEW.md` #5부터 #9에 등록한다. P2는 현재도 읽히지만 하루 분포와 토큰 의미를 더 빨리 읽게 하는 항목이다. 시간대·단가·Wrapped는 기능이 없어도 화면이 거짓을 말하지 않지만, 읽는 방식과 취향을 개선하는 P3다.

---

## 4. 확인한 자료와 PITWALL 착지점

| 자료 | 확인 내용 |
|---|---|
| `/tmp/tokscale-README.md` §Features, §TUI Features | 8개 view, keyboard/mouse, contribution graph, zero-flicker, multi-platform, detailed token breakdown, JSON export |
| `/tmp/tokscale-README.md` §Group-By Strategies, §Filtering by Platform, §Date Filtering | model/client/workspace/session grouping, `sessionId`, client·날짜·연도 필터 |
| `/tmp/tokscale-README.md` §Pricing Lookup, §Custom Pricing Overrides, §Pricing | LiteLLM·OpenRouter, 1시간 cache, JSON override, tiered/cache/reasoning pricing |
| `/tmp/tokscale-README.md` §Task-Attributed Report | LLM backend, wiki DB, session title/category와 2차 task cluster |
| `/tmp/tokscale-README.md` §Social, §Autosubmit, §Social Platform | OAuth, submit, leaderboard, public profile, QR, scheduler |
| `/tmp/tokscale-README.md` §Frontend Visualization, §Wrapped 2025 | 2D·3D graph, day detail, Wrapped image contents |
| `PITWALL.md` §4, §5, §7, §8, §11 | 캐시와 작업 토큰 분리, 하루 요약·타임라인, 개인정보 하드 룰, 선례와 미결 |
| `pitwall/src/render/summaryRenderer.ts` | 체커기 이후 조직 단위 하루 요약, 고정 행과 node pooling |
| `.omo/notepads/pitwall-readability/learnings.md` | 현재 703 테스트, 출처 정직성, localStorage 데이터셋 저장, 이미 달성한 렌더링·가독성 상태 |

---

## 5. 최종 판정

Tokscale은 PITWALL의 경쟁 제품이 아니라, **토큰 회계와 날짜 집계가 어디까지 세분화될 수 있는지 보여주는 분석 도구**다. 채택할 것은 그 세분화를 곁눈질용 고정 카드 안으로 줄이는 일이다. 계정 × 날짜 강도, cache read/write와 reasoning, 시간대 곡선, 로컬 단가 override, 하루 Wrapped 요약은 모두 로컬·익명·고정 레이아웃으로 만들 수 있다.

나머지는 기능이 부족해서가 아니라 제품 경계가 달라서 기각한다. TUI와 3D는 응시를 요구하고, leaderboard와 public profile은 순위·식별을 만들며, LLM report와 원격 pricing·sync는 본문 또는 outbound 경로를 요구한다. PITWALL은 많이 보여주는 제품이 아니라, **없는 사실을 만들지 않고 3초 안에 오늘의 상태를 읽히는 제품**으로 남는다.
