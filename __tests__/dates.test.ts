import { listAvailableNewMonthTargets, resolveNewMonthTarget } from '../src/lib/dates';

describe('resolveNewMonthTarget', () => {
  const current = { month: 8, year: 2026 };

  test('chooses the current month when it does not exist', () => {
    expect(resolveNewMonthTarget(current, false, false)).toEqual(current);
  });

  test('chooses the next month when the current month exists', () => {
    expect(resolveNewMonthTarget(current, true, false)).toEqual({ month: 9, year: 2026 });
  });

  test('returns no target when the current and next months exist', () => {
    expect(resolveNewMonthTarget(current, true, true)).toBeNull();
  });

  test('rolls December over to January of the next year', () => {
    expect(resolveNewMonthTarget({ month: 12, year: 2026 }, true, false)).toEqual({
      month: 1,
      year: 2027,
    });
  });
});

describe('listAvailableNewMonthTargets', () => {
  const current = { month: 2, year: 2026 };

  test('lists the current month followed by exactly twelve previous months', () => {
    const targets = listAvailableNewMonthTargets(current, []);

    expect(targets).toHaveLength(13);
    expect(targets[0]).toEqual(current);
    expect(targets[1]).toEqual({ month: 1, year: 2026 });
    expect(targets[12]).toEqual({ month: 2, year: 2025 });
  });

  test('lists next month first when current exists', () => {
    const targets = listAvailableNewMonthTargets(current, [current]);

    expect(targets[0]).toEqual({ month: 3, year: 2026 });
  });

  test('still offers missing previous months when current and next exist', () => {
    const targets = listAvailableNewMonthTargets(current, [current, { month: 3, year: 2026 }]);

    expect(targets[0]).toEqual({ month: 1, year: 2026 });
    expect(targets).toHaveLength(12);
  });

  test('excludes previous months that already exist', () => {
    const targets = listAvailableNewMonthTargets(current, [
      { month: 1, year: 2026 },
      { month: 12, year: 2025 },
    ]);

    expect(targets).not.toContainEqual({ month: 1, year: 2026 });
    expect(targets).not.toContainEqual({ month: 12, year: 2025 });
  });
});