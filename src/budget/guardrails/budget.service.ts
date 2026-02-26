// src/budget/guardrails/budget.service.ts
import { prisma } from '../../shared/utils/prisma';

export class BudgetGuardrail {
  /**
   * Verifica se l'utente ha abbastanza budget per l'operazione.
   * Ritorna true se può procedere, false se è bloccato.
   */
  static async canAfford(userId: string, estimatedCost: number): Promise<boolean> {
    const budget = await prisma.budgetControl.findUnique({
      where: { userId }
    });

    if (!budget) return false;

    // Se ha superato il limite e ha il blocco attivo
    if (budget.usedThisMonth + estimatedCost > budget.monthlyLimit && budget.hardStop) {
      console.warn(`[Guardrail] Blocco scattato per l'utente ${userId}. Budget esaurito.`);
      return false;
    }

    return true;
  }

  /**
   * Aggiorna il portafoglio dell'utente dopo che l'AI ha risposto.
   */
  static async deductCost(userId: string, actualCost: number): Promise<void> {
    await prisma.budgetControl.update({
      where: { userId },
      data: {
        usedThisMonth: {
          increment: actualCost
        }
      }
    });
    console.log(`[Guardrail] Scalati $${actualCost.toFixed(4)} dal budget dell'utente ${userId}.`);
  }
}