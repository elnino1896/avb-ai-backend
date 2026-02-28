// src/automation/automation.routes.ts
import { Router, Request, Response } from 'express';
import { AutomationService } from './automation.service';

const router = Router();

// Endpoint protetto (Idealmente ci andrebbe una chiave segreta, ma per test va bene così)
router.get('/run-cron', async (req: Request, res: Response) => {
  console.log('⚡ Richiesta manuale di avvio CRON ricevuta!');
  const result = await AutomationService.runDailyAutomations();
  res.json(result);
});

export default router;