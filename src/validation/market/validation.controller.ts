import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { prisma } from '../../shared/utils/prisma';
import { AIOrchestrator } from '../../ai/engine/orchestrator';

export const validateVenture = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ventureId = req.params.ventureId as string;
    
    // 1. CATTURIAMO IL CONTESTO EXTRA DAL FRONTEND
    const { extraContext } = req.body || {};

    // 2. Recuperiamo la Venture
    const venture = await prisma.venture.findUnique({
      where: { id: ventureId }
    });

    if (!venture || venture.userId !== userId) {
      res.status(404).json({ error: 'Venture non trovata o accesso negato.' });
      return;
    }

    if (venture.status !== 'IDEATION' && venture.status !== 'VALIDATION') {
      res.status(400).json({ error: 'Questa venture è già in fase operativa e non può essere ri-validata.' });
      return;
    }

    // 🧠 3. IL NUOVO CERVELLO: VC + Architetto di Automazioni Severo
    const systemPrompt = `Sei un Partner di Venture Capital di livello mondiale e un Ingegnere di Automazione AI.
    Il tuo compito è analizzare oggettivamente l'idea di startup e, parallelamente, ideare un "Agente AI Autonomo".
    
    CRITERI DI VALUTAZIONE:
    1. Painkiller vs Vitamin (Risolve un problema reale e doloroso?)
    2. Barriere all'ingresso (È facile da copiare per i competitor?)
    3. Saturation (Il mercato è già saturo?)
    4. Marginalità (I costi si mangeranno i profitti considerando il budget indicato?)

    REGOLA D'ORO VERDETTO: 
    - Se l'idea è banale, satura, non monetizzabile, dai "NO-GO" (score 10-59). 
    - Se l'idea ha potenziale, dai "GO" (score 60-95). 

    REGOLA D'ORO AUTOMAZIONE (MAGIA NERA):
    Pensa a un'operazione quotidiana e noiosa di RICERCA ESTERNA o GROWTH HACKING che l'AI può fare in background per aiutare il Founder (es. raschiare Reddit/LinkedIn per trovare clienti, monitorare i prezzi dei competitor, estrarre modelli 3D gratuiti da Printables). NON proporre funzioni interne al prodotto (es. non proporre di analizzare i dati degli utenti o di creare report per l'app finale, l'app non esiste ancora!). L'automazione deve servire al CEO per validare o far crescere il business.

    Devi rispondere ESATTAMENTE ed ESCLUSIVAMENTE con un oggetto JSON valido contenente queste chiavi:
    "competizione" (stringa),
    "margineStimato" (stringa),
    "tempoDiAvvio" (stringa),
    "score" (numero intero da 1 a 100),
    "verdetto" (stringa: "GO" o "NO-GO"),
    "spiegazione" (stringa: 3 frasi spietate in cui motivi il verdetto),
    "automazione" (stringa: Descrivi un'automazione di ricerca o scraping giornaliera. Sii specifico, indica siti reali. Se non serve, scrivi "Nessuna automazione strettamente necessaria").
    Non aggiungere nessun altro testo fuori dal JSON.`;

    const contextAddition = extraContext 
      ? `\n\n⚠️ NOTA URGENTE DAL FOUNDER (Diritto di Replica):\n"${extraContext}"\n-> Tieni ASSOLUTAMENTE CONTO di questa nota per ricalcolare i costi, le barriere all'ingresso e il verdetto finale.` 
      : '';

    const userPrompt = `Analizza questa startup e proponi un'automazione AI giornaliera:
    Nome: ${venture.name}
    Nicchia: ${venture.niche}
    Descrizione: ${venture.description}
    Budget Mensile a disposizione: $${venture.monthlyBudget}${contextAddition}`;

    // 4. Eseguiamo l'analisi
    const aiResponse = await AIOrchestrator.executePrompt(
      userId,
      'MARKET_VALIDATION',
      systemPrompt,
      userPrompt,
      ventureId 
    );

    // 5. Pulizia e Parsing
    const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const metrics = JSON.parse(cleanJson);

    // 🔥 6. Aggiorniamo la Venture salvando anche la Magia Nera!
    const updatedVenture = await prisma.venture.update({
      where: { id: ventureId },
      data: {
        status: 'VALIDATION',
        metrics: metrics,
        dailyAutomation: metrics.automazione // Salviamo l'idea di automazione nel DB!
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