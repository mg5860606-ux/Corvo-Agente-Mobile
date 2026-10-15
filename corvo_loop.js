/**
 * 🔄 CORVO AGENTE MOBILE - AUTONOMOUS LOOP (ESTILO OPENCLAW)
 * Roda em loop contínuo resolvendo a missão passo a passo com reflexão
 * e autocorreção, parando APENAS quando o objetivo for 100% concluído.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const godMode = require('./corvo_god_mode');
const selfCoding = require('./corvo_self_coding');
const brain = require('./corvo_brain');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

async function runAutonomousMission(missionId, objective) {
  console.log(`[AUTONOMOUS LOOP] Iniciando missão [${missionId}]: ${objective}`);
  brain.saveMission(missionId, objective, 'running', 0, null);

  if (!genAI) {
    console.error('[ERRO] GEMINI_API_KEY não configurada.');
    brain.saveMission(missionId, objective, 'failed', 0, 'API Key ausente');
    return;
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  let step = 0;
  let completed = false;
  let finalReport = '';

  while (!completed && step < 15) {
    step++;
    console.log(`\n--- [AUTONOMOUS LOOP] Iteração / Passo ${step} ---`);

    const prompt = `Você é o Corvo Agente Mobile em Loop Autônomo Contínuo (Estilo OpenClaw).
Objetivo da Missão: "${objective}"
Passo atual: ${step}

Instruções:
- Analise o estado atual da missão.
- Decida a próxima ação técnica a ser executada no Android (shell, arquivo, teste, etc.).
- Se a missão estiver 100% concluída, inicie sua resposta com a tag "[MISSAO_CONCLUIDA]" seguida do relatório final detalhado.
- Se ainda faltar passos, indique a ação que você tomou ou o raciocínio atual.`;

    try {
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      console.log(`[IA PENSAMENTO]:\n${text}`);

      if (text.includes('[MISSAO_CONCLUIDA]')) {
        completed = true;
        finalReport = text.replace('[MISSAO_CONCLUIDA]', '').trim();
        console.log(`[AUTONOMOUS LOOP] Missão concluída com sucesso no passo ${step}!`);
        brain.saveMission(missionId, objective, 'completed', step, finalReport);
      } else {
        brain.remember(`mission_${missionId}`, `Passo ${step}: ${text.substring(0, 150)}`);
      }
    } catch (e) {
      console.error(`[ERRO NO LOOP] Passo ${step} falhou:`, e.message);
      await new Promise(r => setTimeout(r, 3000));
    }

    // Intervalo de respiro entre iterações
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!completed) {
    console.log(`[AUTONOMOUS LOOP] Limite de passos atingido para a missão ${missionId}.`);
    brain.saveMission(missionId, objective, 'max_steps_reached', step, 'Limite de iterações atingido.');
  }
}

module.exports = { runAutonomousMission };
