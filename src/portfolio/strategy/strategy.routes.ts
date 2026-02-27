import { Router } from 'express';
import { generateStrategy } from './strategy.controller';
import { requireAuth } from '../../core/middlewares/auth.middleware';

const router = Router();

// L'URL ORA COMBACIA AL MILLIMETRO COL FRONTEND: POST /api/v1/strategy/pivot/:ventureId
router.post('/pivot/:ventureId', requireAuth, generateStrategy);

export default router;