// src/portfolio/strategy/strategy.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { prisma } from '../../shared/utils/prisma';
import { AIOrchestrator } from '../../ai/engine/orchestrator';

export const generateStrategy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { ventureId } = req.params;

    // 1. Recuperiamo la Venture
    const venture = await prisma.venture.findUnique({
      where: { id: ventureId }
    });

    if (!venture || venture.userId !== userId) {
      res.status(404).json({ error: 'Venture non trovata.' });
      return;
    }

    if (venture.status !== 'VALIDATION') {
      res.status(400).json({ error: 'La venture deve essere validata (Status: VALIDATION) prima di generare una strategia.' });
      return;
    }

    // 2. Leggiamo il verdetto del Validation Engine
    const metrics = venture.metrics as any;
    const isNoGo = metrics?.verdetto === 'NO-GO';

    // 3. Prompt Dinamico: Se NO-GO facciamo Pivot, se GO facciamo Action Plan
    const systemPrompt = isNoGo
      ? `Sei un Senior Startup Advisor. L'idea fornita ha ricevuto un NO-GO (Score: ${metrics?.score}) perché la competizione è ${metrics?.competizione}. 
         Devi suggerire un PIVOT RADICALE. Trova una sotto-nicchia specifica o un modello di business alternativo dove i $${venture.monthlyBudget} di budget mensile siano sufficienti per dominare. Fornisci la nuova rotta in 3 punti chiari.`
      : `Sei un COO esperto. L'idea ha ricevuto un GO. Scrivi un piano operativo chirurgico di 30 giorni per il lancio, ottimizzando il budget di $${venture.monthlyBudget}. Dividi in: Settimana 1, Settimana 2, Settimana 3, Settimana 4.`;

    const userPrompt = `Dettagli Venture Attuale:
    Nome: ${venture.name}
    Nicchia: ${venture.niche}
    Descrizione: ${venture.description}`;

    // 4. Eseguiamo l'AI
    const aiResponse = await AIOrchestrator.executePrompt(
      userId,
      isNoGo ? 'PIVOT_STRATEGY' : 'ACTION_PLAN',
      systemPrompt,
      userPrompt,
      ventureId
    );

    // 5. Aggiorniamo lo stato della Venture
    const updatedVenture = await prisma.venture.update({
      where: { id: ventureId },
      data: {
        status: isNoGo ? 'PIVOTED' : 'OPERATIONAL',
      }
    });

    res.status(200).json({
      message: isNoGo ? 'Strategia di PIVOT generata per salvare la venture.' : 'Piano Operativo generato con successo.',
      aiStrategy: aiResponse,
      data: updatedVenture
    });

  } catch (error: any) {
    console.error('[Strategy Error]:', error);
    if (error.message === 'BUDGET_EXCEEDED') {
      res.status(402).json({ error: 'Budget AI esaurito.' });
    } else {
      res.status(500).json({ error: 'Errore durante la generazione della strategia.' });
    }
  }
};