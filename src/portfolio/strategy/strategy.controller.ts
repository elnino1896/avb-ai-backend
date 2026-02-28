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

    // 🧠 3. IL NUOVO PROMPT DEL PIVOT: Strategia + Nuova Automazione
    const systemPrompt = isNoGo
      ? `Sei un Senior Product Strategist e Architetto di Automazioni AI. Questa startup ha fallito la validazione di mercato (Score: ${metrics?.score}/100).
         Motivazione del fallimento: ${metrics?.spiegazione || 'Competizione troppo alta o margini bassi'}.
         Budget mensile: $${venture.monthlyBudget}.

         PROGETTA UN PIVOT REALE e difendibile applicando una di queste 3 strategie: 
         1) "Niche Down" 
         2) "Platform Shift" 
         3) "Monetization Flip"

         Formatta la tua risposta usando ESATTAMENTE questa struttura:

🔥 STRATEGIA DI PIVOT:
[Spiega in 3 punti operativi come stravolgere il prodotto]

🎯 IL NUOVO VANTAGGIO COMPETITIVO:
[Spiega in 2 righe la Unique Value Proposition]

⚖️ PERCHÉ ORA FUNZIONA:
[Spiega perché questo pivot risolve le criticità]

🔌 AUTOMAZIONE GIORNALIERA:
[Descrivi un'operazione quotidiana e noiosa (es. cercare lead, raschiare dati, analizzare trend) che l'AI può fare in background ogni giorno per QUESTO NUOVO BUSINESS. Sii specifico].`
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

    // 🔥 5. LO SPLIT MAGICO: Separiamo la Strategia dall'Automazione
    let finalStrategy = aiResponse;
    let newAutomation = null;

    if (isNoGo && aiResponse.includes('🔌 AUTOMAZIONE GIORNALIERA:')) {
      const parts = aiResponse.split('🔌 AUTOMAZIONE GIORNALIERA:');
      finalStrategy = parts[0].trim(); // Tutto ciò che viene prima (La strategia)
      newAutomation = parts[1].trim(); // Tutto ciò che viene dopo (La nuova automazione)
    }

    // 6. Aggiorniamo lo stato della Venture e SALVIAMO TUTTO 💾
    const updatedVenture = await prisma.venture.update({
      where: { id: ventureId },
      data: {
        status: isNoGo ? 'PIVOTED' : 'OPERATIONAL',
        aiStrategy: finalStrategy,
        // Se l'AI ha generato una nuova automazione per il pivot, sovrascriviamo la vecchia!
        ...(newAutomation && { dailyAutomation: newAutomation }) 
      }
    });

    res.status(200).json({
      message: isNoGo ? 'Strategia di PIVOT generata per salvare la venture.' : 'Piano Operativo generato con successo.',
      aiStrategy: finalStrategy,
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