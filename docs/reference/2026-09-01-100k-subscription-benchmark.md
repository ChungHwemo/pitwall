# [pitwall] ₩10만/월 구독 — 가격·제품 벤치마크

조사 2026-09-01. 1차 출처: 벤더 가격 페이지(insane-search `engine` ok=True) + GitHub API.
환율 가정 **1,400 KRW/USD** [중간] → ₩100,000 ≈ **$71**.

---

## 0. 결론

₩10만/월에 팔리는 LLM 도구는 **개인 CLI가 아니다.** 같은 가격대는 Helicone Pro $79, LangSmith Plus 약 2석, Langfuse Core $29의 위쪽이다. 전부 팀 좌석·수집 API·보존·지원이 있다.

tokscale은 MIT·5,232★·$0. 개인 사용량 집계에 ₩10만을 받으면 그 제품과 같은 일을 유료로 파는 것이다.

PITWALL이 ₩10만을 받으려면 **조직 벽(세컨드 모니터 1면)** 이어야 한다. 대시보드/트레이싱이 아니라 곁눈질. 그게 이 저장소의 유일한 공백이다.

---

## 1. 가격표 (1차)

| 제품 | 출처 | 스티커 | ₩ 환산 | 무엇을 파나 |
|---|---|---:|---:|---|
| tokscale | GitHub API 2026-09-01, 5,232★ MIT | $0 | 0 | 로컬 에이전트 토큰 TUI/웹. 리더보드 opt-in |
| Langfuse Cloud Core | [langfuse.com/pricing](https://langfuse.com/pricing) engine 2026-09-01 | **$29/월** | ~4.1만 | 100k units, 무제한 유저, 90일 |
| Langfuse Cloud Pro | 동일 | **$199/월** | ~27.9만 | 3년 보존, SOC2/ISO 리포트 |
| Helicone Pro | [helicone.ai/pricing](https://www.helicone.ai/pricing) engine 2026-09-01 | **$79/월** | ~11.1만 | 무제한 좌석, 알림, 1개월 보존 |
| Helicone Team | 동일 | **$799/월** | ~112만 | SOC2/HIPAA, Slack |
| LangSmith Plus | inference.net 정리(2026-06, 2차) | $39/석 | 2석≈₩10.9만 | 트레이스. 좌석제 |
| Portkey | buildmvpfast 정리(2026-07, 2차) | $49/월 | ~6.9만 | 게이트웨이 |
| LiteLLM OSS | [litellm.ai/pricing](https://www.litellm.ai/pricing) engine 2026-09-01 | $0 self-host | 0 | 프록시. Enterprise는 용량 협상, 토큰당 아님 |
| LiteLLM Marketplace | Microsoft Marketplace 리스팅 | $108,000/년 | ~1,260만/년 | 70+팀 규모 플랜 설명 |

₩10만은 **Helicone Pro와 한 칸**. Core 트레이싱($29)보다 비싸고, Pro 컴플라이언스($199)보다 싸다.

---

## 2. ₩10만에 들어 있는 것 / 없는 것

Helicone Pro·Langfuse Core가 공통으로 파는 것:

- 멀티 유저
- 수집 API (프록시 또는 SDK)
- 보존 기간
- 알림
- 이용약관·프라이버시 페이지
- 셀프서브 결제
- 지원 창구

안 파는 것: 세컨드 모니터 앰비언트, F1 은유, 곁눈질 3초.

PITWALL 출하물(로컬 HTML + ad-hoc 앱, 계정 1–3대, 서버 0, 결제 0)은 **$0 칸**에 있다. tokscale이 이미 그 칸을 채운다.

---

## 3. 채택 / 기각

| 가져올 것 | 이유 |
|---|---|
| 가격 앵커 = 조직 벽 1면 정액 ₩10만 | Helicone Pro와 같은 「팀 한 줄」. 좌석제가 되면 순위 압력이 생긴다 (PRIV-5′) |
| 약관·프라이버시 URL, 지원 메일 | $79 제품의 최소 포장 |
| 만료 있는 라이선스 | 월구독의 도메인. 결제 사업자보다 먼저 시계 |

| 기각 | 이유 |
|---|---|
| 개인 월 ₩10만 | tokscale $0과 같은 일 |
| LangSmith식 좌석제 | 사람=좌석=순위 유혹. G4 사망 |
| 트레이스/프롬프트 본문 | PRIV-4. Langfuse 영역 |
| ₩10만을 「지금 출하 HTML」에 붙이기 | 서명·SLA·조직 데이터 없음 |

---

## 4. 신뢰도

- Langfuse $29/$199, Helicone Hobby/Pro/Team, LiteLLM OSS $0: **[높음]** 공식 페이지 engine 성공.
- LangSmith $39/석, Portkey $49: **[중간]** 2026-06/07 2차 정리. 공식 페이지를 이 세션에서 끝까지 인용하지 않음.
- 환율 1,400: **[중간]** 가정. 가격 카피는 원 통화+원화를 같이 쓴다.
