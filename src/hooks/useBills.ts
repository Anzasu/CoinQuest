import { useCallback } from 'react';
import { db } from '@/db';
import { billTemplates, monthlyBills } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { nowIso } from '@/lib/dates';

export type BillTemplate = typeof billTemplates.$inferSelect;
export type MonthlyBill = typeof monthlyBills.$inferSelect;

export function useBills() {
  const getAllTemplates = useCallback(async (): Promise<BillTemplate[]> => {
    return db.select().from(billTemplates).orderBy(asc(billTemplates.sortOrder));
  }, []);

  const getActiveTemplates = useCallback(async (): Promise<BillTemplate[]> => {
    return db
      .select()
      .from(billTemplates)
      .where(eq(billTemplates.isActive, true))
      .orderBy(asc(billTemplates.sortOrder));
  }, []);

  const createTemplate = useCallback(async (params: {
    name: string;
    amountCents: number;
  }): Promise<BillTemplate> => {
    const existing = await db.select().from(billTemplates).orderBy(asc(billTemplates.sortOrder));
    const maxOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), 0);

    const [template] = await db
      .insert(billTemplates)
      .values({
        name: params.name,
        amountCents: params.amountCents,
        isActive: true,
        sortOrder: maxOrder + 1,
        createdAt: nowIso(),
      })
      .returning();

    return template;
  }, []);

  const updateTemplate = useCallback(async (
    id: number,
    params: { name: string; amountCents: number; isActive: boolean },
  ): Promise<void> => {
    await db
      .update(billTemplates)
      .set({ name: params.name, amountCents: params.amountCents, isActive: params.isActive })
      .where(eq(billTemplates.id, id));
  }, []);

  const deleteTemplate = useCallback(async (id: number): Promise<void> => {
    await db.delete(billTemplates).where(eq(billTemplates.id, id));
  }, []);

  const getBillsForPeriod = useCallback(async (periodId: number): Promise<MonthlyBill[]> => {
    return db.select().from(monthlyBills).where(eq(monthlyBills.periodId, periodId));
  }, []);

  return {
    getAllTemplates,
    getActiveTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getBillsForPeriod,
  };
}
