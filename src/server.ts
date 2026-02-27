// src/server.ts
import dotenv from 'dotenv';
dotenv.config(); // <--- DEVE ESSERE LA PRIMA COSA IN ASSOLUTO!

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Importiamo le nostre rotte
import authRoutes from './core/auth/auth.routes';
import userRoutes from './users/user.routes';
import ventureRoutes from './portfolio/ventures/venture.routes';
import strategyRoutes from './portfolio/strategy/strategy.routes';
import billingRoutes from './billing/billing.routes';
import validationRoutes from './validation/market/validation.routes';
import executionRoutes from './execution/execution.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 
app.use(cors()); 
app.use(morgan('dev')); 
app.use(express.json()); 

// --- ROTTE API ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/ventures', ventureRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/validation/market', validationRoutes);

// LA MAGIA È QUI: Agganciamo la strategia alla rotta corretta!
app.use('/api/v1/strategy', strategyRoutes);

app.use('/api/v1/execution', executionRoutes);

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'online', message: 'AVB-AI Engine is running 🚀' });
});

// Avvio del server
app.listen(PORT, () => {
  console.log(`\n🚀 [AVB-AI] Server operativo sulla porta ${PORT}`);
});

