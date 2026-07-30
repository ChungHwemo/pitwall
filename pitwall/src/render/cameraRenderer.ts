import type { CarState, RaceState } from '../types';
import { CLASS_STYLE } from '../config/theme';
import { setText } from './setText';

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
      setText(card.klass, style.label);
      card.klass.style.color = style.color;

      // 타이어는 소스가 있을 때만 게이지를 그린다 (PRD §7.0).
      // 없는 값을 0%로 표시하면 화면이 "소진됨"이라는 없는 사실을 주장한다.
      const parts = [`FUEL ${Math.round(car.fuel_pct)}%`];
      if (car.tyre_pct !== undefined) parts.push(`TYRE ${Math.round(car.tyre_pct)}%`);
      parts.push(`${car.distance.toLocaleString('ko-KR')} tok`);
      setText(card.stats, parts.join(' · '));
    });
  }
}
