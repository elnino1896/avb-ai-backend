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