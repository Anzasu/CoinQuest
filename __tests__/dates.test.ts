import { resolveNewMonthTarget } from '../src/lib/dates';

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