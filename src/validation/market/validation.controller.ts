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

    // 🧠 3. IL NUOVO CERVELLO BIFORCUTO (Startup vs Azienda Esistente)
    const systemPrompt = venture.isExistingBusiness
      ? `Sei un Consulente Aziendale di livello Elite (ex-McKinsey) e Architetto di Automazioni AI.
         Stai analizzando un'azienda GIÀ ESISTENTE e OPERATIVA.
         
         CRITERI DI VALUTAZIONE:
         1. Posizionamento e Offerta
         2. Colli di bottiglia operativi
         3. Scalabilità e Margini

         REGOLA D'ORO VERDETTO: 
         - Se il modello fa acqua o non è scalabile dai "NO-GO" (score 10-59). 
         - Se l'azienda è sana e pronta per crescere dai "GO" (score 60-95). 

         REGOLA D'ORO AUTOMAZIONE (MAGIA NERA):
         Devi proporre un'automazione di SCALING (es. raschiare lead in target da LinkedIn, monitorare recensioni online, estrarre dati competitor). Non proporre compiti banali. Definisci anche la Schedulazione Perfetta per il fuso orario target.

         Devi rispondere ESATTAMENTE con un oggetto JSON valido:
         "competizione": "...",
         "margineStimato": "...",
         "tempoDiAvvio": "Tempo stimato per l'ottimizzazione",
         "score": 85,
         "verdetto": "GO",
         "spiegazione": "3 frasi in cui motivi la diagnosi",
         "automazione": {
           "descrizione": "Spiega l'automazione di ricerca o scraping.",
           "frequenza": "DAILY oppure WEEKLY",
           "orario": "HH:00 (es. 09:00, 15:00, 23:00)",
           "fusoOrario": "Un fuso orario IANA valido (es. Europe/Rome, America/New_York, Asia/Tokyo)"
         }
         Non aggiungere testo fuori dal JSON.`
      : `Sei un Partner di Venture Capital e un Architetto di Automazioni AI.
         
         CRITERI DI VALUTAZIONE:
         1. Painkiller vs Vitamin
         2. Barriere all'ingresso
         3. Saturation
         4. Marginalità

         REGOLA D'ORO VERDETTO: 
         - Banale/Satura: "NO-GO" (score 10-59). 
         - Potenziale reale: "GO" (score 60-95). 

         REGOLA D'ORO AUTOMAZIONE (MAGIA NERA):
         Proponi un'operazione di RICERCA ESTERNA o GROWTH HACKING (es. raschiare Reddit, monitorare competitor). 
         Inoltre, devi definire la SCHEDULAZIONE PERFETTA per questa startup. Se vende a Wall Street, l'orario migliore è le 15:00 (America/New_York). Se è un report settimanale, la frequenza è WEEKLY.

         Devi rispondere ESATTAMENTE con un oggetto JSON valido:
         "competizione": "...",
         "margineStimato": "...",
         "tempoDiAvvio": "...",
         "score": 85,
         "verdetto": "GO",
         "spiegazione": "...",
         "automazione": {
           "descrizione": "Spiega l'automazione di ricerca o scraping.",
           "frequenza": "DAILY oppure WEEKLY",
           "orario": "HH:00 (es. 09:00, 15:00, 23:00)",
           "fusoOrario": "Un fuso orario IANA valido (es. Europe/Rome, America/New_York, Asia/Tokyo)"
         }
         Non aggiungere testo fuori dal JSON.`;

    const contextAddition = extraContext 
      ? `\n\n⚠️ NOTA URGENTE DAL FOUNDER (Diritto di Replica):\n"${extraContext}"\n-> Tieni ASSOLUTAMENTE CONTO di questa nota per ricalcolare i costi, le barriere all'ingresso e il verdetto finale.` 
      : '';

    const userPrompt = venture.isExistingBusiness
      ? `Analizza questa azienda e proponi un'automazione AI di scaling:
         Nome: ${venture.name}
         Settore: ${venture.niche}
         Situazione/Problemi: ${venture.description}
         Budget Mensile per Scaling: $${venture.monthlyBudget}${contextAddition}`
      : `Analizza questa startup e proponi un'automazione AI giornaliera:
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

    // 🔥 6. Aggiorniamo la Venture salvando TUTTI i parametri di schedulazione!
    const updatedVenture = await prisma.venture.update({
      where: { id: ventureId },
      data: {
        status: 'VALIDATION',
        metrics: metrics,
        dailyAutomation: metrics.automazione?.descrizione,
        automationFrequency: metrics.automazione?.frequenza,
        automationTime: metrics.automazione?.orario,
        automationTimezone: metrics.automazione?.fusoOrario
      }
    });

    res.status(200).json({
      message: 'Analisi completata con successo.',
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