// src/execution/execution.routes.ts
import { Router } from 'express';
// 🔥 FIX: Abbiamo aggiunto runBoardMeeting alla lista degli import
import { generateExecutionPlan, getWarRoomData, completeHumanTask, executeAITask, sendWarRoomMessage, runBoardMeeting } from './execution.controller';
import { requireAuth } from '../core/middlewares/auth.middleware';

const router = Router();

// Creazione e Lettura War Room
router.post('/:ventureId/plan', requireAuth, generateExecutionPlan);
router.get('/:ventureId', requireAuth, getWarRoomData);

// Esecuzione Task
router.put('/task/:taskId/complete', requireAuth, completeHumanTask);
router.post('/task/:taskId/execute-ai', requireAuth, executeAITask);

// Chat della War Room
router.post('/:ventureId/chat', requireAuth, sendWarRoomMessage);

// 🔥 LA NUOVA ROTTA: Board Meeting Mensile
router.post('/:ventureId/board', requireAuth, runBoardMeeting);

export default router;