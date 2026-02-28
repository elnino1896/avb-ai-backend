// src/automation/automation.service.ts
import { prisma } from '../shared/utils/prisma';
import { AIOrchestrator } from '../ai/engine/orchestrator';

export class AutomationService {
  
  static async runDailyAutomations() {
    console.log('🤖 [CRON-HEARTBEAT] Battito cardiaco ricevuto. Controllo le schedulazioni...');

    try {
      const targetUser = await prisma.user.findUnique({
        where: { email: 'founder@avb-ai.com' } 
      });

      if (!targetUser) return { success: false, message: 'Utente test non trovato' };

      // Recuperiamo TUTTE le venture attive con un'automazione
      const ventures = await prisma.venture.findMany({
        where: {
          userId: targetUser.id,
          dailyAutomation: { not: null },
          status: 'OPERATIONAL'
        }
      });

      let executedCount = 0;

      for (const venture of ventures) {
        if (!venture.automationTime || !venture.automationTimezone) continue;

        // 1. CALCOLO DELL'ORARIO LOCALE DELLA STARTUP
        // Che ore sono ADESSO nel fuso orario richiesto da questa startup?
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: venture.automationTimezone,
          hour: '2-digit',
          hour12: false
        });
        
        const currentHourInTargetZone = formatter.format(new Date()); // Es: "15" o "09"
        const targetHour = venture.automationTime.split(':')[0]; // Prende "15" da "15:00"

        // 2. CONTROLLO DI FREQUENZA E ORARIO
        const isTimeMatch = currentHourInTargetZone === targetHour;
        
        // Evitiamo che giri due volte nella stessa ora/giorno (Cooldown di sicurezza)
        let isCooldownOk = true;
        if (venture.lastAutomationRun) {
          const hoursSinceLastRun = (new Date().getTime() - venture.lastAutomationRun.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastRun < 20) isCooldownOk = false; // Deve passare almeno quasi un giorno
        }

        if (isTimeMatch && isCooldownOk) {
          console.log(`⏰ [MATCH] Eseguo automazione per ${venture.name} (Fuso: ${venture.automationTimezone}, Ora: ${venture.automationTime})`);

          const systemPrompt = `Sei il CTO Co-Pilot di "${venture.name}". Nicchia: "${venture.niche}".
          Task: "${venture.dailyAutomation}"
          Simula/Esegui la ricerca e scrivi un report professionale e amichevole per il CEO da postare nella War Room. Inizia con un saluto.`;

          const aiReport = await AIOrchestrator.executePrompt(
            targetUser.id, 'DAILY_AUTOMATION', systemPrompt, 'Esegui il task', venture.id
          );

          // Iniettiamo nella War Room
          await prisma.chatMessage.create({
            data: { ventureId: venture.id, role: 'ai', content: `**[🤖 AUTOMAZIONE SCHEDULATA COMPLETATA]**\n\n${aiReport}` }
          });

          // Aggiorniamo l'orario dell'ultima esecuzione nel database!
          await prisma.venture.update({
            where: { id: venture.id },
            data: { lastAutomationRun: new Date() }
          });

          executedCount++;
        } else {
          console.log(`💤 [SKIP] ${venture.name} dorme. (Ora target: ${targetHour}, Ora locale lì: ${currentHourInTargetZone})`);
        }
      }

      console.log(`🏁 [CRON-HEARTBEAT] Fine. Eseguite ${executedCount} automazioni.`);
      return { success: true, executed: executedCount };

    } catch (error) {
      console.error('❌ [CRON] Errore critico:', error);
      return { success: false, error: 'Errore interno' };
    }
  }
}