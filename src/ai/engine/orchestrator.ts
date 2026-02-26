// src/ai/engine/orchestrator.ts
import OpenAI from 'openai';
import { prisma } from '../../shared/utils/prisma';
import { BudgetGuardrail } from '../../budget/guardrails/budget.service';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prezzi per GPT-4o-mini (per 1000 token)
const COST_PER_1K_INPUT = 0.00015;
const COST_PER_1K_OUTPUT = 0.00060;

export class AIOrchestrator {
  static async executePrompt(
    userId: string,
    actionType: string,
    systemPrompt: string,
    userPrompt: string,
    ventureId?: string
  ): Promise<string> {
    
    // 1. Controllo Preventivo Budget (Guardrail)
    // Verifichiamo se l'utente ha almeno 1 centesimo residuo per iniziare
    const isAffordable = await BudgetGuardrail.canAfford(userId, 0.01);
    if (!isAffordable) {
      throw new Error('BUDGET_EXCEEDED');
    }

    try {
      console.log(`[AI Orchestrator] Avvio generazione per utente ${userId}...`);
      
      // 2. Chiamata a OpenAI
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7, // Creatività bilanciata
      });

      const aiOutput = response.choices[0].message.content || '';
      const usage = response.usage;

      // 3. Calcolo Costo Esatto al millesimo di centesimo
      let actualCost = 0;
      let totalTokens = 0;
      
      if (usage) {
        const inputCost = (usage.prompt_tokens / 1000) * COST_PER_1K_INPUT;
        const outputCost = (usage.completion_tokens / 1000) * COST_PER_1K_OUTPUT;
        actualCost = inputCost + outputCost;
        totalTokens = usage.total_tokens;
      }

      // 4. Aggiornamento Portafoglio (Guardrail Post-Volo)
      await BudgetGuardrail.deductCost(userId, actualCost);

      // 5. Salvataggio Log Decisionale Infallibile (Memoria)
      await prisma.aIDecisionLog.create({
        data: {
          userId,
          ventureId,
          actionType,
          inputPrompt: `SYS: ${systemPrompt}\nUSER: ${userPrompt}`,
          aiOutput: aiOutput,
          tokensUsed: totalTokens,
          costEstimated: actualCost,
          modelUsed: 'gpt-4o-mini'
        }
      });

      return aiOutput;

    } catch (error) {
      console.error('[AI Orchestrator Error]:', error);
      throw error;
    }
  }
}