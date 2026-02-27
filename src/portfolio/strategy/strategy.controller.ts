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

    // 🧠 3. IL NUOVO PROMPT DEL PIVOT: Turnaround Specialist
    const systemPrompt = isNoGo
      ? `Sei un genio del Turnaround aziendale. L'idea fornita ha appena ricevuto un disastroso NO-GO (Score: ${metrics?.score}/100) dal nostro comitato VC. Il motivo principale del fallimento era: competizione ${metrics?.competizione}.
         Il tuo compito è salvare questa startup con un PIVOT RADICALE e trasformarla in un'idea da GO assoluto, tenendo conto che il budget è solo di $${venture.monthlyBudget}/mese.

         DEVI formattare la tua risposta in testo normale usando ESATTAMENTE questa struttura:

🔥 STRATEGIA DI PIVOT:
[Spiega in 3 punti chiari come stravolgere il modello di business, la nicchia o il prodotto per sbaragliare la concorrenza]

📈 NUOVO SCORE PREVISTO: [Inserisci un punteggio tra 85 e 98]/100
✅ NUOVO VERDETTO: GO

⚖️ CONFRONTO CON L'IDEA ORIGINALE:
[Spiega in 2-3 righe perché questo pivot alza il punteggio da ${metrics?.score} a quello nuovo, risolvendo le criticità della prima idea].`
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