import {
  splitSalary,
  remainingAfterBills,
  calculateDonationGoal,
  parseEuroInput,
  formatCents,
  centsToInputString,
  budgetStatus,
  verifySplit,
} from '../src/lib/money';

// ──────────────────────────────────────────
// splitSalary
// ──────────────────────────────────────────

describe('splitSalary', () => {
  test('exact quarter — no rounding needed', () => {
    const s = splitSalary(4000);
    expect(s).toEqual({ partA: 1000, partB: 1000, partC: 1000, partD: 1000 });
    expect(verifySplit(4000, s)).toBe(true);
  });

  test('1 extra cent goes to A', () => {
    const s = splitSalary(4001);
    expect(s).toEqual({ partA: 1001, partB: 1000, partC: 1000, partD: 1000 });
    expect(verifySplit(4001, s)).toBe(true);
  });

  test('2 extra cents go to A and B', () => {
    const s = splitSalary(4002);
    expect(s).toEqual({ partA: 1001, partB: 1001, partC: 1000, partD: 1000 });
    expect(verifySplit(4002, s)).toBe(true);
  });

  test('3 extra cents go to A, B, C', () => {
    const s = splitSalary(4003);
    expect(s).toEqual({ partA: 1001, partB: 1001, partC: 1001, partD: 1000 });
    expect(verifySplit(4003, s)).toBe(true);
  });

  test('real-world salary: €3,000.00 gross', () => {
    // 300000 cents
    const s = splitSalary(300000);
    expect(s.partA + s.partB + s.partC + s.partD).toBe(300000);
    expect(s.partA).toBe(75000); // €750.00
    expect(verifySplit(300000, s)).toBe(true);
  });

  test('odd amount: €2,125.44 = 212544 cents', () => {
    const s = splitSalary(212544);
    expect(verifySplit(212544, s)).toBe(true);
    // 212544 / 4 = 53136, remainder = 0
    expect(s.partA).toBe(53136);
    expect(s.partD).toBe(53136);
  });

  test('odd amount: 10001 cents (1 extra → A gets +1)', () => {
    const s = splitSalary(10001);
    expect(s.partA).toBe(2501);
    expect(s.partB).toBe(2500);
    expect(s.partC).toBe(2500);
    expect(s.partD).toBe(2500);
    expect(verifySplit(10001, s)).toBe(true);
  });

  test('zero salary', () => {
    const s = splitSalary(0);
    expect(s).toEqual({ partA: 0, partB: 0, partC: 0, partD: 0 });
  });

  test('throws on negative', () => {
    expect(() => splitSalary(-1)).toThrow(RangeError);
  });
});

// ──────────────────────────────────────────
// remainingAfterBills
// ──────────────────────────────────────────

describe('remainingAfterBills', () => {
  test('basic subtraction', () => {
    expect(remainingAfterBills(300000, 87500)).toBe(212500);
  });

  test('no bills', () => {
    expect(remainingAfterBills(300000, 0)).toBe(300000);
  });

  test('throws when bills exceed salary', () => {
    expect(() => remainingAfterBills(100, 200)).toThrow(RangeError);
  });

  test('exact match', () => {
    expect(remainingAfterBills(1000, 1000)).toBe(0);
  });
});

// ──────────────────────────────────────────
// calculateDonationGoal
// ──────────────────────────────────────────

describe('calculateDonationGoal', () => {
  test('25% of Part D, exact', () => {
    expect(calculateDonationGoal(40000)).toBe(10000);
  });

  test('floors the result', () => {
    // 10001 / 4 = 2500.25 → floor = 2500
    expect(calculateDonationGoal(10001)).toBe(2500);
  });

  test('zero', () => {
    expect(calculateDonationGoal(0)).toBe(0);
  });

  test('real example: Part D = €531,36 = 53136 cents → goal = 13284 (€132,84)', () => {
    expect(calculateDonationGoal(53136)).toBe(13284);
  });
});

// ──────────────────────────────────────────
// parseEuroInput
// ──────────────────────────────────────────

describe('parseEuroInput', () => {
  test('integer string', () => {
    expect(parseEuroInput('12')).toBe(1200);
  });

  test('comma decimal', () => {
    expect(parseEuroInput('12,34')).toBe(1234);
  });

  test('period is thousands separator in European format: 12.34 = 1234 euros', () => {
    // In European format, the dot is a thousands separator (not decimal).
    // "12.34" is read as the number 1234, i.e. €1.234,00 = 123400 cents.
    expect(parseEuroInput('12.34')).toBe(123400);
  });

  test('European thousands separator: 1.234,56', () => {
    // Dots are thousands separators → removed → "1234,56" → "1234.56" → 123456
    expect(parseEuroInput('1.234,56')).toBe(123456);
  });

  test('empty string returns null', () => {
    expect(parseEuroInput('')).toBeNull();
  });

  test('invalid string returns null', () => {
    expect(parseEuroInput('abc')).toBeNull();
  });

  test('negative returns null', () => {
    expect(parseEuroInput('-10')).toBeNull();
  });

  test('zero', () => {
    expect(parseEuroInput('0')).toBe(0);
  });

  test('0,00', () => {
    expect(parseEuroInput('0,00')).toBe(0);
  });
});

// ──────────────────────────────────────────
// formatCents
// ──────────────────────────────────────────

describe('formatCents', () => {
  test('zero', () => {
    expect(formatCents(0)).toBe('€0,00');
  });

  test('round number', () => {
    expect(formatCents(100000)).toBe('€1.000,00');
  });

  test('with cents', () => {
    expect(formatCents(123456)).toBe('€1.234,56');
  });

  test('small amount under €1', () => {
    expect(formatCents(99)).toBe('€0,99');
  });

  test('negative amount', () => {
    expect(formatCents(-5000)).toBe('-€50,00');
  });
});

// ──────────────────────────────────────────
// budgetStatus
// ──────────────────────────────────────────

describe('budgetStatus', () => {
  test('under budget', () => {
    expect(budgetStatus(10000, 9999)).toBe('under');
  });

  test('exactly at limit = under', () => {
    expect(budgetStatus(10000, 10000)).toBe('under');
  });

  test('over budget', () => {
    expect(budgetStatus(10000, 10001)).toBe('over');
  });
});

// ──────────────────────────────────────────
// Full flow integration test
// ──────────────────────────────────────────

describe('full monthly flow', () => {
  test('salary split + donation goal are consistent', () => {
    const salary = 350000; // €3,500
    const bills = 87500;  // €875
    const remaining = remainingAfterBills(salary, bills);
    expect(remaining).toBe(262500); // €2,625

    const split = splitSalary(remaining);
    expect(verifySplit(remaining, split)).toBe(true);
    // Each part = 65625 (exactly divisible)
    expect(split.partA).toBe(65625);

    const donationGoal = calculateDonationGoal(split.partD);
    expect(donationGoal).toBe(16406); // floor(65625 / 4)
  });

  test('3-cent rounding scenario', () => {
    // Remaining = 100003 → base = 25000, extra = 3
    const s = splitSalary(100003);
    expect(s.partA).toBe(25001);
    expect(s.partB).toBe(25001);
    expect(s.partC).toBe(25001);
    expect(s.partD).toBe(25000);
    expect(verifySplit(100003, s)).toBe(true);
  });
});
