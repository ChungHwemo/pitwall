import { describe, it, expect } from 'vitest';
import { LIVE_ID, pickDataset } from '../src/config/datasets';

const SETS = [
  { id: LIVE_ID, label: '실시간' },
  { id: 'demo-small', label: '데모 · 소규모' },
  { id: 'demo', label: '데모 · 중규모' },
];

describe('pickDataset', () => {
  it('저장된 선택이 있으면 환경보다 앞선다', () => {
    expect(pickDataset(SETS, 'demo', true)?.id).toBe('demo');
    expect(pickDataset(SETS, LIVE_ID, false)?.id).toBe(LIVE_ID);
  });

  it('네이티브 첫 실행은 실시간이다 — 브리지가 있는데 데모로 열리면 LIVE가 영영 안 붙는다', () => {
    expect(pickDataset(SETS, null, true)?.id).toBe(LIVE_ID);
    expect(pickDataset(SETS, '', true)?.id).toBe(LIVE_ID);
  });

  it('브라우저 첫 실행은 데모다 — 브리지 없이 LIVE라고 가장하지 않는다', () => {
    expect(pickDataset(SETS, null, false)?.id).toBe('demo-small');
  });

  it('저장이 목록에 없으면 없는 것과 같다', () => {
    expect(pickDataset(SETS, 'gone', true)?.id).toBe(LIVE_ID);
    expect(pickDataset(SETS, 'gone', false)?.id).toBe('demo-small');
  });
});
