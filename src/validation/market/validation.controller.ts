// src/validation/market/validation.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { prisma } from '../../shared/utils/prisma';
import { AIOrchestrator } from '../../ai/engine/orchestrator';

export const validateVenture = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ventureId = req.params.ventureId as string;
    
    // 🔥 1. CATTURIAMO IL CONTESTO EXTRA DAL FRONTEND (La tua ribattuta)
    const { extraContext } = req.body || {};

    // 2. Recuperiamo la Venture dal database
    const venture = await prisma.venture.findUnique({
      where: { id: ventureId }
    });

    if (!venture || venture.userId !== userId) {
      res.status(404).json({ error: 'Venture non trovata o accesso negato.' });
      return;
    }

    // 🔥 FIX SBLOCCO: Permettiamo l'analisi sia se è nuova (IDEATION) sia se è un ricalcolo (VALIDATION)
    if (venture.status !== 'IDEATION' && venture.status !== 'VALIDATION') {
      res.status(400).json({ error: 'Questa venture è già in fase operativa e non può essere ri-validata.' });
      return;
    }

    // 🧠 3. IL NUOVO CERVELLO: VC Severo ma Giusto
    const systemPrompt = `Sei un Partner di Venture Capital di livello mondiale (stile Y Combinator).
    Il tuo compito è analizzare oggettivamente e razionalmente le idee di startup in base a:
    1. Painkiller vs Vitamin (Risolve un problema reale e doloroso?)
    2. Barriere all'ingresso (È facile da copiare per i competitor?)
    3. Saturation (Il mercato è già saturo?)
    4. Marginalità (I costi si mangeranno i profitti considerando il budget indicato?)

    REGOLA D'ORO: Valuta il reale potenziale. 
    - Se l'idea è banale, satura, non monetizzabile o inattuabile col budget, dai un "NO-GO" (score tra 10 e 59). 
    - Se l'idea ha una nicchia chiara, vantaggi competitivi e margini sani, premiandola dai un "GO" (score tra 60 e 95). 
    Sii severo ma GIUSTO. Non dare sempre lo stesso voto, analizza il contesto reale.

    Devi rispondere ESATTAMENTE ed ESCLUSIVAMENTE con un oggetto JSON valido contenente queste chiavi:
    "competizione" (stringa: es. "Alta - Mercato saturo"),
    "margineStimato" (stringa, es. "15% - Troppi costi server"),
    "tempoDiAvvio" (stringa, es. "12 settimane"),
    "score" (numero intero da 1 a 100 calcolato oggettivamente in base alle regole),
    "verdetto" (stringa: "GO" o "NO-GO"),
    "spiegazione" (stringa: 3 o 4 frasi spietate in cui motivi nel dettaglio perché hai dato questo verdetto e punteggio).
    Non aggiungere nessun altro testo, markdown, o spiegazione fuori dal JSON.`;

    // 🔥 INIETTIAMO LA NOTA DEL FOUNDER (SE ESISTE) COME COMANDO ASSOLUTO
    const contextAddition = extraContext 
      ? `\n\n⚠️ NOTA URGENTE DAL FOUNDER (Diritto di Replica):\n"${extraContext}"\n-> Tieni ASSOLUTAMENTE CONTO di questa nota per ricalcolare i costi, le barriere all'ingresso e il verdetto finale.` 
      : '';

    const userPrompt = `Analizza questa startup:
    Nome: ${venture.name}
    Nicchia: ${venture.niche}
    Descrizione: ${venture.description}
    Budget Mensile a disposizione: $${venture.monthlyBudget}${contextAddition}`;

    // 4. Eseguiamo l'analisi scalando il budget
    const aiResponse = await AIOrchestrator.executePrompt(
      userId,
      'MARKET_VALIDATION',
      systemPrompt,
      userPrompt,
      ventureId 
    );

    // 5. Pulizia e Parsing del JSON restituito dall'AI
    const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const metrics = JSON.parse(cleanJson);

    // 6. Aggiorniamo la Venture nel Database
    const updatedVenture = await prisma.venture.update({
      where: { id: ventureId },
      data: {
        status: 'VALIDATION',
        metrics: metrics // Salviamo i KPI calcolati dall'AI aggiornati!
      }
    });

    res.status(200).json({
      message: 'Analisi di Mercato completata con successo.',
      data: updatedVenture
    });

  } catch (error: any) {
    console.error('[Validation Error]:', error);
    if (error.message === 'BUDGET_EXCEEDED') {
      res.status(402).json({ error: 'Budget AI esaurito.' });
    } else {
      res.status(500).json({ error: 'Errore durante la validazione. L\'AI potrebbe aver restituito un formato non valido.' });
    }
  }
};