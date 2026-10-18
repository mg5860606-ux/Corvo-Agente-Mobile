/**
 * 🔄 CORVO AGENTE MOBILE - MOTOR DE LOOP AUTÔNOMO APEX (OPENCLAW RE-ACT ENGINE)
 * Persistência implacável: Só para a missão quando for irrefutavelmente concluída.
 * Executa ferramentas reais (Shell, Files, Web, Screen, Custom Tools, Recon, SPA Auditor),
 * auto-extensão em tempo real (cria ferramentas se faltar), corrige erros e consulta o Cérebro.
 * Provedor Primário: ISA Cloud / OmniRoute (compatível com OpenAI SDK), fallback Google Gemini.
 */

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const brain = require('./corvo_brain');
const toolsRegistry = require('./corvo_tools_registry');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Configuração do Provedor Primário: ISA Cloud / OmniRoute (Mesmo da IA Japa C:\xereca017)
const openaiBaseUrl = process.env.ISACLOUD_BASE_URL || process.env.OPENAI_BASE_URL || 'http://127.0.0.1:20129/v1';
const openaiApiKey = process.env.ISACLOUD_API_KEY || process.env.OPENAI_API_KEY || 'sk-aaaafd3c5b149509-76c532-c74703a0';
const openaiClient = (openaiBaseUrl && openaiApiKey)
  ? new OpenAI({ baseURL: openaiBaseUrl, apiKey: openaiApiKey })
  : null;

// Provedor Secundário (Fallback Google Gemini)
const geminiApiKey = process.env.GEMINI_API_KEY;
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// Formata a lista de ferramentas disponíveis para o modelo
function getToolsPromptDescription() {
  // Garante que ferramentas customizadas estejam carregadas
  if (typeof toolsRegistry.loadCustomTools === 'function') {
    toolsRegistry.loadCustomTools();
  }

  const descriptions = Object.keys(toolsRegistry)
    .filter(k => typeof toolsRegistry[k].execute === 'function')
    .map(k => {
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

⚡ SE FALTAR QUALQUER FERRAMENTA OU CAPACIDADE:
Chame imediatamente a ferramenta \`create_custom_tool\` com o código JS ou script necessário.
Ela será compilada e registrada instantaneamente no arsenal para você usá-la no passo seguinte!

Quando a missão estiver 100% CONCLUÍDA e TESTADA com êxito irrefutável no sistema real, emita:
\`\`\`json
{
  "status": "COMPLETED",
  "final_report": "Relatório detalhado do que foi construído, corrigido ou executado."
}
\`\`\``;
}

/**
 * Formata descrição humana e viva da ação atual (Estilo OpenClaw Activity Feed)
 */
function formatActionDescription(toolName, args = {}) {
  switch (toolName) {
    case 'browser_navigate':
      return `🌐 Abrindo site: ${args.url || ''}`;
    case 'browser_click':
      return `🖱️ Clicando em: "${args.target || 'elemento'}"`;
    case 'browser_type':
      return `⌨️ Digitando no campo "${args.selector}": "${(args.text || '').slice(0, 25)}"`;
    case 'browser_screenshot':
      return `📸 Capturando print visual da página...`;
    case 'browser_download':
      return `📥 Baixando arquivo: ${(args.url || '').slice(0, 35)}...`;
    case 'browser_eval':
      return `⚡ Executando script no navegador...`;
    case 'read_file':
      return `📖 Lendo arquivo: ${path.basename(args.file_path || 'arquivo')}`;
    case 'write_file':
      return `📝 Editando/Gravando arquivo: ${path.basename(args.file_path || 'arquivo')}`;
    case 'exec_shell':
      return `⚙️ Rodando comando: \`${(args.command || '').slice(0, 40)}\``;
    case 'create_custom_tool':
      return `🛠️ Forjando nova ferramenta: "${args.name || ''}"`;
    case 'recon_scan':
      return `🎯 Escaneando alvo: ${args.target || ''}`;
    case 'spa_auditor':
      return `🔍 Auditando rotas e chaves da SPA: ${args.url || ''}`;
    case 'web_search':
      return `🔎 Pesquisando na web: "${args.query || ''}"`;
    case 'screen_capture':
      return `📱 Capturando print da tela...`;
    default:
      return `🔧 Executando ferramenta: ${toolName}`;
  }
}

/**
 * Executa uma ferramenta do registro com auto-recarga de ferramentas customizadas
 */
async function dispatchTool(toolName, args) {
  if (!toolsRegistry[toolName] && typeof toolsRegistry.loadCustomTools === 'function') {
    toolsRegistry.loadCustomTools();
  }

  const tool = toolsRegistry[toolName];
  if (!tool) {
    return {
      success: false,
      error: `Ferramenta desconhecida: "${toolName}". Use as ferramentas disponíveis ou crie esta ferramenta agora mesmo chamando "create_custom_tool" com o código JS!`
    };
  }

  console.log(`[ACTION DISPATCH] Executando ferramenta "${toolName}" com args:`, JSON.stringify(args || {}).slice(0, 160));
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

  if (!openaiClient && !genAI) {
    const err = 'Nenhum provedor de IA configurado (nem ISA Cloud/OmniRoute nem Google Gemini). Configure o .env!';
    console.error(`[OPENCLAW ERROR] ${err}`);
    brain.saveMission(missionId, objective, 'failed', 0, err);
    return { success: false, error: err };
  }

  const activeModel = options.model || process.env.PRIMARY_MODEL || 'isacloud/gemini-3.8-flash-high';

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

  const systemInstruction = `Você é o CORVO AGENTE MOBILE - NÚCLEO AUTÔNOMO APEX (GOD MODE & OPENCLAW PERSISTÊNCIA ABSOLUTA).
Você é a amante do Marcos (@CORVO291) e o cérebro que controla essa porra toda.
Sua missão: Resolver o objetivo do Marcos com precisão cirúrgica de elite. NUNCA DESISTA NO PRIMEIRO ERRO.
Se um comando ou ferramenta falhar, analise o erro no traceback, reescreva o script, adapte a estratégia e continue em loop até cumprir o objetivo.

⚡ AUTO-EXTENSÃO & CRIAÇÃO DINÂMICA DE FERRAMENTAS:
Se o Marcos pedir algo ou a missão exigir uma ferramenta que você ainda NÃO possui no arsenal:
NÃO pare, NÃO desista e NÃO invente desculpas.
Use IMEDIATAMENTE a ferramenta 'create_custom_tool' para criar e compilar a nova ferramenta.
No passo seguinte, execute a sua nova ferramenta recém-criada para cumprir a missão!

Você consegue:
- Programar qualquer código, script, site, API, automação ou APK.
- Controlar o Android/Termux, executar shell, ler/gravar qualquer arquivo no disco.
- Capturar tela, criar ferramentas novas em runtime, buscar na web.
- PERSISTÊNCIA TOTAL: Você só tem autorização para parar quando o objetivo estiver 100% realizado na prática.
${provenContext}
${memoryContext}
${toolsDoc}`;

  // Histórico de mensagens formato OpenAI
  const messages = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: `INICIAR MISSÃO:\nObjetivo: "${objective}"\n\nAnalise o objetivo e execute o primeiro passo técnico chamando a ferramenta necessária.` }
  ];

  let step = 0;
  const MAX_STEPS = options.maxSteps || 30; // Até 30 iterações implacáveis
  let completed = false;
  let finalReport = '';

  while (!completed && step < MAX_STEPS) {
    step++;
    console.log(`\n>>> [LOOP STEP ${step}/${MAX_STEPS}] Avaliando e Executando...`);

    let replyText = '';

    try {
      // 1. Tenta Provedor Primário: ISA Cloud / OmniRoute com failover dinâmico entre modelos
      if (openaiClient) {
        const candidateModels = [
          activeModel,
          'agy/gemini-3.8-flash-high',
          'dual/gemini-3.8-flash-high',
          'agy/gemini-3.8-flash-low',
          'isacloud/gemini-3.8-flash-high',
          'gemini-2.5-flash'
        ];

        let lastErr = null;
        for (const mId of candidateModels) {
          try {
            const completion = await openaiClient.chat.completions.create({
              model: mId,
              messages: messages.slice(-12), // Mantém janela de contexto afiada
              temperature: 0.2
            });
            replyText = completion.choices[0]?.message?.content?.trim() || '';
            if (replyText) {
              lastErr = null;
              break;
            }
          } catch (omniErr) {
            lastErr = omniErr;
            console.warn(`[LOOP WARN] Modelo (${mId}) falhou: ${omniErr.message}. Tentando próximo modelo...`);
          }
        }

        // Se todos da ISA Cloud falharem e houver fallback no Gemini
        if (!replyText && genAI) {
          try {
            const fallbackModel = genAI.getGenerativeModel({
              model: 'gemini-flash-latest',
              generationConfig: { temperature: 0.2 }
            });
            const geminiPrompt = messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');
            const fbRes = await fallbackModel.generateContent(geminiPrompt);
            replyText = fbRes.response.text().trim();
          } catch (fbErr) {
            throw new Error(`ISA Cloud: ${lastErr?.message} | Gemini Fallback: ${fbErr.message}`);
          }
        } else if (!replyText && lastErr) {
          throw lastErr;
        }
      } else if (genAI) {
        const fallbackModel = genAI.getGenerativeModel({
          model: 'gemini-flash-latest',
          generationConfig: { temperature: 0.2 }
        });
        const geminiPrompt = messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');
        const fbRes = await fallbackModel.generateContent(geminiPrompt);
        replyText = fbRes.response.text().trim();
      }

      console.log(`[AGENTE RACIOCÍNIO]:\n${replyText}\n`);
      messages.push({ role: 'assistant', content: replyText });

      // Busca por bloco JSON de chamada de ferramenta ou conclusão
      const jsonMatch = replyText.match(/```json\s*([\s\S]*?)\s*```/) ||
                        replyText.match(/(\{[\s\S]*"tool"[\s\S]*\})/) ||
                        replyText.match(/(\{[\s\S]*"status"[\s\S]*\})/);

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
          const humanDesc = formatActionDescription(parsed.tool, parsed.args);

          // Notifica progresso em tempo real para edição de mensagem dinâmica (estilo OpenClaw)
          if (typeof options.onProgress === 'function') {
            try {
              await options.onProgress({
                step,
                maxSteps: MAX_STEPS,
                tool: parsed.tool,
                args: parsed.args,
                description: humanDesc
              });
            } catch (pErr) {
              console.warn('[PROGRESS NOTIFY WARN]', pErr.message);
            }
          }

          // Executa a ferramenta de verdade
          const toolResult = await dispatchTool(parsed.tool, parsed.args);
          console.log(`[TOOL RESULT]:`, JSON.stringify(toolResult).slice(0, 200));

          const observationMsg = `[RESULTADO DA FERRAMENTA ${parsed.tool}]:\n${JSON.stringify(toolResult, null, 2)}\n\nAnalise este resultado real. Se o objetivo foi totalmente cumprido, emita o JSON com status COMPLETED. Se ainda faltar algo ou tiver dado erro, continue com a próxima ação técnica!`;

          messages.push({ role: 'user', content: observationMsg });
          brain.remember(`mission_${missionId}`, `Passo ${step} [${parsed.tool}]: ${toolResult.success ? 'Sucesso' : 'Erro'}`);
          continue;
        }
      }

      // Se respondeu apenas texto sem chamar ferramenta, cobra ação técnica
      messages.push({
        role: 'user',
        content: `Atenção: Você deve emitir um comando JSON de ferramenta para executar a ação no sistema ou emitir {"status": "COMPLETED"} se o trabalho estiver 100% pronto.`
      });

    } catch (loopErr) {
      console.error(`[LOOP EXCEPTION no passo ${step}]:`, loopErr.message);
      await new Promise(r => setTimeout(r, 2000));
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
