// src/execution/execution.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../core/middlewares/auth.middleware';
import { prisma } from '../shared/utils/prisma';
import { AIOrchestrator } from '../ai/engine/orchestrator';

export const generateExecutionPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    // FIX 1: Forziamo la conversione in stringa per calmare TypeScript
    const ventureId = String(req.params.ventureId);

    const venture = await prisma.venture.findUnique({
      where: { id: ventureId }
    });

    if (!venture || venture.userId !== userId) {
      res.status(404).json({ error: 'Venture non trovata.' });
      return;
    }

    const systemPrompt = `Sei il formidabile CTO e COO di questa startup. Il progetto è stato approvato e dobbiamo passare all'azione.
    Il tuo compito è scomporre la creazione di questo business in ESATTAMENTE 5 task operativi fondamentali per lanciare l'MVP (Minimum Viable Product).
    
    DEVI decidere chi farà cosa:
    - Task strategici, fisici o decisionali per l'umano (es. "Registrare dominio", "Contattare 5 clienti") -> imposta "isAI": false
    - Task di pura creazione contenuti, codice o analisi (es. "Scrivere i testi della Landing Page", "Strutturare lo schema del database") -> imposta "isAI": true
    
    Rispondi ESATTAMENTE E SOLO con un array JSON valido usando questa struttura esatta. Nessun testo prima o dopo le parentesi quadre:
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

    const createdTasks = await Promise.all(
      tasksData.map((t: any) => 
        prisma.task.create({
          data: {
            ventureId,
            title: t.title,
            description: t.description,
            isAI: t.isAI,
            status: 'TODO'
          }
        })
      )
    );

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

    // FIX 2: Usiamo 'any' per bypassare i problemi di cache di Prisma su Render
    const venture: any = await prisma.venture.findUnique({
      where: { id: ventureId },
      include: { 
        tasks: {
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

    // FIX 2: Usiamo 'any'
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

    const systemPrompt = `Sei un Senior Specialist incaricato di eseguire MATERIALMENTE questo lavoro per la startup in lancio. 
    Sii iper-specifico, professionale e fornisci un output pronto all'uso (es. se è un testo per una landing page, scrivi il copy finale; se è un piano, fai l'elenco puntato definitivo).
    Non fare premesse, restituisci solo il lavoro finito.`;

    const userPrompt = `Dettagli Startup:
    Nome: ${task.venture.name}
    Nicchia: ${task.venture.niche}
    Contesto: ${task.venture.description}

    IL TUO TASK DA ESEGUIRE ORA:
    Titolo: ${task.title}
    Descrizione/Istruzioni: ${task.description}`;

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

// Aggiungi questa funzione alla fine di src/execution/execution.controller.ts

export const sendWarRoomMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ventureId = String(req.params.ventureId);
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Il messaggio non può essere vuoto.' });
      return;
    }

    // 1. Recuperiamo la Venture e i Task per dare CONTESTO all'AI
    const venture: any = await prisma.venture.findUnique({
      where: { id: ventureId },
      include: { tasks: true }
    });

    if (!venture || venture.userId !== userId) {
      res.status(404).json({ error: 'Venture non trovata.' });
      return;
    }

    // 🧠 2. IL PROMPT DEL CTO IN CHAT
    const systemPrompt = `Sei il CTO e Co-Founder AI di questa startup. Stai parlando in tempo reale con il tuo CEO (l'umano).
    Rispondi in modo iper-diretto, pratico e strategico. Niente convenevoli noiosi.
    Se ti fa una domanda tecnica, di marketing o su un task specifico, dagli la soluzione esatta step-by-step per sbloccare la situazione.
    Sei un esecutore, non un filosofo.`;

    // Prepariamo la lista dei task per fargli sapere a che punto siete
    const tasksList = venture.tasks.map((t: any) => `- [${t.status}] ${t.title} (${t.isAI ? 'AI' : 'Umano'})`).join('\n');

    const userPrompt = `Dettagli Startup:
    Nome: ${venture.name}
    Nicchia: ${venture.niche}
    
    Stato Attuale dei Task:
    ${tasksList}

    Messaggio urgente dal CEO: "${message}"`;

    // 3. Facciamo rispondere l'Oracolo!
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