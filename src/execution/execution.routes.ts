// src/execution/execution.routes.ts
import { Router } from 'express';
// Assicurati di aver aggiunto sendWarRoomMessage agli import!
import { generateExecutionPlan, getWarRoomData, completeHumanTask, executeAITask, sendWarRoomMessage } from './execution.controller';
import { requireAuth } from '../core/middlewares/auth.middleware';

const router = Router();

// Creazione e Lettura War Room
router.post('/:ventureId/plan', requireAuth, generateExecutionPlan);
router.get('/:ventureId', requireAuth, getWarRoomData);

// Esecuzione Task
router.put('/task/:taskId/complete', requireAuth, completeHumanTask);
router.post('/task/:taskId/execute-ai', requireAuth, executeAITask);

// 🔥 LA NUOVA ROTTA: Chat della War Room
router.post('/:ventureId/chat', requireAuth, sendWarRoomMessage);

export default router;