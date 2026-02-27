// src/execution/execution.routes.ts
import { Router } from 'express';
import { generateExecutionPlan, getWarRoomData, completeHumanTask, executeAITask } from './execution.controller';
import { requireAuth } from '../core/middlewares/auth.middleware';

const router = Router();

// Creazione e Lettura War Room
router.post('/:ventureId/plan', requireAuth, generateExecutionPlan);
router.get('/:ventureId', requireAuth, getWarRoomData);

// 🔥 NUOVE ROTTE: Esecuzione Task
router.put('/task/:taskId/complete', requireAuth, completeHumanTask);
router.post('/task/:taskId/execute-ai', requireAuth, executeAITask);

export default router;