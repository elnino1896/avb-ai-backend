// src/billing/billing.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../core/middlewares/auth.middleware';
import { prisma } from '../shared/utils/prisma';

export const upgradePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { plan } = req.body; // Es: "PRO", "ENTERPRISE"

    if (plan !== 'PRO' && plan !== 'ENTERPRISE') {
      res.status(400).json({ error: 'Piano non valido. Scegli tra PRO e ENTERPRISE.' });
      return;
    }

    // Definiamo i nuovi limiti di budget in base al piano
    const newBudgetLimit = plan === 'PRO' ? 100.0 : 500.0;

    // Eseguiamo una Transazione Prisma: aggiorniamo l'utente e il suo portafoglio insieme
    const [updatedUser, updatedBudget] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { plan: plan }
      }),
      prisma.budgetControl.update({
        where: { userId: userId },
        data: { 
          monthlyLimit: newBudgetLimit,
          // Azzeriamo i consumi del mese in corso per premiare l'upgrade
          usedThisMonth: 0.0 
        }
      })
    ]);

    console.log(`[Billing] 💰 L'utente ${userId} ha fatto l'upgrade al piano ${plan}. Nuovo limite: $${newBudgetLimit}`);

    res.status(200).json({
      message: `Upgrade al piano ${plan} completato con successo! Il tuo budget AI è stato ricaricato.`,
      data: {
        plan: updatedUser.plan,
        budget: updatedBudget
      }
    });

  } catch (error) {
    console.error('[Billing Error]:', error);
    res.status(500).json({ error: 'Errore durante l\'elaborazione dell\'upgrade.' });
  }
};