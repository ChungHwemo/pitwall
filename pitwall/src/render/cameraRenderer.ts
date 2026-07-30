import type { CarState, RaceState } from '../types';
import { CLASS_STYLE } from '../config/theme';
import { setText } from './setText';

/** 한도 창을 사람이 읽는 단위로. 모르면 아무것도 안 붙인다. */
function windowLabel(minutes: number | undefined): string {
  if (minutes === undefined) return '';
  if (minutes % 1440 === 0) return `/${minutes / 1440}일`;
  if (minutes % 60 === 0) return `/${minutes / 60}시간`;
  return `/${minutes}분`;
}

/** 억 단위까지 가는 토큰 수를 카드 한 줄에 담는다. */
function compact(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

interface Card {
  root: HTMLElement;
  number: HTMLElement;
  klass: HTMLElement;
  stats: HTMLElement;
  carId: string | null;
}

export class CameraRenderer {
  private cards: Card[] = [];
  private pinHandler: ((carId: string) => void) | null = null;

  constructor(container: HTMLElement, slotCount: number) {
    for (let i = 0; i < slotCount; i++) {
      const root = document.createElement('div');
      root.className = 'cam-card';
      root.setAttribute('data-empty', 'true');

      const number = document.createElement('div');
      number.className = 'cam-number';
      const klass = document.createElement('div');
      klass.className = 'cam-class';
      const stats = document.createElement('div');
      stats.className = 'cam-stats';

      root.append(number, klass, stats);
      container.appendChild(root);

      const card: Card = { root, number, klass, stats, carId: null };
      root.addEventListener('click', () => {
        if (card.carId && this.pinHandler) this.pinHandler(card.carId);
      });
      this.cards.push(card);
    }
  }

  onPinToggle(handler: (carId: string) => void): void {
    this.pinHandler = handler;
  }

  render(state: RaceState, picks: string[]): void {
    this.cards.forEach((card, i) => {
      const carId = picks[i];
      const car: CarState | undefined = carId ? state.cars.get(carId) : undefined;

      if (!car) {
        card.carId = null;
        card.root.setAttribute('data-empty', 'true');
        setText(card.number, '—');
        setText(card.klass, '');
        setText(card.stats, '');
        return;
      }

      const style = CLASS_STYLE[car.car_class];
      card.carId = car.car_id;
      card.root.setAttribute('data-empty', 'false');
      // 카넘버만 쓴다. car_id 원문은 절대 화면에 넣지 않는다 (PRD PRIV-1/PRIV-3).
      setText(card.number, `#${String(car.car_number).padStart(3, '0')}`);
      // 등급 이름(HYPERCAR/PROTOTYPE)은 개발용 자리표시였다. 알고 싶은 것은
      // "이 계정이 지금 무슨 모델을 돌리는가"이므로 모델명을 쓴다. 색은 등급을
      // 계속 나타내므로 라벨과 색이 같은 사실의 두 면이다.
      setText(card.klass, car.model);
      card.klass.style.color = style.color;

      // 돈이 먼저다. 예전 첫 칸은 `FUEL %`였는데, 그 분모는 아무도 설정한 적 없는
      // 기본 일일 예산이었고 실측에서 10:01에 0%가 되어 하루의 73%를 "연료 없음"으로
      // 표시했다. 실제로 쓴 액수는 그런 가정 없이 참이다 (감사 F2).
      const parts = [`$${car.cost_usd.toFixed(2)}`];
      // 타이어는 소스가 있을 때만 게이지를 그린다 (PRD §7.0).
      // 없는 값을 0%로 표시하면 화면이 "소진됨"이라는 없는 사실을 주장한다.
      // 한도는 창 길이를 함께 쓴다. "72% 남음"만으로는 5시간인지 일주일인지 모른다.
      if (car.tyre_pct !== undefined) {
        parts.push(`LIMIT ${Math.round(car.tyre_pct)}%${windowLabel(car.limit_window_minutes)}`);
      }
      // 작업량과 캐시 재전송을 나눠 쓴다. 실측상 전체의 96.5%가 재전송이라
      // 합쳐 쓰면 화면이 실제 작업량을 수십 배로 부풀린다.
      parts.push(`WORK ${compact(car.distance)}`);
      if (car.cached > 0) parts.push(`CACHE ${compact(car.cached)}`);
      setText(card.stats, parts.join(' · '));
    });
  }
}
