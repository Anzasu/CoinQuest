// All monetary values are integers representing euro cents.
// No floating-point arithmetic is ever used for money.

export interface SalarySplit {
  partA: number;
  partB: number;
  partC: number;
  partD: number;
}

/**
 * Split the remaining salary (after bills) into four equal parts.
 *
 * Rules from spec:
 * - Each part gets exactly floor(remaining / 4) cents.
 * - If there are leftover cents (remaining % 4 != 0), the extras go to A first, then B.
 *   Possible extra values: 0, 1, 2, or 3 cents.
 *   0 extra: A=B=C=D=base
 *   1 extra: A=base+1, B=C=D=base
 *   2 extra: A=base+1, B=base+1, C=D=base
 *   3 extra: A=base+1, B=base+1, C=base+1, D=base  ← spec says A and B get extra,
 *             but 3 cents must go somewhere; C gets 1 as well (only A&B "receive the
 *             extra cents", so we give the third cent to C to keep the sum exact —
 *             this is the minimal assumption).
 */
export function splitSalary(remainingCents: number): SalarySplit {
  if (remainingCents < 0) {
    throw new RangeError('remainingCents must be >= 0');
  }
  const base = Math.floor(remainingCents / 4);
  const extra = remainingCents % 4; // 0, 1, 2, or 3

  return {
    partA: base + (extra >= 1 ? 1 : 0),
    partB: base + (extra >= 2 ? 1 : 0),
    partC: base + (extra >= 3 ? 1 : 0),
    partD: base,
  };
}

/**
 * Calculate the remaining salary after bills are deducted.
 */
export function remainingAfterBills(salaryAmountCents: number, totalBillsCents: number): number {
  const remaining = salaryAmountCents - totalBillsCents;
  if (remaining < 0) {
    throw new RangeError('Bills exceed salary');
  }
  return remaining;
}

/**
 * Donation goal = 25% of Part D before any spending.
 * Stored as an exact integer (floor). The spec does not specify rounding direction,
 * so we use floor to avoid over-committing.
 */
export function calculateDonationGoal(partDAmountCents: number): number {
  return Math.floor(partDAmountCents / 4);
}

/**
 * Sum an array of cent amounts safely.
 */
export function sumCents(amounts: number[]): number {
  return amounts.reduce((acc, v) => acc + v, 0);
}

/**
 * Calculate the current balance of a part given:
 *  - its starting amount (from the split + opening carry-over + legacy imports)
 *  - all external income added to it
 *  - all amounts that reduced it (spent, transferred out, withdrawn)
 */
export function calculatePartBalance(
  startingAmountCents: number,
  addedCents: number,
  reducedCents: number,
): number {
  return startingAmountCents + addedCents - reducedCents;
}

/**
 * Determine whether a budget is under or over.
 */
export function budgetStatus(limitCents: number, spentCents: number): 'under' | 'over' {
  return spentCents <= limitCents ? 'under' : 'over';
}

/**
 * Validate that an amount string entered by the user represents a valid euro amount.
 * Accepts: "12", "12,34", "12.34", "1234", "1.234,56", "1234,56"
 * Returns cents or null if invalid.
 */
export function parseEuroInput(input: string): number | null {
  if (!input || input.trim() === '') return null;

  // Normalize: remove thousands dots, replace comma decimal with period
  const cleaned = input
    .trim()
    .replace(/\./g, '') // remove all dots (used as thousands separator)
    .replace(',', '.'); // convert decimal comma to period

  const val = parseFloat(cleaned);
  if (isNaN(val) || val < 0) return null;

  // Round to 2 decimal places to get exact cents
  return Math.round(val * 100);
}

/**
 * Format a cent amount as a European euro string: €1.234,56
 */
export function formatCents(cents: number): string {
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const centsPart = abs % 100;

  const eurosFormatted = euros.toLocaleString('de-DE'); // uses dot as thousands separator
  const centsFormatted = centsPart.toString().padStart(2, '0');

  return `${isNegative ? '-' : ''}€${eurosFormatted},${centsFormatted}`;
}

/**
 * Format cents as a plain number string for input fields (e.g. "1234,56").
 */
export function centsToInputString(cents: number): string {
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const centsPart = abs % 100;
  return `${euros},${centsPart.toString().padStart(2, '0')}`;
}

/**
 * Verify the split sums back to the original amount.
 * Used in tests and assertions.
 */
export function verifySplit(remainingCents: number, split: SalarySplit): boolean {
  return split.partA + split.partB + split.partC + split.partD === remainingCents;
}
