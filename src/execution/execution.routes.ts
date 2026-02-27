// src/execution/execution.routes.ts
import { Router } from 'express';
import { generateExecutionPlan } from './execution.controller';
import { requireAuth } from '../core/middlewares/auth.middleware';

const router = Router();

// L'URL sarà: POST /api/v1/execution/:ventureId/plan
router.post('/:ventureId/plan', requireAuth, generateExecutionPlan);

// 🔥 LA NUOVA ROTTA per leggere i dati
router.get('/:ventureId', requireAuth, getWarRoomData);

export default router;