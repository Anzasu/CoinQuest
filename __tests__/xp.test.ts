import {
  calculateLevel,
  levelThreshold,
  levelProgress,
  xpToNextLevel,
  sumXp,
} from '../src/lib/xp';

describe('levelThreshold', () => {
  test('level 1 threshold is 0', () => {
    expect(levelThreshold(1)).toBe(0);
  });

  test('level 2 threshold is 200 (base 100 * level)', () => {
    // threshold(2) = 100 * (2*3/2 - 1) = 100 * 2 = 200
    expect(levelThreshold(2)).toBe(200);
  });

  test('level 3 threshold', () => {
    // threshold(3) = 100 * (3*4/2 - 1) = 100 * 5 = 500
    expect(levelThreshold(3)).toBe(500);
  });

  test('level 4 threshold', () => {
    // threshold(4) = 100 * (4*5/2 - 1) = 100 * 9 = 900
    expect(levelThreshold(4)).toBe(900);
  });

  test('level 5 threshold', () => {
    // threshold(5) = 100 * (5*6/2 - 1) = 100 * 14 = 1400
    expect(levelThreshold(5)).toBe(1400);
  });

  test('thresholds are monotonically increasing', () => {
    for (let i = 1; i < 20; i++) {
      expect(levelThreshold(i + 1)).toBeGreaterThan(levelThreshold(i));
    }
  });
});

describe('calculateLevel', () => {
  test('0 XP = level 1', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  test('199 XP = level 1', () => {
    expect(calculateLevel(199)).toBe(1);
  });

  test('200 XP = level 2', () => {
    expect(calculateLevel(200)).toBe(2);
  });

  test('499 XP = level 2', () => {
    expect(calculateLevel(499)).toBe(2);
  });

  test('500 XP = level 3', () => {
    expect(calculateLevel(500)).toBe(3);
  });

  test('large XP always returns a valid level', () => {
    const level = calculateLevel(100000);
    expect(level).toBeGreaterThan(1);
  });
});

describe('levelProgress', () => {
  test('exactly at level 1 start = 0 progress', () => {
    expect(levelProgress(0)).toBe(0);
  });

  test('halfway through level 1', () => {
    // Level 1: 0 → 200. At 100 → 50%
    expect(levelProgress(100)).toBeCloseTo(0.5);
  });

  test('at threshold = start of new level = 0 progress', () => {
    // At level 2 threshold = 200, progress in level 2 = 0
    expect(levelProgress(200)).toBe(0);
  });

  test('progress is between 0 and 1', () => {
    for (const xp of [0, 50, 200, 501, 900, 1400, 2100]) {
      const p = levelProgress(xp);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe('xpToNextLevel', () => {
  test('0 XP needs 200 more to reach level 2', () => {
    expect(xpToNextLevel(0)).toBe(200);
  });

  test('100 XP needs 100 more to reach level 2', () => {
    expect(xpToNextLevel(100)).toBe(100);
  });

  test('at level 2 needs 300 to reach level 3', () => {
    // threshold(2)=200, threshold(3)=500, diff=300
    expect(xpToNextLevel(200)).toBe(300);
  });
});

describe('sumXp', () => {
  test('empty array', () => {
    expect(sumXp([])).toBe(0);
  });

  test('sums correctly', () => {
    expect(sumXp([100, 50, 75, 30])).toBe(255);
  });
});
