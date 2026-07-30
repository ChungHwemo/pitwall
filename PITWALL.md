# PITWALL — 현재 상태 전부

2026-07-30 기준 · HEAD `1786df9` · 테스트 456개 통과 · tsc 클린 · 런타임 의존성 0

조직의 LLM 사용을 8시간 내구 레이스로 그리는 상시 노출 화면. 대시보드가 아니라
두 번째 모니터에 띄워 두고 **곁눈질로 읽는** 물건이다.

---

## 1. 지금 돌아가는 것

```bash
npm test                      # 456개
npm run dev                   # 웹 (시뮬레이터)
npm run fetch:limits          # 벤더 한도 갱신 → fixtures/limits.json
npm run import:real           # 로컬 로그 → fixtures/events.real.jsonl
npm run build:real            # 실기록을 심은 단일 HTML (dist/pitwall.html, 824KB)
npm run build:app:real        # macOS 앱 (dist/PITWALL.app, 1.1MB)
open dist/PITWALL.app         # ⌘T 항상 위 · ⌘F 전체 화면
```

앱은 Xcode 프로젝트 없이 `swiftc` + `WKWebView`로 만든다. ad-hoc 서명이라
**이 기기에서만** 돈다. 배포하려면 개발자 서명이 필요하다 (미결 D9).

---

## 2. 오늘 실측 (2026-07-30, 재생 중인 데이터)

호출 2,097건 · 계정 2대 · 창 07시–22시 (활동에서 파생) · 비용 $425.13

| 차 | 벤더 | 호출 | 작업 토큰 | 캐시 재전송 | 비용 | 에러 | 모델 |
|---|---|---|---|---|---|---|---|
| #012 | Claude | 1,650 | 8,428,515 | 692,905,675 | $400.54 | 0 | claude-opus-5 |
| #883 | Codex | 447 | 3,202,348 | 44,243,072 | $24.59 | 0 | gpt-5.5 277 · gpt-5.6-luna 92 · gpt-5.6-sol 78 |

**캐시 재전송이 전체 토큰의 98.4%다.** 거리는 작업 토큰만 센다.

### 한도 (`fixtures/limits.json`)

| 벤더 | 창 | 사용 | 리셋 | 판독 |
|---|---|---|---|---|
| Claude | 5시간 | 38% | 07-31 01:29 KST | API, 방금 |
| Claude | 7일 | 95% | 08-01 04:59 KST | API, 방금 |
| Codex | 7일 | 97% | 08-05 15:57 KST | 로그, 3시간 전 |
| Grok | 7일 | 52% | (지남) | 로그, **6일 전** |

Grok은 자기가 돌 때만 청구 줄을 쓴다. 6일 전 값이므로 화면이 나이를 밝힌다.

---

## 3. 세 개의 축 — 절대 섞지 않는다

| 축 | 의미 | 단위 | 출처 |
|---|---|---|---|
| **랩** | 한 바퀴 | 작업 토큰 200,000 | `LAP_TOKENS` |
| **레이스** | 하루 | 활동에서 파생한 창 (오늘 07–22시) | `workdayFromActivity()` |
| **한도** | 벤더가 거는 벽 | 5시간 / 7일 롤링 | 벤더 API·로그 |

여기에 **연료**(비용 예산)가 하나 더 있지만 한도가 아니다. 돈이 남아도 한도에
막히고, 돈이 없어도 호출은 나간다. 한때 `highlightOf`가 연료로 한도를 판정했고
그게 축 붕괴였다 — 지금은 `tyre_pct`만 본다.

**한도 소스가 없는 차는 한도에 걸렸다고 주장하지 않는다.** 없는 게이지를 0%로
그리면 화면이 없는 사실을 말한다.

---

## 4. 화면 요소

### HUD (상단)
`07/30 10:13  ⏱ 03:13:00 / 15:00:00   $61.49 · $19.1/시간 · 6.0k tok/분   RACING`

- 날짜 + 벽시계 — 재생 중이면 **재생 위치의 시각**
- 경과 / 총 레이스 시간 (창에서 파생)
- 누적 비용 · 시간당 소진 · 분당 작업 토큰
- 페이즈. 시계가 진짜로 지어낸 값일 때만 `· DEMO`
- 연봉을 설정하면 그 시점까지 번 금액

### 트랙
- 좌표계 1500×1000 (가로 비 1.5). 코스는 반경의 82%를 쓴다
- 스트로크 폭 102, 레인 3개 (H +30 / P 0 / GT −30), 레인 안 지터 ±11
- 차 = **계정**. 글리프 모양·색이 등급 (H 삼각 빨강 / P 원 파랑 / GT 사각 노랑)
- 진행률 = `(위상해시 + 작업토큰 % 200k) / 200k`
- 겹침은 `spreadProgress()`가 최소 간격 0.009로 밀어낸다
- **9대 미만이면 카넘버를 글리프 아래에 쓴다.** 넘으면 끈다
- 보간 LERP 0.15 · SNAP 0.0005 · 투영 클램프 0.95

### 피트
에러 또는 한도로 멈춘 차는 주행선을 비우고 **인필드 피트 레인**에 선다.
바깥으로 빼면 좌표계를 벗어나는 코너가 생겨 안쪽으로 뺐다 — 실제 서킷과 같다.
정지 표식으로 둘을 구분한다: 에러는 빨간 느낌표 획, 한도는 호박색 게이지 바.

### 카메라 카드 (우측, 3장)
`#883 / gpt-5.6-luna / $0.32 · LIMIT 3%/7일 · 리셋 5일 18시간 · 판독 3시간 18분 전 · WORK 212.5k · CACHE 1.7M`

- 첫 칸은 **실제 쓴 돈**. 예전엔 `FUEL %`였는데 분모가 아무도 설정 안 한 값이었고
  10:01에 0%가 되어 하루의 73%를 "연료 없음"으로 표시했다
- 리셋 카운트다운은 **실제 시각** 기준 (재생 위치가 아니라)
- 한 시간 넘은 판독만 나이를 붙인다
- 에러가 있으면 `ERR n`
- 빈 카드는 레이아웃에서 빠진다 (노드는 재사용 풀로 남는다)

### 피드 (차 선택 시)
그 계정의 호출 내역. `시각 · 모델 · 에이전트·스킬 · work·cache`.
초 단위로 구분이 안 되는 연속 호출은 한 줄로 접고 `×3`을 붙인다.
카넘버만 쓴다 — 계정 uuid도 이메일도 화면에 오지 않는다.

### 라디오 (하단)
두 갈래로 발화한다.
- `eventRadio` — 호출 하나 (에러·리타이어·피트인/아웃)
- `stateRadio` — **상태 변화** (모델 교체, 한도 걸려 피트인, 한도 회복, 에러 누적)

실데이터는 전부 `call`이라 앞의 것만으로는 영원히 침묵한다. 그래서 뒤의 것이 있다.

---

## 5. 데이터 파이프라인

```
~/.claude/projects/**/*.jsonl   → claudeCodeImport.toCarEvent()
~/.codex/**/*.jsonl             → agentLogs.codexEvent()  + codexRateLimit()
~/.grok/**/*.jsonl              → agentLogs.grokEvent()   + grokCredits()
~/.copilot/**/*.jsonl           → agentLogs.copilotEvents()
                                        ↓
                            scripts/importClaudeCode.ts
                            · 오늘을 고른다 (없으면 균형 잡힌 과거 하루)
                            · 창을 활동에서 파생하고 창 밖은 잘라낸다 (양을 찍는다)
                            · 벤더 한도를 그 벤더 차량 전체에 붙인다
                                        ↓
                            fixtures/events.real.jsonl
                                        ↓
                     vite.config.ts (PITWALL_REAL=1, 최근 3,000건)
                                        ↓
                              ReplaySource → 화면
```

한도는 별도 경로다.

```
키체인 (Claude Code-credentials) → OAuth 토큰 → api.anthropic.com/api/oauth/usage
~/.codex 최신 rate_limits
~/.grok 최신 billing 줄
                → scripts/fetchLimits.ts → fixtures/limits.json (사용률·리셋·판독시각만)
```

### 다루지 않는 소스
- **OpenCode** — 토큰 필드가 없다
- **Ollama (로컬 gemma)** — 사용 기록을 남기지 않는다

둘 다 추측하지 않고 뺐다.

---

## 6. 개인정보·보안 규칙 (전부 코드에 강제됨)

- **차량 id는 소금 친 해시.** 계정 uuid·이메일·파일 경로 원문은 밖으로 안 나간다
- `~/.claude.json`의 `oauthAccount.emailAddress`는 **읽지도 않는다**. `accountUuid`만
- OAuth 토큰은 **키체인에서 읽어 요청 헤더로만** 쓴다. 출력·파일 어디에도 안 남는다
- `CarEvent` 스키마에 프롬프트·응답 본문 필드가 **없다** (스키마 수준 PRIV-4)
- 화면에 이름 없음, 순위·리더보드 UI 없음
- 화이트리스트 방식 파싱 — `SELECT *` 없음
- k-익명성 하한 10 (`minTeamSizeForIndividual`, 완화 방향으로 못 연다)

---

## 7. 모델 카탈로그

23개 모델. 각 항목이 `priceSource: 'verified' | 'unverified'`와 `sourceUrl`을
가지며 **테스트가 강제한다.** 단가를 모르는 모델은 비용 0으로 처리하고
"카탈로그 밖 모델"로 보고한다 — 지어내지 않는다.

추론 토큰은 모든 벤더에서 출력으로 계산한다.

---

## 8. 렌더링 규칙

- SVG `transform` **속성** 금지. CSS `transform`/`opacity`만 쓴다 (레이아웃 무효화)
- 노드는 **위치 슬롯 풀**로 재사용한다. id로 키를 잡으면 DOM이 무한히 자란다
- 같은 텍스트 재기입 금지 (`setText` 가드) — 레이아웃 3,601 → 1,112회
- 차량에는 글자를 안 붙인다 **단, 9대 미만이면 카넘버는 예외**
- 경고는 도형이다. 느낌표를 글자로 그리지 않는다

측정: 100대 × 36,000프레임에서 CSS transform 레이아웃 **0회**. 남은 레이아웃은
프레임 수가 아니라 **이벤트 수**를 따른다.

---

## 9. 파일

```
pitwall/
  src/
    types.ts                    데이터 계약 (CarEvent / CarState)
    main.ts                     앱 조립 + 프레임 루프
    browser.ts                  브라우저 배선 (rAF는 여기에만)
    state/
      clock.ts                  근무창·페이즈·workdayFromActivity·벽시계
      pace.ts                   비용·시간당·분당 속도
      reducer.ts                이벤트 → 상태
      demoClock.ts              시뮬레이터 전용 가상 시계
      summary.ts  ringBuffer.ts
    track/
      generateTrack.ts          코스 생성 (시드·가로비)
      layout.ts                 레인·피트·좌표
      spacing.ts                겹침 방지
      trackModel.ts             무엇을 그릴지 (순수 함수, DOM 모름)
    render/                     trackRenderer · cameraRenderer · feedRenderer
                                radioRenderer · summaryRenderer · hudRenderer
                                settingsPanel · setText
    source/                     ReplaySource · SimulatorSource
                                claudeCodeImport · agentLogs
    radio/                      eventRadio (stateRadio 포함) · routineRadio
    director/director.ts        카메라 슬롯 선정
    config/                     models · presets · settings · theme
  scripts/                      importClaudeCode · fetchLimits
                                bundleSingleFile · dumpEvents
  app/                          PitwallApp.swift · build.sh · icon.svg · makeIcon.sh
  tests/                        32개 파일 456개
docs/
  superpowers/specs/2026-07-29-pitwall-prd.md
  superpowers/specs/2026-07-30-mvp-decisions.md
  superpowers/plans/2026-07-29-pitwall-v1.md
  reference/2026-07-30-f1-telemetry-teardown.md
  screenshots/
pitwall/docs/superpowers/specs/2026-07-30-devils-advocate-audit.md
```

---

## 10. 감사에서 나온 10건 — 처리 결과

`pitwall/docs/superpowers/specs/2026-07-30-devils-advocate-audit.md`.
ccusage · Claude-Code-Usage-Monitor · sniffly · vibe-log와 비교했다.

| # | 결손 | 상태 |
|---|---|---|
| F1 | 근무창 09–18시 가정이 작업의 61.4%를 버림 | **해결** — 활동에서 파생, 창 밖은 잘라내고 양을 찍음 |
| F2 | 화면에 돈이 없음 (FUEL %는 지어낸 분모) | **해결** — 카드·HUD에 실제 금액 |
| F3 | 소진 속도 없음 | **해결** — $/시간 · tok/분 |
| F4 | 리셋 시각을 갖고 있으면서 버림 | **해결** — 카운트다운, 실제 시각 기준 |
| F5 | 출처·신선도 라벨 없음 | **해결** — 1시간 넘은 판독은 나이 표시 |
| F6 | 에러 화면 없음, 라디오 침묵 | **부분** — `ERR n` + `stateRadio`. **에러 0건이라 실데이터 검증 불가** |
| F7 | 시계가 가짜 | **해결** — 재생 위치를 시계로, 날짜 표시, DEMO는 진짜 가짜일 때만 |
| F8 | 최대 숫자(CACHE)가 아무 움직임도 안 만듦 | F2로 정리됨 |
| F9 | 군중 제어가 죽은 코드 | **유지 판단** — 조직 규모의 경로다. 계정 2대라 안 터지는 것이지 틀린 게 아님 |
| F10 | 클릭해야 알 수 있음 | **해결** — 9대 미만이면 카넘버 표시 |

### 감사 중 내가 틀렸던 것
"랩 20만 토큰이라 차가 안 돈다"고 의심했다. **틀렸다** — 실측 40.6바퀴/일.
멈춰 보인 원인은 F1(창)이었다.

---

## 11. 이 프로젝트에서 잡은 실제 버그들

기록해 둔다. 같은 실수를 반복하지 않으려고.

- **8시간 산수** — 09:00–18:00은 9시간. 레이스 시간을 파생값으로 바꿈
- **거리 50배 부풀림** — 캐시 재전송을 작업으로 셈. `work = (prompt − cache_read) + completion`
- **`String.replace`의 `$&`** — 번들에 `$&&`가 있어 `</body>`가 코드에 끼어듦
- **빈 양자화가 점멸을 만듦** — 빈은 칸이지 물체가 아니라 애니메이션할 대상이 없었다
- **차가 트랙을 벗어남** — 레인 ±14인데 스트로크 34
- **노드 무한 증가** — id 키 → 위치 슬롯 풀
- **가장 붐빈 날이 98% 단일 계정** — 균형 기준으로 교체, 다시 "오늘"로 교체
- **Codex 모델이 unknown 182건** — `turn_context`가 다른 파일에 있음. 파일 첫 모델로 시드
- **`<synthetic>`을 호출로 셈** — API를 안 부른 줄이다
- **`gpt-5.5` 카탈로그 누락** — 277건이 비용 0이었다
- **시계와 이벤트가 다른 타임라인** — HUD는 오후, 데이터는 아침
- **리셋 카운트다운이 재생 시계 기준** — 3시간 49분이 15시간 17분으로 보였다
- **Kimi 단가 추측 2건 다 틀림** — k3는 H/$15, k2.6은 P/$4

---

## 12. 미결

### 데이터
- 세 벤더가 같은 날 돈 적이 07-19 하루뿐. 오늘은 2대 (Claude·Codex)
- Grok 한도는 6일 전 판독. Grok을 한 번 돌리면 갱신됨
- Copilot은 세션 집계라 호출 단위가 아님 — 호출 수가 실제 호출 수가 아니다
- 에러 0건이라 에러 표현을 실데이터로 검증 못 함

### 미측정 게이트
- 8시간 연속 구동 시 힙 ≤ 50MB
- 실제 GPU 프레임률
- 3초 인지 기준선 (D5)

### 결정 필요 (`2026-07-30-mvp-decisions.md`)
- D8 연료 예산의 출처 — 지금 기본값 $60/일은 근거 없음
- D9 배포용 개발자 서명
- D10 SwiftUI 위젯 vs 상시 창

### PRD 미해결 질문
Q1, Q2 (LiteLLM 로그 미확보), Q6/Q6b, Q7

### 서버
없다. v1은 전부 로컬이다. 조직 단위 집계는 나중.

---

## 13. 커밋 규칙

- 작성자·커미터 `정휘모 <tolaria@naver.com>`, 공동작성자 `bart.lee <bart.lee@kakao.com>`
- 푸시 전 `gh auth switch --user Hwemo-Chung`
- 원격 SHA를 `gh api`로 받아 `git push --force-with-lease=main:<SHA>`
- 저장소 `Hwemo-Chung/pitwall` (private)
