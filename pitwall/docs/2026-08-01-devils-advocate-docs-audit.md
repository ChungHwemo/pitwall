# 악마의 변호인 감사 — README.md · PITWALL.md (2026-08-01)

**감사 대상:** `/README.md`, `/PITWALL.md` (2026-08-01 재작성본)
**방식:** 모든 주장을 저장소 실제 상태에 대해 재측정/재확인. 문서는 유죄 추정.
**감사 기준 저장소 상태:** HEAD `15257ed` (2026-08-01 09:11 +0900)

**검증 도구 실측 요약**
- `npm test` → **Test Files 43 passed (43) · Tests 703 passed (703)** (7.11s)
- `npm run build:single` → 빌드 도구 자체 출력 `dist/pitwall.html 5434.4 kB` (exit 0)
- `git log` → 3개 핵심 커밋 모두 2026-08-01 09:11 +0900
- `MODEL_CATALOG` grep 카운트 = **21** 항목
- 데이터셋 distinct 측정 · 데모 분포 재계산 · real.jsonl 집계 재계산 완료

---

## 0. 한눈에 — 확정 오류 (severity 순)

| # | 위치 | 심각도 | 요지 |
|---|---|---|---|
| E1 | README:77 | ❌ HIGH | 가독성 명세 링크가 깨졌다 (`docs/...` → 실제는 `pitwall/docs/...`) |
| E2 | README:39, 43–48 | ❌ HIGH | "19개 모델" — 카탈로그는 **21개** (`gpt-5.5`·`claude-opus-4-8` 누락) |
| E3 | README:72 | ❌ MED | "PRD v1.2" — 실제 문서는 **v1.4** |
| E4 | README:73 | ❌ MED | "18개 태스크" — 계획서는 **19개** (Task 1–19) |
| E5 | PITWALL:58–59 | ❌ MED | 더미 분포 4개 수치 전부 소스·실측과 불일치 |
| E6 | PITWALL:67–73 | ⚠️/🔍 MED | "오늘 실측" 표가 커밋된 `events.real.jsonl`로 재현 안 됨 |
| E7 | README:9 | ⚠️ LOW | "36,000프레임" — 실측은 **35,996** |
| C1 | CHECKLIST:15 | ⚠️ 문서충돌 | "256 passed / 20 files" — README/PITWALL의 703/43과 모순 (구버전) |
| C2 | CHECKLIST:54,56 | ⚠️ 문서충돌 | "19개 모델 / 19–19" — 실제 21과 모순 (README와 같은 미갱신) |

---

## 1. 청구항 인벤토리 + 2. 판정표 (통합)

범례: ✅ 정확 / ❌ 오류 / ⚠️ 부정확·오해소지 / 🔍 검증불가

### README.md

| # | 문서(줄) | 주장 | 증거 | 판정 |
|---|---|---|---|---|
| R1 | R:8 | 703 tests | `npm test` → Tests 703 passed | ✅ |
| R2 | R:8 | `tsc` 0 오류 | 노트패드 실측 기록(2026-08-01) | 🔍(재실행 안 함, 기록상 ✅) |
| R3 | R:8 | 기본 단일 빌드 5,434.4 kB (약 5.4 MB) | 빌드도구 출력 `pitwall.html 5434.4 kB` | ✅ |
| R4 | R:8 | 런타임 의존성 0개 | `package.json` `dependencies` 없음 | ✅ |
| R5 | R:9 | 차량 100대 × 36,000프레임 | CHECKLIST:173 = **35,996프레임** | ⚠️(반올림) |
| R6 | R:9 | layout 유발 0 | CHECKLIST:173 "360만 회 쓰기 layout 0" | ✅ |
| R7 | R:10 | 예전 24 kB보다 커졌다 | CHECKLIST:17 JS 24.7 kB | ✅(근사) |
| R8 | R:10 | 실기록은 `PITWALL_REAL=1` 빌드에서만 | `vite.config.ts:32-33` | ✅ |
| R9 | R:14-16 | `npm run dev`/`build:single`/`dump:events` | `package.json` scripts 존재 | ✅ |
| R10 | R:24 | `build:app` → dist/PITWALL.app (136 kB) | 앱 미빌드(swiftc) | 🔍 |
| R11 | R:25 | `build:app:real` | `package.json:18` | ✅ |
| R12 | R:39 | 6개 공급자 | models.ts provider 6종 | ✅ |
| R13 | R:39 | **19개 모델** | `MODEL_CATALOG` = **21개** | ❌ |
| R14 | R:43-48 | 모델 표(19개 나열) | `gpt-5.5`·`claude-opus-4-8` 누락 | ❌ |
| R15 | R:39 | 단가 2026-07-30 공식 문서에서 | models.ts:6 동일 문구 | ✅ |
| R16 | R:50 | H≥$12 · P$2.5–10 · GT≤$1.5 | models.ts:14-16 동일 | ✅ |
| R17 | R:56 | 기본 빌드 데모 3벌만 | vite.config `filter(startsWith('demo'))` → 3벌 | ✅ |
| R18 | R:56 | 원본 fixture 계정 4·14·40 | 측정: 4·14·40 | ✅ |
| R19 | R:56 | 모델 4·7·8종 | 측정: 4·7·8 | ✅ |
| R20 | R:56 | 최대 5,000건, 초과 시 겹치는 구간 잘라 로그 | `PER_SET=5000`, 빌드로그 확인 | ✅ |
| R21 | R:56 | REAL 빌드에 실기록·실기록·붐빈 날 추가 | vite.config SOURCES 라벨 일치 | ✅ |
| R22 | R:58 | LIVE는 `window.pitwallLive`+`LiveSource`에서만 | browser.ts:92,117-129 | ✅ |
| R23 | R:58 | 시뮬레이터·지어낸 재생 = DEMO·`지어낸 데이터` | datasetPicker.ts:56, main.ts | ✅ |
| R24 | R:58 | 설정 패널 **데모 모드**는 시계 설정, 배지와 별개 | settingsPanel.ts:148, HELP.demoClock | ✅ |
| R25 | R:62 | 배속 `1×·20×·30×·100×` | settingsPanel SPEEDS | ✅ |
| R26 | R:62 | 내부값 busy·sparse·chaos·real → 붐비는 날·한산한 날·대혼란·실측 | settingsPanel PRESETS | ✅ |
| R27 | R:63 | Skoll Game Icons, CC BY 3.0 | trackRenderer SKOLL_CREDIT + assets/f1/README | ✅ |
| R28 | R:63 | viewBox `26.3 194.9 459.4 122.2` | trackRenderer:44 동일 | ✅ |
| R29 | R:63 | 24×16 크기 | `CAR_ICON {width:24,height:16}` | ✅ |
| R30 | R:64 | 투명 `.car-hit`, 모든 차량 클릭, 선택 시 피드 | trackRenderer:133-139,433-436,469-472 | ✅ |
| R31 | R:72 | **PRD v1.2** | PRD 문서 헤더 = **v1.4** | ❌ |
| R32 | R:73 | 구현 계획 **18개 태스크** | 계획서 Task 1–19 = **19개** | ❌ |
| R33 | R:74 | f1 분해: 채택 5 / 기각 7 | 분해문서 §2 "5개", §3 표 7행 | ✅ |
| R34 | R:75 | CHECKLIST 링크 | `pitwall/CHECKLIST.md` 존재 | ✅ |
| R35 | R:76 | MVP 결정 D1–D10 링크 | 파일 존재 | ✅ |
| R36 | R:77 | 가독성 명세 링크 `docs/superpowers/specs/2026-08-01-readability.md` | 루트 기준 **부재**; 실제는 `pitwall/docs/...` | ❌ |
| R37 | R:91 | 4프리셋 busy/sparse/chaos/real | presets 일치 | ✅ |
| R38 | R:93 | `localStorage` `pitwall.dataset` 저장 | `DATASET_KEY='pitwall.dataset'` | ✅ |

### PITWALL.md

| # | 문서(줄) | 주장 | 증거 | 판정 |
|---|---|---|---|---|
| P1 | P:3 | 2026-08-01 기준 | git 커밋 2026-08-01 | ✅ |
| P2 | P:3,13,253 | 703개 · 파일 43개 | `npm test` 703/43 | ✅ |
| P3 | P:3 | tsc 클린 · 의존성 0 | package.json / 노트패드 | ✅ |
| P4 | P:13-27 | 15개 `npm run` 스크립트 전부 | package.json 전부 존재 | ✅ |
| P5 | P:15 | build:single 5,434.4 kB 실측 | 빌드도구 출력 일치 | ✅ |
| P6 | P:21 | make:demo:all 계정 4/14/40 | package.json:23 인자 4·14·40 | ✅ |
| P7 | P:36-37 | 기본 데모 3벌, REAL 시 실기록 2벌 추가 | vite.config | ✅ |
| P8 | P:38 | 지어낸 데이터면 `지어낸 데이터` 배지 | datasetPicker.ts:56 | ✅ |
| P9 | P:42 | 실시간=네이티브 브리지에서만 | browser.ts | ✅ |
| P10 | P:43 | real.jsonl 1,302건 · real-busy 7,375건 | `wc -l` 1302 / 7375 | ✅ |
| P11 | P:43 | 각각 1,302 / 5,000건 심음 | 1302<5000 전량, 7375→5000 절단 | ✅ |
| P12 | P:44-46 | 데모 계정 4/14/40 · 모델 4/7/8 · 5,000건 | 측정 일치 | ✅ |
| P13 | P:51-54 | LIVE 조건·pitwallIngest·DEMO 라벨링 | browser.ts / main.ts | ✅ |
| P14 | P:55-56 | 데모 모드 = 벽시계 접기 · 내부 키 `demoClock` | settingsPanel `data-setting='demoClock'` | ✅ |
| P15 | P:58 | 작업 토큰 중앙 **1,950** | 측정 데모 ~2,300–2,450 / 생성기 목표 2,107 | ❌ |
| P16 | P:58 | 캐시 비중 **99.4%** | 측정 데모 ~96% / 생성기 목표 96.0% | ❌ |
| P17 | P:59 | 호출 간격 중앙 **5.2초** | 측정 데모 ~2.2초 / 생성기 목표 2.3초 | ❌ |
| P18 | P:59 | p99 **371초** | 측정 데모 ~185–261초 / 생성기 목표 172초 | ❌ |
| P19 | P:60-61 | 성향 heavy/steady/bursty/light/idle · verified만 | makeDemo.ts / models.ts priceSource | 🔍(부분 ✅) |
| P20 | P:67 | 오늘 실측 호출 2,097 · 계정 2 | real.jsonl calls=**1,302** · cars=2 | ⚠️/🔍 |
| P21 | P:68-72 | 작업 11,315,653 · 캐시 737,148,747 · $425.13 · 아낌 $3,265.41 | real.jsonl 재계산: work 8,640,311 · cache 437,845,502 · $256.84 | 🔍(커밋본 불일치) |
| P22 | P:100 | 랩 = 작업 토큰 **50,000** | `LAP_TOKENS = 50_000` | ✅ |
| P23 | P:142-143 | 실제 서킷 40개 `bacinger/f1-circuits` MIT/ODbL | import:circuits + f1-circuits.geojson 존재 | 🔍(개수 미검증) |
| P24 | P:159-161 | Skoll `f1-car` CC BY 3.0 · viewBox `26.3 194.9 459.4 122.2` · 24×16 | trackRenderer 일치 | ✅ |
| P25 | P:162-163 | 투명 `.car-hit` 모든 차량 클릭 · 재클릭 해제 | trackRenderer / main select toggle | ✅ |
| P26 | P:168 | 발열 로지스틱 500→24% · 1,500→50% · 3,000→68% · 40,000→97% | `heatOf` 재계산: 23.7/50/67.6/97.0% | ✅ |
| P27 | P:170 | 프레임당 이동 랩의 0.4% | `MAX_FRAME_STEP = 0.004` | ✅ |
| P28 | P:177 | font-size clamp 식 | style.css:23 **문자 단위 일치** | ✅ |
| P29 | P:180 | 1440×900에서 16px | style.css:10 주석 확인 | ✅ |
| P30 | P:181 | `--pw-zoom` 0.85 / 1.3 | style.css:13-14 | ✅ |
| P31 | P:194-196 | 배속·프리셋·데모 모드 라벨 | settingsPanel 일치 | ✅ |
| P32 | P:214-217 | 벤치마크 도구 20개 이상 | 벤치문서 "최소 20개" | ✅ |
| P33 | P:224 | 2차 도구 7개 · 채택 0건 | 벤치문서 "7개 조사, 채택 0건" | ✅ |
| P34 | P:114-122 | §5 HUD ASCII 예시 수치(451콜·$61.49·417콜·949.3k 등) | 예시 다이어그램 | 🔍(예시, 비측정) |
| P35 | P:316-319 | 커밋 규칙(작성자/원격/저장소) | 저장소 메타 미확인 | 🔍 |

---

## 3. 확정 오류 상세 (❌·⚠️, 심각도 순)

### E1 — README 가독성 명세 링크 깨짐 ❌ HIGH
- **문서:** README:77 `[가독성 구현 명세](docs/superpowers/specs/2026-08-01-readability.md)`
- **실제:** 루트 기준 `docs/superpowers/specs/2026-08-01-readability.md` **부재**. 파일은 `pitwall/docs/superpowers/specs/2026-08-01-readability.md`에 있다. 같은 표의 다른 링크(PRD·계획·teardown·MVP결정)는 전부 루트 `docs/`로 정상 해석되므로 이 항목만 경로가 틀렸다.
- **증거:** `ls` — 루트 경로 MISS, `find` — `pitwall/docs/.../2026-08-01-readability.md` 존재.
- **정정문:** `| [가독성 구현 명세](pitwall/docs/superpowers/specs/2026-08-01-readability.md) | 데이터 출처 라벨, 데모 데이터 선택, 설정 패널, 트랙 차량 가독성 구현 명세 |`

### E2 — "19개 모델" 실제 21개 ❌ HIGH
- **문서:** README:39 "6개 공급자 **19개 모델**", 표(43–48)에 19개 나열.
- **실제:** `MODEL_CATALOG`는 **21개**. 표에서 빠진 것: `gpt-5.5`(OpenAI, H), `claude-opus-4-8`(Anthropic, H). 공급자 6종은 정확.
- **증거:** `grep -cE "^\s*\{ id:" src/config/models.ts` → 21; id 목록 21개.
- **정정문:** "시뮬레이터는 6개 공급자 **21개** 모델을 섞어 이벤트를 만든다." + Anthropic 행에 `claude-opus-4-8`, OpenAI 행에 `gpt-5.5` 추가.

### E3 — "PRD v1.2" 실제 v1.4 ❌ MED
- **문서:** README:72 "PRD v1.2".
- **실제:** PRD 문서 헤더 `**PRD v1.4** · 2026-07-30`. (v1.2는 변경 이력 중 한 단계일 뿐 현재 판본이 아니다.)
- **증거:** `docs/superpowers/specs/2026-07-29-pitwall-prd.md:3`.
- **정정문:** `| [PRD v1.4](docs/superpowers/specs/2026-07-29-pitwall-prd.md) | 제품 정의, 은유 사전, 데이터 모델, 프라이버시 가드레일, 리스크 등록부 |`

### E4 — "18개 태스크" 실제 19개 ❌ MED
- **문서:** README:73 "18개 태스크 TDD 실행 계획".
- **실제:** 계획서에 Task 1–19 헤더 존재, "Task 1–19 전부 구현·커밋됐다". Task 19(설정 레이어)가 뒤에 추가돼 총 **19개**.
- **증거:** `2026-07-29-pitwall-v1.md` Task 헤더 grep(4070: Task 19, 4343: Task 18) + 본문 13행.
- **정정문:** `| [구현 계획 v1](docs/superpowers/plans/2026-07-29-pitwall-v1.md) | 19개 태스크 TDD 실행 계획 |`

### E5 — 더미 분포 4개 수치 전부 불일치 ❌ MED
- **문서:** PITWALL:58–59 "작업 토큰 중앙 1,950 · 캐시 비중 99.4% · 호출 간격 중앙 5.2초 / p99 371초".
- **실제(측정, 데모 3벌):** 작업 중앙 ~2,309–2,450 · 캐시 ~95.6–96.3% · 간격 중앙 ~2.1–2.4초 · p99 ~185–261초. **생성기(`makeDemo.ts`) 자체 목표**도 작업 2,107 · 캐시 96.0% · 간격 2.3초 · p99 172초로, 문서 수치는 실측·목표 어느 쪽과도 일치하지 않는다.
- **증거:** node 재계산(demo-small/demo/demo-large) + `scripts/makeDemo.ts:16-20`.
- **정정문:** "더미는 실측 분포로 만든다 — 작업 토큰 중앙 약 2,100 · 캐시 비중 약 96% · 호출 간격 중앙 약 2.3초 / p99 약 200초. 계정마다 성향이 다르다…"

### E6 / P20–P21 — "오늘 실측" 표가 커밋 데이터로 재현 안 됨 ⚠️/🔍 MED
- **문서:** PITWALL:67–73 호출 2,097 · 작업 11,315,653 · 캐시 737,148,747(98.4%) · $425.13 · 아낌 $3,265.41.
- **실제:** 커밋된 `events.real.jsonl` 재계산 = 호출 **1,302** · 작업 **8,640,311** · 캐시 **437,845,502** · 비용 **$256.84**. 계정 2만 일치.
- **판정:** "2026-07-30 오늘 실측"이라 명시된 그날의 라이브 캡처로 보이며, 저장소 픽스처로는 재현 불가. 사실 오류로 단정하지 않되, **커밋된 실기록과 크게 다르다는 점을 밝히거나 재현 가능한 수치로 교체 권고**.
- **증거:** node 집계 real.jsonl.

### E7 — "36,000프레임" ⚠️ LOW
- **문서:** README:9 "차량 100대 × 36,000프레임".
- **실제:** CHECKLIST:173 "차량 100대 × 35,996프레임". 반올림.
- **정정문:** "차량 100대 × 35,996프레임에서 layout 유발 0…" (또는 "약 36,000").

---

## 4. 문서 간 정합성 (README ↔ PITWALL ↔ CHECKLIST)

| 항목 | README | PITWALL | CHECKLIST | 판정 |
|---|---|---|---|---|
| 테스트 수 | 703 | 703 | **256 passed / 20 files** (:15) | ❌ CHECKLIST 구버전 (실제 703/43) |
| 테스트 파일 수 | — | 43 | 20 | ❌ CHECKLIST 구버전 |
| 모델 수 | 19 | — | **19개 / 19–19 검증**(:54,56) | ❌ 둘 다 미갱신 (실제 21) |
| 번들 크기 | 5,434.4 kB(단일HTML) | 5,434.4 kB | JS 24.7 kB(:17) | ⚠️ 측정 대상 다름(단일HTML vs JS전용); 모순 아님 |
| 데모 계정 | 4/14/40 | 4/14/40 | — | ✅ 일치 |
| 프리셋 | busy/sparse/chaos/real | 동일 | busy/sparse/chaos(:67-69) | ✅ (CHECKLIST는 real 미언급이나 충돌 아님) |
| viewBox | 26.3 194.9 459.4 122.2 | 동일 | — | ✅ |
| LAP 토큰 | — | 50,000 | (구서술 20만/500만) | ✅ PITWALL이 현행 소스(50,000)와 일치 |

**핵심 정합성 결론:** `pitwall/CHECKLIST.md`(2026-07-30)와 구현 계획서 헤더(13행)는 **256 tests / 20 files / 24.4–24.7 kB / 19 모델** 시대의 수치로 멈춰 있다. README·PITWALL는 703/43/5,434.4 kB로 갱신됐으나 **모델 수 19는 두 문서 모두 21로 갱신하지 못했다.** CHECKLIST 자체는 이번 감사 대상이 아니지만, README/PITWALL와의 대조 지점으로 기록한다.

---

## 5. 검증불가(🔍) 목록과 사유
- README:24 `PITWALL.app (136 kB)` — swiftc 앱 빌드를 수행하지 않음(장시간/환경 의존). 크기 미재현.
- R2/P3 `tsc` 0 오류 — 이번 감사에서 `tsc` 재실행 안 함. 노트패드 2026-08-01 기록상 clean.
- PITWALL:114-122 §5 HUD ASCII 예시 수치 — 문서 내 삽화, 측정 대상 아님.
- PITWALL:142 서킷 "40개" — geojson 존재는 확인, 정확한 개수는 미집계.
- PITWALL:316-319 커밋 규칙(계정/원격/협업자) — 저장소 권한·원격 메타 미확인.

---

## 6. 감사자 총평
- **하드 스펙(테스트 703/43, 번들 5,434.4 kB, viewBox, 24×16, Skoll/CC BY 3.0, `.car-hit`, `pitwall.dataset`, 배속·프리셋·`데모 모드`·`지어낸 데이터` 문자열, LAP 50,000, 발열곡선 24/50/68/97%, `MAX_FRAME_STEP` 0.4%, CSS clamp 식, LIVE 브리지 정직성)**은 소스와 문자·수치 단위까지 정확했다. 재작성 품질은 대체로 높다.
- **치명 결함은 두 가지 부류**다. (a) 모델 카탈로그가 21개로 늘었는데 문서 3곳(README 본문·표, CHECKLIST)이 19에 멈춤. (b) 참조 문서 메타데이터 미갱신 — PRD 판본(v1.2→v1.4), 태스크 수(18→19), 그리고 실제로 404 나는 가독성 명세 링크.
- **수치 신뢰성 경고:** PITWALL의 더미 분포 4개 수치(P15–P18)는 생성기·픽스처 어느 쪽으로도 뒷받침되지 않는다. "오늘 실측" 표(P20–P21)는 커밋 데이터로 재현 불가하므로, 재현 가능한 수치로 교체하거나 출처를 명시할 것.
