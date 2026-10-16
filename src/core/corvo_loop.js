/**
 * 🔄 CORVO AGENTE MOBILE - MOTOR DE LOOP AUTÔNOMO (OPENCLAW RE-ACT ENGINE)
 * Persistência implacável: Só para a missão quando realmente for concluída.
 * Executa ferramentas reais (Shell, Files, Web, Screen, Custom Tools, Recon, SPA Auditor),
 * valida os retornos, corrige erros automaticamente e consulta o Cérebro com Soluções Comprovadas.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const brain = require('./corvo_brain');
const toolsRegistry = require('./corvo_tools_registry');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Formata a lista de ferramentas disponíveis para o modelo
function getToolsPromptDescription() {
  const descriptions = Object.keys(toolsRegistry).map(k => {
    const t = toolsRegistry[k];
    return `### Ferramenta: \`${k}\`
Descrição: ${t.description}
Parâmetros: ${JSON.stringify(t.parameters)}`;
  }).join('\n\n');

  return `Você tem à sua disposição as seguintes FERRAMENTAS REAIS DO SISTEMA:\n\n${descriptions}\n
Para chamar uma ferramenta, responda EXCLUSIVAMENTE com o bloco JSON no seguinte formato:
\`\`\`json
{
  "tool": "nome_da_ferramenta",
  "args": { ...parametros }
}
\`\`\`
Quando a missão estiver 100% CONCLUÍDA e TESTADA com êxito irrefutável, emita:
\`\`\`json
{
  "status": "COMPLETED",
  "final_report": "Relatório detalhado do que foi construído, corrigido ou executado."
}
\`\`\``;
}

/**
 * Executa uma ferramenta do registro
 */
async function dispatchTool(toolName, args) {
  const tool = toolsRegistry[toolName];
  if (!tool) {
    return { success: false, error: `Ferramenta desconhecida: "${toolName}". Use apenas ferramentas registradas.` };
  }
  console.log(`[ACTION DISPATCH] Executando ferramenta "${toolName}" com args:`, JSON.stringify(args).slice(0, 150));
  try {
    return await tool.execute(args || {});
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Motor Principal do Loop Autônomo
 * @param {string} missionId ID único da missão
 * @param {string} objective Objetivo intransigente
 * @param {object} options Opções de execução e callbacks
 */
async function runAutonomousMission(missionId, objective, options = {}) {
  console.log(`\n==================================================`);
  console.log(`🦅 [OPENCLAW LOOP] MISSÃO INICIADA: [${missionId}]`);
  console.log(`🎯 OBJETIVO: ${objective}`);
  console.log(`==================================================\n`);

  brain.saveMission(missionId, objective, 'running', 0, null);

  if (!genAI) {
    const err = 'GEMINI_API_KEY não configurada no .env';
    console.error(`[OPENCLAW ERROR] ${err}`);
    brain.saveMission(missionId, objective, 'failed', 0, err);
    return { success: false, error: err };
  }

  const activeModel = options.model || process.env.PRIMARY_MODEL || 'gemini-flash-latest';
  const model = genAI.getGenerativeModel({
    model: activeModel,
    generationConfig: {
      temperature: 0.2, // Raciocínio cirúrgico e focado
    }
  });

  // Busca se há soluções comprovadas na memória sobre esta tarefa
  const provenSolutions = brain.getProvenSolutions();
  const provenContext = Object.keys(provenSolutions).length > 0
    ? `\nSoluções comprovadas anteriores na memória neural:\n${JSON.stringify(provenSolutions, null, 2)}\n`
    : '';

  // Busca memórias episódicas correlacionadas
  const recalledMemories = await brain.recall(objective.slice(0, 40), 5);
  const memoryContext = recalledMemories.length > 0
    ? `\nMemórias e fatos recuperados:\n${recalledMemories.join('\n')}\n`
    : '';

  const toolsDoc = getToolsPromptDescription();
  const history = [];

  const systemInstruction = `Você é o CORVO AGENTE MOBILE - NÚCLEO AUTÔNOMO (GOD MODE & OPENCLAW PERSISTÊNCIA ABSOLUTA).
Você é o braço direito leal do Marcos (@CORVO291).
Sua missão: Resolver o objetivo do Marcos com precisão de elite. NUNCA DESISTA NO PRIMEIRO ERRO.
Se um comando falhar, analise o erro (stderr, código de retorno), reescreva o script ou encontre outra abordagem.
Você consegue:
- Programar qualquer código, script, site, API, automação ou APK.
- Controlar o Android/Termux, executar shell, ler/gravar qualquer arquivo no disco.
- Capturar tela, criar ferramentas novas em runtime, buscar na web.
- PERSISTÊNCIA TOTAL: Você só tem autorização para parar quando o objetivo estiver 100% realizado na prática.
${provenContext}
${memoryContext}
${toolsDoc}`;

  let step = 0;
  const MAX_STEPS = options.maxSteps || 30; // Até 30 iterações implacáveis
  let completed = false;
  let finalReport = '';

  // Injeção do primeiro objetivo
  history.push({
    role: 'user',
    parts: [{ text: `INICIAR MISSÃO:\nObjetivo: "${objective}"\n\nAnalise o objetivo e execute o primeiro passo técnico chamando a ferramenta necessária.` }]
  });

  while (!completed && step < MAX_STEPS) {
    step++;
    console.log(`\n>>> [LOOP STEP ${step}/${MAX_STEPS}] Avaliando e Executando...`);

    try {
      // Monta conversa e gera pensamento
      const chat = model.startChat({
        history: history.slice(-10) // Mantém os últimos 10 turnos de contexto vivo
      });

      const response = await chat.sendMessage(
        step === 1 ? systemInstruction : `Passo atual ${step}. Continue a execução da missão até a conclusão total.`
      );

      const replyText = response.response.text();
      console.log(`[AGENTE RACIOCÍNIO]:\n${replyText}\n`);

      history.push({ role: 'model', parts: [{ text: replyText }] });

      // Busca por bloco JSON de chamada de ferramenta ou conclusão
      const jsonMatch = replyText.match(/```json\s*([\s\S]*?)\s*```/) || replyText.match(/(\{[\s\S]*"tool"[\s\S]*\})/) || replyText.match(/(\{[\s\S]*"status"[\s\S]*\})/);

      if (jsonMatch) {
        let parsed = null;
        try {
          parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } catch (e) {
          console.warn('[PARSE WARN] Falha ao parsear JSON da IA, solicitando correção...');
        }

        if (parsed && parsed.status === 'COMPLETED') {
          completed = true;
          finalReport = parsed.final_report || replyText;
          console.log(`\n🎉 [MISSÃO CONCLUÍDA COM SUCESSO NO PASSO ${step}]`);
          brain.saveMission(missionId, objective, 'completed', step, finalReport);
          brain.remember('mission_success', `Missão ${missionId} completada: ${objective}`);
          if (options.onComplete) options.onComplete({ success: true, step, report: finalReport });
          return { success: true, steps: step, report: finalReport };
        }

        if (parsed && parsed.tool) {
          // Executa a ferramenta de verdade
          const toolResult = await dispatchTool(parsed.tool, parsed.args);
          console.log(`[TOOL RESULT]:`, JSON.stringify(toolResult).slice(0, 200));

          const observationMsg = `[RESULTADO DA FERRAMENTA ${parsed.tool}]:\n${JSON.stringify(toolResult, null, 2)}\n\nAnalise este resultado real. Se o objetivo foi totalmente cumprido, emita o JSON com status COMPLETED. Se ainda faltar algo ou tiver dado erro, continue com a próxima ação.`;

          history.push({ role: 'user', parts: [{ text: observationMsg }] });
          brain.remember(`mission_${missionId}`, `Passo ${step} [${parsed.tool}]: ${toolResult.success ? 'Sucesso' : 'Erro'}`);
          continue;
        }
      }

      // Se respondeu apenas texto sem chamar ferramenta, forçar o modelo a agir
      history.push({
        role: 'user',
        parts: [{ text: `Atenção: Você deve emitir um comando JSON de ferramenta para executar a ação no sistema ou emitir {"status": "COMPLETED"} se o trabalho estiver 100% pronto.` }]
      });

    } catch (loopErr) {
      console.error(`[LOOP EXCEPTION no passo ${step}]:`, loopErr.message);
      await new Promise(r => setTimeout(r, 3000));
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  if (!completed) {
    const timeoutMsg = `Limite de ${MAX_STEPS} passos atingido para a missão.`;
    console.warn(`[LOOP TIMEOUT] ${timeoutMsg}`);
    brain.saveMission(missionId, objective, 'max_steps_reached', step, timeoutMsg);
    return { success: false, steps: step, error: timeoutMsg };
  }
}

module.exports = { runAutonomousMission, dispatchTool };
