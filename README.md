# PITWALL

**LiteLLM 프록시 로그를 8시간 내구 레이스 중계 화면으로 번역하는, 세컨드 모니터에 상시 띄워두는 앰비언트 디스플레이.**

대시보드가 아니다. 대시보드는 응시하는 물건이고, PITWALL은 곁눈질하는 물건이다. 체류 시간이 길면 실패다 — 3초 훑고 자기 일로 돌아가되 내일도 켜져 있으면 성공이다.

현재 상태: **v1 구현 완료 + 브라우저 실측 완료.**
256 tests · `tsc` 0 오류 · 빌드 24 kB · 런타임 의존성 0개.
차량 100대 × 36,000프레임에서 **layout 유발 0** — 남은 layout은 전부 텍스트 변경분이고 프레임 수가 아니라 이벤트 수에 비례한다.
8시간 힙 구동만 남았다 — [CHECKLIST.md](pitwall/CHECKLIST.md).

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

시뮬레이터는 6개 공급자 19개 모델을 섞어 이벤트를 만든다. 단가는 2026-07-30에 각 공급자 공식 문서에서 직접 읽었고, 항목마다 출처를 갖는다 ([`src/config/models.ts`](pitwall/src/config/models.ts)).

| 공급자 | 모델 |
|---|---|
| Anthropic | `claude-fable-5` · `claude-opus-5` · `claude-sonnet-5` · `claude-haiku-4-5` |
| OpenAI | `gpt-5.6-sol` · `gpt-5.6-terra` · `gpt-5.6-luna` · `gpt-5.4-mini` · `gpt-5.4-nano` |
| Google | `gemini-3.1-pro-preview` · `gemini-3.5-flash` · `gemini-3.1-flash-lite` |
| xAI | `grok-4.5` · `grok-4.3` |
| DeepSeek | `deepseek-v4-pro` · `deepseek-v4-flash` |
| Moonshot | `kimi-k3` · `kimi-k2.7-code` · `kimi-k2.6` |

클래스는 출력 단가 밴드로 나눈다: **H** ≥ $12/Mtok, **P** $2.5–10, **GT** ≤ $1.5.

샘플 출력은 [`pitwall/fixtures/`](pitwall/fixtures/)에 커밋되어 있으며, v1.5 어댑터가 맞춰야 할 데이터 계약의 실물이다.

---

## 문서

| 문서 | 내용 |
|---|---|
| [PRD v1.2](docs/superpowers/specs/2026-07-29-pitwall-prd.md) | 제품 정의, 은유 사전, 데이터 모델, 프라이버시 가드레일, 리스크 등록부 |
| [구현 계획 v1](docs/superpowers/plans/2026-07-29-pitwall-v1.md) | 18개 태스크 TDD 실행 계획 |
| [f1-telemetry 분해](docs/reference/2026-07-30-f1-telemetry-teardown.md) | 참조 구현 원본 코드 분석. 채택 기법 5건 / 기각 7건 |
| [출시 검수](pitwall/CHECKLIST.md) | 측정한 것과 **측정하지 않은 것**을 분리해 기록 |
| **[MVP 결정 사항](docs/superpowers/specs/2026-07-30-mvp-decisions.md)** | 실제로 띄워 보고 나온 가독성 문제 + 지금 정해야 할 10건 (D1–D10) |

---

## v1 범위

시뮬레이터 MVP. **실 LiteLLM 연동은 v1.5.**

- 트랙 SVG 1종 · 클래스별(H/P/GT) 레인 분리 · 리더 라이트 글리프
- 활동 중인 차량만 트랙에 렌더 (레인당 상한 40대, 초과분은 클러스터 배지)
- 카메라 슬롯 3~5개 자동 선별 + 핀 고정
- 팀 라디오 — 이벤트 즉시 발화 + 매시 정각 패턴 피드백
- 근무일 타임라인 (포메이션 랩 → 스타트 라이트 → 점심 피트 → 체커기)
- 연봉 HUD (`localStorage` 전용) · 하루 요약 카드
- 시뮬레이터 3프리셋 (`busy` / `sparse` / `chaos`) · **서버 없음**

## 기술 스택

Vite · TypeScript · Vitest · SVG · `requestAnimationFrame`. UI 프레임워크 없음. **런타임 의존성 0개.**

배포는 정적 호스팅. 로드 후 시뮬레이터는 오프라인에서 돈다. 실데이터는 `EventSource` 구현체만 갈아끼우면 붙는다.

**서버는 v1.5.** 실 LiteLLM 연동이 서버를 요구하는 시점에 도입한다. 성공 지표용 텔레메트리도 그때 같은 서버에 얹으며, v1에서는 자기보고 설문 + 로컬 자기 관찰로 근사한다 — 지표를 보려고 감시 채널을 먼저 까는 순서를 만들지 않는다.

## 하드 룰

협상 대상이 아닌 것들.

- **기본 익명.** 카넘버 + 클래스로만 표시. 이름 없음
- **개인 간 정렬·순위 UI 금지.** 타이밍 타워를 만들지 않는다
- **프롬프트·응답 본문 미수집.** 스키마에 필드 자체가 없다
- **색상 단독 인코딩 금지.** 클래스는 색 + 형태 이중 인코딩
- **트랙 위 텍스트 라벨 금지.** 상세값은 카메라 카드에서만
- **조용한 truncation 금지.** 상한에 걸려 잘라냈으면 화면에 명시한다

이유는 하나다. 이 화면이 노동 감시 도구로 읽히는 순간 제품은 죽는다.

## 라이선스

미정.
