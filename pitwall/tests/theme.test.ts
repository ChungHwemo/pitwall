import { describe, it, expect } from 'vitest';
import { CLASS_STYLE, SEVERITY_COLOR, BACKGROUND, contrastRatio } from '../src/config/theme';
import { CAR_CLASSES } from '../src/types';

describe('CLASS_STYLE', () => {
  it('세 클래스 모두 정의되어 있다', () => {
    for (const cls of CAR_CLASSES) expect(CLASS_STYLE[cls]).toBeDefined();
  });

  it('형태가 서로 달라야 한다 — 색상 단독 인코딩 금지', () => {
    const shapes = CAR_CLASSES.map((c) => CLASS_STYLE[c].shape);
    expect(new Set(shapes).size).toBe(CAR_CLASSES.length);
  });

  it('색상도 서로 달라야 한다', () => {
    const colors = CAR_CLASSES.map((c) => CLASS_STYLE[c].color);
    expect(new Set(colors).size).toBe(CAR_CLASSES.length);
  });

  it('모든 클래스 색이 배경 대비 4.5:1 이상이다', () => {
    for (const cls of CAR_CLASSES) {
      const ratio = contrastRatio(CLASS_STYLE[cls].color, BACKGROUND);
      expect(ratio, `${cls} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('색상이 6자리 hex 형식이다', () => {
    for (const cls of CAR_CLASSES) {
      expect(CLASS_STYLE[cls].color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('SEVERITY_COLOR', () => {
  it('세 단계 모두 정의되어 있다', () => {
    expect(Object.keys(SEVERITY_COLOR).sort()).toEqual(['critical', 'info', 'warn']);
  });

  it('모든 심각도 색이 배경 대비 4.5:1 이상이다', () => {
    for (const [name, color] of Object.entries(SEVERITY_COLOR)) {
      expect(contrastRatio(color, BACKGROUND), `${name} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('contrastRatio', () => {
  it('흑백 대비는 21:1이다', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('같은 색 대비는 1:1이다', () => {
    expect(contrastRatio('#3366cc', '#3366cc')).toBeCloseTo(1, 6);
  });

  it('인자 순서와 무관하다', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#000000'), 6);
  });

  it('잘못된 hex를 거부한다', () => {
    expect(() => contrastRatio('red', BACKGROUND)).toThrow('invalid hex color');
  });
});
