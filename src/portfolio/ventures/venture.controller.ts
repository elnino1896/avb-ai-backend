// src/portfolio/ventures/venture.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { AIOrchestrator } from '../../ai/engine/orchestrator';
import { prisma } from '../../shared/utils/prisma'; // <-- Aggiunto l'import di Prisma

export const generateVentures = async (req: AuthRequest, res: Response): Promise<void> => {
  // ... (Lascia intatto il codice che c'è già qui dentro per generare le idee)
  try {
    const userId = req.user!.id;
    const { skills, interests, riskLevel } = req.body;

    if (!skills || !interests) {
      res.status(400).json({ error: 'Skills e interessi sono richiesti.' });
      return;
    }

    const systemPrompt = `Sei un Senior Venture Builder AI. Genera 3 idee di startup SaaS o e-commerce.`;
    const userPrompt = `Skills: ${skills.join(', ')}. Interessi: ${interests.join(', ')}. Rischio: ${riskLevel || 'MEDIUM'}`;

    const aiResponse = await AIOrchestrator.executePrompt(userId, 'IDEA_GENERATION', systemPrompt, userPrompt);
    res.status(200).json({ message: 'Venture generate con successo.', data: aiResponse });
  } catch (error: any) {
    res.status(500).json({ error: 'Errore durante la generazione.' });
  }
};

// --- NUOVA FUNZIONE: Salvataggio della Venture Scelta ---
export const createVenture = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, niche, description, monthlyBudget, riskLevel } = req.body;

    if (!name || !niche || !description) {
      res.status(400).json({ error: 'Nome, nicchia e descrizione sono obbligatori.' });
      return;
    }

    // Creiamo fisicamente la Venture nel database
    const newVenture = await prisma.venture.create({
      data: {
        userId,
        name,
        niche,
        description,
        monthlyBudget: monthlyBudget || 0.0,
        riskLevel: riskLevel || 'MEDIUM',
        status: 'IDEATION' // Stato iniziale del ciclo di vita
      }
    });

    res.status(201).json({
      message: 'Venture salvata con successo nel Portfolio.',
      data: newVenture
    });

  } catch (error) {
    console.error('[Create Venture Error]:', error);
    res.status(500).json({ error: 'Errore durante il salvataggio della venture.' });
  }
};

// NUOVA FUNZIONE: Recupera tutte le Venture dell'utente
export const getVentures = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    // Peschiamo dal DB tutte le venture di questo utente, ordinate dalla più recente
    const ventures = await prisma.venture.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ data: ventures });
  } catch (error) {
    console.error('[Venture Error]:', error);
    res.status(500).json({ error: 'Errore durante il recupero del portfolio.' });
  }
};