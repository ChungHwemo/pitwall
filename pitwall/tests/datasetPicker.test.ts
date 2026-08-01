import { describe, it, expect, beforeEach } from 'vitest';
import { DatasetPicker } from '../src/render/datasetPicker';
import type { Dataset } from '../src/config/datasets';

const SETS: Dataset[] = [
  { id: 'real', label: '실기록', synthetic: false, events: [] },
  { id: 'demo', label: '데모 · 중규모', synthetic: true, events: [] },
];

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>';
  host = document.getElementById('host')!;
});

describe('DatasetPicker', () => {
  it('고를 수 있는 것을 모두 보여준다', () => {
    new DatasetPicker(host, SETS, 'real', () => {});
    const options = [...host.querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual(['실기록', '데모 · 중규모']);
  });

  it('지어낸 데이터는 화면이 밝힌다 — 실기록과 헷갈리면 안 된다', () => {
    new DatasetPicker(host, SETS, 'demo', () => {});
    expect(host.textContent).toContain('지어낸 데이터');
    expect(host.querySelector('.dataset')!.getAttribute('data-synthetic')).toBe('true');
  });

  it('실기록일 때는 경고를 붙이지 않는다', () => {
    new DatasetPicker(host, SETS, 'real', () => {});
    expect(host.textContent).not.toContain('지어낸 데이터');
    expect(host.querySelector('.dataset')!.getAttribute('data-synthetic')).toBe('false');
  });

  it('고르면 알린다', () => {
    let picked = '';
    new DatasetPicker(host, SETS, 'real', (id) => { picked = id; });
    const select = host.querySelector('select')!;
    select.value = 'demo';
    select.dispatchEvent(new Event('change'));
    expect(picked).toBe('demo');
  });

  it('고를 게 하나뿐이면 목록을 띄우지 않는다', () => {
    new DatasetPicker(host, [SETS[0]!], 'real', () => {});
    expect(host.querySelector('select')).toBeNull();
    expect(host.textContent).toContain('실기록');
  });

  it('둘 이상이면 .dataset-select 드롭다운이 뜬다', () => {
    // 기본 빌드가 데모를 여러 벌 심으면 이 목록이 나와야 한다 — 예전처럼
    // 가짜 `실시간` 한 줄이 아니라 고를 수 있는 화면이어야 한다.
    new DatasetPicker(host, SETS, 'demo', () => {});
    expect(host.querySelector('.dataset-select')).not.toBeNull();
  });
});

describe('설명', () => {
  it('무엇을 고르는 칸인지 밝힌다', () => {
    new DatasetPicker(host, SETS, 'real', () => {});
    expect(host.querySelector('.dataset')!.getAttribute('title')).toBeTruthy();
  });

  it('실시간은 무엇인지 따로 말한다', () => {
    const withLive: Dataset[] = [
      { id: 'live', label: '실시간', synthetic: false, events: [] }, ...SETS,
    ];
    new DatasetPicker(host, withLive, 'live', () => {});
    expect(host.querySelector('.dataset')!.getAttribute('title')).toContain('지금');
  });
});
