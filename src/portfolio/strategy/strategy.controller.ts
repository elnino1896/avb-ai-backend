// src/portfolio/strategy/strategy.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { prisma } from '../../shared/utils/prisma';
import { AIOrchestrator } from '../../ai/engine/orchestrator';

export const generateStrategy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ventureId = req.params.ventureId as string;

    // 1. Recuperiamo la Venture
    const venture = await prisma.venture.findUnique({
      where: { id: ventureId }
    });

    if (!venture || venture.userId !== userId) {
      res.status(404).json({ error: 'Venture non trovata.' });
      return;
    }

    if (venture.status !== 'VALIDATION') {
      res.status(400).json({ error: 'La venture deve essere validata prima di generare una strategia.' });
      return;
    }

    // 2. Leggiamo il verdetto del Validation Engine
    const metrics = venture.metrics as any;
    const isNoGo = String(metrics?.verdetto).toUpperCase().includes('NO-GO');

    // 🧠 3. IL NUOVO PROMPT DEL PIVOT: Strategia Reale e Difendibile
    const systemPrompt = isNoGo
      ? `Sei un Senior Product Strategist di fama mondiale. Questa startup ha appena fallito la validazione di mercato (Score: ${metrics?.score}/100).
         Motivazione del fallimento: ${metrics?.spiegazione || 'Competizione troppo alta o margini troppo bassi'}.
         Budget mensile disponibile per il lancio: $${venture.monthlyBudget}.

         Il tuo compito NON è inventare numeri fittizi, ma progettare un PIVOT REALE e difendibile che trasformerebbe questo fallimento in un business profittevole.
         Per farlo, devi applicare obbligatoriamente una di queste tre strategie: 
         1) "Niche Down" (iper-specializzazione su un target minuscolo ma altospendente).
         2) "Platform Shift" (cambiare completamente il canale di acquisizione o il formato del prodotto).
         3) "Monetization Flip" (offrire il prodotto gratis e far pagare qualcos'altro).

         Formatta la tua risposta in testo normale usando ESATTAMENTE questa struttura:

🔥 STRATEGIA DI PIVOT:
[Spiega in 3 punti operativi come stravolgere il prodotto per aggirare la competizione e i limiti di budget]

🎯 IL NUOVO VANTAGGIO COMPETITIVO (BLUE OCEAN):
[Spiega in 2 righe qual è la "Unique Value Proposition" che rende irrilevanti i competitor attuali]

⚖️ PERCHÉ ORA PASSEREBBE LA VALIDAZIONE:
[Spiega razionalmente, in base alla marginalità e alle barriere all'ingresso, perché questo pivot merita un GO e risolve le criticità del pitch originale].`
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

    // 5. Aggiorniamo lo stato della Venture e SALVIAMO LA STRATEGIA 💾
    const updatedVenture = await prisma.venture.update({
      where: { id: ventureId },
      data: {
        status: isNoGo ? 'PIVOTED' : 'OPERATIONAL',
        aiStrategy: aiResponse
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