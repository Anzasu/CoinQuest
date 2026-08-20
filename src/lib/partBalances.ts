import { db } from '@/db';
import { ledgerParts, legacyPartImports } from '@/db/schema';

export type PartKey = 'A' | 'B' | 'C' | 'D';

export interface PartBalanceSummary {
  incomeCents: number;
  spentCents: number;
  transferredCents: number;
  withdrawnCents: number;
  remainingCents: number;
}

export async function getPartBalanceSummaries(): Promise<Record<PartKey, PartBalanceSummary>> {
  const rows = await db.select().from(ledgerParts);
  const legacyRows = await db.select().from(legacyPartImports);
  const summaries = {} as Record<PartKey, PartBalanceSummary>;

  for (const part of ['A', 'B', 'C', 'D'] as const) {
    const partRows = rows.filter((row) => row.partType === part);
    const monthlyIncome = partRows.reduce((sum, row) => sum + row.monthlyTotalCents, 0);
    const legacyIncome = legacyRows
      .filter((row) => row.partType === part && row.countsTowardAllTimeTotal)
      .reduce((sum, row) => sum + row.amountCents, 0);
    const spentCents = partRows.reduce((sum, row) => sum + row.spentAmountCents, 0);
    const transferredCents = partRows.reduce((sum, row) => sum + row.transferredOutAmountCents, 0);
    const withdrawnCents = partRows.reduce((sum, row) => sum + row.withdrawnCashAmountCents, 0);
    const incomeCents = monthlyIncome + legacyIncome;

    summaries[part] = {
      incomeCents,
      spentCents,
      transferredCents,
      withdrawnCents,
      remainingCents: incomeCents - spentCents - transferredCents - withdrawnCents,
    };
  }

  return summaries;
}

export async function getOverallPartBalance(part: PartKey): Promise<number> {
  return (await getPartBalanceSummaries())[part].remainingCents;
}