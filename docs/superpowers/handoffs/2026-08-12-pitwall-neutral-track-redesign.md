# PITWALL Neutral Track Redesign Handoff

작성자: Chung Hwemo <tolaria@naver.com>
작성일: 2026-08-12

## 구현 방법 우선

다음 구현은 `shadcn/ui`를 설치하거나 React 컴포넌트를 도입하지 않는다. 공식 shadcn의 의미 기반 CSS 변수 문법과 neutral 컴포넌트 문법만 현재 Vite + TypeScript + SVG 구조에 차용한다.

1. `pitwall/src/style.css`에 `background`, `foreground`, `card`, `muted`, `muted-foreground`, `border`, `input`, `ring`, `accent`, `destructive`, `radius` 의미 토큰을 추가한다.
2. 새 색을 직접 뿌리지 않고 기존 PITWALL 토큰을 위 의미 토큰에 매핑한다. 기존의 cyan/green/red/purple는 차량 클래스와 운영 상태 전용으로 유지한다.
3. 트랙을 고정된 주 콘텐츠로 승격한다. 데스크톱에서는 트랙이 넓은 주 영역, 타워가 읽기용 보조 영역이 된다. 선택·상세 패널은 트랙을 밀지 않고 overlay로 겹친다.
4. 트랙 주변에는 제목·실시간 상태·차량 수·최근 활동만 남기는 compact rail을 둔다. 설정·범례는 계속 disclosure로 숨긴다.
5. 타워 행은 `번호 > 상태 > 비용/속도 > 모델/스파크` 순으로 시각 계층을 재정렬한다. 행 높이와 고정 열 때문에 숫자가 잘리지 않도록 `minmax(0, 1fr)`와 명시적 우선순위를 사용한다.
6. 모바일은 `트랙 → 핵심 상태 rail → 차량 목록` 순서로 쌓고, 문서만 주 스크롤 소유자가 되게 한다. 모델명과 spark는 먼저 접되 번호·상태·한도·비용은 남긴다.
7. 기존 `TrackRenderer`, `TowerRenderer`, `PitwallApp`의 데이터 계약과 SVG pooling은 유지한다. 레이아웃 변경 때문에 position, heat, stopped 상태의 의미를 바꾸지 않는다.

## 현재 상태

- 기존 기능 변경분: 실제 Claude/Codex/Grok usage 파싱, Claude message-id dedup, 세부 pricing, heat attack/release, 관련 테스트와 fixture 변경이 작업 트리에 있다.
- `DESIGN.md`에는 현재 dark operational wall, CJK 우선, 트랙/타워 계약, reduced-motion, WCAG 제약이 기록되어 있다.
- shadcn 공식 문서에서 확인한 기준은 의미 토큰 중심 테마, `card`/`muted`/`border`/`ring` 계층, 기본 radius 파생 토큰이다.
- 이번 대화에서 만든 비교 시안: `.superpowers/brainstorm/75135-1786532958/content/track-layout-options.html`

## 레이아웃 선택지

### A. Track-first / Radar wall (추천)

트랙을 가장 넓게 두고 타워를 보조 패널로 둔다. 현재 제품의 “3초 훑기” 목적과 가장 잘 맞으며, 트랙을 중점으로 전부 개선한다는 요구를 직접 충족한다.

### B. Split / Timing tower

현재 타워 우선 구조를 유지하고 neutral surface 계층만 정리한다. 변경량은 작지만 트랙이 여전히 보조 정보로 남는다.

### C. Responsive / Course canvas

모든 폭에서 트랙을 먼저 보이고 차량 목록을 disclosure로 둔다. ambient 성격은 강하지만 여러 계정의 비교 가독성이 떨어진다.

결정권자에게 별도 선택이 없으면 A를 기본값으로 구현한다.

## 구현 대상

- `pitwall/src/style.css`: semantic neutral tokens, shell grid, track panel, rail, tower row hierarchy, responsive breakpoints
- `pitwall/src/main.ts`: 필요한 경우 track rail/detail wrapper만 추가. 데이터/상태 흐름은 변경하지 않음
- `pitwall/src/render/trackRenderer.ts`: 기존 SVG node/class/data attribute 재사용. 새 장식 node 추가 금지
- `pitwall/src/render/towerRenderer.ts`: 기존 상태/비용/속도/overflow semantics 유지
- `pitwall/tests/`: DOM 구조, keyboard focus, no-overflow, selected/stopped/heat invariants 보강
- `DESIGN.md`: 승인된 토큰·레이아웃·접근성 규칙 반영

## 검증 순서

1. `npx tsc --noEmit`
2. `npx vitest run`
3. `npm run build:single`
4. Playwright에서 375x812, 768x812, 1280x720 캡처
5. 각 폭에서 `document.documentElement.scrollWidth === innerWidth` 확인
6. 실제 track/tower selection, error/limit/stopped, sparse/empty, reduced-motion 확인
7. heat는 빠른 attack/느린 release를 유지하고 position은 token-derived인지 확인

## 보류 사항

- A/B/C 최종 선택
- 트랙 대 타워 비율의 최종 수치
- 새 neutral 토큰을 기존 `--pw-*`와 병행할지, semantic alias만 둘지
- 브라우저 실시간 live bridge QA의 fresh evidence 재생성

## 커밋 범위 주의

실행 중 생성된 `.playwright-mcp` 로그와 `.superpowers/brainstorm/*/state`의 PID·session key 파일은 커밋하지 않는다. 레이아웃 비교 HTML은 결정권자 검토용 산출물이므로 포함할 수 있다.
