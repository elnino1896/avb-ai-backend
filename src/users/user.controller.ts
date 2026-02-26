// src/users/user.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../core/middlewares/auth.middleware';
import { prisma } from '../shared/utils/prisma';

export const getMyDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Recuperiamo l'utente con il suo portafoglio e gli ultimi log AI
    const dashboardData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
        budget: true,
        decisionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5 // Prendiamo solo le ultime 5 azioni AI
        }
      }
    });

    if (!dashboardData) {
      res.status(404).json({ error: 'Utente non trovato.' });
      return;
    }

    res.status(200).json({
      message: 'Dashboard caricata con successo.',
      data: dashboardData
    });

  } catch (error) {
    console.error('[Dashboard Error]:', error);
    res.status(500).json({ error: 'Errore nel caricamento della dashboard.' });
  }
};