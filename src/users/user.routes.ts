// src/users/user.routes.ts
import { Router } from 'express';
import { getMyDashboard } from './user.controller';
import { requireAuth } from '../core/middlewares/auth.middleware';

const router = Router();

// Rotta protetta: solo chi ha il token può vedere il proprio portafoglio
router.get('/me', requireAuth, getMyDashboard);

export default router;