import { describe, it, expect } from 'vitest';
import {
  CLASS_STYLE, SEVERITY_COLOR, BACKGROUND, contrastRatio, relativeLuminance,
  TRACK_COLOR, EVENT_POLARITY_COLOR, ACCENT_DELTA, CONTRIBUTION_STEPS,
} from '../src/config/theme';
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

describe('TRACK_COLOR', () => {
  it('중심선 대비가 배경 대비 2.5:1 이상이다', () => {
    expect(contrastRatio(TRACK_COLOR.centerline, BACKGROUND)).toBeGreaterThanOrEqual(2.5);
  });

  it('피트레인 대비가 2.0:1 이상이고 중심선보다 어둡다', () => {
    expect(contrastRatio(TRACK_COLOR.pitLane, BACKGROUND)).toBeGreaterThanOrEqual(2.0);
    expect(relativeLuminance(TRACK_COLOR.pitLane)).toBeLessThan(relativeLuminance(TRACK_COLOR.centerline));
  });

  it('마커 색이 기존 체커드 플래그 값과 같다', () => {
    expect(TRACK_COLOR.markerDark).toBe('#11161d');
    expect(TRACK_COLOR.markerLight).toBe('#e8edf3');
  });

  it('섹터 색이 6자리 hex다', () => {
    expect(TRACK_COLOR.sector).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('EVENT_POLARITY_COLOR', () => {
  it('positive/caution/neutral 세 극성이 정의되어 있다', () => {
    expect(Object.keys(EVENT_POLARITY_COLOR).sort()).toEqual(['caution', 'neutral', 'positive']);
  });

  it('caution이 SEVERITY_COLOR.warn과 같은 계열이다 — 표면 간 빨강 의미가 어긋나지 않는다', () => {
    expect(SEVERITY_COLOR.warn).toBe(EVENT_POLARITY_COLOR.caution);
  });
});

describe('ACCENT_DELTA — 따뜻한 노랑 단일 액센트', () => {
  it('F2C744 계열이다', () => {
    expect(ACCENT_DELTA.toLowerCase()).toBe('#f2c744');
  });

  it('GT 클래스와 warn 상태는 ACCENT_DELTA를 쓰지 않는다', () => {
    expect(CLASS_STYLE.GT.color.toLowerCase()).not.toBe(ACCENT_DELTA.toLowerCase());
    expect(SEVERITY_COLOR.warn.toLowerCase()).not.toBe(ACCENT_DELTA.toLowerCase());
  });
});

describe('GT 클래스 — 색만 이동, 형태는 유지', () => {
  it('보라 계열 색상이고 사각형 배지를 유지한다', () => {
    expect(CLASS_STYLE.GT.shape).toBe('square');
    expect(contrastRatio(CLASS_STYLE.GT.color, BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('CONTRIBUTION_STEPS — 기여도 그리드 강도 램프', () => {
  it('5단이다 — tokscale 레시피와 같다', () => {
    expect(CONTRIBUTION_STEPS).toHaveLength(5);
  });

  it('모든 단이 6자리 hex다', () => {
    for (const step of CONTRIBUTION_STEPS) expect(step).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('어두운 쪽에서 밝은 쪽으로 단조 증가한다', () => {
    const lums = CONTRIBUTION_STEPS.map(relativeLuminance);
    for (let i = 1; i < lums.length; i++) expect(lums[i]!).toBeGreaterThan(lums[i - 1]!);
  });

  it('따뜻한 노랑(ACCENT_DELTA·ffd24d) 계열을 쓰지 않는다', () => {
    const banned = new Set(['#f2c744', '#ffd24d']);
    for (const step of CONTRIBUTION_STEPS) expect(banned.has(step.toLowerCase())).toBe(false);
    expect(CONTRIBUTION_STEPS.map((s) => s.toLowerCase())).not.toContain(ACCENT_DELTA.toLowerCase());
  });
});
