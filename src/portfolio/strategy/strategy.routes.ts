// src/portfolio/strategy/strategy.routes.ts
import { Router } from 'express';
import { generateStrategy } from './strategy.controller';
import { requireAuth } from '../../core/middlewares/auth.middleware';

const router = Router();

// L'URL sarà: POST /api/v1/ventures/:ventureId/strategy
router.post('/:ventureId/strategy', requireAuth, generateStrategy);

export default router;