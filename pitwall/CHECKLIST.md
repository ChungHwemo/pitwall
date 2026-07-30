# PITWALL MVP 출시 검수

각 항목에 실제 관측값을 적는다. 빈칸이 있으면 출시하지 않는다.

**측정일:** 2026-07-30 (자동 게이트만) · **미측정 항목은 아래에 명시했다.**

> **검수 범위: 조직 기본값 1세트.** 사용자가 설정을 바꾼 조합은 검수하지 않았다 (PRD A20).

---

## 자동 게이트 — 통과

| 항목 | 합격 기준 | 관측값 |
|---|---|---|
| 단위·통합 테스트 | 전부 통과 | ✅ **208 passed / 18 files** |
| 타입 검사 | `tsc --noEmit` 오류 0 | ✅ **exit 0** |
| 프로덕션 빌드 | 성공 | ✅ **JS 20.31 kB (gzip 7.79) · CSS 1.12 kB** |
| 런타임 의존성 | 0개 | ✅ **zero runtime dependencies** |

## 설정 레이어 — Task 19

| 항목 | 합격 기준 | 관측값 |
|---|---|---|
| 조직 기본값 파일 부재 | `pitwall.settings.json`이 없어도 내장 기본값으로 정상 기동 | ✅ `loadOrgSettings`가 실패를 `{}`로 흡수. 테스트로 커버 |
| 우선순위 | 조직 → 로컬 → 세션 순으로 뒤가 앞을 덮는다 | ✅ 4개 테스트 |
| 하한 강제 | 설정에 `minTeamSizeForIndividual: 3`을 넣어도 10으로 동작 | ✅ 단위 + 통합 테스트 |
| 레이스 시간 | 상단 바 분모가 `종료 − 시작 − 휴식` = `08:00:00` | ✅ 통합 테스트가 HUD 문자열 검증 |
| 설정 미전송 | 아웃바운드 요청 0건 (조직 파일 GET만 허용) | ✅ `fetch` 스텁 호출 0회 테스트 |

## 프라이버시 — 정적 검사

| 항목 | 합격 기준 | 관측값 |
|---|---|---|
| 이름 노출 | 렌더 경로에 `car_id` 출력 없음 | ✅ `OK: car_id never written to DOM text` |
| 순위 UI | 렌더 레이어에 `rank`/`leaderboard`/`tower`/`<ol>` 없음 | ✅ `OK: no ranking UI in render layer` |
| 네트워크 전송 | `fetch`/`XHR`/`WebSocket` — **허용 1건 외 0건** | ⚠️ `settings.ts:loadOrgSettings`의 GET 1건. 같은 오리진 배포 자산 읽기이며 **전송 아님**. 그 외 0건 |
| 연봉 HUD 격리 | 저장·로드 경로에 네트워크 없음 | ✅ `fetch` 스텁 테스트 |

> **`director.ts`의 `ranked` 변수는 순위 UI가 아니다.** 카메라 선별 점수 정렬용 지역 변수이며 화면에 나가지 않는다. 그래서 grep 범위를 `src/render/`와 `main.ts`로 좁혔다 — 넓은 grep은 오탐만 내고 게이트를 무의미하게 만든다.

## 렌더 규칙 — 정적 검사

| 항목 | 합격 기준 | 관측값 |
|---|---|---|
| SVG `transform` 속성 | 0건 (CSS `transform`만) | ✅ `OK: no SVG transform attribute` |
| jsdom 비호환 기하 API | `getBBox` 등 0건 | ✅ `OK: none` |
| 노드 풀링 | 반복 렌더에 노드 수 불변 | ✅ 300프레임 후 노드 수 동일 (테스트) |
| DOM 무한 증가 | 1,000프레임 후 노드 수 불변 | ✅ 통합 테스트 |

## 모델 카탈로그 — 더미 데이터의 단가 출처

| 항목 | 합격 기준 | 관측값 |
|---|---|---|
| 공급자 커버리지 | 6개 (anthropic / openai / google / xai / deepseek / moonshot) | ✅ 18개 모델 |
| 가격 출처 명시 | 모든 항목에 `priceSource` + `sourceUrl` | ✅ 테스트가 강제 |
| 검증된 가격 | 공식 문서에서 직접 확인 | ✅ 16 / 18 |
| **미검증 가격** | 자리표시자임을 표시 | ⚠️ **2건: `kimi-k3`, `kimi-k2.6`** — Moonshot 가격표가 클라이언트 렌더라 값 미확보 |
| 클래스 밴드 | H > P > GT가 출력 단가로 겹치지 않음 | ✅ 테스트가 강제 |
| 비용 계산 | 이벤트 `cost_usd`가 그 모델 단가와 일치 | ✅ 시뮬레이터·픽스처 양쪽 테스트 |

> **`kimi-*` 두 항목의 숫자는 실측이 아니다.** 실 LiteLLM 연동 전에 Moonshot 공식 가격으로 교체해야 한다. §16 Q9로 등록.

## 프리셋 동작

| 항목 | 합격 기준 | 관측값 |
|---|---|---|
| `busy` | 차량이 상태에 등록되고 트랙에 렌더된다 | ✅ 통합 테스트 (육안 확인 미실시) |
| `sparse` | 화면이 비어 보이지 않는다. 카드가 폴백으로 채워진다 | ✅ 통합 테스트 (육안 확인 미실시) |
| `chaos` | 라디오가 발화한다 | ✅ 통합 테스트 (발화 속도 육안 확인 미실시) |

---

## ❌ 미측정 — 출시 전 반드시 수행

**이 항목들은 자동 테스트로 대체 불가능하다. 통과했다고 적지 않는다.**

| 항목 | 합격 기준 | 왜 미측정인가 |
|---|---|---|
| 120대 프레임률 | 평균 ≥ 55fps | 실제 브라우저 + DevTools Performance 30초 녹화 필요 |
| **Layout 이벤트** | 프레임당 0회 | 동상. **0이 아니면 Canvas 전환 검토** |
| Paint 이벤트 | 차량 이동만으로 반복 페인트 없음 | 동상 |
| 8시간 힙 증가 | ≤ 50MB | 8시간 연속 구동 필요. 5분 데모로는 아무것도 안 보인다 |
| 흑백 인쇄 | 그레이스케일에서 클래스가 형태로 구분 | 스크린샷 + 변환 필요 |
| 색각 시뮬레이션 | deuteranopia에서 클래스 구분 가능 | DevTools Rendering 패널 필요 |
| 새 레이스 / 이어하기 | 새로고침 동작 확인 | 실제 브라우저 세션 필요 |
| 라디오 가독성 | `chaos`에서 읽을 수 있는 속도 | 사람의 판단이 필요 |

### 실행 방법

```bash
cd pitwall && npm run dev
```

프리셋은 `localStorage`의 `pitwall.settings`에 `{"preset":"chaos"}` 형태로 넣어 바꾼다.

```bash
# 정적 게이트 재실행
npm test && npx tsc --noEmit && npm run build
rg -i 'rank|leaderboard|timing-tower|<ol' src/render/ src/main.ts || echo "OK: no ranking UI"
rg "setAttribute\(['\"]transform" src/ || echo "OK: no SVG transform attribute"
rg 'getBBox|getComputedTextLength|createSVGPoint|getScreenCTM' src/ || echo "OK: no jsdom-hostile geometry"
```

---

## v1 범위에서 제외한 것

| 항목 | 사유 |
|---|---|
| 일일 브리핑 (PRD §10.4) | 일별 집계 테이블이 필요하다. v1은 시뮬레이터라 소스가 없다 |
| 레이아웃 B (PRD §6.2) | v1.5 대안으로 명시된 비목표 |
| 이스터에그 `ehvkals` | 음원 라이선스 미확보 |
| 설정 UI | Task 19는 병합·하한까지. UI는 `localStorage` 직접 편집으로 대체 |
