// src/billing/billing.routes.ts
import { Router } from 'express';
import { upgradePlan } from './billing.controller';
import { requireAuth } from '../core/middlewares/auth.middleware';

const router = Router();

// L'URL sarà: POST /api/v1/billing/upgrade
router.post('/upgrade', requireAuth, upgradePlan);

export default router;