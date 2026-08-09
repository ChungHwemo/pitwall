# PITWALL UI/UX 벤치마크 확장 — 방송 중계 × 앰비언트 관제 × LLM 사용량

**조사일:** 2026-08-09

**범위:** 공식 제품 페이지·공식 문서·공식 디자인 시스템 12건
**목적:** 기존 GitHub 기능 벤치마크를 반복하지 않고, 현재 화면을 실제로 재배치할 수 있는 제품 화면 문법을 수집한다.

## 0. 결론 먼저

PITWALL은 LiteLLM·코딩 에이전트 로그를 8시간 내구 레이스로 번역해 두 번째 모니터에 상시 띄우는 **앰비언트 방송 화면**이다. 분석용 대시보드가 아니다. 사용자는 3초 안에 다음만 답하고 본업으로 돌아가야 한다.

1. 데이터가 진짜 LIVE인지, 언제까지 신선한지
2. 전체 필드가 조용한지 바쁜지, 어디에 분포하는지
3. 지금 주목할 한 차량/작업과 그 이유가 무엇인지
4. 비용·속도·한도 중 무엇이 실제로 변했는지

현재 1280px LIVE·1800px dense·375px LIVE 캡처를 열어 확인했다. 화면은 전체 코스와 익명 타워라는 고유 자산은 강하지만, HUD·타워·모델 막대·한 줄짜리 `FOCUS`·하단 무전이 거의 같은 시각 강도로 놓여 있다. 특히 `FOCUS 881 · RUNNING · 0 tok/min ...`은 이름은 포커스지만 실질적으로 얇은 상태줄이고, 모바일은 큰 빈 트랙 뒤에 증거가 밀린다.

**권장 방향은 하나다: `사실 띠 → 방송 포커스 → 전체 필드 → 증거 띠`의 4계층.** 카드 수를 늘리지 않는다. 현재의 타워와 완전 코스는 유지하고, 포커스를 실제 텔레메트리 블록으로 승격하며, 신선도와 최근 실제 이벤트를 문장으로 고정한다.

## 1. 조사 방법과 증적 수준

- 제품 정의: `README.md`, `PITWALL.md`, `DESIGN.md`, 방송 트랙 PRD, 현재 CSS·렌더러 이름을 읽었다.
- 프로젝트 화면: `pitwall-1280x720-live.png`, `pitwall-1800x960-dense.png`, `pitwall-375x812-live.png`를 직접 열었다.
- 실제품 화면 탐색: Lazyweb에서 `motorsport live timing`, `operations monitoring dashboard live telemetry`, `AI usage cost analytics dashboard`, `broadcast live sports score center` 4개 질의를 실행했다. Better Stack, SigNoz, ThoughtSpot, Apptio, ESPN, GameChanger의 데스크톱 캡처 6장을 실제로 열었다. 이 캡처는 방향 탐색에만 썼고 저장소에는 넣지 않았다.
- 아래 12건의 채택 판단은 다시 공식 제품 페이지·공식 문서·공식 디자인 시스템으로 확인했다. 로그인·구독이 필요한 실제 LIVE 화면을 열지 못한 경우에는 이를 명시하며, 문서가 보장한 기능 이상을 주장하지 않는다.

## 2. 12개 벤치마크와 PITWALL 매핑

### 2.1 F1 TV Live Timing — 전체 맥락과 한 차량의 깊이를 동시에

- **공식 출처:** [What is F1 TV Pro? — F1 TV live timing](https://www.formula1.com/en/page/what-is-f1-tv-pro) (2026 시즌 페이지, 2026-08-09 확인)
- **확인한 화면/기능:** 공식 페이지는 Live Timing을 여러 기기에서 쓰는 “virtual pit wall”로 설명하고, 실시간 랩타임·날씨·타이어·전략을 한 제품 안에서 제공한다. 구독 LIVE 화면 자체는 열지 못했다.
- **재사용 패턴:** 전체 경주 맥락과 선택 대상의 세부 텔레메트리를 분리한다. 지도는 위치를, 숫자 블록은 이유를 말한다.
- **PITWALL 매핑:** `.detail`의 완전 코스는 안정된 배경 문맥으로 유지하고, `.broadcast-focus`는 차 번호·상태·최근 변화·누적 work·rate·마지막 이벤트 시각을 2행 이상으로 보여주는 독립 블록이 되어야 한다.
- **기각:** 영상, 온보드, 드라이버 신원, 순위·격차는 데이터도 없고 PRIV 규칙과 충돌한다.

### 2.2 NASCAR Race Center — Live / Timeline / Raw Feed의 역할 분리

- **공식 출처:** [NASCAR Live — Ways To Follow](https://www.nascar.com/followlive/) (2026 제품 페이지, 2026-08-09 확인)
- **확인한 화면/기능:** 공식 페이지는 Live Scoring, Lap by Lap, Raw Feed, Race Tracker를 서로 다른 표면으로 나눈다. Live Scoring은 랩·피트·위치, Timeline은 주요 업데이트, Raw Feed는 75개 이상의 데이터 포인트를 담당한다.
- **재사용 패턴:** 요약·시간순 사건·깊은 원자료를 한 화면에 동등하게 펼치지 않고, 역할을 분리한다.
- **PITWALL 매핑:** `.tower`는 현재값, `.radio`는 최근 실제 상태 변화 3–5건, 선택 피드는 수동 포커스 시에만 깊이를 제공한다. 하단 무전은 뉴스 티커처럼 한 줄로 흘리지 말고, `시각 · 차번호 · 사건 · 실제 변화`의 고정 열을 가져야 한다.
- **기각:** 리더보드 정렬, 팬터지, AI 해설, 영상 하이라이트는 감시·오락 기능이고 PITWALL의 사실성에 필요 없다.

### 2.3 FIAWEC+ Live Timing Pro — 8시간 제품은 엔지니어 데이터와 방송을 겹친다

- **공식 출처:** [FIAWEC+ now available via App Store and Google Play](https://www.fiawec.com/en/news/fiawec-now-available-via-app-store-and-google-play/13256) (2026-05-06)
- **확인한 화면/기능:** FIA WEC는 2026년 제품에서 `Live Timing Pro`가 실제 피트월 엔지니어가 받는 것과 같은 데이터를 제공한다고 명시한다. 데스크톱 출시는 2026년 3월, 앱 출시는 5월이다.
- **재사용 패턴:** 장시간 방송은 “보는 화면”과 “정확한 데이터”를 분리하지 않는다. 시각적 흥미는 사실을 가리는 장식이 아니라 사실의 우선순위여야 한다.
- **PITWALL 매핑:** 코스 애니메이션은 그대로 두되, 전역 `LIVE / SYNCING n / STALE 5m / STOPPED`와 선택 차의 데이터 시각을 항상 문자로 보장한다. 8시간 동안 변화가 없을 때 빈 공간을 채우지 않는다.
- **기각:** WEC의 팀·제조사·클래스 순위는 익명 비순위 타워로 번역하지 않는다.

### 2.4 Gran Turismo 7 Race Display — “항상 보이는 것”과 “필요할 때 보이는 것”

- **공식 출처:** [Gran Turismo 7 Online Manual — The Race Display](https://www.gran-turismo.com/world/gt7/manual/race/02) 및 [The Multi-Function Display](https://www.gran-turismo.com/us/gt7/manual/race/04) (© 2026 Sony Interactive Entertainment, 2026-08-09 확인)
- **확인한 화면/기능:** 공식 매뉴얼의 번호가 붙은 Race Display는 코스맵·랩·총시간·근처 차량·경고를 공간별로 고정한다. 반면 세부 조절은 MFD 한 슬롯에서 좌우로 전환한다. 상태가 실제로 발생할 때 표시색도 변한다.
- **재사용 패턴:** 핵심 위치·시간·경고는 고정하고, 저빈도 상세는 하나의 전환 가능한 슬롯에 모은다.
- **PITWALL 매핑:** HUD에는 `시간 / 경과 / 데이터 출처 / freshness / 비용 / pace`만 남긴다. 데이터셋·설정·범례는 하나의 보조 컨트롤 군으로 묶는다. 포커스에는 한 번에 한 차량만 보여 주며 track geometry는 선택으로 변하지 않는다.
- **기각:** 브레이크·기어·가상 속도처럼 PITWALL 데이터에 없는 계기는 만들지 않는다.

### 2.5 Grafana Playlists / Kiosk Mode — 두 번째 모니터용 제어 밀도

- **공식 출처:** [Grafana — Manage playlists](https://grafana.com/docs/grafana/latest/visualizations/dashboards/create-manage-playlists/) (2026-08-09 확인)
- **확인한 화면/기능:** Grafana는 playlists를 situational awareness와 큰 화면용으로 설명한다. Kiosk mode는 메뉴·내비게이션·대시보드 컨트롤을 숨기고, auto-fit은 패널을 화면에 맞춘다. `Esc`로 제어를 잠시 다시 노출한다.
- **재사용 패턴:** wall mode에서는 편집·탐색 제어를 숨기되 탈출구는 명확히 둔다.
- **PITWALL 매핑:** native 전체화면/항상 위에서는 설정·범례·데이터셋 select를 기본 축소하고, 마우스 이동·키보드 포커스·명시적 단축키 때 다시 보인다. 단, 데이터 provenance와 LIVE/DEMO는 컨트롤이 아니라 사실이므로 숨기지 않는다.
- **기각:** 여러 대시보드 자동 순환은 PITWALL의 한 장짜리 의미 모델을 깨므로 도입하지 않는다.

### 2.6 Grafana State Timeline — 상태의 “횟수”보다 “지속 시간”

- **공식 출처:** [Grafana — State timeline](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/state-timeline/) (2026-08-09 확인)
- **확인한 화면/기능:** State Timeline은 상태를 band/region으로 그리고 길이로 지속 시간을 표현한다. `null`은 gap으로 남길 수 있고, 같은 연속 상태는 병합할 수 있다.
- **재사용 패턴:** RUN/IDLE/LIMIT/ERROR/STALE 같은 이산 상태는 스파크라인보다 시간 밴드가 더 직접적이다. 결측을 연결하지 않는 것이 사실성이다.
- **PITWALL 매핑:** `.tower-spark` 또는 근무일 timeline에 미세한 상태 밴드를 적용한다. `STALE`·수집 공백은 회색 선으로 이어 붙이지 말고 실제 gap 또는 점선으로 남긴다. 라벨은 `RUN`, `IDLE`, `LIMIT`, `ERROR`를 그대로 유지한다.
- **기각:** 자유로운 pan/zoom, 패널 편집기, 수십 series pagination은 앰비언트 표면에 필요 없다.

### 2.7 Better Stack Dashboards + Live Tail — 집계와 사건 로그를 섞지 않는다

- **공식 출처:** [Better Stack — Get started with Dashboards](https://betterstack.com/docs/logs/dashboards/getting-started/) (© 2026, 2026-08-09 확인)
- **확인한 화면/기능:** 공식 문서는 dashboard가 빠른 pre-aggregated metrics를, Live Tail이 원시 로그를 담당한다고 분리한다. Dashboard 안의 Live Tail query도 최근 10분 로그를 제한적으로 넣는다. Lazyweb에서 열린 Better Stack Telemetry 화면은 얇은 사이드바, 상단 검색/시간 범위, 넓은 로그 표라는 밀도 문법을 확인했다.
- **재사용 패턴:** 집계는 안정된 요약으로, 사건은 짧은 증거 창으로 둔다.
- **PITWALL 매핑:** `.models`는 모델별 호출·work token·비용·cache 집계를 유지하고, `.radio`/선택 feed는 최근 실제 사건만 보여 준다. 모델 막대에 로그 문장을 넣거나 radio에 누적 합계를 반복하지 않는다.
- **기각:** query builder, SQL, 사이드바 내비게이션은 관제 도구의 조작성이고 PITWALL에는 불필요하다.

### 2.8 OpenAI API Usage Dashboard — 범위·시간대·비용 귀속을 명시

- **공식 출처:** [OpenAI — API Usage Dashboard](https://help.openai.com/en/articles/10478918-api-usage-dashboard) (페이지 표기 `Updated: 9 days ago`, 2026-08-09 확인)
- **확인한 화면/기능:** 공식 도움말의 실제 Usage Dashboard 캡처는 시간 범위, `Group by`, project selector를 보여 준다. Usage detail은 1분 TPM 간격을 지원하고 시간대는 UTC다. Scale Tier에서는 usage가 있어도 project spend가 0일 수 있다.
- **재사용 패턴:** 숫자에는 반드시 범위·버킷·귀속 규칙이 따라야 한다. `0 비용`은 `0 활동`이 아니다.
- **PITWALL 매핑:** HUD에 `source · window · as-of`를 붙이고, 모델 요약에서 `activity`와 `cost`를 별도 열로 취급한다. LIVE가 아닌 재생은 wall clock과 event time을 구분한다.
- **기각:** 프로젝트·사용자 drill-down과 CSV export는 summary overlay 이후의 분석 기능이며 메인 화면에 넣지 않는다.

### 2.9 GitHub Copilot Usage Metrics — freshness는 품질 메타데이터

- **공식 출처:** [GitHub — Viewing the Copilot usage metrics dashboard](https://docs.github.com/en/copilot/how-tos/administer-copilot/view-usage-and-adoption) (© 2026 GitHub, 2026-08-09 확인)
- **확인한 화면/기능:** Enterprise → Insights → Copilot usage 화면은 adoption·feature·model·language trend를 나눈다. 공식 문서는 IDE telemetry와 server-side telemetry를 함께 쓰며 데이터가 최대 3개의 완전한 UTC day만큼 늦을 수 있다고 명시한다.
- **재사용 패턴:** 데이터 지연과 coverage는 수치 밖의 주석이 아니라 수치의 의미 일부다.
- **PITWALL 매핑:** `FRESH`, `SYNCING n`, `STALE 5m`를 HUD와 포커스 모두에서 문자로 보여 준다. 수집되지 않은 계정을 `0`으로 읽지 않도록 `NO SOURCE`/`UNKNOWN`을 별도 상태로 둔다.
- **기각:** 개인별 adoption·성과 비교는 PITWALL의 비감시 원칙과 충돌한다.

### 2.10 Anthropic Usage & Cost API — cache는 독립된 1급 축

- **공식 출처:** [Anthropic — Usage and Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api) 및 [Messages Usage Report](https://platform.claude.com/docs/en/api/admin/usage_report) (2026-08-09 확인)
- **확인한 화면/기능:** 공식 Admin API는 1분/1시간/1일 버킷을 제공하고 model·workspace·service tier 등으로 분해한다. usage는 uncached input, cache creation, cache read, output, server tool use를 별도 필드로 반환한다.
- **재사용 패턴:** 모든 token을 하나의 총량으로 합치지 않는다. cache reuse는 사용량의 부수 주석이 아니라 비용·효율을 설명하는 독립 사실이다.
- **PITWALL 매핑:** `.models`의 모델 행은 `calls · work · cost`를 기본으로 두고, cache hit/절감은 모델 패널 또는 summary의 한 축으로 승격한다. 현재 조직 합계의 `캐시 98%` 한 칸만으로 끝내지 않는다.
- **기각:** workspace/API-key/user drill-down은 익명 account rollup 아래로 노출하지 않는다.

### 2.11 LiteLLM Admin Dashboard — 가장 가까운 기능 경쟁자는 분석용 관제 콘솔

- **공식 출처:** [LiteLLM — Getting Started / Proxy Server](https://docs.litellm.ai/) (2026-08-09 확인)
- **확인한 화면/기능:** 공식 페이지는 per-project/user multi-tenant spend, virtual keys, cost tracking, rate limiting, admin dashboard UI를 명시하고 실제 `ui_3` dashboard 이미지를 제공한다. 여러 project/person의 spend tracking이 핵심이다.
- **재사용 패턴:** `tenant → model → spend/limit` 계층은 도메인상 검증됐다.
- **PITWALL 매핑:** `.tower`의 익명 account lane, `.models`의 provider/model rollup, HUD의 cost/rate/limit를 유지한다. PITWALL의 차별점은 이 구조를 query 가능한 관리화면이 아니라 3초짜리 앰비언트 방송으로 재편하는 것이다.
- **기각:** key management, auth, budget editing, per-user spend ranking은 메인 화면에 들어오지 않는다.

### 2.12 IBM Carbon — status는 색이 아니라 색+형태+문자

- **공식 출처:** [Carbon — Color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/) (Last updated 2026-07-29), [Status indicators](https://v10.carbondesignsystem.com/patterns/status-indicator-pattern/), [Typography](https://carbondesignsystem.com/elements/typography/overview/) (2026-08-09 확인)
- **확인한 디자인 규칙:** Carbon은 categorical·sequential·alert palette를 구분한다. alert는 red=error, orange=serious warning, yellow=warning, green=normal로 나누며, status indicator는 color·shape·symbol·text 중 최소 3개를 권장한다. 중립 본문색과 명시적 type hierarchy도 강조한다.
- **재사용 패턴:** class 색, 열기(heat) ramp, operational status를 같은 팔레트로 처리하지 않는다. 상태 배지는 비인터랙티브하고 문자 우선이다.
- **PITWALL 매핑:** `ERROR=#ff5c5c`, `LIMIT=#F2C744`, `SYNCING/FRESH=#4dc3ff`, `CONNECTED=#4ade80`, `STALE=#55636f`로 역할을 분리한다. 현재 ERROR와 LIMIT가 같은 빨강인 부분은 도형·문자뿐 아니라 색도 분리한다. 큰 숫자/상태와 보조 단위의 크기·weight 대비를 키우되, 새 네트워크 폰트는 추가하지 않는다.
- **기각:** Carbon 컴포넌트나 IBM Plex 패키지를 의존성으로 넣지 않는다. 규칙만 가져온다.

## 3. 합성된 정보 위계

### 3.1 1280px 이상

```text
┌ STATUS / SOURCE / AS-OF ────────────── PACE / COST ───── DATA · LEGEND · SETTINGS ┐
├ ACCOUNT TOWER (고정순) ───────────────┬ BROADCAST FOCUS (한 차량, 2행 텔레메트리) ┤
│ 번호 · 모델 · 상태 · 한도 · 비용/속도 │ 번호 · 실제 변화 · 상태/사유 · 마지막 사건 │
│                                       ├───────────────────────────────────────────┤
│ MODEL SUMMARY                          │ FULL-FIELD CIRCUIT (기하 고정, 선택만 강조) │
├────────────────────────────────────────┴───────────────────────────────────────────┤
│ RACE CONTROL: 시각 · 차량 · 실제 사건 · Δwork/Δcost · freshness                  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- 코스는 오른쪽에서 가장 큰 안정 영역이고, 포커스가 바뀌어도 크기·viewBox가 변하지 않는다.
- 포커스는 현재의 한 줄을 2행 블록으로 승격한다. 첫 행은 `#881 · RUNNING · FRESH 2s`; 둘째 행은 `+18.4k work · $0.41 · 3.2k tok/min · 마지막 이벤트 12:42:08`처럼 실제 변화만 쓴다.
- 타워는 고정 car-number 순서를 유지한다. 위험도에 따라 보일 행을 고를 수 있어도 정렬 순서는 바꾸지 않는다.
- 모델 요약은 tower보다 약하고 radio보다 강한 3순위다. 색 막대 하나보다 `calls / work / cache / cost` 열이 먼저다.
- 하단 Race Control은 3–5개 실제 사건만 남기며, 새 사건이 없으면 정적이다.

### 3.2 375px

정보 순서는 `상태·출처 → 포커스 → 완전 코스 → 타워 → 모델 요약 → 최근 사건 → 설정/범례`다. 현재처럼 타워 뒤에 포커스가 늦게 나오거나, 큰 빈 트랙이 상태 설명을 밀어내면 안 된다. 문서 하나만 세로 스크롤하고, 포커스와 코스는 별도 가로 스크롤을 만들지 않는다.

## 4. 상호작용 계약

| 동작 | 권장 반응 | 근거 |
|---|---|---|
| 차량 클릭/Enter/Space | focus만 갱신하고 `MANUAL` 고정. 같은 차량 재선택 시 `AUTO` 복귀 | F1의 전체 맥락+대상 깊이, GT7의 한 MFD 슬롯 |
| 자동 Director 전환 | 160–240ms opacity/transform 교차 전환 1회. 코스 geometry와 tower order 불변 | 방송 포커스는 바뀌어도 field context는 유지 |
| source 지연 | `SYNCING n`, `STALE 5m`, `NO SOURCE`를 숫자와 함께 노출. 위치 전방투영 중단 | GitHub freshness, Grafana gap |
| 설정/범례 | wall mode에서 축소, 사용자 입력 시 재노출. provenance는 계속 보임 | Grafana kiosk |
| 최근 사건 | append만 하고 자동 marquee/무한 애니메이션 금지 | NASCAR Timeline, Better Stack Live Tail |
| reduced motion | 모든 보간·pulse·교차 전환 제거, 같은 문자·도형·순서 즉시 갱신 | 기존 접근성 계약 유지 |

## 5. 색·타입·재질 방향

### 색

- near-black `#0e1116`과 blue-gray 선형 ramp는 유지한다. 화면 대부분은 neutral이어야 한다.
- 상태색은 `ERROR red / LIMIT amber / FRESH-SYNC blue / CONNECTED green / STALE gray`로 분리하고 항상 문자+도형을 동반한다.
- H/P/GT categorical 색과 heat sequential ramp는 status palette와 의미를 공유하지 않는다.
- 모델 막대는 같은 neutral blue ramp 안에서 길이로 비교하고, 경고색을 사용량 크기에 쓰지 않는다.

### 타입

- telemetry 값은 현재 monospace/tabular 숫자를 유지한다.
- 크기 위계를 `label 0.7rem → body 0.9rem → operational fact 1.1rem → focus number 1.6–1.9rem`으로 명확히 한다. 한 줄에 같은 weight를 반복하지 않는다.
- 이미 vendored된 `Kenney Future Narrow.ttf`를 쓰려면 `DESIGN.md`를 먼저 갱신하고 focus heading/phase label에만 제한한다. 외부 폰트 fetch나 새 패키지는 필요 없다.
- 한국어는 wide tracking을 적용하지 않고, 숫자+단위는 붙여 쓴다.

### 재질

- base canvas, hairline separator, raised focus surface의 3단이면 충분하다.
- 카드 그리드를 추가하지 않는다. 경계선은 같은 위계의 패널 사이에만 쓰고, 포커스만 `--pw-surface`로 한 단계 올라온다.
- glow·gradient는 선택/심각도에 쓰지 않는다. track heat는 현재 brightness 규칙 안에서만 사용한다.

## 6. 구현 우선순위

| 우선순위 | 변경 | 직접 대응 surface | 근거 |
|---|---|---|---|
| P0 | HUD를 `source/freshness/as-of`와 `pace/cost` 두 군으로 재배치 | `.hud`, dataset badge | OpenAI, GitHub, WEC |
| P0 | 한 줄 focus를 2행 텔레메트리 블록으로 승격 | `.broadcast-focus` | F1, GT7 |
| P0 | ERROR와 LIMIT의 색·형태·문자를 분리 | tower, track marker, legend | Carbon |
| P0 | 모바일 순서를 상태→focus→track→tower로 변경 | 375px layout | NASCAR, GT7 |
| P1 | radio를 3–5건 고정 열의 Race Control strip으로 변경 | `.radio` | NASCAR Timeline, Better Stack |
| P1 | RUN/IDLE/LIMIT/ERROR/STALE를 짧은 상태 밴드로 표현 | `.tower-spark` 또는 hourly timeline | Grafana State Timeline |
| P1 | 모델 summary에 cache를 1급 축으로 승격 | `.models`, summary overlay | Anthropic, LiteLLM |
| P2 | native full-screen에서 wall-mode 제어 축소 | settings, legend, dataset controls | Grafana Kiosk |

## 7. 하지 않을 것

- 새 대시보드 카드, pie chart, query builder, 자유 zoom/pan
- 개인·계정 성과 순위, 사용자 이름, 프로젝트 경로, 효율 점수
- 실제 데이터에 없는 속도계·타이어·랩타임·전략
- 구독 제품의 화면을 픽셀 복사하거나 브랜드 로고·F1 red를 차용
- 외부 런타임 폰트·이미지·analytics
- 데이터 gap을 보간해 LIVE처럼 보이게 하기

이 12건이 공통으로 말하는 것은 “더 많이 보여라”가 아니다. **전체 맥락을 고정하고, 지금의 한 사실을 크게 하고, 나머지는 증거 순서로 낮춰라**다. PITWALL의 재설계는 새 시각화 라이브러리 없이도 현재 DOM/SVG 구조 안에서 이 방향을 달성할 수 있다.
