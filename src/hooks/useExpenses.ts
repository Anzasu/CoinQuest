import { useCallback } from 'react';
import { db } from '@/db';
import { expenses, ledgerParts, monthlyPeriods, budgets } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nowIso } from '@/lib/dates';
import { budgetStatus } from '@/lib/money';
import type { ExpenseCategory } from '@/lib/categories';

export type Expense = typeof expenses.$inferSelect;

export function useExpenses() {
  const getExpensesForPeriod = useCallback(async (periodId: number): Promise<Expense[]> => {
    return db
      .select()
      .from(expenses)
      .where(eq(expenses.periodId, periodId))
      .orderBy(desc(expenses.date));
  }, []);

  const addExpense = useCallback(async (params: {
    periodId: number;
    amountCents: number;
    date: string;
    category: ExpenseCategory;
    paymentMethod: 'cash' | 'card';
    note?: string;
  }): Promise<Expense> => {
    const [expense] = await db
      .insert(expenses)
      .values({
        periodId: params.periodId,
        amountCents: params.amountCents,
        date: params.date,
        category: params.category,
        paymentMethod: params.paymentMethod,
        note: params.note ?? null,
        countsTowardSpending: true,
        createdAt: nowIso(),
      })
      .returning();

    // Reduce Part D current balance
    const parts = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, params.periodId), eq(ledgerParts.partType, 'D')));

    if (parts[0]) {
      await db
        .update(ledgerParts)
        .set({
          currentBalanceCents: parts[0].currentBalanceCents - params.amountCents,
          spentAmountCents: parts[0].spentAmountCents + params.amountCents,
        })
        .where(eq(ledgerParts.id, parts[0].id));
    }

    // Update period monthly spent
    const period = await db.select().from(monthlyPeriods).where(eq(monthlyPeriods.id, params.periodId));
    if (period[0]) {
      const newSpent = period[0].monthlySpentCents + params.amountCents;
      await db
        .update(monthlyPeriods)
        .set({ monthlySpentCents: newSpent })
        .where(eq(monthlyPeriods.id, params.periodId));
    }

    // Update overall budget spent
    const overallBudget = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.periodId, params.periodId), eq(budgets.scope, 'overall')));
    if (overallBudget[0]) {
      const newSpent = overallBudget[0].spentAmountCents + params.amountCents;
      await db
        .update(budgets)
        .set({
          spentAmountCents: newSpent,
          status: budgetStatus(overallBudget[0].limitAmountCents, newSpent),
        })
        .where(eq(budgets.id, overallBudget[0].id));
    }

    // Update category budget spent if exists
    const catBudget = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.periodId, params.periodId),
          eq(budgets.scope, 'category'),
          eq(budgets.category as any, params.category),
        ),
      );
    if (catBudget[0]) {
      const newSpent = catBudget[0].spentAmountCents + params.amountCents;
      await db
        .update(budgets)
        .set({
          spentAmountCents: newSpent,
          status: budgetStatus(catBudget[0].limitAmountCents, newSpent),
        })
        .where(eq(budgets.id, catBudget[0].id));
    }

    return expense;
  }, []);

  const updateExpense = useCallback(async (
    id: number,
    params: {
      amountCents: number;
      date: string;
      category: ExpenseCategory;
      paymentMethod: 'cash' | 'card';
      note?: string;
    },
    oldAmountCents: number,
  ): Promise<void> => {
    const [exp] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!exp) return;

    await db
      .update(expenses)
      .set({
        amountCents: params.amountCents,
        date: params.date,
        category: params.category,
        paymentMethod: params.paymentMethod,
        note: params.note ?? null,
      })
      .where(eq(expenses.id, id));

    const delta = params.amountCents - oldAmountCents;

    // Adjust Part D
    const parts = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, exp.periodId), eq(ledgerParts.partType, 'D')));
    if (parts[0]) {
      await db
        .update(ledgerParts)
        .set({
          currentBalanceCents: parts[0].currentBalanceCents - delta,
          spentAmountCents: parts[0].spentAmountCents + delta,
        })
        .where(eq(ledgerParts.id, parts[0].id));
    }

    // Adjust period monthly spent
    const period = await db.select().from(monthlyPeriods).where(eq(monthlyPeriods.id, exp.periodId));
    if (period[0]) {
      await db
        .update(monthlyPeriods)
        .set({ monthlySpentCents: period[0].monthlySpentCents + delta })
        .where(eq(monthlyPeriods.id, exp.periodId));
    }
  }, []);

  const deleteExpense = useCallback(async (id: number): Promise<void> => {
    const [exp] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!exp) return;

    await db.delete(expenses).where(eq(expenses.id, id));

    // Restore Part D balance
    const parts = await db
      .select()
      .from(ledgerParts)
      .where(and(eq(ledgerParts.periodId, exp.periodId), eq(ledgerParts.partType, 'D')));
    if (parts[0]) {
      await db
        .update(ledgerParts)
        .set({
          currentBalanceCents: parts[0].currentBalanceCents + exp.amountCents,
          spentAmountCents: parts[0].spentAmountCents - exp.amountCents,
        })
        .where(eq(ledgerParts.id, parts[0].id));
    }

    // Restore period monthly spent
    const period = await db.select().from(monthlyPeriods).where(eq(monthlyPeriods.id, exp.periodId));
    if (period[0]) {
      await db
        .update(monthlyPeriods)
        .set({ monthlySpentCents: period[0].monthlySpentCents - exp.amountCents })
        .where(eq(monthlyPeriods.id, exp.periodId));
    }
  }, []);

  return { getExpensesForPeriod, addExpense, updateExpense, deleteExpense };
}
