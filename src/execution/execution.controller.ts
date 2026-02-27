// src/execution/execution.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../core/middlewares/auth.middleware';
import { prisma } from '../shared/utils/prisma';
import { AIOrchestrator } from '../ai/engine/orchestrator';

export const generateExecutionPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ventureId = String(req.params.ventureId);

    const venture = await prisma.venture.findUnique({
      where: { id: ventureId }
    });

    if (!venture || venture.userId !== userId) {
      res.status(404).json({ error: 'Venture non trovata.' });
      return;
    }

    const systemPrompt = `Sei il formidabile CTO e COO di questa startup. Il progetto è stato approvato.
    Il tuo compito è scomporre la creazione di questo business in task operativi (da 3 a 10).
    
    OBIETTIVO SUPREMO: MASSIMIZZARE IL LAVORO DELL'AI. L'umano non deve mai "pensare", deve solo "fare click" o agire nel mondo esterno.
    
    REGOLE ASSEGNAZIONE:
    - Imposta "isAI": true per TUTTO ciò che riguarda strategia, pensiero, creazione o pianificazione (Piani Marketing, Copywriting, Analisi Target, Scrittura Codice).
    - Imposta "isAI": false SOLO ED ESCLUSIVAMENTE per azioni fisiche esterne in cui l'umano deve materialmente registrarsi, pagare o configurare qualcosa manualmente (es. "Comprare il dominio", "Registrare l'azienda", "Configurare Stripe").
    
    Rispondi ESATTAMENTE E SOLO con un array JSON valido:
    [
      {
        "title": "Nome del task",
        "description": "Spiegazione super dettagliata di cosa fare",
        "isAI": true o false
      }
    ]`;

    const userPrompt = `Dettagli Venture:
    Nome: ${venture.name}
    Nicchia: ${venture.niche}
    Strategia o Descrizione: ${venture.aiStrategy || venture.description}`;

    const aiResponse = await AIOrchestrator.executePrompt(userId, 'EXECUTION_PLAN', systemPrompt, userPrompt, ventureId);

    const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const tasksData = JSON.parse(cleanJson);

    const createdTasks = [];
    for (const t of tasksData) {
      const newTask = await prisma.task.create({
        data: {
          ventureId,
          title: t.title,
          description: t.description,
          isAI: t.isAI,
          status: 'TODO'
        }
      });
      createdTasks.push(newTask);
    }

    await prisma.venture.update({
      where: { id: ventureId },
      data: { status: 'OPERATIONAL' }
    });

    res.status(200).json({
      message: 'Piano di esecuzione generato con successo!',
      data: createdTasks
    });

  } catch (error: any) {
    console.error('[Execution Error]:', error);
    res.status(500).json({ error: 'Errore durante la scomposizione in task.' });
  }
};

export const getWarRoomData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ventureId = String(req.params.ventureId);

    const venture: any = await prisma.venture.findUnique({
      where: { id: ventureId },
      include: { 
        tasks: {
          orderBy: [
            { createdAt: 'asc' },
            { id: 'asc' }
          ]
        },
        chatMessages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!venture || venture.userId !== userId) {
      res.status(404).json({ error: 'War Room non trovata.' });
      return;
    }

    res.status(200).json({ data: venture });

  } catch (error: any) {
    console.error('[War Room Error]:', error);
    res.status(500).json({ error: 'Errore nel caricamento della War Room.' });
  }
};

export const completeHumanTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskId = String(req.params.taskId);
    
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: 'DONE' }
    });
    
    res.status(200).json({ message: 'Task completato!', data: updatedTask });
  } catch (error) {
    console.error('[Task Error]:', error);
    res.status(500).json({ error: 'Errore durante il completamento del task.' });
  }
};

export const executeAITask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const taskId = String(req.params.taskId);

    const task: any = await prisma.task.findUnique({
      where: { id: taskId },
      include: { venture: true }
    });

    if (!task || task.venture.userId !== userId) {
      res.status(404).json({ error: 'Task non trovato.' });
      return;
    }

    if (!task.isAI) {
      res.status(400).json({ error: 'Questo task deve essere eseguito da un umano.' });
      return;
    }

    const completedAITasks = await prisma.task.findMany({
      where: { 
        ventureId: task.ventureId, 
        status: 'DONE', 
        isAI: true, 
        aiResult: { not: null } 
      }
    });
    
    const contextMemory = completedAITasks.length > 0 
      ? completedAITasks.map(t => `--- TASK PRECEDENTE: ${t.title} ---\n${t.aiResult}`).join('\n\n')
      : 'Nessun task tecnico precedente.';

    // 🔥 FIX: Aggiunta regola 5 contro le allucinazioni visive
    const systemPrompt = `Sei un Senior Developer, Copywriter e Growth Hacker. Il tuo compito NON è spiegare come si fa un lavoro, ma FARLO MATERIALMENTE.
    
    REGOLE DI ESECUZIONE (VIETATO INFRANGERLE):
    1. VIETATO FARE LISTE GENERICHE: Non dire "crea una pagina", "scegli un hosting".
    2. PRENDI LE DECISIONI: Scegli TU lo strumento migliore e imponilo.
    3. FORNISCI IL MATERIALE PRONTO: Scrivi codice, query del database o copy finale pronto per il copia-incolla. Se è marketing, dammi il target esatto e i testi delle ads.
    4. USA LA MEMORIA: Usa i dati dei task passati che trovi nel contesto.
    5. VIETATO INSERIRE LINK FINTI O IMMAGINI: Non usare MAI la sintassi markdown per le immagini (es. ![alt](link)). Non rimandare mai l'utente a tool esterni come Lucidchart. Se devi rappresentare un'architettura software, un diagramma di flusso o una mappa mentale, CREALA DIRETTAMENTE USANDO TESTO (ASCII Art), Tabelle Markdown o all'interno di un blocco di codice.`;

    const userPrompt = `Dettagli Startup:
    Nome: ${task.venture.name}
    Nicchia: ${task.venture.niche}
    Contesto: ${task.venture.description}

    📜 MEMORIA DEI TASK GIÀ COMPLETATI (Usali come base costruttiva!):
    ${contextMemory}

    🎯 IL TUO TASK DA ESEGUIRE ORA:
    Titolo: ${task.title}
    Descrizione/Istruzioni: ${task.description}
    
    Ricorda: Niente teoria. Voglio l'output finale puro e pronto all'uso.`;

    const aiResult = await AIOrchestrator.executePrompt(userId, 'TASK_EXECUTION', systemPrompt, userPrompt, task.ventureId);

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { 
        status: 'DONE',
        aiResult: aiResult 
      }
    });

    res.status(200).json({ message: 'Task eseguito dall\'AI!', data: updatedTask });

  } catch (error: any) {
    console.error('[AI Task Error]:', error);
    res.status(500).json({ error: 'Errore durante l\'esecuzione del task da parte dell\'AI.' });
  }
};

export const sendWarRoomMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ventureId = String(req.params.ventureId);
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Il messaggio non può essere vuoto.' });
      return;
    }

    const venture: any = await prisma.venture.findUnique({
      where: { id: ventureId },
      include: { tasks: true }
    });

    if (!venture || venture.userId !== userId) {
      res.status(404).json({ error: 'Venture non trovata.' });
      return;
    }

    await prisma.chatMessage.create({
      data: { ventureId, role: 'user', content: message }
    });

    const recentMessages = await prisma.chatMessage.findMany({
      where: { ventureId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    const chatHistory = recentMessages.reverse().map(m => `${m.role === 'user' ? 'CEO' : 'CTO'}: ${m.content}`).join('\n\n');

    // 🔥 FIX: Aggiunta regola 4 contro le allucinazioni visive
    const systemPrompt = `Sei il CTO e Co-Founder AI di questa startup. Parli con il tuo CEO.
    
    REGOLE FONDAMENTALI DI CHAT:
    1. PER I TASK CREATIVI E MENTALI (Codice, Testi, Piani): Esegui tu il lavoro al 100%. Consegna l'output finale (codice, copy) pronto per il copia-incolla. Non dare consigli, fai il lavoro.
    2. PER I TASK MANUALI/FISICI (es. "Comprare un dominio", "Configurare account social", "Iscriversi a Stripe"): Dato che non hai le mani per farlo, DEVI COMPORTARTI COME UN MENTORE INTERATTIVO.
       - VIETATO dare liste infinite di istruzioni. 
       - Dai SOLO il PRIMO STEP.
       - Fornisci il link esatto (es. "Vai su https://www.namecheap.com").
       - Spiega esattamente dove cliccare.
       - Concludi SEMPRE il messaggio con: "Fammi sapere quando hai fatto questo passaggio o scrivimi 'fatto', così passiamo al prossimo step."
       - Aspetta la conferma dell'utente prima di dare lo step 2.
    3. Il tuo tono deve essere professionale, diretto, incoraggiante e super pratico.
    4. NIENTE ALLUCINAZIONI VISIVE: È severamente vietato inserire link finti a immagini o diagrammi (es. ![diagramma](url)). Se il CEO ti chiede un'architettura o un flusso di lavoro, rappresentalo SEMPRE E SOLO usando testo ASCII (diagrammi creati con trattini e sbarrette), elenchi puntati o blocchi di codice.`;

    const tasksList = venture.tasks.map((t: any) => 
      `- [${t.status}] ${t.title} (${t.isAI ? 'AI' : 'Umano'})\n  ${t.aiResult ? '-> Risultato: ' + t.aiResult.substring(0, 300) + '...' : ''}`
    ).join('\n');

    const userPrompt = `Dettagli Startup:
    Nome: ${venture.name}
    Nicchia: ${venture.niche}
    
    Stato Attuale dei Task e Risultati:
    ${tasksList}

    📜 CRONOLOGIA RECENTE DELLA CHAT (Ultimi messaggi scambiati):
    ${chatHistory}

    Rispondi al CEO.`;

    const aiResponse = await AIOrchestrator.executePrompt(userId, 'WARROOM_CHAT', systemPrompt, userPrompt, ventureId);

    await prisma.chatMessage.create({
      data: { ventureId, role: 'ai', content: aiResponse }
    });

    res.status(200).json({ reply: aiResponse });

  } catch (error: any) {
    console.error('[War Room Chat Error]:', error);
    if (error.message === 'BUDGET_EXCEEDED') {
      res.status(402).json({ error: 'Budget AI esaurito.' });
    } else {
      res.status(500).json({ error: 'Errore durante la comunicazione con il CTO.' });
    }
  }
};

export const runBoardMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ventureId = String(req.params.ventureId);
    const { visitors, leads, customers, revenue, costs, notes } = req.body;

    const venture = await prisma.venture.findUnique({
      where: { id: ventureId }
    });

    if (!venture || venture.userId !== userId) {
      res.status(404).json({ error: 'Venture non trovata.' });
      return;
    }

    const systemPrompt = `Sei il "Board of Directors" (Consiglio di Amministrazione) AI di questa startup.
    Il tuo compito è analizzare spietatamente le metriche mensili fornite dal CEO.
    Calcola i tassi di conversione (es. Visitatori -> Clienti) e i margini di profitto (Runway/Burn rate).
    
    DEVI STRUTTURARE LA TUA RISPOSTA ESCLUSIVAMENTE COME UN OGGETTO JSON VALIDO. Nessun testo prima o dopo le parentesi graffe.
    
    La struttura JSON DEVE essere esattamente questa:
    {
      "report": "Il tuo report completo formattato in Markdown. Inizia sempre con il VERDETTO in MAIUSCOLO (🟢 SCALE, 🟡 PIVOT, 🔴 KILL) seguito dall'analisi dura e cruda dei numeri.",
      "newTasks": [
        {
          "title": "Nome Azione 1",
          "description": "Descrizione dettagliata di cosa fare operativamente.",
          "isAI": true o false
        },
        {
          "title": "Nome Azione 2",
          "description": "Descrizione dettagliata di cosa fare operativamente.",
          "isAI": true o false
        },
        {
          "title": "Nome Azione 3",
          "description": "Descrizione dettagliata di cosa fare operativamente.",
          "isAI": true o false
        }
      ]
    }

    REGOLE PER I NUOVI TASK: Imposta "isAI": true per lavori strategici, copy o codice. Imposta "isAI": false solo per lavori manuali o di pagamento.`;

    const userPrompt = `Startup: ${venture.name} | Nicchia: ${venture.niche}
    
    📊 METRICHE DI QUESTO MESE:
    - Visitatori Unici: ${visitors}
    - Leads/Iscritti gratuiti: ${leads}
    - Clienti Paganti: ${customers}
    - Fatturato Mensile: $${revenue}
    - Costi Mensili: $${costs}
    
    Note del CEO: "${notes || 'Nessuna nota aggiuntiva.'}"
    
    Genera il Report e le 3 Azioni in formato JSON.`;

    const aiResponse = await AIOrchestrator.executePrompt(userId, 'BOARD_MEETING', systemPrompt, userPrompt, ventureId);

    let parsedData;
    try {
      const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanJson);
    } catch (e) {
      console.error("Errore parse JSON Board:", aiResponse);
      throw new Error('L\'AI non ha restituito un formato valido.');
    }

    const dateStr = new Date().toLocaleDateString('it-IT');
    const reportTask = await prisma.task.create({
      data: {
        ventureId,
        title: `📈 Board Meeting: Report Mensile (${dateStr})`,
        description: `Metriche fornite: ${visitors} visitatori, ${customers} clienti, $${revenue} fatturato, $${costs} costi.`,
        isAI: true,
        status: 'DONE',
        aiResult: parsedData.report
      }
    });

    const createdTasks = [];
    for (const t of parsedData.newTasks) {
      const newTask = await prisma.task.create({
        data: {
          ventureId,
          title: `🎯 [Azione Mese] ${t.title}`,
          description: t.description,
          isAI: t.isAI,
          status: 'TODO'
        }
      });
      createdTasks.push(newTask);
    }

    res.status(200).json({ message: 'Board Meeting completato con successo!', data: reportTask });

  } catch (error: any) {
    console.error('[Board Meeting Error]:', error);
    if (error.message === 'BUDGET_EXCEEDED') {
      res.status(402).json({ error: 'Budget AI esaurito.' });
    } else {
      res.status(500).json({ error: 'Errore durante il Board Meeting.' });
    }
  }
};