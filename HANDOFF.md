# PITWALL 작업 인수인계

> 완료 기록 (2026-08-08): 아래 인수인계의 slow-pit 버그와 미커밋 renderer/projection/docs 작업은 `cd7075c`, `da2d646`, `3b807c1`으로 완료했다. 전체 53 files / 858 tests, typecheck, production build, headed Chromium 검증을 통과했다. 이하 내용은 작업 시작 시점의 스냅샷으로 보존한다. native LIVE blocker는 별도이며 해결로 표시하지 않았다.

## 다음 세션의 목표

Codex 5.6은 이 문서를 먼저 읽고, 현재 diff를 보존한 뒤 **한도/error 차량의 느린 피트 이동**을 TDD로 구현한다. 이 버그는 아직 고쳐지지 않았다.

## 사용자 요청

현재 저장소 작업 상태를 재발견 없이 이어갈 수 있는 문서만 남긴다. 기존 uncommitted 변경은 보존한다. 소스 코드는 이 세션에서 수정하지 않았다.

## 현재 완료된 변경

- REVIEW #14: `HOT_CAP`을 넘는 limit 차량도 hot 상태로 보존하고, 피트 레인과 박스를 여러 행으로 확장해 차량이 겹치지 않게 했다.
- Projection 회귀 테스트를 동작별 파일로 분리했다. 기존 회귀를 유지하면서 lap, motion, retention, reverse 테스트를 추가했다.
- `README.md`와 `PITWALL.md`의 테스트 수를 현재 결과인 858에 맞췄다.
- 위 세 항목은 구현되어 있지만 **최종 리뷰와 plan 완료 처리는 아직 하지 않았다**. `.omo/plans/review-improvements.md`의 F1부터 F4 최종 검토도 미완료다.

## 검증 결과

현재 확인된 결과:

```bash
cd pitwall && npx tsc --noEmit
# pass

cd pitwall && npx vitest run --no-file-parallelism
# pass, 52 files / 858 tests
```

추가로 기존 native 검증에서 전체 앱 relaunch 후 LIVE snapshot restore는 PASS였다.

## 현재 uncommitted 파일

HANDOFF.md 생성 전 `git status --short` 기준:

```text
 M PITWALL.md
 M README.md
 M pitwall/src/render/trackRenderer.ts
 M pitwall/src/track/layout.ts
 M pitwall/tests/projection.test.ts
 M pitwall/tests/trackRenderer.test.ts
?? pitwall/tests/projection-laps.test.ts
?? pitwall/tests/projection-motion.test.ts
?? pitwall/tests/projection-retention.test.ts
?? pitwall/tests/projection-reverse.test.ts
```

이 문서 자체도 새 untracked 파일이다. 커밋, reset, stash, discard는 하지 않았다.

## 남은 버그와 확정 원인

### 증상

limit/error 차량은 피트 표현으로 이동했지만 피트 안에서 완전히 정지한다. 요청된 동작은 차량이 피트 표현을 유지하면서도 **느리고 결정론적으로 이동하는 것**이다.

### Root cause

`pitwall/src/render/trackRenderer.ts`의 `TrackRenderer.renderHot()` STOPPED branch가:

1. `this.projector.hold(car.carId, now)`를 호출해 투영 속도를 0으로 만든다.
2. `pitBoxes()`가 계산한 static 좌표로 `translate()`한다.

따라서 같은 차량의 다음 프레임은 같은 피트 박스에 계속 그려진다. 기존 `pitwall/tests/trackRenderer.test.ts` 343부터 378행 부근의 테스트도 stopped 차량의 transform이 바뀌지 않아야 한다고 명시적으로 기대한다. 이 테스트 계약이 현재 필요한 동작과 충돌한다.

`step()`만 호출하고 static `pitBoxes()`를 유지하는 수정은 안 된다. 차량은 여전히 화면상 정지해 보인다.

## 권장 다음 작업

1. `pitwall/tests/trackRenderer.test.ts`의 public renderer 경계에 실패하는 회귀 테스트를 먼저 추가한다. 같은 limit/error 차량을 여러 timestamp로 렌더하고, 위치가 피트 레인 안에서 바뀌며 같은 입력에 같은 위치열을 만드는지 검사한다.
2. `renderHot()`의 STOPPED 경로에 피트 레인 progress/movement mapping 또는 동등한 결정론적 slow movement seam을 추가한다. 피트 표현, 사유 표시, 여러 차량 간 분리는 유지한다.
3. 관련 기존 테스트의 “멈춘다” 기대를 새 제품 동작에 맞게 바꾸되, pin 차량과 주행선 차량 회귀는 보존한다.
4. 다음 명령으로 검증한다.

```bash
cd pitwall && npx vitest run --no-file-parallelism
cd pitwall && npx tsc --noEmit
```

5. 변경 파일에 `lsp_diagnostics`를 실행하고, 최종 리뷰와 `.omo/plans/review-improvements.md`의 남은 항목을 실제 증거에 맞춰 처리한다. slow-motion 버그를 고쳤다고 검증하기 전에는 완료라고 말하지 않는다.

## 별도 native LIVE blocker

native 검증에서 **full relaunch restore는 PASS**였지만, 앱 안에서 WebView만 reload하면 async `window.pitwallLive` bridge race 때문에 화면이 LIVE 대신 DEMO로 fallback하는 별도 버그가 발견됐다. 이 문제는 이번 작업에서 다루지 않았다. native LIVE 연속성, duplicate replay, 즉시 reload 손실 범위도 최종 검토 전까지 미완료로 취급한다.

## 참고 경로

- `REVIEW.md`: 리뷰 항목과 처리 기록
- `.omo/plans/review-improvements.md`: #14, projection test split, 문서 동기화, native LIVE 및 F1부터 F4 최종 검토 상태
- `pitwall/src/render/trackRenderer.ts`: 남은 STOPPED branch
- `pitwall/tests/trackRenderer.test.ts`: 기존 stopped renderer 계약과 피트 회귀
- `.omo/evidence/live-reload-reliability/task-3-native-reload.md`: native 검증 범위와 blocker

## Suggested skills

- `programming`: TypeScript 변경과 진단 규칙
- `tdd` 또는 `superpowers:test-driven-development`: 실패 회귀부터 작성
- `review-work`: 구현 후 최종 correctness, quality, security, QA 검토
- `superpowers:verification-before-completion`: 완료 주장 전 테스트와 진단 증거 확인

## 추가 (2026-08-09): 트랙 중복선 회귀 수정

인수인계 이후 uncommitted broadcast renderer WIP(`bootBroadcastTrackRenderer`)가
`main.ts`에서 기본 렌더러로 연결되어 있었다. `BroadcastTrackRenderer`가 하드코딩된
`pitLanePoints(track, 40)`으로 피트 레인을 그리는데, 이 서킷 대부분을 도는 좌표
개수라 화면에서 주행선과 거의 겹치는 두 번째 트랙처럼 보였다 (REVIEW #14가 이미
정착시킨 얇은 피트 스퍼와 다름).

**수정**: `src/main.ts`의 `bootBroadcastTrackRenderer` 호출에 `supported: () => false`를
추가해 항상 기존에 검증된 legacy `TrackRenderer`를 쓰도록 강제했다. broadcast 관련
파일(`broadcastTrackRenderer.ts`, `broadcastRendererSession.ts`, `broadcastDirector.ts`,
`broadcastOverflow.ts`와 대응 테스트)은 건드리지 않았다 — 이 WIP은 그대로 보존된다.

**검증**: `tests/broadcastTrackRenderer.test.ts`에 회귀 테스트 2건 추가(수정 없이는
실패, 있으면 통과 확인함). 전체 `npx vitest run --no-file-parallelism` 57 files / 897
tests 통과, `tsc --noEmit` 0 오류, `npm run build:single` 5,464.1 kB, `git diff --check`
0. 개발 서버 + Chromium DOM 조사로 수정 전(`data-renderer="broadcast"`, 피트 레인
d 속성 657자·40개 점)과 수정 후(`data-renderer="legacy"`, 피트 레인 194자)를
직접 비교해 확인했다.

## 추가 (2026-08-09): 피트 정지 · 유휴 주행선 이동 정정

사용자가 REVIEW #14의 "한도/에러 차량이 피트 안에서 느리고 결정론적으로 이동" 결정을
명시적으로 뒤집었다 — "데이터 없을시 멈춰있는게 아니고 천천히 이동이라고 오류와
한도제한이 멈추는거고". 즉 **정지는 error/limit 몫, 느린 이동은 무통신(stale) 차량
몫**으로 자리가 바뀌었다.

**수정**: `pitwall/src/render/trackRenderer.ts`의 `renderHot()` STOPPED 분기에서
`pitCreep()` 호출을 제거하고 `pitBoxesCache`의 정적 좌표로 바로 `translate()`한다 —
피트에 선 차는 이제 완전히 정지한다. `pitwall/src/track/layout.ts`의 `pitCreep()`
함수와 그 전용 상수(`PIT_CREEP_PERIOD_MS`)는 삭제했다. 피트 박스 간격 공식
(`PIT_BOX_SPACING` 등 기하)은 그대로 보존했다 — 이번 정정과 무관한 값이다.

대신 `trackRenderer.ts`에 `idleCreepOffset(carId, now)`를 추가해, 무통신(≥5분,
`car.idle === true`) 차량이 주행선(`renderCold` 및 `renderHot`의 비-STOPPED 분기)에서
`Projector.step()`의 반환값 위에 작은 결정론적 왕복(progress ±0.0006, 8초 주기)을
얹는다. `Projector`의 내부 `visual` 상태는 건드리지 않으므로(`visualProgressOf` 불변),
기존 "유휴 sway는 진행률을 바꾸지 않는다" 불변식(REVIEW #10, `trackRenderer.test.ts`
434행)과 충돌하지 않는다.

**검증**: `tests/trackRenderer-pit-motion.test.ts`를 새 계약(피트 정지)에 맞게 갱신하고,
`tests/trackRenderer.test.ts`에 무통신 차량의 결정론적 저속 이동 회귀를 추가했다(수정
전 실패 확인). 전체 `npx vitest run --no-file-parallelism` **57 files / 898 tests**
통과, `tsc --noEmit` 0 오류, `npm run build:single` 5,464.0 kB, `git diff --check` 0.
broadcast WIP 파일은 건드리지 않았다.
