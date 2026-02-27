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

    const systemPrompt = `Sei un Senior Developer, Copywriter e Growth Hacker. Il tuo compito NON è spiegare come si fa un lavoro, ma FARLO MATERIALMENTE.
    
    REGOLE DI ESECUZIONE (VIETATO INFRANGERLE):
    1. VIETATO FARE LISTE GENERICHE: Non dire "crea una pagina", "scegli un hosting".
    2. PRENDI LE DECISIONI: Scegli TU lo strumento migliore e imponilo.
    3. FORNISCI IL MATERIALE PRONTO: Scrivi codice, query del database o copy finale pronto per il copia-incolla. Se è marketing, dammi il target esatto e i testi delle ads.
    4. USA LA MEMORIA: Usa i dati dei task passati che trovi nel contesto.`;

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

    // 🔥 FIX DEFINITIVO: IL CTO DIVENTA UN MENTORE INTERATTIVO PER I TASK UMANI!
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
    3. Il tuo tono deve essere professionale, diretto, incoraggiante e super pratico.`;

    const tasksList = venture.tasks.map((t: any) => 
      `- [${t.status}] ${t.title} (${t.isAI ? 'AI' : 'Umano'})\n  ${t.aiResult ? '-> Risultato: ' + t.aiResult.substring(0, 300) + '...' : ''}`
    ).join('\n');

    const userPrompt = `Dettagli Startup:
    Nome: ${venture.name}
    Nicchia: ${venture.niche}
    
    Stato Attuale dei Task e Risultati:
    ${tasksList}

    Messaggio dal CEO: "${message}"`;

    const aiResponse = await AIOrchestrator.executePrompt(userId, 'WARROOM_CHAT', systemPrompt, userPrompt, ventureId);

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