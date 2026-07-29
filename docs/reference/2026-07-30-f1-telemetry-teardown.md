# [pitwall] matteocelani/f1-telemetry 코드·디자인 분해

**작성일** 2026-07-30 · **대상** `matteocelani/f1-telemetry` @ `877f99c` (2026-06-03) · **라이선스** MIT
**목적** PRD §11.1 / §11.4 / §17이 이 저장소를 근거로 삼은 주장을 원본 코드에서 재확인하고, PITWALL v1이 채택할 기법과 기각할 기법을 확정한다.

> 이 문서의 모든 `[High]` 항목은 위 SHA의 파일을 직접 읽고 확인했다. 2차 출처 인용 없음.

---

## 0. 결론 먼저

| PRD 주장 | 실제 | 판정 |
|---|---|---|
| "SVG + rAF 60fps 보간 + 직접 DOM 조작" (§11.1) | 맞다. 단 **직접 DOM 조작은 `TrackMap`의 rAF 핫패스 한 곳뿐**이고, 나머지 UI는 전부 React 렌더 | **절반 맞음** |
| "WebGL·canvas 불필요" (§11.1) | 맞다. 차트만 `recharts`/`uplot` | **맞음** |
| "UI 프레임워크 없음"의 선례 (§11.4) | **틀렸다.** Next.js 16.1.6 + React 19.2.4 + zustand + Tailwind v4 + shadcn/base-ui + framer-motion | **틀림 — 이 저장소는 PITWALL의 무프레임워크 결정을 지지하지 않는다** |
| "서버 이벤트를 50ms 윈도우로 배칭" (§11.1) | 맞다. 단 **서버 측**(`socket-server.ts`)이며 클라이언트 버퍼는 배칭이 아니라 방송 딜레이 싱크 | **맞음, 위치 정정 필요** |
| "38★ 취미 프로젝트, 권위 하향" (§11.1) | 별 수는 맞다(38★, 최종 푸시 2026-06-03). 코드는 취미 수준 이상 — 핫패스 무할당·NaN 가드·랩 경계 리셋 가드 등 실전 결함 대응이 들어 있다 | **별 수 맞음, 품질 평가는 상향** |

**한 줄 요약:** 아키텍처는 참고하지 않는다(모노레포·Next.js·실서버). **렌더 핫패스의 기법 5개와 디자인 토큰 구조 1개만 가져온다.**

---

## 1. 실제 구조

```
f1-telemetry/            pnpm 워크스페이스
├── core/                공용 타입 + SignalR 채널 상수
├── apps/backend/        Node. F1 공식 SignalR 피드 → WebSocket 재방송
│   └── src/services/socket-server.ts   ← 50ms 배칭이 여기 있다
└── apps/frontend/       Next.js 16 App Router
    ├── src/ws/          wsClient / wsBuffer / wsHandler
    ├── src/store/       zustand 스토어 13개 (채널당 1개꼴)
    └── src/app/live/    sections/ + components/
        └── sections/TrackMap.tsx       ← 직접 DOM 조작은 여기뿐
```

프론트엔드 런타임 의존성 28개. PITWALL v1의 "런타임 의존성 0개" 제약과 정반대다. **구조는 참고 대상이 아니다.**

---

## 2. 채택할 기법 5개

### 2.1 CSS `offset-path`로 폐곡선 위 위치 지정 — 가장 큰 발견 [High]

`TrackMap.tsx:196-200`은 차량 `<g>`에 좌표를 주지 않는다.

```tsx
<g style={{
  offsetPath: `path("${circuit.path}")`,
  offsetDistance: '0%',
  offsetRotate: '0deg',
}} />
```

rAF 루프(`TrackMap.tsx:72-80`)가 매 프레임 쓰는 것은 **문자열 하나**다.

```ts
el.style.offsetDistance = `${percent}%`;
```

`x`/`y`/`cx`/`cy` 계산이 아예 없다. 진행률 퍼센트 하나가 곧 위치다. 브라우저가 경로 위 호길이 보간을 대신 해준다.

**PITWALL 적용.** Task 8의 `positionAt(track, progress, carClass)`(호길이 누적 + 선형보간)이 하던 일의 상당 부분을 CSS가 흡수한다. 다만 **완전 대체는 하지 않는다.** 이유:

- jsdom은 `offset-path`를 계산하지 않는다. Task 13이 jsdom 단위 테스트에 의존하므로(계획서 2631-2635행), 순수 함수 `positionAt()`은 **테스트 가능성을 위해 유지**한다.
- 레인 분리(클래스별 오프셋)는 `offset-path` 단독으로 안 된다. 레인마다 별도 `path` 문자열을 만들어 각 레인 그룹에 다른 `offsetPath`를 주는 방식이 필요하다.

**권장 절충:** 좌표 계산은 `positionAt()`으로 테스트하고, 렌더러는 레인별 `offsetPath` + `offsetDistance`로 그린다. 프레임당 쓰기가 `style.transform` 문자열 조립(`translate(x,y)`)에서 퍼센트 문자열 하나로 줄어든다. Global Constraints의 "CSS 속성만, SVG 속성 금지" 규칙과 충돌하지 않는다 — `offset-distance`는 CSS 속성이고 레이아웃을 무효화하지 않는다.

> **미검증 [Medium]:** `offset-path`가 `transform`과 동일한 컴포지팅 경로를 타는지는 측정하지 않았다. Task 18 벤치마크에 `transform` 방식과 `offset-distance` 방식 A/B를 추가한다.

### 2.2 앵커 + 전방투영 + lerp 3단 보간 [High]

`useTrackMap.ts:599-646`. 차량당 상태 5필드:

| 필드 | 뜻 |
|---|---|
| `anchorPercent` | 마지막 실데이터 위치 |
| `anchorTime` | 그 데이터가 도착한 시각 |
| `nextBoundaryPercent` | 다음 데이터가 올 것으로 예상되는 위치 |
| `estimatedDwellMs` | 두 지점 사이 예상 소요(직전 랩타임 ÷ 세그먼트 수) |
| `visualPercent` | 화면에 실제로 그려지는 값 |

```ts
progress    = min(elapsed / estimatedDwellMs, 0.95)   // MAX_PROJECTION_RATIO
target      = anchor + (nextBoundary - anchor) * progress
visual     += (target - visual) * 0.15                 // LERP_FACTOR
if (|delta| < 0.01) visual = target                    // LERP_SNAP_THRESHOLD
```

**0.95 클램프가 핵심이다.** 다음 앵커에 도달하기 전에 멈춘다 — 데이터가 늦어도 차가 다음 구간을 앞질러 가지 않는다. PRD §15의 "**데이터가 없을 때 임의 이벤트를 생성하지 않는다**"와 정확히 같은 규율의 렌더 버전이다.

**PITWALL 적용: 그대로 채택.** 상수 3개(0.95 / 0.15 / 0.01)와 5필드 상태 구조를 Task 13 렌더러에 옮긴다. 우리 쪽 `estimatedDwellMs`는 랩타임이 아니라 **직전 호출 간격의 이동중앙값**에서 나온다.

### 2.3 핫패스 무할당 [High]

`useTrackMap.ts`가 프레임당 객체를 하나도 만들지 않으려고 쓰는 수법:

- `projectedRef` — 반환 객체를 재사용하고 사라진 키만 `delete` (336-337, 601-609행)
- `SECTOR_KEYS` / `SEGMENT_KEYS` — 사전 정렬 상수 배열로 `Object.keys().sort()` 회피 (63-77행)
- `DRIVER_META`, `RACE_DATE_RANGES` — 모듈 로드 시점에 1회 계산 (88-113행)
- `COMPLETED_STATUSES` — `Set` 상수로 매 프레임 배열 `includes` 회피 (81행)

**PITWALL 적용: 채택.** 8시간 상시 실행(PRD §11.3, 힙 증가 ≤ 50MB 릴리스 게이트)에서 프레임당 할당은 GC 압력으로 직결된다. Task 13 렌더러와 Task 10 디렉터의 프레임 경로에 같은 규칙을 적용한다.

### 2.4 백그라운드 탭 대응 — rAF 정지 시 setInterval 인계 [High]

`wsBuffer.ts:85-119` + `wsClient.ts:178-215`.

```ts
pauseRaf()   // 탭이 숨으면 rAF 취소
tick(∞)      // 외부 드라이버(setInterval)가 캡 없이 드레인
resumeRaf()  // 복귀 시 rAF 재개
```

rAF 루프일 때만 `MAX_DISPATCH_PER_FRAME = 20` 캡을 적용해 렌더 폭풍을 막고, 백그라운드 드레인은 캡을 풀어 밀린 프레임을 소진한다. 코드 주석이 "브라우저가 숨은 탭의 `setInterval`을 ~1Hz로 clamp한다"는 현실까지 명시한다.

**PITWALL 적용: 채택.** PRD A9(백그라운드 탭 rAF 정지)의 완화책이 지금은 "`visibilitychange`에서 상태 재동기화"라는 한 줄뿐이다. 이 3메서드 패턴을 Task 17 메인 루프의 구체 설계로 승격한다. 우리는 시뮬레이터가 브라우저 안에 있으므로 더 단순하다 — 숨은 동안 이벤트 생성을 **벽시계 기준으로 건너뛰고**, 복귀 시 보간 없이 스냅한다(PRD §11.3과 동일).

### 2.5 서버 배칭: 채널별 최신값 coalescing + 직렬화 diff [High]

`socket-server.ts:6-7, 110-160`.

```ts
const BATCH_INTERVAL_MS = 50;             // ≈20fps
broadcast(ch, data) → batchBuffer.set(ch, deepMerge(existing, data))
flush() {
  for ([ch, data] of batchBuffer) {
    if (deltaCache.get(ch) === JSON.stringify(data)) continue;  // 무변경 채널 스킵
    ...
  }
  // 1회 직렬화 후 전 클라이언트에 공유
}
```

배칭 = "50ms 동안 온 것을 모아 보낸다"가 아니라 **"50ms 동안 채널별 최신 상태로 접어서 변한 것만 보낸다"**이다. deep merge로 델타가 서로를 덮어쓰지 않게 한다.

**PITWALL 적용: 위치를 옮겨 채택.** v1에는 서버가 없다. 같은 배칭을 **`EventSource` → 스토어 경계**에 둔다. PRD §11.2의 "이벤트 배칭 50ms"는 유효하되, 구현 위치는 `SimulatorSource`가 방출한 이벤트를 리듀서에 넘기기 직전이다. 차량별 최신 상태로 접는 것은 이미 리듀서가 하는 일이므로, 우리 쪽에서 추가로 필요한 것은 **50ms 동안 렌더 트리거를 1회로 묶는 것**뿐이다.

---

## 3. 기각할 것

| 대상 | 기각 사유 |
|---|---|
| Next.js / React / zustand 스택 | PITWALL v1은 런타임 의존성 0개. 이 저장소는 무프레임워크 결정의 **근거가 아니다** |
| `TimingTower` (순위 정렬 리스트) | PRD PRIV-5 정면 위반. 개인 간 정렬 UI 금지 |
| 차량 위 텍스트 라벨 (`TrackMap.tsx:214-224`, TLA 3글자) | PRD §6.3 "트랙 위 텍스트 라벨 금지". 카메라 카드에서만 표시 |
| `ResizablePanelGroup` 3분할 + breakpoint별 레이아웃 트리 | PRD §2.2 "모바일·반응형" 비목표. 세컨드 모니터 고정 |
| GPS 아핀 변환 캘리브레이션 (`useTrackMap.ts:397-432`) | 우리는 좌표계가 하나다. 워밍업 3프레임 후 스케일 추정할 대상이 없음 |
| F1 팀 색상 하드코딩 팔레트 (`--color-team-*`) | 실제 팀 브랜드색. PRD가 회피하기로 한 "실제 팀명·로고" 범주에 인접. `#e10600` F1 레드도 쓰지 않는다 |
| 파일 단위 코드 복사 | MIT라 가능하지만 저작권 고지 의무 발생. **기법만 가져오고 파일은 복제하지 않는다** |

---

## 4. 디자인에서 가져올 것

### 4.1 2계층 시맨틱 토큰 [High]

`globals.css`. 원시값을 `:root` / `.dark`에 두고, Tailwind `@theme inline`이 의미 이름으로 한 번 더 매핑한다.

```css
:root  { --f1-sector-purple: hsl(284 100% 64%); }   /* 원시값 */
@theme inline { --color-f1-sector-purple: var(--f1-sector-purple); }  /* 의미 이름 */
.dark  { --f1-sector-purple: hsl(284 100% 64%); }   /* 다크에서 재정의 */
```

**PITWALL 적용:** Task 12 `config/theme.ts`가 지금은 JS 객체 하나다. 색상값을 CSS 변수로 내리고 JS는 변수명만 참조하게 하면, 색각 이상 대응 팔레트 교체가 **JS 재빌드 없이** 가능해진다. 형태(shape) 인코딩은 JS에 남는다.

다크 기본 배경 `hsl(240 18% 10%)`(#15151e)는 상시 노출 화면에 맞는 선택이다 — 순흑이 아니라 약간 푸른 계열. **값 자체는 참고하되 F1 레드 primary는 채택하지 않는다.**

### 4.2 트랙 자체에 전역 상태를 입히는 이중 path [High]

`TrackMap.tsx:145-164`. 같은 경로를 두 번 그린다.

| 레이어 | stroke-width | opacity (정상 / 상태) |
|---|---|---|
| glow | 8 | 0.06 / 0.15 |
| track | 3 | 0.2 / 0.6 |

트랙 상태(옐로·SC·레드)가 뜨면 두 레이어의 색과 불투명도가 함께 바뀐다. 별도 배너 없이 **화면 전체가 상태를 말한다.**

**PITWALL 적용: 채택.** PRD §15의 `STALE`(데이터 끊김) / `LIMITED`(한도 초과)를 배너가 아니라 트랙 색으로 표현한다. 곁눈질 3초 안에 읽혀야 한다는 G1에 배너보다 잘 맞는다. 접근성 하드 룰에 따라 색 단독은 금지 — 상태별로 트랙 대시 패턴을 함께 바꾼다.

### 4.3 이산 마커 나열 = 리더 라이트 [High]

`SegmentDots.tsx`. `size-2` 원을 `gap-px`로 나열하고 상태별 색만 바꾼다. 미도달 구간은 `bg-muted-foreground/10`.

PRD §6.3이 르망에서 가져오기로 한 "순위 = 이산 마커, 라벨 없음" 원리의 최소 구현체가 이것이다. 컴포넌트가 38줄이다.

**PITWALL 적용:** 카메라 카드의 연료·타이어 게이지를 연속 바가 아니라 **이산 도트 N개**로 그린다. 곁눈질에서 "몇 칸 남았나"는 바 길이보다 도트 개수가 빠르다.

### 4.4 근사값을 근사값이라고 말하는 UI [High]

`TrackMap.tsx:110-137`. GPS가 없어 세그먼트 타이밍으로 위치를 추정 중일 때 좌하단에 "Estimated positions" 배지를 띄우고, 클릭하면 왜 추정인지 설명하는 팝오버가 열린다.

PRD §6.4의 "**조용한 truncation은 '전부 보여줬다'는 거짓말이 된다**"와 같은 원칙이다.

**PITWALL 적용: 채택.** 두 곳에 쓴다 — 레인 렌더 상한 초과 시 클러스터 배지(§6.4), BOX BOX 휴리스틱이 근사임을 밝히는 표시(§7.2, A13).

---

## 5. PRD 정정 사항

| PRD 위치 | 정정 |
|---|---|
| §11.1 | "직접 DOM 조작"은 rAF 핫패스 한 곳에 국한. 나머지는 React 렌더임을 명시 |
| §11.1 | 50ms 배칭은 **서버 측**. v1에 서버가 없으므로 `EventSource` → 스토어 경계로 위치 이동 |
| §11.4 | "UI 프레임워크 없음"의 근거로 이 저장소를 인용할 수 없음. 무프레임워크 결정의 근거는 **200노드 직접 조작 + 의존성 0**이라는 우리 자체 논리뿐 |
| §11.1 | 코드 품질 평가 상향: 별 38개지만 핫패스 무할당·NaN 가드·랩 경계 리셋 가드 등 실전 대응이 있음. "합리적 출발점" → "**검증할 가치가 있는 구현 디테일 출처**" |
| §17 "검증했으나 변경 없음" | "`f1-telemetry`의 SVG+rAF+50ms 배칭 접근" 항목은 부분 오류. 위 4건 반영 |

---

## 6. 확인한 파일

| 파일 | 행 | 확인 내용 |
|---|---|---|
| `apps/frontend/src/app/live/sections/TrackMap.tsx` | 231 | `offset-path` 렌더, rAF 루프, 이중 path glow, 추정 배지 |
| `apps/frontend/src/modules/timing/hooks/useTrackMap.ts` | 656 | 앵커+전방투영+lerp, 무할당 핫패스, 랩 경계 가드, GPS 아핀 변환 |
| `apps/frontend/src/ws/wsBuffer.ts` | 122 | 딜레이 링버퍼, `pauseRaf`/`resumeRaf`/`tick`, 프레임당 디스패치 캡 |
| `apps/backend/src/services/socket-server.ts` | 180+ | 50ms 배칭, 채널별 coalescing, 직렬화 diff |
| `apps/frontend/src/assets/css/globals.css` | 200+ | 2계층 시맨틱 토큰, 다크 기본값 |
| `apps/frontend/src/app/live/components/SegmentDots.tsx` | 38 | 이산 마커 나열 |
| `apps/frontend/src/app/live/page.tsx` | 252 | breakpoint별 레이아웃 트리 (기각) |
| `apps/frontend/package.json` | 53 | 런타임 의존성 28개 (기각 근거) |
