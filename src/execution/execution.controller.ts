// src/execution/execution.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../core/middlewares/auth.middleware';
import { prisma } from '../shared/utils/prisma';
import { AIOrchestrator } from '../ai/engine/orchestrator';

export const generateExecutionPlan = async (req: AuthRequest, res: Response): Promise<void> => {
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

    // 🧠 2. IL PROMPT DEL CTO: Scomposizione in Task
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

    // 3. Eseguiamo l'AI
    const aiResponse = await AIOrchestrator.executePrompt(userId, 'EXECUTION_PLAN', systemPrompt, userPrompt, ventureId);

    // 4. Puliamo e parsiamo l'array JSON
    const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const tasksData = JSON.parse(cleanJson);

    // 5. Salviamo i task nel Database! 💾
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

    // 6. Promuoviamo la startup in "Fase Operativa"
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

// Aggiungi questa funzione in fondo a src/execution/execution.controller.ts
export const getWarRoomData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ventureId = req.params.ventureId as string;

    // Recuperiamo la Venture e, grazie a Prisma, INCLUDIAMO I TASK collegati!
    const venture = await prisma.venture.findUnique({
      where: { id: ventureId },
      include: { 
        tasks: {
          orderBy: { createdAt: 'asc' } // Li ordiniamo dal più vecchio al più nuovo
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

// Aggiungi queste due funzioni in fondo a src/execution/execution.controller.ts

// 1. Funzione per l'Umano: Segna semplicemente il task come completato
export const completeHumanTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    
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

// 2. Funzione per l'AI: Esegue materialmente il lavoro! 🤖🔥
export const executeAITask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;

    // Recuperiamo il task e la venture associata
    const task = await prisma.task.findUnique({
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

    // 🧠 IL PROMPT ESECUTIVO: Diciamo all'AI di lavorare
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

    // Facciamo lavorare l'AI!
    const aiResult = await AIOrchestrator.executePrompt(userId, 'TASK_EXECUTION', systemPrompt, userPrompt, task.ventureId);

    // Salviamo il lavoro e completiamo il task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { 
        status: 'DONE',
        aiResult: aiResult // Salviamo il lavoro prodotto dall'AI!
      }
    });

    res.status(200).json({ message: 'Task eseguito dall\'AI!', data: updatedTask });

  } catch (error: any) {
    console.error('[AI Task Error]:', error);
    res.status(500).json({ error: 'Errore durante l\'esecuzione del task da parte dell\'AI.' });
  }
};