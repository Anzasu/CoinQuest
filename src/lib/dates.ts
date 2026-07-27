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
