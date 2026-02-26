// src/core/auth/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../../shared/utils/prisma';

// Chiave segreta dal file .env
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 1. Validazione base
    if (!email || !password) {
      res.status(400).json({ error: 'Email e password sono obbligatori.' });
      return;
    }

    // 2. Controllo se l'utente esiste già
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Un utente con questa email esiste già.' });
      return;
    }

    // 3. Hash della password (Sicurezza)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Calcolo della data di reset del budget (es. tra 30 giorni)
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);

    // 5. Creazione Utente + Portafoglio AI (Transazione singola)
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        budget: {
          create: {
            monthlyLimit: 10.0, // Diamo 10$ di budget AI per il trial
            resetDate: resetDate
          }
        }
      },
      include: {
        budget: true // Restituiamo anche i dati del budget appena creato
      }
    });

    // 6. Generazione del Token JWT
    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

    // 7. Risposta al client (senza inviare la password!)
    res.status(201).json({
      message: 'Utente registrato con successo e Budget AI inizializzato.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        plan: newUser.plan,
        budget: newUser.budget
      }
    });

  } catch (error) {
    console.error('[Auth Error]:', error);
    res.status(500).json({ error: 'Errore interno del server durante la registrazione.' });
  }
};

// Aggiungi questo in fondo a src/core/auth/auth.controller.ts

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email e password sono obbligatori.' });
      return;
    }

    // 1. Cerca l'utente e includi il suo budget
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { budget: true }
    });

    if (!user) {
      res.status(401).json({ error: 'Credenziali non valide.' });
      return;
    }

    // 2. Verifica la password criptata
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Credenziali non valide.' });
      return;
    }

    // 3. Genera un nuovo Token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Login effettuato con successo.',
      token,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        budget: user.budget
      }
    });

  } catch (error) {
    console.error('[Login Error]:', error);
    res.status(500).json({ error: 'Errore interno durante il login.' });
  }
};