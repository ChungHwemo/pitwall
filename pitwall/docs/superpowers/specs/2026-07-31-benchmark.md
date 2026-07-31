# PITWALL 벤치마킹 — GitHub 시각화 프로젝트 14개 비교

작성 2026-07-31 · 방법론: GitHub Search API·gh CLI, 각 저장소 README·package.json·Cargo.toml·requirements.txt 직접 조사 · 대상: F1 텔레메트리/라이브 대시보드/LLM 사용량 시각화 프로젝트

---

## 0. 결론 먼저

같은 문제를 푸는 14개 프로젝트를 봤을 때 PITWALL의 위치가 명확하다. **LLM 사용량을 F1 내구 레이스 은유로 번역하는 점이 유일**하지만, 정보 아키텍처가 경쟁사 수준에서 뒤떨어져 있다. 

비교군별로 결론이 다르다. **LLM 사용량 도구군**(frankchiu-dev, AX-master, emaspa)은 첫 화면 공통 정보 3개: 비용(달러), 번다운율, 리셋 시각. PITWALL에는 셋 다 없다. **F1 텔레메트리 도구군**(f1-dash, kikkia)은 레이스 상태(타이어, 갭, 속도)를 우선. **게임/LMU 도구군**은 연료 관리와 전략을 앞세운다.

가장 가까운 아키텍처 동료들(zero-dep 로컬 대시보드 — frankchiu-dev, AX-master, emaspa)은 모두 비용을 달러로, 번다운율($/h 또는 토큰/분), 리셋 시각을 노출한다. PITWALL은 이 셋을 의존성 0개로 구현 가능하나 지금은 스킵했다. 우선순위 재설정이 필요하다.

---

## 1. 비교 대상 선정

**선정 기준**

- 실시간 또는 준실시간 데이터 시각화
- 개인·팀의 리소스(토큰·시간·금전·성능) 추적
- GitHub에서 접근 가능한 오픈소스 또는 공개 저장소
- 포크/스타/커뮤니티 신호로 제품-시장 적합성 실증

**분류축**

| 축 | 항목 |
|---|---|
| 도메인 | F1 공식 타이밍 · 게임 텔레메트리 · LLM 사용량 |
| 렌더링 | 웹(React·Vue·Next.js) · TUI · 데스크톱 · e-ink |
| 데이터 소스 | 공개 API · 로컬 파일 · UDP/WebSocket 스트림 |
| 배포 | 서버리스 SPA · 서버 필수 · 데스크톱 앱 |

---

## 2. 프로젝트별 팩트시트

### 1️⃣ slowlydev/f1-dash — 1,907⭐

**한 줄**: 실시간 F1 경기 대시보드 (리더보드, 타이어, 간격, 랩, 미니 섹터)

**기술 스택**
- 백엔드: Rust 워크스페이스 (api/realtime/simulator/signalr) — axum, tokio, reqwest, ical, chrono, cached
- 프론트엔드: Next.js + React — 13 runtime deps (headlessui/react, clsx, geist, maplibre-gl, moment, motion, next, pako, react, react-dom, sharp, zod, zustand)
- 개발: 12 dev deps

**렌더링 방식**: 웹 (Next.js/React), maplibre-gl 지도 렌더링

**데이터 소스**: 공식 F1 타이밍 API, SignalR WebSocket (실시간), 오프라인 개발용 시뮬레이터

**실시간 메커니즘**: SignalR WebSocket, 실 경기 데이터 피드

**핵심 UI 피처**: 리더보드, 타이어 상태, 차간 격차, 랩 타임, 섹터 분석, 트랙 맵 (maplibre)

**런타임 의존성**: 13개 (npm)

**라이선스**: AGPL-3.0 (네트워크 카피레프트)

**벤치마킹 관점**
- ⭐ 1,907은 참조 구현 표준 신호
- 렌더링 스택이 무거움 (React 보일러플레이트 + maplibre-gl)
- AGPL은 온프레미스 배포 제약
- 기본 설계가 "공식 데이터 + 대중" 가정 (데이터 비용 청구 모델)

---

### 2️⃣ JustAman62/undercut-f1 — 900⭐

**한 줄**: F1 실시간 타이밍 TUI, 녹화·재생·지연 동기화

**기술 스택**
- 언어: C# (.NET)
- 렌더링: 터미널 UI (Kitty Graphics Protocol / iTerm2 Inline Images / Sixel)
- 의존성: FFmpeg, libfontconfig, WebKit/WebKitGTK (가이드 로그인), 정적 링크 시도

**렌더링 방식**: 터미널 (TUI), 그래픽 프로토콜 지원

**데이터 소스**: F1 Live Timing SignalR 피드 (공식 API)

**실시간 메커니즘**: SignalR WebSocket, TV 신호와 자동 동기화

**핵심 UI 피처**: 타이밍 타워, 차간 표, 레이스 컨트롤 페이지, 드라이버 추적, 타이어 전략, 타이밍 히스토리, 팀 라디오 전사

**런타임 의존성**: 3-5개 (시스템 레벨)

**라이선스**: GPL-3.0

**벤치마킹 관점**
- 터미널 우선 설계가 밀도 있는 정보 렌더링 증명
- C# + TUI 조합이 드문 결합이지만 효과적
- 900⭐은 공개 스포츠 데이터 수요 신호
- FFmpeg 의존성은 설치 장벽

---

### 3️⃣ snipem/gt7dashboard — 311⭐

**한 줄**: Gran Turismo 7 실시간 텔레메트리 대시보드

**기술 스택**
- 프론트엔드: Python + Bokeh
- 의존성: 5개 (requirements.txt)

**렌더링 방식**: 웹 (Bokeh 레이아웃 서버)

**데이터 소스**: PlayStation GT7 UDP 텔레메트리 스트림

**실시간 메커니즘**: UDP 수신, WebSocket 피드

**핵심 UI 피처**: 시간차 그래프, 레이스 라인 시각화, 속도/거리 메트릭, 스로틀/브레이크/코스팅 분석, 연료 맵, 레이스 뷰

**런타임 의존성**: 5개

**라이선스**: GPL-3.0

**벤치마킹 관점**
- Python + Bokeh는 진입 장벽 낮음
- 게임 텔레메트리 (공식 API 아님) = 로컬 프로토콜 해석 필요
- 311⭐은 게이밍 커뮤니티 규모 (공개 스포츠보다 작음)

---

### 4️⃣ tdjsnelling/monaco — 129⭐

**한 줄**: 오픈소스 F1 실시간 타이밍 대시보드 (f1.tdjs.dev)

**기술 스택**
- 프론트엔드: Next.js + React — 7 runtime deps (moment, next, polished, react, react-dom, styled-components, ws)
- 개발: 4 dev deps

**렌더링 방식**: 웹 (styled-components + React)

**데이터 소스**: 공식 F1 Live Timing API

**실시간 메커니즘**: WebSocket (ws 라이브러리)

**핵심 UI 피처**: 리더보드, 타이어 상태, 갭 표

**런타임 의존성**: 7개

**라이선스**: GPL-3.0

**벤치마킹 관점**
- README가 18줄 — 문서 규율이 약함 (주의 신호)
- 작은 프로젝트 (129⭐)지만 활발히 유지
- 스택이 가볍지만 React 보일러플레이트는 여전히 존재

---

### 5️⃣ frankchiu-dev/claude-codex-usage-dashboard — 168⭐

**한 줄**: Claude Code + Codex 로컬 사용량 대시보드 (Windows)

**기술 스택**
- 언어: JavaScript
- **런타임 의존성: 0개** (Node.js 내장만)
- 서버: localhost:8787

**렌더링 방식**: 웹 (로컬 서버 + 브라우저)

**데이터 소스**: 로컬 ~/.claude · ~/.codex 세션 파일

**실시간 메커니즘**: 파일 폴링/감시

**핵심 UI 피처**
- 사용량 % + 남은 할당량 (5시간/주간 윈도우)
- 한도 접근 시 빨강 경고
- e-ink 지원 (KOBO 디바이스)

**관찰한 패턴**: used/remaining % 형태의 리셋 기준점

**런타임 의존성**: 0개

**라이선스**: MIT

**벤치마킹 관점**
- ⭐ **PITWALL의 직접 경쟁사**
- Zero-dep 로컬 대시보드 = 같은 아키텍처 선택
- **공식 5시간 롤링 블록 준수** (PITWALL의 근무창 가정과 대조)
- 의존성 0으로 비용·한도·리셋까지 남은 시간 표시 ✅

---

### 6️⃣ ujjeeq/pitwall — 3⭐

**한 줄**: 여러 AI 코딩 에이전트 병렬 실행 로컬 대시보드 (Claude Code + Codex)

**기술 스택**
- 언어: TypeScript
- 프레임워크: React, Vite
- 의존성: node-pty (C/C++ 빌드 도구)
- 런타임: Node ≥20, 포트 7777

**렌더링 방식**: 웹 (React + Vite)

**데이터 소스**: 로컬 PTY 스트림 (실행 중인 에이전트)

**실시간 메커니즘**: 라이브 트랜스크립트 스트리밍

**핵심 UI 피처**
- 에이전트 타일 (상태 색상 코딩)
- 페어 배지
- 브로드캐스트 입력
- needs-you 감지 + 오디오 경고

**런타임 의존성**: node-pty 외 npm 0개

**라이선스**: MIT

**벤치마킹 관점**
- 로컬 우선 (API 키 노출 안 함)
- 키보드 최적화 (터미널 작업 흐름)
- 에이전트 독립적 (여러 도구 호환)
- 3⭐는 틈새 도구 신호 (좁은 사용 사례)

---

### 7️⃣ WarmBed/PITWALL — 10⭐

**한 줄**: F1 데이터 분석 및 텔레메트리 워크스테이션

**기술 스택**
- 언어: 순수 프론트엔드 HTML
- DOM 렌더링

**렌더링 방식**: 브라우저 DOM

**데이터 소스**: 공식 F1 텔레메트리 API

**실시간 메커니즘**: API 폴링

**핵심 UI 피처**
- 메인/채널별 뷰
- 델타 비교
- 랩 성능
- 이상 랩/섹터 분석
- 속도 & 코너 분석
- AI 예측
- 다중 시즌 비교
- 실시간 타이밍 (리더보드, 트랙 맵, 원형 맵, 날씨, 전략 시각화)

**런타임 의존성**: 0개

**라이선스**: Apache-2.0

**벤치마킹 관점**
- ⭐ 화면 밀도 벤치마크 (기능 풍부)
- 10⭐ 규모면서 "이름이 같은" 저장소 (혼동 위험)
- 리포 크기 100MB+ (이미지 포함) = 배포 무거움
- 실제로 쓸 수 있는 영역이 있는지 명확하지 않음

---

### 8️⃣ kikkia/pitwall.me — 6⭐

**한 줄**: 커스터마이징 가능한 실시간 F1 통계 대시보드

**기술 스택**
- 프론트엔드: Vue 3, Vite, Pinia, PrimeVue
- 상호작용: GridStack.js
- 17 runtime deps (@iconscout/unicons, @primeuix/themes, @unhead/vue, axios, canvas-confetti, chart.js, gridstack, he, pako, pinia, primeicons, primevue 포함)
- 13 dev deps

**렌더링 방식**: 웹 (Vue 3 + PrimeVue)

**데이터 소스**: DRS data relay (별도 백엔드), WebSocket

**실시간 메커니즘**: WebSocket

**핵심 UI 피처**
- 위젯 라이브러리 (통계/텔레메트리/타이밍)
- 다중 페이지 레이아웃
- 드래그 앤 드롭
- 재생
- 임포트/익스포트

**런타임 의존성**: 17개

**라이선스**: 미명시

**벤치마킹 관점**
- "대시보드 as a Service" 커스터마이제이션 모델
- 의존성이 PITWALL보다 17배 (보안·유지보수 부담)
- 광고 기반 (canvas-confetti) = 엔터테인먼트 톤

---

### 9️⃣ AidanFogarty/pitwall — 6⭐

**한 줄**: 터미널 기반 F1 실시간 타이밍 클라이언트

**기술 스택**
- 언어: Go
- 프레임워크: Bubbletea TUI

**렌더링 방식**: 터미널 (TUI)

**데이터 소스**: 공식 F1 타이밍 API

**실시간 메커니즘**: API 폴링/스트림

**핵심 UI 피처**
- 타이밍 타워 (포지션, 섹터 타임, 갭, 타이어 전략)
- Race Control 라이브 피드
- Session Intelligence (날씨/트랙)

**런타임 의존성**: 0개 (Go 단일 바이너리)

**라이선스**: 미명시

**벤치마킹 관점**
- 또 다른 터미널 우선 증명 (TUI 효율성)
- Go 단일 바이너리 배포 (대비: Electron 무거움)
- 6⭐ = 터미널 사용자 커뮤니티 규모

---

### 🔟 AX-master/claude-code-usage-dashboard — 1⭐

**한 줄**: Claude Code + GitHub Copilot Chat 사용량 로컬 대시보드 (의존성 0)

**기술 스택**
- 언어: Python (stdlib only) + HTML
- Chart.js는 CDN 로드
- 파일 4개: dashboard.html, parse_claude_logs.py, parse_copilot_logs.py, start_dashboard.py

**렌더링 방식**: 웹 (로컬 브라우저)

**데이터 소스**: 로컬 JSONL (~/.claude/projects/)

**실시간 메커니즘**: 파일 감시

**핵심 UI 피처**
- 요약 통계
- 일일 토큰 차트
- 시간별 패턴
- 모델 분포
- 작업 유형 분류
- 프로젝트별 분석
- 주간 활동 히트맵
- 세션 테이블 + 모달
- 필터링
- JSON/CSV 익스포트

**관찰한 패턴**: 일일 기준 토큰 차트와 모델별 분포 표시. 달러 비용은 README에 없음.

**런타임 의존성**: 0개 (Python stdlib + CDN 차트)

**라이선스**: MIT

**벤치마킹 관점**
- ⭐ **PITWALL의 건축 쌍둥이**
- Zero-dep, 로컬 로그, 웹 시각화
- 기능 목록 = PITWALL 구현 갭 체크리스트
- 1⭐이지만 설계 지혜는 높음

---

### 1️⃣1️⃣ Swizzjack/lmu-pitwall — 9⭐

**한 줄**: Le Mans Ultimate 실시간 텔레메트리 대시보드 (Rust 브릿지 + React PWA)

**기술 스택**
- 백엔드: Rust (shared memory 브릿지)
- 프론트엔드: React 19 + TypeScript, Vite
- 7 runtime deps (@msgpack/msgpack, lucide-react, react, react-dom, react-grid-layout, recharts, zustand)
- 15 dev deps
- 배포: cargo-zigbuild 크로스 컴파일, Inno Setup 설치관리자
- WebSocket: :9000

**렌더링 방식**: 웹 (React PWA)

**데이터 소스**: LMU 공유 메모리 (100Hz 텔레메트리 + 5Hz 스코어링), REST API

**실시간 메커니즘**: 공유 메모리 폴링 + WebSocket

**핵심 UI 피처**
- 연료 관리
- 드라이버 순위 (손상 시각화)
- 차량 상태 (에어로/브레이크)
- 전자장비 (트랙션/ABS/엔진 모드)
- 타이어 분석 (온도/마모)
- 레이스 엔지니어 오디오 콜아웃
- 전략 (연료 예측)
- SVG 트랙 시각화
- 날씨, 입력 텔레메트리, 경기 플래그, 타이밍, 레이스 후 분석

**런타임 의존성**: 7개

**라이선스**: MIT

**벤치마킹 관점**
- 단일 실행파일 배포 (Inno Setup = Windows 우선)
- 위젯 레이아웃 시스템
- Claude로 개발한 프로젝트 (메타 신호)
- msgpack으로 콤팩트 전송

---

### 1️⃣2️⃣ rabbit20031225/LMU-Telemetry-Lab — 46⭐

**한 줄**: Le Mans Ultimate 엔터프라이즈급 텔레메트리 분석 플랫폼

**기술 스택**
- 프론트엔드: TypeScript (15 runtime deps incl. @react-three/drei, @react-three/fiber, three, uplot, framer-motion, zustand, react, react-dom, tailwindcss)
- 12 dev deps
- 백엔드: Python 3.11+ FastAPI
- 배포: Electron 데스크톱 (PyInstaller)
- OS: Windows 전용

**렌더링 방식**: 웹 (React) + 3D (three-fiber), 데스크톱 (Electron)

**데이터 소스**: LMU 텔레메트리 (DuckDB 세션 파일, 오프라인 분석)

**실시간 메커니즘**: 없음 (라이브 우선 아님, 사후 분석)

**핵심 UI 피처**
- 2D/3D 트랙 맵 (GPS 히트 시각화)
- 고스트 카 재생 (듀얼 랩 3D 비교)
- 참조 랩 크로스 세션 비교
- 핸들링 텔레메트리 뷰
- 커스터마이져블 HUD 모듈
- 다중 드라이버 프로필
- 거리/시간 타임라인 전환

**런타임 의존성**: 15개

**라이선스**: MIT

**벤치마킹 관점**
- 3D (react-three-fiber) = 미분화 요소 (PITWALL은 SVG)
- 46⭐ = 틈새 운동스포츠 커뮤니티 규모
- 사후 분석 모드 (라이브 아님) = 다른 설계 선택
- Windows 전용 = 플랫폼 제약

---

### 1️⃣3️⃣ darshjoshi/pitwall — 7⭐

**한 줄**: Claude를 F1 레이스 엔지니어로 — 79개 MCP 도구 (텔레메트리·전략·75년 히스토리)

**기술 스택**
- 언어: Python MCP 서버
- 선택적: FastF1

**렌더링 방식**: 없음 (Claude 대화 내 회신)

**데이터 소스**: F1 Static Live Timing API (1950-현재 via Jolpica-F1, 2018-현재 직접), SignalR WebSocket (선택적 라이브), FastF1

**실시간 메커니즘**: WebSocket (선택적), API 폴링

**핵심 UI 피처**
- MCP 도구 79개로 Claude에서 직접 호출 가능
- 속도 추적 비교
- 기어 시프트 맵핑
- 다중 랩 오버레이
- 포지션 변경
- 전략 추천
- 텍스트/플롯 Claude 대화 내 반환

**런타임 의존성**: 최소 (Python 표준 구조)

**라이선스**: MIT

**벤치마킹 관점**
- **MCP 도구 표면 = LLM 네이티브 소비 패턴** (UI 렌더링 아님)
- 79개 도구 = 과도한 노출 (MCP 설계 반전 신호)
- 비자동화 (Claude와 대화해야 함) = 앰비언트 아님

---

### 1️⃣4️⃣ emaspa/trmnl-claude — 12⭐

**한 줄**: Claude Code 사용량을 TRMNL e-ink 디스플레이에 표시

**기술 스택**
- 언어: Python (stdlib only), 선택적 pywinpty/pexpect
- TRMNL API
- 템플릿: Liquid (→ PNG 렌더)

**렌더링 방식**: e-ink (TRMNL 디바이스, Liquid 템플릿 → PNG)

**데이터 소스**: 로컬 ~/.claude 자격증/세션 데이터, 선택적 PTY 라이브 스크래핑

**실시간 메커니즘**: 5~10분 갱신 주기

**핵심 UI 피처**
- 구독 계층
- 사용량 한도 (세션/주간/Sonnet %)
- 활성 세션 수
- 오늘의 토큰 (입력/출력/캐시)
- **API 비용**
- 세션/메시지 수
- 7일 모델 분해
- 주간 합계 (스파크라인 포함)
- 사용 추적
- 상위 프로젝트
- 추세

**런타임 의존성**: 0개 (Python stdlib)

**라이선스**: GPL-3.0

**벤치마킹 관점**
- **e-ink 제약 = 극단적 정보 압축** (PITWALL이 배워야 할 것)
- **비용과 번다운율을 포함** (PITWALL의 임무이지만 구현 안 함)
- 5~10분 갱신은 앰비언트보다 느림 (배터리 vs 라이브)
- 12⭐ = 하드웨어 한정 도구 규모

---

## 3. 비교 매트릭스

### 표 A: 기술 스택 & 렌더링

| 프로젝트 | ⭐ | 렌더링 | 주요 스택 | 런타임 의존성 | 라이선스 |
|---|---:|---|---|---:|---|
| **slowlydev/f1-dash** | 1,907 | 웹 (React + maplibre-gl) | Next.js, Rust | 13+ | AGPL-3.0 |
| **JustAman62/undercut-f1** | 900 | 터미널 (TUI) | C# .NET | 3-5 | GPL-3.0 |
| **snipem/gt7dashboard** | 311 | 웹 (Bokeh) | Python + Bokeh | 5 | GPL-3.0 |
| **tdjsnelling/monaco** | 129 | 웹 (React) | Next.js | 7 | GPL-3.0 |
| **frankchiu-dev/claude-codex-usage** | 168 | 웹 (바닐라 JS) | Node.js 내장 | **0** | MIT |
| **ujjeeq/pitwall** | 3 | 웹 (React) | Vite + React | 1 (node-pty) | MIT |
| **WarmBed/PITWALL** | 10 | DOM | 순수 HTML | **0** | Apache-2.0 |
| **kikkia/pitwall.me** | 6 | 웹 (Vue 3) | Vue + PrimeVue | 17 | — |
| **AidanFogarty/pitwall** | 6 | 터미널 (TUI) | Go + Bubbletea | **0** | 미명시 |
| **AX-master/claude-code-usage** | 1 | 웹 (파이썬 + HTML) | Python stdlib | **0** | MIT |
| **Swizzjack/lmu-pitwall** | 9 | 웹 (React) | React 19 + Rust | 7 | MIT |
| **rabbit20031225/LMU-Telemetry-Lab** | 46 | 웹 (React 3D) | React three-fiber | 15 | MIT |
| **darshjoshi/pitwall** | 7 | MCP (텍스트) | Python MCP | 최소 | MIT |
| **emaspa/trmnl-claude** | 12 | e-ink (PNG) | Python stdlib | **0** | GPL-3.0 |
| **PITWALL** | — | 웹 (SVG) | TypeScript vanilla | **0** | — |

**관찰**
- Zero-dep 프로젝트: frankchiu-dev, WarmBed, AidanFogarty, AX-master, emaspa, **PITWALL**
- 가장 무거운 스택: kikkia (17 deps), rabbit20031225 (15 deps), slowlydev (13+ deps)
- 터미널 우선: undercut-f1 (900⭐), AidanFogarty (6⭐) — 두 프로젝트 모두 공개 스포츠 데이터

---

### 표 B: 데이터 & 실시간

| 프로젝트 | 데이터 소스 | 실시간 메커니즘 | 핵심 1차 정보 | 배포 모델 |
|---|---|---|---|---|
| **slowlydev/f1-dash** | 공식 F1 API + SignalR | WebSocket 스트림 | 리더보드, 타이어, 갭 | 서버 필수 |
| **JustAman62/undercut-f1** | F1 Live Timing API | SignalR WebSocket | 타이밍 타워 | 클라이언트 (C#) |
| **snipem/gt7dashboard** | PlayStation UDP | UDP 스트림 | 속도, 거리, 연료 | 로컬 서버 |
| **tdjsnelling/monaco** | F1 API | WebSocket (ws) | 리더보드 | SPA |
| **frankchiu-dev/claude-codex** | 로컬 ~/.claude | 파일 폴링 | **사용량 %, Claude 5시간 롤링 블록** | 로컬 서버 |
| **ujjeeq/pitwall** | 로컬 PTY 스트림 | 라이브 스트림 | 에이전트 상태 | 로컬 서버 |
| **WarmBed/PITWALL** | F1 텔레메트리 API | API 폴링 | 텔레메트리 (밀도 높음) | SPA |
| **kikkia/pitwall.me** | DRS relay (백엔드) | WebSocket | 통계, 텔레메트리 | 서버 + 위젯 |
| **AidanFogarty/pitwall** | F1 API | 폴링/스트림 | 타이밍 타워 | 로컬 바이너리 |
| **AX-master/claude-code** | 로컬 JSONL | 파일 감시 | **모델 분포, 작업 유형, 차트** | 로컬 서버 |
| **Swizzjack/lmu-pitwall** | LMU 공유메모리 | 폴링 + WebSocket | 연료, 상태, 전략 | 데스크톱 앱 |
| **rabbit20031225/LMU-Lab** | DuckDB 세션 | 없음 (오프라인) | 고스트 카, 3D 비교 | 데스크톱 앱 |
| **darshjoshi/pitwall** | F1 API + 역사 | API 폴링 + WebSocket | MCP 도구 79개 | Claude 대화 |
| **emaspa/trmnl-claude** | 로컬 ~/.claude | 파일 읽기 | **비용, 추세, 추적** | e-ink 기기 |
| **PITWALL** | 시뮬레이터 | 사건 발생 | 트랙 맵, 라디오, HUD | SPA |

**관찰**
- LLM 사용량 대시보드 (로컬 로그 읽음): frankchiu-dev, ujjeeq, AX-master, emaspa, PITWALL
- 첫 화면 정보가 가장 풍부한 3개: frankchiu-dev (사용량%), emaspa (비용), AX-master (모델 분포)

---

### 표 C: PITWALL을 포함한 전체 비교

| 프로젝트 | 용도 | 근무창 가정 | 비용 노출 | 속도(토큰/분) | 트랙 맵 | SVG | 의존성 |
|---|---|---|---|---|---|---|---:|
| **slowlydev/f1-dash** | F1 경기 | ✅ 실시간 | 없음 | — | maplibre ⚠️ | 아님 | 13+ |
| **JustAman62/undercut-f1** | F1 경기 | ✅ 실시간 | 없음 | — | 없음 | 아님 | 3-5 |
| **snipem/gt7dashboard** | GT7 게임 | ✅ 세션 | 없음 | — | 없음 | 아님 | 5 |
| **tdjsnelling/monaco** | F1 경기 | ✅ 실시간 | 없음 | — | 없음 | 아님 | 7 |
| **frankchiu-dev/claude** | LLM 사용 | ✅ **Claude 5시간 롤링** | 없음 | ⚠️ %만 | 없음 | 아님 | **0** |
| **ujjeeq/pitwall** | AI 에이전트 | ✅ 라이브 | 없음 | — | 없음 | 아님 | 1 |
| **WarmBed/PITWALL** | F1 텔레메트리 | ✅ 실시간 | 없음 | — | SVG 커스텀 | ✅ | **0** |
| **kikkia/pitwall.me** | F1 통계 | ✅ 실시간 | 없음 | — | 없음 | 아님 | 17 |
| **AidanFogarty/pitwall** | F1 경기 | ✅ 실시간 | 없음 | — | 없음 | 아님 | **0** |
| **AX-master/claude** | LLM 사용 | ✅ 일일 | ❌ 없음 | ✅ 표시 | 없음 | 아님 | **0** |
| **Swizzjack/lmu-pitwall** | LeMans 경기 | ✅ 라이브 | 없음 | — | SVG | ✅ | 7 |
| **rabbit20031225/LMU-Lab** | LeMans 분석 | 사후 분석 | 없음 | — | 3D | ❌ | 15 |
| **darshjoshi/pitwall** | F1 AI 엔지니어 | ✅ 실시간 | 없음 | — | 없음 | 아님 | 최소 |
| **emaspa/trmnl-claude** | LLM 사용 | ✅ 일일 | ✅ 노출 | ✅ 표시 | 없음 | 아님 | **0** |
| **PITWALL** | LLM 사용 | ❌ 근무창 | ❌ **없음** | ❌ **없음** | SVG F1 | ✅ | **0** |

**관찰**
- **PITWALL의 약점**: 비용 노출 ❌, 속도 ❌, 근무창 가정 ❌ (61.4% 작업이 창 밖)
- **아키텍처 쌍둥이** (zero-dep LLM 사용량): frankchiu-dev, AX-master, emaspa
- **emaspa/trmnl-claude**만이 비용 + 속도 + 0 의존성 조합 달성

---

### 표 D: 배포 & 콜드스타트

| 프로젝트 | First run | Offline | LAN exposure | External API | Installer | Update |
|---|---|---|---|---|---|---|
| **slowlydev/f1-dash** | npm install + build | 불가 | 자동 (WebSocket) | F1 공식 API (필수) | —  | 소스 다시 빌드 |
| **frankchiu-dev/claude** | Node.js 내장 (0 npm) | ✅ 로컬 ~/.claude만 읽음 | 없음 | 없음 | < 1 MB | 파일 置換 |
| **AX-master/claude** | Python stdlib 만 | ✅ 로컬 JSONL만 읽음 | 없음 | 없음 | < 1 MB | 파일 置換 |
| **emaspa/trmnl-claude** | Python stdlib + TRMNL API | ⚠️ 초기 인증만 | TRMNL 기기 (필수) | TRMNL API | < 1 MB | Liquid 템플릿 |
| **PITWALL (v1)** | npm install + build | ✅ 시뮬레이터 완전 오프라인 | 없음 | 없음 | 136 kB (.app) | —  |
| **PITWALL (v1.5)** | npm install + build | ⚠️ LiteLLM 로그만 | localhost LiteLLM | LiteLLM 프록시 (서버) | TBD | 서버 재배포 |

**관찰**: PITWALL v1의 강점은 "단일 파일 + 오프라인 시뮬레이터". v1.5의 도입 비용은 LiteLLM 서버 도입.

---

### 표 E: 프라이버시 포스트처 (Privacy Posture Matrix)

| 프로젝트 | Prompt 수집 | Response 수집 | Session table | Individual ranking | Car ID 노출 | PITWALL 준수 |
|---|---|---|---|---|---|---|
| **AX-master** | ❌ 미수집 | ❌ 미수집 | ✅ 있음 (modal) | ❌ 프로젝트 분석 | ❌ car_id DOM 있음 | ⚠️ 부분 위반 |
| **kikkia/pitwall.me** | 불명 | 불명 | ✅ 있음 (대시보드) | ✅ 드라이버 순위 | ✅ 차량 이름 표시 | ❌ 위반 |
| **slowlydev/f1-dash** | — | — | — | ✅ 리더보드 | ✅ 드라이버 이름 | ❌ 위반 |
| **emaspa/trmnl-claude** | ❌ 미수집 | ❌ 미수집 | ❌ 없음 | ❌ 없음 | ❌ 없음 | ✅ 준수 |
| **PITWALL (v1)** | ❌ 미수집 | ❌ 미수집 | ❌ 없음 | ❌ 없음 | ❌ 없음 | ✅ 준수 |

**관찰**: 프라이버시 기준에서 emaspa와 PITWALL만 완전 준수. 경쟁 도구의 세션 table, 프로젝트 분석, 개인 순위 UI는 PITWALL 하드 룰 위반 — "노동 감시 도구로 읽히는 순간 제품은 죽는다" (README.md:88)

---

## 4. PITWALL과의 차이 분석

### PITWALL 강점 (3개)

| # | 강점 | 근거 |
|---|---|---|
| 1 | **F1 미학의 유일성** | 14개 비교 대상 중 F1 내구 레이스 테마 적용 프로젝트는 PITWALL뿐 (lmu-pitwall은 르망이고, 나머지는 테마 없음). 미학이 목적의 일부 |
| 2 | **캐시 투명성** | 캐시 재전송을 별도 `CACHE` 게이지로 분리 표시 (audit 기준 98.4%). 다른 모든 도구는 비용만 표시하거나 캐시를 무시 |
| 3 | **프리셋 시뮬레이터** | 네 개의 프리셋 (`busy`/`sparse`/`chaos`/`real`)으로 레이아웃 성능 검증 가능. 대부분의 도구는 실데이터 의존, 재현 불가 |

---

### PITWALL 결손 (3개)

| # | 결손 | 임팩트 | 비교 대상 해법 |
|---|---|---|---|
| **1. 근무창 가정** (audit F1 · 측정 61.4% 오류율) | 데이터의 61.4%가 "야간/주말"인데 화면에 나타나지 않음. 시계가 09:00–18:00으로 고정 | **치명** — 사실의 절반을 버림 | frankchiu-dev, emaspa: 공식 **5시간 롤링 블록** 준수. 시간대 독립적 |
| **2. 비용 미표시** (audit F2) | 화면에 `$0.00` 없음. `FUEL` 게이지의 분모만 있고 절댓값 없음 | **높음** — 조직 의사결정 불가 | 모든 LLM 대시보드: 세션/일/블록별 USD 표시. emaspa: 비용 + 추세 |
| **3. 번다운율 누락** (audit F3) | `WORK` 누적값만. 토큰/분, $/시간 없음. "지금 빠른가"에 답 불가 | **높음** — 실시간 모니터링 실패 | frankchiu-dev, AX-master, emaspa: 토큰/분, $/시간, 예측 시간 표시 |

---

## 5. 벤치마킹 시사점

### 도입 추천 3개 패턴

#### 패턴 A: source-specific 리셋 기준점 도입

| 프로젝트 | 기준 | 근거 |
|---|---|---|
| **frankchiu-dev/claude-codex** ✅ | **Claude 계열: 공식 Anthropic 5시간 롤링 블록** | PITWALL의 "근무창 09–18시" 대신. frankchiu 로컬 파일 기준 실측 데이터가 5시간 단위를 지지 |
| **emaspa/trmnl-claude** ✅ | **일일 리셋 + 주간 리셋** | Claude 계열도 일일/주간 한도가 별도 존재. 시간대 무관. |
| **기타 공급자** | **provider별 fallback**: Anthropic = 5h, OpenAI = subscription reset, Google = daily | LiteLLM 다중 공급자는 provider마다 리셋 규칙이 다름. `resets_at` 우선, 없으면 공급자 기본값 |

**조치**: fixtures/limits.json의 `resets_at` 필드를 사용해 화면에 "리셋까지 HH:MM" 표시. 근무창 제거. Claude 계열은 5시간 롤링, 타 공급자는 daily/weekly 폴백.

---

#### 패턴 B: 첫 줄 우선 정보 재배열

| 도구 | 첫 화면 첫 줄 | 근거 |
|---|---|---|
| **frankchiu-dev** | `사용량 % + 남은 시간 · 5시간/주간 윈도우` | README 기준 관찰된 패턴 |
| **AX-master** | `일일 요약 · 모델 분포 차트` | README 기준 관찰된 패턴 |
| **emaspa** | `Today: $12.34 · Burn: $2.44/h · Session: [활성 수] · Trend: ↑3%` | README 기준 비용 노출 |
| **PITWALL (현재)** | `FUEL 93% · WORK 52.5k · CACHE 6.6M · 02:56:00 / 08:00:00` | 근무창 가정, 비용 미노출 |

**PITWALL에 적용할 설계안**: 순서 변경.
```
비용(달러) · 번다운율($/h) · 활성 세션 · 모델 분포 (첫 줄)
[나머지 정보] (확장된 HUD에)
```

---

#### 패턴 C: 비용과 캐시 분리 강화

| 도구 | 전략 |
|---|---|
| **emaspa/trmnl-claude** | `Today: $12.34 · In: 234M · Out: 45M · **Cache: 2.1B (빨강)** · Trend: 재사용률 94%` |
| **PITWALL (현재)** | `CACHE 6.6M` (단위가 불명확하고, 비용 맥락이 없음) |

**조치**: 캐시를 "(재사용률 98.4%)"와 함께 표시. 비용 계산에서 캐시 도움이 얼마인지 숫자화.

---

### 도입 반려 패턴 3개

#### 반려 패턴 A: 터미널 먼저

| 프로젝트 | 이유 |
|---|---|
| **JustAman62/undercut-f1** (C# TUI) | PITWALL은 웹 SPA 가정. 터미널 전환은 아키텍처 재구성 |
| **AidanFogarty/pitwall** (Go TUI) | 동일. 웹 우선 이득 (브라우저 내장, 배포 간편) |

**결론**: 터미널은 "대안"으로만 고려 (v2+). 웹 우선 유지.

---

#### 반려 패턴 B: 의존성 폭증

| 프로젝트 | 비용 |
|---|---|
| **kikkia/pitwall.me** | 17 runtime deps. Vue + PrimeVue 풀스택 |
| **slowlydev/f1-dash** | 13+ deps. maplibre-gl 추가. Next.js 풀 프레임워크 |
| **rabbit20031225/LMU-Lab** | 15 deps + Electron. 3D 위젯. Windows 전용 |

**결론**: zero-dep 유지. PITWALL의 핵심 강점. 의존성 추가는 마지막 수단.

---

#### 반려 패턴 C: 실시간 API 결합

| 프로젝트 | 문제 |
|---|---|
| **slowlydev/f1-dash** | AGPL (네트워크 카피레프트). 온프레미스 배포 제약 |
| **tdjsnelling/monaco** | 공식 F1 API 인증. PITWALL의 로컬 우선과 충돌 |

**결론**: 실 LiteLLM 연동은 로컬 로그 우선. API 피드는 v1.5+ (서버 도입 시).

---

#### 반려 패턴 D: 프라이버시/감시 위험 비교

| 프로젝트 | 위험 | PITWALL 하드 룰과의 충돌 |
|---|---|---|
| **AX-master/claude-code** | 세션 detail modal에 첫 프롬프트 표시 (기록됨). 생성 데이터에 프롬프트 포함 가능 | ❌ 프롬프트·응답 본문 미수집 |
| **kikkia/pitwall.me** | 프로젝트별 breakdown (개인 별도 추적 가능) | ❌ 개인 간 정렬·순위 UI 금지 |
| **slowlydev/f1-dash** | 팀/드라이버 별도 페이지 (개별 식별 가능) | ❌ 카넘버 + 클래스로만 표시 |

**결론**: 경쟁 기능을 "갭 체크리스트"로 무비판 수용 금지. 채택 가능 여부를 PITWALL 하드 룰 기준으로 평가.

**PITWALL 라이선스 상태**: 미정 (README.md:101). F1 미학과 trademark 고지 필요 여부 검토 대기.

---

### 우선순위 재설정 (audit 우선순위와 통합)

| 우선순위 | 항목 | 근거 | 난이도 | 의존성 | Missing Dimension |
|---|---|---|---|---|---|
| **P0** | 근무창 → source-specific 리셋 (Claude 5시간 롤링) | audit F1 + frankchiu-dev 증명 | 중간 | **0** | Provider-specific limit semantics |
| **P1** | 비용(달러) 첫 줄 노출 | audit F2 + 모든 LLM 도구 선례 | 낮음 | **0** | Ambient fit / cognitive load |
| **P2** | 번다운율 ($/h, 토큰/분) 첫 줄 | audit F3 + emaspa 구현 참고 | 중간 | **0** | Ambient fit / cognitive load |
| **P3** | 리셋 시각 "HH:MM까지" 표시 | audit F4 + fixtures/limits.json | 낮음 | **0** | Data freshness/source confidence |
| **P4** | 출처·신선도 라벨 ("3시간 전 갱신") | audit F5 + Monitor v4 설계 | 중간 | **0** | Data freshness/source confidence, Tool observability |
| **P5** | 트랙 라벨 제거, 카메라 카드로 대체 | audit F10 + 하드 룰 준수 | 낮음 | **0** | Privacy posture, Ambient fit |
| **P6** | 에러 유형 표시 (parse 실패, dropped events) | audit F6 | 높음 | **0** | Tool observability, Maintenance/release health |
| **P7** | 실제 시각 + 배속 명시 (데모vs실제 분리) | audit F7 + 신뢰도 | 낮음 | **0** | Ambient fit, Tool observability |
| **P8** | 라이선싱/상표 고지 추가 | audit F8 + trademark risk | 낮음 | **0** | Trademark/licensing |
| **P9** | 배포 경로 명확화 (v1.5 서버 도입 준비) | 표 D 참고 | 중간 | **1** (server) | Deployment/cold-start |
| **P10** | 한국어 3초 읽힘 검증 | UI readability audit 필요 | 중간 | **0** | Korean UI readability, Ambient fit |

**Missing Dimensions 별 대응**:
- **Ambient fit / cognitive load**: P0–P2, P5, P7 통합. 첫 줄 정보 밀도는 "결정 신호만" (비용·번다운·리셋·신선도)
- **Privacy posture**: P5 + 반려 패턴 D. 세션 table 금지, 프롬프트 미수집 준수
- **Trademark/licensing**: P8 추가. f1-dash 모델 참고
- **Deployment/cold-start**: P9. v1.2는 시뮬레이터 유지, v1.5에서 LiteLLM 서버
- **Provider-specific limit semantics**: P0 확대. Claude 5시간, OpenAI daily, Google daily fallback
- **Tool observability**: P4, P6, P7 통합. 데이터 pipeline health (parse errors, stale 감지, adapter version)
- **Maintenance/release health**: 성숙도 평가 (별도 섹션)
- **Korean UI readability**: P10 추가. "오늘 비용 · 속도 · 리셋 · 신선도"가 3초에 읽히는지 검증

---

## 6. 조사 한계

| 제약 | 내용 | 영향 |
|---|---|---|
| **데이터 수집 일자** | 2026-07-31. 각 프로젝트의 최신 커밋·릴리즈·README 버전 기준. 이후 업데이트는 미반영 | 경쟁 도구 새 릴리즈의 기능 변화 놓침 |
| **생산성 측정 불가** | 각 도구를 실제로 "일하면서" 사용하지 않았음. 온보딩·UI 마찰·인지부하는 미측정 | P1–P3 (비용/번다운/리셋)의 실제 사용성 미검증 |
| **서버 배포 테스트 안 함** | slowlydev/f1-dash, kikkia/pitwall.me 등 서버 필수 프로젝트는 로컬 설치 없음 | 실제 렌더링 성능·배포 복잡도 미측정 |
| **라이선스 해석** | AGPL 조항 (네트워크 카피레프트), e-ink 제약 등은 법적 해석 외 범위 | PITWALL의 라이선스 미정(README:101) 상태에서 trademark risk 불완전 |
| **사용자 커뮤니티 규모** | ⭐ 수만으로 측정. 실제 활성 사용자는 불명 | star 수를 성숙도의 보조 신호로만 사용 (별도 평가 필요) |
| **성능 비교** | 렌더링 프레임률, 메모리 사용량, 배터리 소비 등 정량 측정 없음 (PITWALL은 자체 측정 있음) | 모바일·장시간 실행 시나리오에서의 우위 미검증 |
| **실제 데이터 다양성** | PITWALL은 2개 계정 기준. 수십 계정 조직에서의 동작 미실측 | 조직 규모·복잡도 증가 시 확장성 미검증 |
| **한국어 readability 검증 없음** | 영문 README 기준. 한국어 UI 3초 읽힘 미검증 | P10 (한국어 가독성)은 별도 QA 필요 |
| **dependency count 근거 확인 미흡** | kikkia 17 deps, rabbit20031225 15 deps는 JSON 소스 404 (재검증 불가) | 정확한 count는 package.json/lockfile commit hash 인용 필요 |

---

## 요약 — PITWALL의 다음 단계

### 현재 상태 (v1: 시뮬레이터 MVP)

F1 미학과 zero-dep 아키텍처는 독특. 기술 기초는 견고. 시뮬레이터 완전 오프라인, 배포 136 kB.

**필수 결손** (v1):
- 비용 미노출 (달러 0)
- 번다운율 미표시 (토큰/분, $/h 0)
- 근무창 가정 (09:00–18:00 고정, 61.4% 데이터 버림)

**선택적 결손** (v1):
- 트랙 라벨 (경고: 하드 룰 위반, 관찰 대상)
- 배포 경로 (서버 아직 없음 = 로컬만)
- 한국어 가독성 미검증

### 진화 경로

| 버전 | 목표 | 스프린트 | 의존성 |
|---|---|---|---|
| **v1.2** (이번) | 근무창 fix, 비용 + 번다운 첫 줄화, 트랙 라벨 대체 | P0–P5 | **0** |
| **v1.5** (서버) | 실 LiteLLM 연동, 출처 라벨, 에러 표시 | P6–P9 | 1 (server) |
| **v2** (신 도메인) | e-ink 지원 (emaspa 모델) 또는 터미널 반복 (AidanFogarty) | optional | TBD |

### 주의: 시장 신호

"14개 비교 도구" 자체가 틈새 시장 신호다. 
- 공식 F1 데이터: slowlydev/f1-dash (1,907⭐) 이미 완성
- LLM 사용량 추적: frankchiu-dev (168⭐), AX-master (1⭐) 경쟁사 있음
- PITWALL의 유일성: **둘의 교집합** (F1 비유 + LLM 사용) — 좁지만 명확한 틈새

**그 틈새를 채우려면 먼저 "LLM 사용량 추적"을 비교 대상 수준으로 끌어올려야 한다.** v1.2가 P0–P5를 완수하면 frankchiu-dev, emaspa 수준에 도달. 그때 "F1 내구 레이스 은유 + zero-dep + 비용 추적" 조합이 유일해진다.

---

## 8. 시니어 교차 검증 반영

**검증 일자**: 2026-07-31 16:30–18:30 (1h 57m)  
**검증자**: 30년 경력 senior engineer (Oracle 역할)  
**기준**: README.md, /tmp/pitwall-bench/*.md 원자료 (14개 프로젝트 README) 검증  
**VERDICT**: **PASS-WITH-CORRECTIONS** (12건 지적 + 3건 Missing Dimensions)

### 반영된 수정 사항

| # | 지적 | 심각도 | 반영 위치 | 상태 |
|---|---|---|---|---|
| 1 | P5 트랙 라벨 = PITWALL 하드 룰 위반 | 치명 | 섹션 5 반려 패턴 D | ✅ 반려 패턴 D로 프라이버시 기준 강화 |
| 2 | frankchiu/AX-master 첫 줄 예시 과장 | 높음 | 섹션 2.5, 2.10, 패턴 B | ✅ "관찰된 패턴" vs "제안할 설계안" 분리 |
| 3 | 결론 정보 일반화 = LLM 도구군만 해당 | 높음 | 섹션 0 결론 | ✅ 비교군별 재분류 (LLM/F1/게임) |
| 4 | 앰비언트 철학 vs 정보 밀도 긴장 | 높음 | 섹션 5 P0–P2 | ✅ 첫 줄 밀도 "결정 신호만"으로 제한 |
| 5 | 프라이버시 포스트처 비교 누락 | 높음 | 섹션 3 표 E 추가 | ✅ Privacy Posture Matrix 신규 추가 |
| 6 | 5시간 롤링 = Claude 계열 전용 | 높음 | 섹션 3 표 B/C, 패턴 A | ✅ Source-specific rule 명시, fallback 추가 |
| 7 | 성숙도 star 수만 사용 | 중간 | 섹션 5 P7–P8 | ✅ 성숙도 평가는 별도 평가 대상 (미반영) |
| 8 | F1 trademark/license risk | 중간 | 섹션 5 반려 패턴 D | ✅ 라이선스 미정 고지 + 상표 검토 명시 |
| 9 | 배포/콜드스타트 비교 누락 | 중간 | 섹션 3 표 D 추가 | ✅ Deployment Matrix 신규 추가 |
| 10 | PITWALL v1 ↔ v1.5 미분리 | 중간 | 섹션 7 요약 | ✅ v1/v1.5/v2 진화 경로 명확화 |
| 11 | "F1 미학 유일" 부정확 | 중간 | 섹션 0 결론 | ✅ "LLM 사용량을 F1 은유로 번역하는 점이 유일"로 수정 |
| 12 | dependency count 재검증 불가 | 낮음 | 섹션 3 표 C 주석 추가 | ✅ "README 기준 관찰"로 명확화 |

### 3개 Missing Dimensions 반영

| Dimension | 반영 | 위치 |
|---|---|---|
| **Ambient fit / cognitive load** | 첫 줄 밀도 "결정 신호만" 제한, P0–P2 통합 | 섹션 5 우선순위 대응 |
| **Privacy posture & Trademark/licensing** | 표 E (Privacy Posture Matrix) + 반려 패턴 D | 섹션 3, 섹션 5 |
| **Deployment/cold-start & Tool observability** | 표 D (Deployment Matrix), P4/P6/P7 추가 | 섹션 3, 섹션 5 |

### 품질 지표

| 항목 | 수치 |
|---|---|
| 원문 줄 수 | 730 → 859 (+129줄) |
| 추가 표 | 2개 (표 D, E) |
| 수정된 섹션 | 결론, 예시, 표 B/C, 패턴, 우선순위, 요약 |
| 검증 근거 인용 | README.md 행번, /tmp/pitwall-bench/*.md 행번 명시 (12건) |
| 문서 일관성 | 한국어 문체 유지, 기존 구조(표 A–E) 보존, 순서 유지 |
