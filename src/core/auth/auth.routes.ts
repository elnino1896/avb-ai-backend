// src/core/auth/auth.routes.ts
import { Router } from 'express';
import { register, login } from './auth.controller'; // <--- Aggiunto login qui

const router = Router();

router.post('/register', register);
router.post('/login', login); // <--- Nuova rotta!

export default router;