// src/portfolio/ventures/venture.routes.ts
import { Router } from 'express';
import { generateVentures, createVenture } from './venture.controller'; // <-- Aggiunto createVenture
import { requireAuth } from '../../core/middlewares/auth.middleware';

const router = Router();

// Endpoint per generare le idee (già fatto)
router.post('/generate', requireAuth, generateVentures);

// NUOVO Endpoint per salvare l'idea scelta nel database
router.post('/', requireAuth, createVenture);

export default router;