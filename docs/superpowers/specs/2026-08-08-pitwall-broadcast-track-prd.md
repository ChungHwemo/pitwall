# PITWALL 방송 중계형 트랙 재설계 PRD

**일자:** 2026-08-08
**상태:** 구현 전 결정 완료 · 이 문서의 다음 단계는 TDD RED이며, 프로덕션 변경은 아직 없다.

## 1. 문제와 성공 정의

사용자 판정은 명확하다. **현재 트랙 애니메이션의 가독성은 거의 0**이다. 차가 움직여도 지금 무엇이 위험하고, 전체 필드가 어디에 있고, 왜 한 차량을 봐야 하는지가 곁눈질로 오지 않는다. 장식적 움직임을 늘리는 문제가 아니라, 실제 데이터의 시간·위험·선택을 방송 중계의 우선순위로 번역하는 문제다.

성공은 3초 안에 다음을 모두 답할 수 있는 화면이다.

1. 전체 필드는 어느 코스의 어디에 분포하는가?
2. 지금 방송이 짚는 한 차량/작업은 무엇이며, 어떤 실제 수치가 변했는가?
3. LIVE 상태는 신선·동기화·지연·정지 중 무엇이고, 위험/정지 사유는 무엇인가?

이 제품은 사람·성과의 순위표가 아니다. 차량은 익명 작업 단위이고, 진행은 관측된 토큰/이벤트에서만 나온다. 없는 이벤트, 속도, 연결, 위험을 만들어 내지 않는다.

## 2. 조사 근거와 채택/기각

참조 이미지는 저작권 자산으로 복사·번들·커밋하지 않는다. 조사 기록과 원본 URL은 [벤치마크 증적](../../../.omo/evidence/ulw/review-ui-realtime-20260808/G001-review-md-ui-ux/a1/benchmark-report.md)에 남긴다.

| 참조 | 확인한 시각 메커니즘 | PITWALL 적응 | 기각 |
|---|---|---|---|
| F1 TV 및 [Improved Live Timing](https://www.formula1.com/en/latest/article/improved-live-timing-on-f1-com-for-the-2022-season.3Y1ipx839mv7xeteTqQ8Mk.3Y1ipx839mv7xeteTqQ8Mk) | 리더보드, 구간/차량 텔레메트리, 실시간 차량 추적 지도를 동시에 두되 지도는 전체 문맥을 지킨다. | 전체 필드 레이더 + 단 하나의 방송 포커스 텔레메트리 + 텍스트 LIVE 상태. | 영상·온보드·타이어·드라이버 신원·경쟁 순위. 우리 데이터에 없는 사실이다. |
| [NASCAR Race Center](https://www.nascar.com/racecenter/) · [공식 live 기능 설명](https://www.nascar.com/followlive/) · [Digital Media Kit](https://www.nascar.com/wp-content/uploads/sites/7/2025/08/22/NASCARDigital_MediaKit.pdf) | Race Center는 live leaderboard/live scoring bar를, 공식 live 설명은 실시간 scoring·랩·pit·위치·Race Tracker를, Media Kit은 실시간 scoring·driver data·타임라인을 각각 확인한다. | 트랙을 항상 전부 보이고, 단계/백로그/최근 실제 이벤트를 짧은 방송 스트립으로 둔다. | 위성사진, 광고, 팀 로고, "Top 10"과 결과 중심 순위. |
| [Gran Turismo 7 온라인 매뉴얼](https://www.gran-turismo.com/gb/gt7/manual/gtworld/02) 및 HUD | 운전 장면 위 HUD는 위치·랩·코스·현재 속도 중 즉시 필요한 값만 크게, 주변 맥락은 작게 둔다. | 포커스 패널은 차 번호/상태/실제 work rate·최근 이벤트·신선도만 대형으로, 전체 레이더는 작아지지 않는다. | 게임 조작, 속도계 장식, 이모지·드라이버 이름·가상의 주행 카메라. |
| [Cyber Formula 세계관](https://www.cyber-formula.net/introduction/words.html), [SIN DREI Plus](https://www.project-ynp.com/product/cf/about/index.html), [SIN VIER 매뉴얼](https://www.project-ynp.com/product/cf4/liveitems/CfSinVIerOnlineManualPs4.pdf) | 기계 실루엣과 레이싱 계기는 속도감의 재료지만, 명료한 숫자·게이지·상태가 독해를 우선한다. | 얕은 사선/레이어와 차 실루엣은 방송 포커스를 분리하는 데만 사용한다. | 부스트/변형/미래 예지/과장된 셰이더·블룸. 실제 데이터가 아닌 서사다. |

## 3. 고정 아키텍처 결정

**결정: B — 급진적 SVG/DOM 방송 중계 리디자인. Three.js를 추가하지 않는다.**

| 평가 기준 | A: Three.js 고정 직교/사선 장면 + DOM | B: SVG/DOM 방송 중계 리디자인 | 결정 근거 |
|---|---|---|---|
| 핵심 과제 | 2.5D 광원·실루엣에는 유리하나, 가독성 문제를 3D로 바꾸지 않는다. | 전체 코스·차량·정지 사유·텍스트 포커스를 하나의 접근 가능한 문서 모델로 둔다. | 문제는 카메라가 아니라 위계다. |
| 기존 자산/회귀 | 새 WebGL 수명주기와 이중 렌더러를 추가한다. | `TrackRenderer`의 코스/풀/피트/선택 계약과 테스트를 직접 보존한다. | 현재 SVG는 완전 코스, 풀링, 800 노드 상한을 이미 검증했다. |
| 오프라인 단일 HTML·저사양 | 라이선스·번들 크기·WebGL 가용성·컨텍스트 손실 게이트가 추가된다. | 현재 빌드 계약과 native SVG fallback이 동일하다. | 사용자가 허용했어도 추가 의존성은 가치가 증명될 때만 쓴다. |
| 접근성/200% 확대 | 캔버스에 별도 DOM 대체물이 필요하다. | 레이블·상태·키보드 포커스를 DOM/SVG와 자연스럽게 동기화한다. | CJK·확대·보조기술 요구가 우선이다. |

향후 A를 다시 열 수 있는 조건은 **SVG/DOM 방식이 실제 Chromium 프로파일에서 정한 프레임/노드/가독성 기준을 만족하지 못하고, 고정 시점 2.5D가 그 실패를 해결한다는 비교 프로토타입 증거가 있을 때뿐**이다. 그때 A에는 WebGL 불가와 reduced-motion SVG fallback, 인스턴싱/풀링, 라이선스·빌드 크기 게이트, 자유 카메라 금지, 전체 트랙 상시 노출을 모두 필수로 한다.

## 4. 정보 위계와 화면 계약

화면은 카드들의 동등한 그리드가 아니라, 다음 네 층을 가진 방송 프레임이다.

1. **최상단 사실:** `LIVE`/`REPLAY`와 `FRESH·SYNCING n·STALE 5m·STOPPED`를 말과 모양으로 표시한다. 위험은 `LIMIT`, `ERROR`, `BACKLOG n`, `STALE`처럼 원인을 그대로 쓴다. 색만으로 말하지 않는다.
2. **항상 보이는 전체 필드 레이더:** 완전한 코스·피트·모든 차량을 축소/크롭 없이 유지한다. 비포커스 차량은 클래스 모양과 신선도를 유지하되 절제한다. 숨긴 차량은 `+N`으로 명시한다.
3. **유일한 지배적 방송 포커스:** 자동 Director가 실제 새 이벤트·정지·큰 변화에 따라 하나를 고르며, 사용자의 수동 선택은 이를 이긴다. 포커스에는 번호, 실제 상태, work rate/누적량, 마지막 이벤트 시각, 위험/정지 사유, freshness만 보인다. 포커스가 바뀌어도 레이더의 기하나 크기는 바뀌지 않는다.
4. **보조 증거:** 타이밍 타워와 최근 실제 이벤트 스트립은 확인용이다. 포커스를 경쟁하거나 임의의 알림을 생성하지 않는다.

자동 포커스의 우선순위는 `수동 선택 > error/limit > 새 실제 이벤트의 심각도 > 큰 실제 work-rate 변화 > freshest 후보 > 유지`다. 후보가 없으면 "방송 포커스 없음 — 새 이벤트 대기"를 보이고 추측으로 차량을 선정하지 않는다.

## 5. 상태, 반응형, 실패 모드

| 상태 | 필수 표현/행동 |
|---|---|
| sparse / empty | 빈 공간을 채우지 않는다. 완전 코스와 "관측 차량 없음"만 보여 거짓 활동을 만들지 않는다. |
| dense | 모든 차량은 계속 레이더에, 충돌군은 한 개 대표 마커와 `+N`으로 명시한다. 타워는 번호·상태·위험을 먼저 보존한다. |
| stopped | `ERROR`와 `LIMIT`은 서로 다른 모양+문구; 차는 실제로 멈추며 진행 보간을 하지 않는다. |
| stale | 마지막 수신 경과를 표시하고 위치·속도·연결을 새로 주장하지 않는다. stale은 연결 끊김의 동의어가 아니다. |
| backlog / syncing | `SYNCING n` 또는 `BACKLOG n`과 실제 대기 수를 표시한다. 카운트가 0이 되기 전 `LIVE`를 주장하지 않는다. |
| manual focus | Enter/Space/클릭으로 고정·해제하며 자동 Director가 훔치지 않는다. |
| reduced motion | `prefers-reduced-motion: reduce`에서 이동 보간·펄스·컷 전환을 끄고, 동일한 텍스트/도형/순서의 즉시 상태 변화만 남긴다. |
| 375px | 문서 하나가 세로 스크롤: LIVE 사실 → 포커스 → 전체 레이더 → 타워/이벤트. 가로 스크롤·필수 사실 잘림 금지. |
| 768px | 압축 2단: 포커스와 레이더가 같이 보이고, 타워는 접히거나 아래로 간다. 200% 확대에서도 가로 스크롤 금지. |
| 1280px | 고정 방송 프레임: 전체 레이더가 가장 큰 안정 영역, 포커스 텔레메트리가 그 위/옆을 점유하되 코스를 가리지 않는다. |
| CJK/200% zoom | 한국어 음절을 자르지 않고 숫자+단위를 붙인다. 14 CSS px 이상 필수 본문, 4.5:1 이상, `scrollWidth === innerWidth`를 실제 Chromium에서 확인한다. |

## 6. 시간 기반 모션

모션은 데이터의 시간 축만 표현한다. 각 차량은 관측된 anchor 사이에서 `requestAnimationFrame`으로 보간하고, 새 anchor를 앞지르지 않으며 stopped/stale에서는 진행을 만들지 않는다. 새 방송 포커스는 160–240ms의 opacity/transform 교차 전환 한 번으로 나타나고, 중간에 새 후보가 오면 즉시 재목표화한다. layout property, 무한 장식 애니메이션, 가짜 엔진 흔들림은 금지한다.

각 프레임은 DOM 노드를 만들거나 지우지 않고, 미리 풀링한 차량/집계 마커의 `transform`, `opacity`, `filter`만 바꾼다. 이벤트가 없으면 트랙 프레임은 정적이어야 한다. 시간과 실제 이벤트를 제외한 RNG, CSS 반복 motion, 자동 카메라 이동은 없다.

## 7. 접근성·프라이버시·성능·배포

- WCAG 2.2 AA: 의미 있는 그래픽 3:1, 본문 4.5:1, 가시 포커스, 키보드 전체 조작, 색 외 모양+문구, `aria-live="polite"`의 변화 요약, 수동 포커스의 `aria-pressed`.
- 화면 낭독기는 레이더의 모든 점을 반복 낭독하지 않는다. 포커스, 위험 변화, 전체 차량/집계 수를 요약하고, 타워에서 키보드로 개별 항목에 도달한다.
- 원문 프롬프트/응답, 원시 계정 식별자, 개인 이름, 순위/평가, 외부 런타임 telemetry를 내보내지 않는다. 데이터가 없을 때 LIVE/연결/속도를 지어내지 않는다.
- 오프라인 단일 HTML을 유지한다. 외부 CDN·폰트·이미지·추적 스크립트·네트워크 런타임 의존은 없다.
- 기존 SVG 노드 예산 800을 넘지 않으며, 40대/최악 hot·cold 혼합에서 렌더 후 노드가 안정화된다. 1280px 실 Chromium에서 60fps를 목표로 하고, 10초 동안 long task 50ms 초과 0회·heap/DOM 증가 0을 기록한다. 기준 실패는 미관보다 먼저 고친다.

## 8. 보존·롤백 경계

`TrackRenderer` 원본 소스와 현재 테스트는 삭제하지 않는다. 교체 seam에서는 새 `BroadcastTrackRenderer`의 선택만 추가하고, 원래 호출은 정확히 이 **한 줄의** 날짜 든 주석으로 보존한다: `/* LEGACY/ROLLBACK 2026-08-08: this.trackRenderer = new TrackRenderer(svg, track); */`. 이 주석은 원본 호출 하나만 담으며 큰 주석 블록이나 죽은 구현을 덤프하지 않는다. SVG fallback은 그대로 기존 renderer를 인스턴스화한다. 이것만이 "comment it out"의 허용 해석이다.

## 9. 구현 전 TDD와 검증 순서

1. **RED:** 기존 `TrackRenderer` 특징화 테스트를 먼저 통과시켜 완전 코스, stopped 정지, 피트 간격, 수동 선택, 800 노드/풀 안정성을 잠근다. 이어서 다음 실패 테스트를 쓴다: 자동 포커스 우선순위, stale/backlog의 literal 문구, reduced-motion에서 motion 없음, dense `+N`, 375/768/1280/200% CJK 필수 사실 보존, fallback seam.
2. **GREEN:** 가장 작은 SVG/DOM broadcast shell, Director adapter, 포커스 텔레메트리, 상태 문자열, 풀 재사용을 차례로 구현한다. 각 RED 케이스를 독립적으로 GREEN으로 만든다.
3. **회귀:** 기존 `TrackRenderer`와 그 테스트를 그대로 실행하고, fallback에서 같은 track fixture를 렌더한다.
4. **실 Chromium QA:** production single HTML을 빌드한 뒤 Chrome에서 375·768·1280 및 768/200%를 각각 촬영한다. sparse, dense, stopped error, stopped limit, stale, backlog/syncing, manual focus, reduced motion, CJK 긴 라벨을 실제 이벤트 fixture로 구동한다. 각 시나리오에 스크린샷, action log, DOM/node 수, long-task/프레임 기록을 남긴다.
5. **통과 판정:** 3초 이해 테스트 참가자(또는 사전 정의된 QA 질문)가 §1의 세 답을 모두 맞히고, 모든 화면 폭에서 필수 사실이 보이며, `diff --check`, typecheck, 전체 테스트, build:single, Chromium QA가 통과해야 한다. 한 항목이라도 실패하면 디자인 완성이 아니다.

## 10. 비목표와 출시 게이트

자유 카메라, 3D scene, 영상/온보드, 순위 경쟁, 멋을 위한 셰이더·블룸, 가상의 랩·속도, 새 수집 훅은 이번 범위가 아니다. 이 PRD가 커밋되기 전에는 새 프로덕션 코드를 작성하지 않으며, 커밋 뒤에도 §9의 RED 증거 없이 구현을 시작하지 않는다.
