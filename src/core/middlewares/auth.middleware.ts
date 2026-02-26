// src/core/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Estendiamo l'interfaccia Request di Express per includere l'utente
export interface AuthRequest extends Request {
  user?: { id: string };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Accesso negato. Token mancante o formato non valido.' });
    return;
  }

  // Estraiamo il token (rimuovendo la parola "Bearer ")
  const token = authHeader.split(' ')[1];

  try {
    // Verifichiamo il token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // Attacchiamo l'ID utente alla richiesta, così i prossimi controller sanno chi sta chiamando
    req.user = { id: decoded.userId };
    
    // Passiamo al prossimo controller (via libera!)
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token non valido o scaduto.' });
  }
};