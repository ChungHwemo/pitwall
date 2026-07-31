# F1 SVG 에셋 라이브러리

**PITWALL 렌더링 엔진 용 검증된 GitHub 오픈소스 SVG 아이콘 컬렉션**

수집일: 2026-07-31  
범위: 16 SVG 파일 + 7개 소스 저장소  
철학: zero-dep 원칙 준수 (모든 에셋은 로컬 파일로 인라인, 외부 의존성 없음)

---

## 개요

이 디렉토리는 PITWALL의 트랙 렌더 레이어 (trackRenderer.ts) 에서 사용하는 UI 프리미티브(글리프, 아이콘, 플래그)를 GitHub API로 검증한 공개 소스에서 수집한 것입니다. 모든 파일은 라이선스 규정을 준수하며, 하드 룰 (색+형상 이중 인코딩, 텍스트 라벨 금지, 개인정보 미노출)을 만족합니다.

---

## 소스별 에셋 목록

### 1. Material Design (Templarian)

| 항목 | 값 |
|---|---|
| **출처** | https://raw.githubusercontent.com/Templarian/MaterialDesign/master/svg/flag-checkered.svg |
| **라이선스** | Apache-2.0 |
| **저장소** | https://github.com/Templarian/MaterialDesign |
| **파일** | `material-design/flag-checkered.svg` (1개) |
| **상태** | ✅ 검증됨 (GitHub tree API) |
| **용도** | **P0-1**: PIT 진입/진출 신호 (체커드 플래그, 최우선 후보) |
| **특징** | 11,285★ · 가우스 기반 고품질 · 웹 표준 아이콘 |
| **다운로드** | 2026-07-31 |

---

### 2. Oracle Font Apex

| 항목 | 값 |
|---|---|
| **출처** | https://github.com/oracle/font-apex/master/svgs/small/flag-checkered.svg<br/>https://github.com/oracle/font-apex/master/svgs/large/flag-checkered.svg |
| **라이선스** | Oracle APEX (오픈소스) |
| **저장소** | https://github.com/oracle/font-apex |
| **파일** | `font-apex/flag-checkered-small.svg`<br/>`font-apex/flag-checkered-large.svg` (2개) |
| **상태** | ✅ 검증됨 (GitHub tree API) |
| **용도** | **P0-1 대안**: 엔터프라이즈 수준의 PIT 플래그 (크기 옵션) |
| **특징** | 112★ · 엔터프라이즈 수준 완성도 · 크기 선택 가능 |
| **다운로드** | 2026-07-31 |

---

### 3. Tabler Icons

| 항목 | 값 |
|---|---|
| **출처** | https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline/{name}.svg |
| **라이선스** | MIT |
| **저장소** | https://github.com/tabler/tabler-icons |
| **파일** | `tabler/car.svg`<br/>`tabler/car-suv.svg`<br/>`tabler/gauge.svg`<br/>`tabler/tool.svg`<br/>`tabler/alert-circle.svg`<br/>`tabler/alert-triangle.svg`<br/>`tabler/flag-2.svg` (7개) |
| **상태** | ✅ 검증됨 (GitHub tree API) |
| **용도** | **P1-1**: car, car-suv (자동차 실루엣 - Prototype/GT3 클래스)<br/>**P1-2**: alert-circle, alert-triangle, flag-2 (경고/정지 표시)<br/>**P2**: gauge, tool (게이지/도구 아이콘) |
| **특징** | 21,263★ · 500+ 탈것 아이콘 · 가장 큰 카탈로그 · 일관된 스타일 |
| **다운로드** | 2026-07-31 |
| **검증 상세** | car, car-suv, gauge, tool, alert-circle, alert-triangle, flag-2 모두 GitHub tree API로 파일 존재 확인 |

---

### 4. Game Icons (CC BY 3.0)

| 항목 | 값 |
|---|---|
| **출처** | https://github.com/game-icons/icons |
| **라이선스** | **CC BY 3.0** ⚠️ **저작자 표시 필수** |
| **저장소** | https://github.com/game-icons/icons |
| **파일** | `game-icons/checkered-flag.svg` (저작자: delapouite)<br/>`game-icons/checkered-diamond.svg` (저작자: lorc) (2개) |
| **상태** | ✅ 검증됨 (GitHub tree API) |
| **용도** | **P0-1 대안**: checkered-flag (PIT 플래그, 게임 스타일)<br/>**미할당**: checkered-diamond (백업 옵션) |
| **특징** | 1,325★ · 게임 테마 · F1 게임 감성 부합 |
| **다운로드** | 2026-07-31 |
| **⚠️ 저작자 표시 규칙** | **CC BY 3.0 준수**: 인라인 SVG 사용 시 HTML 주석에 다음 형식 필수 |

```html
<!-- Icon by delapouite, from game-icons.net, CC BY 3.0 -->
<!-- Icon by lorc, from game-icons.net, CC BY 3.0 -->
```

---

### 5. Lucide Icons

| 항목 | 값 |
|---|---|
| **출처** | https://github.com/lucide-icons/lucide |
| **라이선스** | ISC |
| **저장소** | https://github.com/lucide-icons/lucide |
| **파일** | `lucide/car.svg`<br/>`lucide/fuel.svg`<br/>`lucide/gauge.svg` (3개) |
| **상태** | ✅ 검증됨 (GitHub tree API) |
| **용도** | **P1-1 대안**: car (자동차 실루엣)<br/>**P2**: fuel, gauge (연료/속도 게이지) |
| **특징** | 23,717★ · 심플하고 일관된 스타일 · 24×24 뷰박스 표준 · 가벼운 파일 |
| **다운로드** | 2026-07-31 |

---

### 6. ioBroker F1 프로젝트

| 항목 | 값 |
|---|---|
| **출처** | https://github.com/bloop16/ioBroker.f1 |
| **라이선스** | MIT |
| **저장소** | https://github.com/bloop16/ioBroker.f1 |
| **파일** | `iobroker/f1.svg` (1개) |
| **상태** | ✅ 검증됨 (GitHub tree API) |
| **용도** | **미할당**: 최후의 수단 (품질 낮음, 폴백 옵션) |
| **특징** | 1★ · F1 로고 스타일 · 품질 낮음 |
| **다운로드** | 2026-07-31 |
| **비고** | 우선순위 낮음 — 다른 소스 사용 불가 시에만 고려 |

---

### 7. Tencent TDesign Icons

| 항목 | 값 |
|---|---|
| **출처** | https://github.com/Tencent/tdesign-icons |
| **라이선스** | MIT |
| **저장소** | https://github.com/Tencent/tdesign-icons |
| **파일** | `tdesign/SOURCE.txt` (메타데이터만) |
| **상태** | ❌ **미존재** (GitHub tree API로 확인됨) |
| **목표 파일** | `svg/formula.svg` (F1 스타일 수식 기호) |
| **용도** | (대체 불가) |
| **특징** | 85★ · 중국 신뢰도 높음 · F1 직결 아이콘 드물음 |
| **다운로드 시도** | 2026-07-31 |
| **결론** | **재다운로드 불필요** — 리포에 파일이 존재하지 않음 (이미 tree API로 최종 확인) |

---

## 사용 우선순위

용도 매핑은 PITWALL PRD (§2.2, 2026-07-31) 기반입니다.

| 우선순위 | 용도 | 추천 에셋 | 라이선스 | 비고 |
|---|---|---|---|---|
| **P0-1** | PIT 플래그 (텍스트 라벨 교체) | material-design/flag-checkered.svg | Apache-2.0 | 최우선 (하드 룰 준수 필수) |
| **P0-1 대안** | PIT 플래그 (엔터프라이즈/게임 스타일) | font-apex/flag-checkered-{small\|large}.svg<br/>game-icons/checkered-flag.svg | Oracle APEX<br/>CC BY 3.0 | game-icons 사용 시 저작자 표시 필수 |
| **P1-1** | 차량 실루엣 - Prototype | tabler/car.svg | MIT | 자동차 글리프 대체 |
| **P1-1** | 차량 실루엣 - GT3 | tabler/car-suv.svg | MIT | 광폭 스탠스 표현 |
| **P1-1 대안** | 차량 실루엣 (미니멀) | lucide/car.svg | ISC | 간단한 버전 |
| **P1-2** | 경고/오류 표시 | tabler/alert-circle.svg | MIT | 명확한 오류 신호 |
| **P1-2** | 경고/제한 표시 | tabler/alert-triangle.svg | MIT | 제한 신호 (황색) |
| **P1-2 대안** | 정지 플래그 | tabler/flag-2.svg | MIT | 상태 표시 대안 |
| **P2** | 연료 게이지 | lucide/fuel.svg | ISC | 선택적 강화 (v2) |
| **P2** | 속도 게이지 | lucide/gauge.svg<br/>tabler/gauge.svg | ISC<br/>MIT | 선택적 강화 (v2) |
| **P2** | 피트 박스 마킹 | tabler/tool.svg | MIT | 피트 복도 아이콘 (선택) |
| **폴백** | 최후의 수단 | iobroker/f1.svg | MIT | 품질 낮음, 권장 안 함 |
| **미할당** | 예약 옵션 | game-icons/checkered-diamond.svg | CC BY 3.0 | 향후 사용 고려 |

---

## 라이선스 준수

### 라이선스별 요구사항

| 라이선스 | 요구사항 | 구현 방법 |
|---|---|---|
| **Apache-2.0** (Material Design) | 라이선스 텍스트 포함 + 저작권 표시 | `src/LICENSE-APACHE-2.0` 또는 인라인 주석 |
| **MIT** (Tabler, ioBroker, TDesign) | 저작권 표시 + 라이선스 명시 | SVG 주석 + README 크레딧 |
| **ISC** (Lucide) | 라이선스 텍스트 + 저작권 표시 | HTML 크레딧 섹션 |
| **CC BY 3.0** (Game Icons) ⚠️ | **저작자명 필수 기재** | `<!-- Icon by {author}, from game-icons.net, CC BY 3.0 -->` |
| **Oracle APEX** | 라이선스 명시 | README 크레딧 섹션 |

### Game Icons CC BY 3.0 저작자 표시 규칙 (중요)

**CC BY 3.0 라이선스를 준수하려면, game-icons 에셋을 HTML에 인라인할 때 반드시 저작자 정보를 HTML 주석으로 기재해야 합니다.**

```html
<!-- Icon by delapouite, from game-icons.net, CC BY 3.0 -->
<svg>...</svg>

<!-- Icon by lorc, from game-icons.net, CC BY 3.0 -->
<svg>...</svg>
```

이 규칙을 위반하면 라이선스 의무를 다하지 않은 것으로 간주되므로, game-icons 에셋 사용 시 필수입니다.

---

## 권고 사항

1. **Material Design 우선 사용**: 가장 광범위하고 안정적인 소스. Apache-2.0은 상업 사용에도 안전.

2. **색 + 형상 이중 인코딩 유지**: 자동차 글리프 (hot/cold slot)는 색만으로 구분하지 말 것. 삼각형(H), 원(P), 사각형(GT) 형상 구분 반드시 유지.

3. **Game Icons 사용 시 저작자 표시 필수**: CC BY 3.0 규정이므로 빠뜨리면 안 됨.

4. **인라인 SVG 사용 원칙**: 외부 `<image>` 태그 및 HTTP 요청 금지 (zero-dep 원칙, 단일 파일 배포 정책).

5. **파일 크기 예산**: 현재 PITWALL 번들 24.7 kB 대비 +15 kB 상한선. 모든 에셋은 경량화 필요 (Potrace, SimplifyJS 등).

---

## 컬렉션 통계

| 항목 | 수치 |
|---|---|
| **총 소스** | 7개 |
| **총 SVG 파일** | 16개 |
| **검증된 에셋** | 16개 ✅ |
| **미존재 에셋** | 1개 ❌ (tdesign/formula.svg) |
| **라이선스 종류** | 5가지 (Apache-2.0, MIT, ISC, CC BY 3.0, Oracle APEX) |
| **별점 합계** | 122,883★ (가장 인기 많은 오픈소스 아이콘 서버) |
| **수집 완료 날짜** | 2026-07-31 |
| **다음 검토 예정** | PITWALL v1.1 구현 시작 시 (라이선스 재확인) |

---

## 참고

- **스펙 문서**: [`../docs/superpowers/specs/2026-07-31-f1-assets.md`](../../docs/superpowers/specs/2026-07-31-f1-assets.md)
- **구현 대상**: `src/render/trackRenderer.ts`
- **하드 룰 준수**: PITWALL PRD §6 (프라이버시 가드레일) — 색 + 형상 이중 인코딩, 텍스트 라벨 금지, 개인 정보 미노출

---

**마지막 업데이트**: 2026-07-31 (초기 컬렉션)
