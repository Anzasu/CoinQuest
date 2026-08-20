import { format, parseISO } from 'date-fns';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDateDisplay(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'dd/MM/yyyy');
  } catch {
    return isoDate;
  }
}

export function formatMonthYear(month: number, year: number): string {
  return `${monthName(month)} ${year}`;
}

export function currentMonth(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export interface MonthYear {
  month: number;
  year: number;
}

export function shiftMonth(value: MonthYear, offset: number): MonthYear {
  const date = new Date(value.year, value.month - 1 + offset, 1);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

export function resolveNewMonthTarget(
  current: MonthYear,
  currentExists: boolean,
  nextExists: boolean,
): { month: number; year: number } | null {
  if (!currentExists) return current;
  if (nextExists) return null;

  return current.month === 12
    ? { month: 1, year: current.year + 1 }
    : { month: current.month + 1, year: current.year };
}

export function listAvailableNewMonthTargets(current: MonthYear, existing: MonthYear[]): MonthYear[] {
  const existingKeys = new Set(existing.map((value) => `${value.year}-${value.month}`));
  const currentExists = existingKeys.has(`${current.year}-${current.month}`);
  const next = shiftMonth(current, 1);
  const nextExists = existingKeys.has(`${next.year}-${next.month}`);
  const automaticTarget = resolveNewMonthTarget(current, currentExists, nextExists);
  const previousMonths = Array.from({ length: 12 }, (_, index) => shiftMonth(current, -(index + 1)));

  return [automaticTarget, ...previousMonths]
    .filter((value): value is MonthYear => value != null)
    .filter((value) => !existingKeys.has(`${value.year}-${value.month}`));
}
