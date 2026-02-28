// src/automation/automation.service.ts
import { prisma } from '../shared/utils/prisma';
import { AIOrchestrator } from '../ai/engine/orchestrator';

export class AutomationService {
  
  // Questa funzione verrà chiamata dal Cron Job ogni giorno
  static async runDailyAutomations() {
    console.log('🤖 [CRON] Inizio routine di Automazione Giornaliera...');

    try {
      // 1. TROVIAMO L'UTENTE AUTORIZZATO (Il recinto di sicurezza)
      const targetUser = await prisma.user.findUnique({
        where: { email: 'founder@avb-ai.com' } // 🔥 BLOCCO DI SICUREZZA
      });

      if (!targetUser) {
        console.log('❌ [CRON] Utente founder@avb-ai.com non trovato. Abortisco.');
        return { success: false, message: 'Utente test non trovato' };
      }

      // 2. RECUPERIAMO LE VENTURE DA AUTOMATIZZARE
      // Cerchiamo le venture dell'utente che hanno un'automazione definita
      const venturesToAutomate = await prisma.venture.findMany({
        where: {
          userId: targetUser.id,
          dailyAutomation: { not: null },
          status: 'OPERATIONAL' // Esegue solo se la startup è attiva nella War Room!
        }
      });

      console.log(`📡 [CRON] Trovate ${venturesToAutomate.length} venture da automatizzare per il Founder.`);

      // 3. ESEGUIAMO IL TASK PER OGNI VENTURE
      for (const venture of venturesToAutomate) {
        console.log(`⚙️ Esecuzione automazione per: ${venture.name}...`);

        // Il prompt per il nostro Agente "Ricercatore"
        const systemPrompt = `Sei l'Agente AI Autonomo (CTO Co-Pilot) di una startup chiamata "${venture.name}".
        La tua nicchia è: "${venture.niche}".
        Il tuo compito assegnato per oggi è eseguire questa automazione specifica: 
        "${venture.dailyAutomation}"
        
        AGISCI ORA: Genera un report realistico come se avessi appena navigato sul web. 
        Trova o simula 3 risultati pratici e specifici (es. se ti si chiede di cercare modelli 3D, inventa/trova 3 nomi di modelli molto plausibili e spiega perché sono ottimi da vendere).
        
        Rispondi DIRETTAMENTE con il messaggio che invierai all'utente, usa un tono professionale ma amichevole, usa emoji e formatta il testo in Markdown. NON usare formati JSON, scrivi come se stessi chattando. Inizia con un saluto tipo "Buongiorno CEO! Ho appena completato la scansione giornaliera..."`;

        const userPrompt = `Esegui il task di automazione e dammi i risultati.`;

        // L'AI esegue il lavoro
        const aiReport = await AIOrchestrator.executePrompt(
          targetUser.id,
          'DAILY_AUTOMATION',
          systemPrompt,
          userPrompt,
          venture.id
        );

        // 4. INIEZIONE NELLA WAR ROOM (Magia Nera 🪄)
        // Salviamo il report come un normale messaggio di chat da parte dell'AI
        await prisma.chatMessage.create({
          data: {
            ventureId: venture.id,
            role: 'ai',
            content: `**[🤖 AUTOMAZIONE GIORNALIERA COMPLETATA]**\n\n${aiReport}`
          }
        });

        console.log(`✅ Messaggio iniettato nella War Room di ${venture.name}!`);
      }

      console.log('🏁 [CRON] Routine completata con successo.');
      return { success: true, message: `Eseguite automazioni per ${venturesToAutomate.length} venture.` };

    } catch (error) {
      console.error('❌ [CRON] Errore critico durante le automazioni:', error);
      return { success: false, error: 'Errore interno' };
    }
  }
}