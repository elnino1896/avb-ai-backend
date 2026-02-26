// src/validation/market/validation.routes.ts
import { Router } from 'express';
import { validateVenture } from './validation.controller';
import { requireAuth } from '../../core/middlewares/auth.middleware';

const router = Router();

// L'URL sarà: POST /api/v1/validation/market/:ventureId
router.post('/:ventureId', requireAuth, validateVenture);

export default router;