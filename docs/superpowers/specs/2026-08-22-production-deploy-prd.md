# PITWALL — 프로덕션 배포 PRD

**PRD v1.0** · 2026-08-22 · 상태: **구현 착수** (요청: 미비점을 찾아 완성할 때까지)

기존 제품 PRD([2026-07-29-pitwall-prd.md](./2026-07-29-pitwall-prd.md))의 v1 범위 안에서, **지금 공개 배포를 막는 구멍만** 닫는다. 서버·LiteLLM·공증·위젯·8시간 힙 실측은 이 문서의 목표가 아니다.

---

## 0. 한 줄 정의

**데모 전용 단일 HTML을 GitHub Pages에 올리고, 그 산출물에 실기록이 섞이면 CI가 막는다.**

---

## 1. 관측 — 배포가 안 되는 이유 [High]

저장소 `ChungHwemo/pitwall`을 `gh repo view`로 확인했다. 문서(`PITWALL.md` §12)의 `Hwemo-Chung/pitwall (private)`는 **틀렸다.**

| 항목 | 문서 주장 | 실측 2026-08-22 |
|---|---|---|
| 원격 | `Hwemo-Chung/pitwall` private | `ChungHwemo/pitwall` **PUBLIC** |
| CI | 없음 (암시) | `.github/` 없음 · Actions workflow 0 |
| Pages | “정적 호스팅”만 문장 | Pages API 404 · homepage 빈 문자열 |
| Release | — | 0 |
| SPDX 라이선스 | README “라이선스 미정” | `licenseInfo: null` |
| macOS 서명 | ad-hoc, D9 미결 | `codesign --sign -` only |

v1 PRD §11.4는 “배포는 정적 호스팅, 서버 없음”이다. 호스팅도 CI도 없다. 공개 리포인데 라이선스 파일도 없다.

**GitHub 공식 경고** ([Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)): Pages 사이트는 인터넷에 공개된다. 민감 데이터가 산출물에 있으면 올리지 말 것.

`PITWALL_REAL=1` 빌드는 `events.real.jsonl` / `events.real-busy.jsonl`을 심는다. 이 파일에는 프롬프트 본문은 없지만 **실제 세션 UUID**와 해시된 `car_id`가 있다. 기본 빌드는 데모만 심도록 이미 짜여 있다 — **그 불변식을 CI가 강제하지 않는다.**

---

## 2. 목표 / 비목표

### 2.1 목표

| # | 목표 | 검증 |
|---|---|---|
| P1 | `main` 푸시가 데모 전용 `index.html`을 GitHub Pages에 올린다 | 워크플로 + Pages URL |
| P2 | 공개 산출물에 `real` / `real-busy` 데이터셋이 없으면 통과, 있으면 실패 | 단위 테스트 + `release:check` |
| P3 | 공개 산출물에 실기록 canary(`car_id`·`session_id`)가 없으면 통과 | 같은 게이트가 fixture에서 canary를 뽑아 HTML을 스캔 |
| P4 | PR은 테스트·타입·단일 파일 빌드·P2/P3를 돌리고 Pages에는 올리지 않는다 | 워크플로 `if` |
| P5 | SPDX MIT + 서드파티 표시. 공개 리포의 “라이선스 미정”을 끝낸다 | `LICENSE` 파일 |
| P6 | D9: 공개 경로는 웹. macOS 앱은 Apple 공식 “확인되지 않은 개발자” 우회만 안내 | README. Developer ID/$99 없음 |

### 2.2 비목표 (이번 작업에서 명시적으로 하지 않는다)

| 비목표 | 이유 |
|---|---|
| Apple Developer ID · 공증 · 하드닝 | 계정·$99 없음. Apple은 공증을 “Mac App Store 밖 배포”의 선호 경로로 둔다. 지금 공개면은 HTML이다 |
| WidgetKit | D10 권장안이 이미 상주 창 = 현재 앱 |
| 서버 · LiteLLM · 텔레메트리 | v1.5. PRIV outbound-0 |
| 8시간 힙 · GPU fps · 3초 인지 | 측정이지 코드가 아님. 출시 게이트로 이 배포를 막지 않는다 |
| 실기록 fixture를 git에서 삭제 | 로컬 `PITWALL_REAL=1` 경로. Pages가 안 심으면 된다 |
| Vite `base: '/pitwall/'` 멀티파일 배포 | 단일 HTML이 이미 `file://`·서브경로를 견딘다 |
| CSP `unsafe-inline` 연극 | 인라인 번들은 nonce 없이 스크립트를 막으면 죽는다 |
| native LIVE 운영 재실측 | 별도 사람 게이트. 웹 배포와 무관 |

---

## 3. 결정

**D9 해소.** 공개 배포 = GitHub Pages 데모 HTML. macOS 앱은 이 기기 로컬. 다른 Mac은 Apple 안내대로 시스템 설정 → 개인정보 보호 및 보안 → **그래도 열기** ([Open a Mac app from an unknown developer](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac)). `xattr -d`를 1등 안내로 두지 않는다 — 그게 현재 공식 UI가 아니다.

**D-license.** MIT. 런타임 의존성 0, 자산은 이미 MIT/CC0/CC BY 3.0. Skoll CC BY 3.0 귀속은 README에 이미 있다.

**D-pages.** 퍼블리시 소스는 GitHub Actions. 공식 흐름: checkout → 빌드 → `upload-pages-artifact` → `deploy-pages`. 브랜치/`docs/` 폴더에 빌드 산출물을 커밋하지 않는다.

---

## 4. 산출물 계약

공개 사이트 루트는 다음 세 파일만 가진다.

| 파일 | 내용 |
|---|---|
| `index.html` | `npm run build:single`의 `dist/pitwall.html` 전체 문서 (doctype 포함). `pitwall.artifact.html` 조각이 아님 |
| `pitwall.settings.json` | `public/pitwall.settings.json` 복사. `loadOrgSettings`가 `./pitwall.settings.json`을 GET한다 |
| `.nojekyll` | Jekyll이 파일을 삼키지 못하게 |

금지:

- `PITWALL_REAL=1` 산출물
- 데이터셋 id `real`, `real-busy`
- 실기록 fixture에서 뽑은 `car_id` / `session_id` 문자열
- 인라인되지 않은 `/assets/` 경로
- `PITWALL.app`, 실기록 JSONL, `node_modules`

허용:

- 데모 id `demo-small` · `demo` · `demo-large`
- 도움말 문구의 한글 “실기록” (데이터셋이 없을 때도 picker 도움말에 있다 — 이 문자열로 게이트하면 거짓 양성이 난다)
- 파서 필드명 `accountUuid` (코드에 있고 값은 없다)

---

## 5. 구현 경계 (YAGNI)

테스트가 밟는 공개 함수는 세 개다. Vite 설정도 같은 함수를 쓴다 — 빌드와 검사가 다른 목록을 보면 게이트가 거짓을 말한다 (`pickWindow`와 같은 이유).

```ts
chooseEmbeddedSources(wantReal: boolean): { id: string; label: string; file: string }[]
inspectPublicHtml(html: string, opts?: { leakCanaries?: string[] }): { code: string; detail: string }[]
stagePagesSite(opts: { html: string; settingsJson: string; outDir: string }): void
```

`vite.config.ts`의 `SOURCES` 배열은 이 모듈로 옮긴다. 새 런타임 의존성 없음. 새 UI 없음. 서버 없음.

---

## 6. CI

워크플로 하나.

- `verify`: 모든 push/PR. `pitwall/`에서 `npm ci` · `npm test` · `npx tsc --noEmit` · `npm run build:single` · `npm run release:check` · `npm run release:stage`. 스테이징 디렉터리를 일반 artifact로 올린다.
- `pages`: `main` 푸시만. artifact를 받아 `actions/upload-pages-artifact` + `actions/deploy-pages`. environment `github-pages`.

Node 22. 권한: verify는 `contents: read`. pages는 `pages: write` + `id-token: write`.

---

## 7. 출시 게이트 — 이 작업

빈칸이면 배포했다고 말하지 않는다.

| 항목 | 합격 |
|---|---|
| 단위 테스트 `release.test.ts` | RED를 본 뒤 GREEN |
| 전체 `npm test` · `tsc --noEmit` | 통과 |
| `build:single` + `release:check` | 실기록 canary 0 |
| GitHub Actions verify | 통과 |
| Pages URL | `https://chunghwemo.github.io/pitwall/` 200, 데모만 |
| LICENSE | 리포 루트 MIT |

측정하지 않은 것(8시간 힙, native LIVE, GPU fps)은 이 표에 넣지 않는다. 없다고 끝난 것이 아니다. 이 배포의 합격 조건이 아니다.
