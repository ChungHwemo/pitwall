import type { TrackModel } from '../track/trackModel';
import { EVENT_POLARITY_COLOR } from '../config/theme';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createBroadcastOverflow(
  container: SVGSVGElement,
): (model: TrackModel) => void {
  const entries = [
    { key: 'H', x: 24 },
    { key: 'P', x: 94 },
    { key: 'GT', x: 164 },
    { key: 'hot', x: 244 },
  ] as const;
  const nodes = entries.map(({ key, x }) => {
    const node = document.createElementNS(SVG_NS, 'text');
    node.setAttribute('class', 'broadcast-overflow');
    node.dataset['overflow'] = key;
    node.setAttribute('x', String(x));
    node.setAttribute('y', '970');
    node.setAttribute('fill', EVENT_POLARITY_COLOR.neutral);
    node.setAttribute('font-size', '24');
    node.style.opacity = '0';
    container.appendChild(node);
    return { key, node };
  });

  return (model): void => {
    for (const { key, node } of nodes) {
      const count = key === 'hot' ? model.hotOverflow : model.laneOverflow[key];
      node.textContent = count > 0 ? `${key.toUpperCase()} +${count}` : '';
      node.style.opacity = count > 0 ? '1' : '0';
    }
  };
}
