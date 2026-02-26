// src/validation/market/validation.routes.ts
import { Router } from 'express';
import { validateVenture } from './validation.controller';
import { requireAuth } from '../../core/middlewares/auth.middleware';

const router = Router();

// L'URL sarà: POST /api/v1/validation/:ventureId/validate
router.post('/:ventureId/validate', requireAuth, validateVenture);

export default router;