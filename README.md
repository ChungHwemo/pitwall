# PITWALL

**로컬 코딩 에이전트 로그를 8시간 내구 레이스 중계 화면으로 번역하는, 세컨드 모니터에 상시 띄워두는 앰비언트 디스플레이.**

대시보드가 아니다. 대시보드는 응시하는 물건이고, PITWALL은 곁눈질하는 물건이다. 체류 시간이 길면 실패다 — 3초 훑고 자기 일로 돌아가되 내일도 켜져 있으면 성공이다.

현재 상태: **시뮬레이터 + 로컬 LIVE 동작 중. 유료 품질 게이트는 [PRD v2.0](docs/superpowers/specs/2026-08-31-paid-quality-prd.md).** LiteLLM 프록시는 v1.5.
1082 tests · 71 files · `tsc` 0 오류 · 기본 단일 파일 빌드 5,449.1 kB (약 5.4 MB) · 런타임 의존성 0개.
차량 100대 × 35,996프레임에서 **layout 유발 0** — 남은 layout은 전부 텍스트 변경분이고 프레임 수가 아니라 이벤트 수에 비례한다.
기본 빌드는 데모 데이터셋 3벌을 HTML에 심기 때문에 예전 24 kB보다 커졌다. 실기록은 `PITWALL_REAL=1` 빌드에서만 심는다. 8시간 힙 구동만 남았다 — [CHECKLIST.md](pitwall/CHECKLIST.md).

```bash
cd pitwall && npm install
npm run dev                  # 개발 서버
npm run build:single         # dist/pitwall.html — 파일 하나로 어디서나 열림
npm run dump:events -- chaos 300
```

**단일 파일 빌드가 앱으로 가는 경로다.** JS·CSS를 HTML 한 장에 인라인하므로 `file://`로 열어도 돌고, 서버가 없으니 WebView에 그대로 얹힌다.

## macOS 앱

```bash
npm run build:app          # dist/PITWALL.app (136 kB) — 시뮬레이터
npm run build:app:real     # 실 사용 기록으로
open dist/PITWALL.app
```

`swiftc` + `WKWebView` 한 파일. Xcode 프로젝트도, Electron도, Rust도 쓰지 않는다 — 웹 빌드가 서버 없는 HTML 한 장이라 래퍼가 할 일이 그것뿐이다. 상시 노출이 사용 맥락이라 **항상 위**(⌘T)와 **전체 화면**(⌘F)을 메뉴에 둔다.

ad-hoc 서명만 붙는다. 다른 기기에 배포하려면 개발자 인증서가 필요하다.

### 위젯은 별개다

WidgetKit은 JavaScript를 실행하지 않는다 — SwiftUI 정적 스냅샷만 그리고 갱신 주기도 시스템이 정한다(분 단위). 지금 렌더 레이어를 위젯으로 옮길 수 없다. 선택지는 **SwiftUI로 다시 그리거나**(`TrackModel`은 재사용 가능, 렌더러는 폐기) **작은 상주 창으로 가거나**다. 후자면 이 앱이 그대로 간다.

## 더미 데이터

시뮬레이터는 6개 공급자 25개 모델을 섞어 이벤트를 만든다. 단가는 2026-07-30에 각 공급자 공식 문서에서 직접 읽었고, 항목마다 출처를 갖는다 ([`src/config/models.ts`](pitwall/src/config/models.ts)).

| 공급자 | 모델 |
|---|---|
| Anthropic | `claude-fable-5` · `claude-opus-5` · `claude-opus-4-8` · `claude-opus-4-6` · `claude-sonnet-5` · `claude-haiku-4-5` |
| OpenAI | `gpt-5.6-sol` · `gpt-5.5` · `gpt-5.6-terra` · `gpt-5.6-luna` · `gpt-5.4-mini` · `gpt-5.4-nano` |
| Google | `gemini-3.1-pro-preview` · `gemini-3.5-flash` · `gemini-3.1-flash-lite` |
| xAI | `grok-4.6` · `grok-4.6-build` · `grok-4.5` · `grok-4.5-build` · `grok-4.3` |
| DeepSeek | `deepseek-v4-pro` · `deepseek-v4-flash` |
| Moonshot | `kimi-k3` · `kimi-k2.7-code` · `kimi-k2.6` |

클래스는 출력 단가 밴드로 나눈다: **H** ≥ $12/Mtok, **P** $2.5–10, **GT** ≤ $1.5.

샘플 출력은 [`pitwall/fixtures/`](pitwall/fixtures/)에 커밋되어 있으며, v1.5 어댑터가 맞춰야 할 데이터 계약의 실물이다.

### 데이터 출처와 선택

상단 바에서 데이터셋을 고른다. 선택은 `localStorage`의 `pitwall.dataset`에 저장되어 다음 실행에도 유지된다. 기본 빌드는 **데모 · 소규모**, **데모 · 중규모**, **데모 · 대규모** 세 벌만 심는다. 각 세트는 원본 fixture 기준으로 각각 계정 4·14·40개, 모델 4·7·8종의 서로 다른 규모다. 각 데이터셋은 최대 5,000건만 번들에 넣고, 더 많이 있으면 계정이 겹치는 구간을 골라 자른 사실을 빌드 로그에 남긴다. `PITWALL_REAL=1` 빌드에는 여기에 **실기록**, **실기록 · 붐빈 날**도 추가된다.

**실시간**은 데이터 파일이 아니다. 네이티브 앱이 `window.pitwallLive` 브리지를 호출해 실제 `LiveSource`를 연결할 때만 `LIVE`가 뜬다. 일반 브라우저에서는 그 경로를 실행할 수 없으므로 실시간 항목을 골라도 LIVE라고 가장하지 않는다. 시뮬레이터와 지어낸 재생은 `DEMO`와 `지어낸 데이터`로 표시하고, 실기록 재생에는 DEMO를 붙이지 않는다. 설정 패널의 **데모 모드**는 벽시계를 근무 창 안으로 접는 시계 설정이며, 데이터 출처 배지와는 별개다.

LIVE 스냅샷 저장은 nominal 5초 cadence의 best-effort 동작이다. 저장 실패나 rAF 정지로
마지막 성공 스냅샷이 임의로 오래될 수 있으므로 5초를 손실 상한이나 zero-loss 보장으로
해석하지 않는다. 2026-08-22 네이티브 기본은 LIVE. 첫 실행과 ⌘R 복원을 스크린샷으로
확인했다. 스냅샷 유출은 저장 거부. 8시간 힙은 측정 중이다.

### 가독성 구현

- 설정 패널은 `1×` · `20×` · `30×` · `100×` 배속을 제공한다. 시뮬레이터 프리셋의 내부값은 `busy` · `sparse` · `chaos` · `real`로 유지하고 화면에는 **붐비는 날** · **한산한 날** · **대혼란** · **실측**으로 표시한다. 시뮬레이터에서는 **데모 모드**도 고를 수 있다.
- 트랙 차량은 Skoll의 Game Icons F1 아이콘을 쓴다. CC BY 3.0이며, 차량 bbox에 맞춘 `26.3 194.9 459.4 122.2` viewBox와 24×16 크기로 표시하고 글리프를 키웠다.
- 각 차량에는 투명 `.car-hit` 클릭 타깃이 있어 장식 상태와 관계없이 모든 차량을 누를 수 있다. 차량을 고르면 선택 상태가 되고 해당 차량의 호출 피드가 열린다.

---

## 문서

| 문서 | 내용 |
|---|---|
| **[PRD v2.0 유료 품질](docs/superpowers/specs/2026-08-31-paid-quality-prd.md)** | 출하 정본. 카피·IA·프라이버시·연료·솔트 |
| [PRD v1.4](docs/superpowers/specs/2026-07-29-pitwall-prd.md) | 역사 문서. LiteLLM 조직 벽 설계 |
| [구현 계획 v1](docs/superpowers/plans/2026-07-29-pitwall-v1.md) | 19개 태스크 TDD 실행 계획 |
| [f1-telemetry 분해](docs/reference/2026-07-30-f1-telemetry-teardown.md) | 참조 구현 원본 코드 분석. 채택 기법 5건 / 기각 7건 |
| [출시 검수](pitwall/CHECKLIST.md) | 측정한 것과 **측정하지 않은 것**을 분리해 기록 |
| **[MVP 결정 사항](docs/superpowers/specs/2026-07-30-mvp-decisions.md)** | 실제로 띄워 보고 나온 가독성 문제 + 지금 정해야 할 10건 (D1–D10) |
| [가독성 구현 명세](pitwall/docs/superpowers/specs/2026-08-01-readability.md) | 데이터 출처 라벨, 데모 데이터 선택, 설정 패널, 트랙 차량 가독성 구현 명세 |

---

## v1 범위

시뮬레이터 MVP. **실 LiteLLM 연동은 v1.5.**

- 트랙 SVG 1종 · 클래스별(H/P/GT) 레인 분리 · 리더 라이트 글리프
- 활동 중인 차량만 트랙에 렌더 (레인당 상한 40대, 초과분은 클러스터 배지)
- 타워 우선 스플릿. 디렉터가 방송 포커스 1칸. 카메라 카드 그리드는 없음
- 팀 라디오 — 이벤트 즉시 발화 + 매시 정각 패턴 피드백
- 근무일 타임라인 (포메이션 랩 → 스타트 라이트 → 점심 피트 → 체커기)
- 연봉 HUD (`localStorage` 전용) · 하루 요약 카드
- 시뮬레이터 4프리셋 (`busy` / `sparse` / `chaos` / `real`) · 화면 제목 **붐비는 날 / 한산한 날 / 대혼란 / 실측** · **서버 없음**
- LIVE는 네이티브 `LiveSource`에서만, 시뮬레이터와 지어낸 재생은 DEMO와 `지어낸 데이터`로 표시하는 출처 정직성
- 실시간·실기록·데모 데이터셋 선택과 `localStorage`의 `pitwall.dataset` 저장

## 기술 스택

Vite · TypeScript · Vitest · SVG · `requestAnimationFrame`. UI 프레임워크 없음. **런타임 의존성 0개.**

배포는 정적 호스팅. 로드 후 시뮬레이터는 오프라인에서 돈다. 실데이터는 `EventSource` 구현체만 갈아끼우면 붙는다.

**서버는 v1.5.** 실 LiteLLM 연동이 서버를 요구하는 시점에 도입한다. 성공 지표용 텔레메트리도 그때 같은 서버에 얹으며, v1에서는 자기보고 설문 + 로컬 자기 관찰로 근사한다 — 지표를 보려고 감시 채널을 먼저 까는 순서를 만들지 않는다.

## 하드 룰

협상 대상이 아닌 것들.

- **기본 익명.** 카넘버 + 클래스. 이름은 이 기기 라벨이며 기본 꺼짐
- **개인 간 정렬·순위 UI 금지.** 타워는 카넘버 고정순. 사용량으로 줄을 바꾸지 않는다
- **프롬프트·응답 본문 미수집.** 스키마에 필드 자체가 없다
- **색상 단독 인코딩 금지.** 클래스는 색 + 형태 이중 인코딩
- **트랙 위 텍스트 라벨 금지.** 상세값은 카메라 카드에서만
- **조용한 truncation 금지.** 상한에 걸려 잘라냈으면 화면에 명시한다

이유는 하나다. 이 화면이 노동 감시 도구로 읽히는 순간 제품은 죽는다.

## 공개 배포

데모 전용 단일 HTML. 주소: <https://chunghwemo.github.io/pitwall/>

`main` 푸시가 테스트·타입·`build:single`·실기록 혼입 게이트를 통과한 뒤에만 Pages에 올린다. `PITWALL_REAL=1` 산출물은 올리지 않는다. GitHub Pages는 공개다.

macOS 앱은 이 기기 로컬 ad-hoc이다 (2026-08-22 확정). 다른 Mac에서 막히면 Apple 안내대로 시스템 설정 → 개인정보 보호 및 보안 → **그래도 열기**. Developer ID 공증은 하지 않는다.

```bash
npm run measure -- --ms 90000 --headed --dataset demo-large
# 8시간 힙: --ms 28800000  (headless. 끝나기 전에 합격을 말하지 않는다)
```

## 라이선스

코드는 [MIT](LICENSE). GitHub가 라이선스를 읽으려면 LICENSE 본문은 MIT만 둔다.

서드파티 자산 (MIT 아님):

- Skoll Game Icons F1 car: CC BY 3.0 — `pitwall/assets/f1/game-icons/SOURCE.txt`
- Kenney Future Narrow: CC0 — `pitwall/assets/broadcast/LICENSE-CC0.txt`
- Tabler icons: MIT — `pitwall/assets/broadcast/LICENSE-MIT.txt`
- bacinger/f1-circuits 서킷 형상: OpenStreetMap **ODbL** — `pitwall/scripts/importCircuits.ts`

