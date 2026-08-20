import { useCallback } from 'react';
import { db } from '@/db';
import { legacyPartImports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nowIso, todayIso } from '@/lib/dates';
import { getOverallPartBalance } from '@/lib/partBalances';

export type LegacyPartImport = typeof legacyPartImports.$inferSelect;

export function useLegacyImport() {
  const getAll = useCallback(async (): Promise<LegacyPartImport[]> => {
    return db.select().from(legacyPartImports).orderBy(legacyPartImports.partType);
  }, []);

  const getByPart = useCallback(async (partType: 'A' | 'B' | 'C' | 'D'): Promise<LegacyPartImport[]> => {
    return db.select().from(legacyPartImports).where(eq(legacyPartImports.partType, partType));
  }, []);

  /**
   * Add a legacy import for a part.
   * This is setup data only — it does NOT:
   * - Create monthly transactions
   * - Affect piggy banks
   * - Change donation logic
   * It DOES contribute to all-time totals.
   */
  const addImport = useCallback(async (params: {
    partType: 'A' | 'B' | 'C' | 'D';
    amountCents: number;
    note?: string;
  }): Promise<LegacyPartImport> => {
    const [record] = await db
      .insert(legacyPartImports)
      .values({
        partType: params.partType,
        amountCents: params.amountCents,
        dateImported: todayIso(),
        note: params.note ?? null,
        createdAt: nowIso(),
        countsTowardAllTimeTotal: true,
      })
      .returning();

    return record;
  }, []);

  const deleteImport = useCallback(async (id: number): Promise<void> => {
    const [record] = await db.select().from(legacyPartImports).where(eq(legacyPartImports.id, id));
    if (!record) return;
    const overallAvailable = await getOverallPartBalance(record.partType as 'A' | 'B' | 'C' | 'D');
    if (record.amountCents > overallAvailable) {
      throw new Error('This legacy amount cannot be deleted because part of it has already been spent.');
    }
    await db.delete(legacyPartImports).where(eq(legacyPartImports.id, id));
  }, []);

  /**
   * Get the total legacy amount for each part (for all-time total calculations).
   */
  const getLegacyTotals = useCallback(async (): Promise<Record<'A' | 'B' | 'C' | 'D', number>> => {
    const all = await db.select().from(legacyPartImports);
    const totals: Record<'A' | 'B' | 'C' | 'D', number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const row of all) {
      if (row.countsTowardAllTimeTotal) {
        totals[row.partType as 'A' | 'B' | 'C' | 'D'] += row.amountCents;
      }
    }
    return totals;
  }, []);

  return { getAll, getByPart, addImport, deleteImport, getLegacyTotals };
}
