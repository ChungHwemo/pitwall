# Decisions — REVIEW #10–#12

## #12 (P1) — 리로드 데이터 복원: 스냅샷 hydration 채택 (2026-08-03)
- 이벤트 replay 기각: 네이티브 `LogTail.swift`가 파일 오프셋을 유지, WebView 리로드 후 옛 줄을 재전송하지 않음 → 웹 쪽에서 재현 불가.
- 순수 웹 사이드: `localStorage`에 RaceState + liveSamples 주기 저장(5초), boot 시 LIVE 전환 경로에서 복원.
- **핵심 함정 — 내부 시계 재기준화**: `LiveSource.tick()`이 `ts`를 rAF(페이지 상대) 시계로 갈아끼움. `raceState.now`, `CarState.last_event_ts`, `last_error_ts`는 페이지 상대 → 복원 시 `performance.now() - snap.now`만큼 시프트.
- 시프트 금지(wall 시계): `limit_resets_at`, `limit_observed_at`, `hourly` 버킷 인덱스, samples.ts(`wall_ts ?? ts`라 이미 wall epoch).
- 만료: `Date.now() - savedAt > 12h` → 조용히 폐기 (어제 레이스를 오늘 것으로 주장하지 않기).
- 저장 조건: `this.live`일 때만. 복원 조건: browser.ts `pitwallLive` 핸들러에서 `useSource` **이후**.
- `recent` 링버퍼는 복원 안 함 — 피드 카드는 새 이벤트부터 시작 (집계만 복원, 정직).
- 구조: `src/session/liveStore.ts`(신규) — serialize/validate/rebase/만료. `main.ts` — `captureLiveSnapshot()`/`restoreLiveState()` + frame() 자동 저장. `browser.ts` — pitwallLive에서 restore 배선.
- sessionStore 패턴 답습: 깨진 JSON/버전 불일치 → null 조용히.

## #10 (P2) — 유휴 idle sway: 1:1 불변식 유지 (2026-08-03)
- 리뷰어가 P0 충돌 명시("없는 사실 주장") → 시간 기반 주행 **금지**. 진행률 = 토큰 소비 순수 함수 유지.
- 해법: 유휴 차 글리프에 CSS-only 미세 진동(제자리, 진행 없음). 약 2px, 4초 주기, 차량별 위상 차이.
- **그룹은 애니메이션 금지** — `trackRenderer.translate()`가 프레임마다 `group.style.transform`을 덮어씀. 자식 `.class-icon` svg 요소에만.
- 정지 사유(에러/한도, `data-reason`) 차는 제외 — 고장난 차는 멈춰 있어야 정직.
- 위상: `--pw-idle-delay` CSS var를 applyHeat에서 carId 해시로 (변경 시에만 쓰기 — 프레임 쓰기 예산).
- 게이트: SVG `transform` **속성** 금지(그렙 `setAttribute('transform')`) — CSS transform은 허용됨 (CHECKLIST 45행). 순수 CSS 애니메이션 = compositor-only, layout 0 (프로젝트 실측 근거).

## #11 (P3) — 프로바이더 칩: 트랙 단가 축 유지 (2026-08-03)
- 트랙 글리프 축은 비용(연료) 고정 — 프로바이더는 feed/tower **카드**의 모델 텍스트 옆 작은 칩.
- 문자+색 이중 인코딩 (색상 단독 금지 룰). 미지 모델 → 칩을 숨기고, 중립 회색 같은 provider 메타데이터를 만들지 않으며, 기존 provider/color/title/text 메타데이터도 지운다.
- `models.ts` `providerOfModel(id)` + `theme.ts` `PROVIDER_STYLE` (기존 색 토큰과 비충돌, 배경 대비 ≥2.5:1, 색별 근거 주석 — theme.ts 관례).
