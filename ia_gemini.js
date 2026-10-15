/**
 * 🤖 CORVO - MÓDULO IA (Gemini)
 * Usado pelo /ia e /apistatus
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const config = require('../../config');

// 🐛 FIX 2026-08-09: 'gemini-2.5-flash' foi DESCONTINUADO para chaves novas
// (404 "no longer available to new users") — o único modelo que as 6 chaves
// aceitam hoje é 'gemini-flash-latest' (testado: OK em 5 de 6). O pro
// (gemini-2.5-pro) também está 429/404 nas chaves atuais — até o dono
// regularizar o billing, MODEL_FORTE aponta pro mesmo modelo funcional e o
// fallback existente (linha ~425) já cobre qualquer falha.
const MODEL = 'gemini-flash-latest';
const MODEL_FORTE = 'gemini-flash-latest';

/**
 * Escolhe o modelo conforme a dificuldade da tarefa:
 * - flash: conversa rápida, piadas, dúvidas simples
 * - pro: tarefas longas/complexas (mídia, código, missões com ferramentas)
 */
function escolherModelo(system, userText, opts = {}) {
  if (opts.model) return opts.model;
  const q = String(userText || '');
  // 💰 ECONOMIA (regra do dono): o pro é CARO — só vai para ele tarefa
  // REALMENTE pesada. Limiar de tamanho subiu de 350 → 500 (texto longo
  // sozinho não é tarefa pesada) e a lista de palavras foi enxugada:
  // palavras comuns da zoeira (faz, monte, analisa, resumo, tabela) ficam
  // no flash, que dá conta. Sinais fortes (código/site/script/instalar/
  // baixar/projetos) e ações pesadas do bot continuam indo pro pro.
  const complexo =
    q.length > 500 ||
    /(crie|criar|desenvolva|projete|site\b|código|codigo|script\b|instala|baixa|planilha|relat[óo]rio)/i.test(q) ||
    /(buscar_web|executar_terminal|baixar_|criar_arquivo|editar_arquivo)/i.test(q) ||
    // 🧠 Ações pesadas do bot (consultas, rajada, nukar, flood) merecem
    // raciocínio mais profundo: caem no pro com thinkingBudget maior.
    // Só sinais FORTES de ação (imperativos/verbos) para não pegar palavras
    // comuns da zoeira (ex: "vai dar flood", "marcar uma consulta").
    /(\braja\b|\brajad|rajar\b|\bnuka\b|\bnukar\b|flood[aeiou]|consultar\b|datora)/i.test(q);
  return complexo ? MODEL_FORTE : MODEL;
}

/**
 * Extrai APENAS o texto de resposta final de um response do Gemini,
 * ignorando os blocos de RACIOCÍNIO interno (parts com thought: true) que o
 * Gemini 2.5 produz ao pensar. O SDK 0.24.x não filtra isso sozinho — sem
 * este filtro, o raciocínio vazaria na resposta pro usuário.
 */
function extrairTexto(response) {
  try {
    const parts = response?.candidates?.[0]?.content?.parts || [];
    return parts.filter(p => !p.thought && p.text).map(p => p.text).join('');
  } catch (e) {
    return '';
  }
}

/**
 * Executa generateContent com STREAMING opcional (onStream recebe os trechos
 * conforme chegam, para o bot editar a mensagem em tempo real). Filtra os
 * trechos de raciocínio interno (thought) para não vazar no streaming.
 */
async function generateContentComStream(model, contents, onStream) {
  if (typeof onStream === 'function') {
    let textoAcumulado = '';
    const stream = await model.generateContentStream({ contents });
    for await (const chunk of stream.stream) {
      let t = '';
      try {
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        t = parts.filter(p => !p.thought && p.text).map(p => p.text).join('');
      } catch (e) { t = ''; }
      if (t) { textoAcumulado += t; try { onStream(t); } catch (e) {} }
    }
    const response = await stream.response;
    return { response, textoAcumulado };
  }
  const result = await model.generateContent({ contents });
  return { response: result.response };
}

// ===== 🔑 ROTAÇÃO DE CHAVES GEMINI (regra do dono) =====
// Várias chaves em config.geminiKeys (ou env GEMINI_API_KEY como única).
// SEMPRE usa a MESMA chave; só avança para a PRÓXIMA quando a atual esgotar
// (429/quota/exhausted) ou estiver inválida — sequência 1→2→3→…→N→1→2→…
// 💾 O índice em uso é SALVO em disco (data/gemini_chave_atual.json) e
// restaurado ao iniciar — reiniciar o bot NÃO volta pra chave 1.
const CHAVE_ATUAL_FILE = path.join(__dirname, '..', '..', 'data', 'gemini_chave_atual.json');

function carregarIndiceChave() {
  try {
    if (fs.existsSync(CHAVE_ATUAL_FILE)) {
      const j = JSON.parse(fs.readFileSync(CHAVE_ATUAL_FILE, 'utf-8'));
      const n = Number(j.indiceChave);
      if (Number.isInteger(n) && n >= 0) return n;
    }
  } catch (e) { /* arquivo corrompido/ausente → recomeça na 1 */ }
  return 0;
}

function salvarIndiceChave() {
  try {
    fs.mkdirSync(path.dirname(CHAVE_ATUAL_FILE), { recursive: true });
    fs.writeFileSync(CHAVE_ATUAL_FILE, JSON.stringify({ indiceChave, atualizadoEm: new Date().toISOString() }, null, 2));
  } catch (e) { /* falha ao salvar não quebra a rotação */ }
}

let indiceChave = carregarIndiceChave();
let genAI = null;

// ===== 🔴 EXCLUSÃO PERMANENTE DE CHAVES (regra do dono) =====
// Chave que dá erro PERMANENTE (404 modelo não disponível / 401 / 403 chave
// inválida ou revogada) é EXCLUÍDA da rotação e persistida em disco — nunca
// mais é usada, mesmo reiniciando o bot. Erro TEMPORÁRIO (429 quota/rate)
// só rotaciona, NÃO exclui (a cota volta).
const CHAVES_EXCLUIDAS_FILE = path.join(__dirname, '..', '..', 'data', 'gemini_chaves_excluidas.json');

function carregarChavesExcluidas() {
  try {
    if (fs.existsSync(CHAVES_EXCLUIDAS_FILE)) {
      const j = JSON.parse(fs.readFileSync(CHAVES_EXCLUIDAS_FILE, 'utf-8'));
      if (Array.isArray(j.chaves)) return j.chaves.filter(k => k && String(k).trim());
    }
  } catch (e) { /* arquivo corrompido/ausente → começa vazio */ }
  return [];
}

function salvarChavesExcluidas() {
  try {
    fs.mkdirSync(path.dirname(CHAVES_EXCLUIDAS_FILE), { recursive: true });
    fs.writeFileSync(CHAVES_EXCLUIDAS_FILE, JSON.stringify({ chaves: chavesExcluidas, atualizadoEm: new Date().toISOString() }, null, 2));
  } catch (e) { /* falha ao salvar não quebra a rotação */ }
}

let chavesExcluidas = carregarChavesExcluidas();

/** Erro PERMANENTE (404/401/403/modelo indisponível) — NÃO é 429 quota. */
function ehErroPermanente(e) {
  const msg = `${e?.status || ''} ${e?.message || e || ''}`;
  // 429/quota/rate limit é TEMPORÁRIO — não exclui a chave (a cota volta).
  if (/429|quota|RESOURCE_EXHAUSTED|rate\s*limit/i.test(msg)) return false;
  return /401|403|404|invalid\s*api\s*key|api\s*key\s*not\s*valid|permission\s*denied|no\s*longer\s*available|not\s*found/i.test(msg);
}

function excluirChave(chave) {
  if (!chave) return;
  if (chavesExcluidas.includes(chave)) return;
  chavesExcluidas.push(chave);
  salvarChavesExcluidas();
  // 🖥️ Visibilidade pro dono (console do bot): mostra qual chave foi queimada.
  try {
    console.log(`[IA] 🔴 Chave ${String(chave).slice(0, 8)}... EXCLUÍDA da rotação (erro permanente). Restam ${getGeminiKeys().length} chave(s).`);
  } catch (e) { /* log não bloqueia */ }
  // NOTA: não há auto-reset — chave excluída fica de vez (regra do dono).
  // Recuperação manual: resetarChavesExcluidas() ou apagar o arquivo
  // data/gemini_chaves_excluidas.json.
}

/** Lista as chaves excluídas (para diagnóstico / re-adicionar manualmente). */
function getChavesExcluidas() {
  return [...chavesExcluidas];
}

/** Remove TODAS as exclusões (re-adiciona todas as chaves do config). */
function resetarChavesExcluidas() {
  chavesExcluidas = [];
  salvarChavesExcluidas();
}

function getGeminiKeys() {
  // Regra do dono: se config.geminiKeys estiver definido, usa ELAS (rotação + persistência).
  // O env GEMINI_API_KEY vira FALLBACK só quando o config não tiver lista.
  const ks = (Array.isArray(config.geminiKeys) && config.geminiKeys.length)
    ? config.geminiKeys
    : (process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY]
        : (config.geminiKey ? [config.geminiKey] : []));
  // 🔴 Filtra as chaves EXCLUÍDAS: chave com erro permanente nunca mais entra
  return (ks || []).filter(k => k && String(k).trim() && !chavesExcluidas.includes(k));
}

/**
 * Retorna a chave ATUAL da rotação (de env ou config fixa)
 */
function getGeminiKey() {
  const ks = getGeminiKeys();
  if (!ks.length) return '';
  if (indiceChave >= ks.length) {
    indiceChave = 0;
    salvarIndiceChave(); // índice persistido fora do range: corrige E persiste
  }
  return ks[indiceChave];
}

function criarGenAI() {
  genAI = new GoogleGenerativeAI(getGeminiKey());
  return genAI;
}

// 🎡 Avança para a PRÓXIMA chave (sequencial 1→2→…→N→1). Só é chamada quando
// a chave ATUAL esgotou (quota) — o resto do tempo fica na mesma chave.
function rotacionarChave() {
  const ks = getGeminiKeys();
  if (ks.length <= 1) return;
  indiceChave = (indiceChave + 1) % ks.length;
  salvarIndiceChave(); // 💾 sobrevive a reinício do bot
}

function ehErroQuota(e) {
  const msg = `${e?.status || ''} ${e?.message || e || ''}`;
  // Quota (429/exhausted/rate limit), chave inválida/revogada (401/403) OU
  // chave sem acesso ao modelo (404 "no longer available to new users" —
  // tokens novos não enxergam gemini-2.5-flash): nos 3 casos a chave atual
  // não serve → deve rotacionar pra próxima.
  return /429|quota|RESOURCE_EXHAUSTED|rate\s*limit|exhausted|401|403|404|invalid\s*api\s*key|api\s*key\s*not\s*valid|permission\s*denied|no\s*longer\s*available|not\s*found/i.test(msg);
}

/**
 * 🚫 SANITIZA ERRO PRO USUÁRIO — regra do dono: NENHUM erro que vaza pro
 * grupo/DM pode revelar a infraestrutura por trás (Google/Gemini/flash,
 * URLs da API, chaves). Troca por termos genéricos e apaga detalhes.
 * Usado nos handlers de /ia e triggers de texto (ia.js, textos.js).
 */
function sanitizarErroUsuario(msg) {
  let s = String(msg || '')
    // URLs da API (generativelanguage.googleapis.com, etc.)
    .replace(/https?:\/\/[^\s]+/gi, '(serviço de IA)')
    .replace(/generativelanguage[a-z.\-]*/gi, 'serviço de IA')
    // Frases COMPLETAS do provedor (antes de trocar nomes, pra não deixar resto)
    .replace(/this model models?\/[a-z0-9.\-]* is no longer available[^.\n]*\.?/gi, '')
    .replace(/no longer available to new users[^.\n]*\.?/gi, '')
    .replace(/please update your code to use a newer model[^.\n]*\.?/gi, '')
    // Nome do provedor e do modelo (gemini, gemini-2.5-flash, gemini-2.5-pro,
    // veo, veo-3.1-..., nano banana) — tudo vira a MARCA do bot (Corvo Generated)
    // pra não entregar a API real nem nos erros de geração de imagem/vídeo.
    .replace(/gemini[a-z0-9.\-]*/gi, 'Corvo Generated')
    .replace(/nano\s*banana[a-z0-9.\-]*/gi, 'Corvo Generated')
    .replace(/\bveo[a-z0-9.\-]*/gi, 'Corvo Generated')
    // 🧠 DeepSeek / deepsproxy / Playwright (novo provider de texto): também vira
    // a MARCA do bot — nunca vaza o nome do provedor real pro usuário
    .replace(/deepseek[a-z0-9.\-]*/gi, 'Corvo Generated')
    .replace(/deepsproxy[a-z0-9.\-]*/gi, 'Corvo Generated')
    .replace(/playwright[a-z0-9.\-]*/gi, 'fornecedor')
    .replace(/localhost:\d+/gi, 'serviço de IA')
    .replace(/google[a-z.\-]*/gi, 'fornecedor')
    .replace(/models?\/[a-z0-9.\-]*/gi, 'modelo')
    // Fragmentos sobrando ("This model modelo", "The model models/...")
    .replace(/(this|the|a) model modelo/gi, '')
    // Chaves de API expostas
    .replace(/\bAIza[0-9A-Za-z_\-]{30,}\b/g, '[chave]')
    .replace(/\bAQ\.[0-9A-Za-z_\-./=]{10,}\b/g, '[chave]')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Se sobrou vazio (mensagem era só a frase do provedor), cai num texto genérico
  if (!s) s = 'o serviço de IA está temporariamente indisponível.';
  return s;
}

/**
 * Executa fn() tentando cada chave da rotação quando a atual estoura quota.
 * Erro não-quota é repassado na hora (não queima chaves à toa).
 */
async function comRotacao(fn) {
  const ks = getGeminiKeys();
  let ultimoErro = null;
  for (let i = 0; i < ks.length; i++) {
    const chaveEmUso = getGeminiKey();
    try {
      return await fn();
    } catch (e) {
      ultimoErro = e;
      if (!ehErroQuota(e)) throw e;
      // 🔴 Erro PERMANENTE (404/401/403/modelo indisponível): EXCLUI a chave
      // da rotação (persistida em disco). 429 quota só rotaciona, não exclui.
      if (ehErroPermanente(e)) excluirChave(chaveEmUso);
      rotacionarChave();
      criarGenAI();
    }
  }
  throw ultimoErro;
}

/**
 * Chamada com system prompt + mídia opcional (usado pelo agente)
 * @param {string} system - system instruction (persona/contexto)
 * @param {string} prompt - pergunta
 * @param {Array} midia - [{dataBuffer, mimeType}] opcional
 */
async function askSystemGemini(system, prompt, midia = [], opts = {}) {
  if (!getGeminiKey()) throw new Error('Nenhuma chave de IA configurada.');

  const parts = [];
  for (const m of midia) {
    if (m && m.dataBuffer) {
      const b = Buffer.isBuffer(m.dataBuffer) ? m.dataBuffer : Buffer.from(m.dataBuffer);
      parts.push({ inlineData: { data: b.toString('base64'), mimeType: m.mimeType || 'image/jpeg' } });
    }
  }
  parts.push({ text: prompt });

  const result = await comRotacao(async () => {
    const g = new GoogleGenerativeAI(getGeminiKey());
    const m = g.getGenerativeModel({ model: MODEL });
    const generationConfig = {};
    // 💰 MODO LEVE (economia): thinking reduzido a 128 — conversa casual não
    // precisa de raciocínio profundo (o padrão do flash gasta bem mais).
    if (opts.thinkingBudget) {
      generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget };
    }
    return m.generateContent({
      contents: [{ role: 'user', parts }],
      systemInstruction: system,
      ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    });
  });
  const response = result.response;
  // 📊 Conta o uso NA FONTE (cada chamada real à API), com os tokens reais
  recordUsage(response.usageMetadata?.totalTokens);
  return {
    text: extrairTexto(response) || 'Sem resposta.',
    tokens: response.usageMetadata?.totalTokens,
  };
}

/**
 * Chamada com system prompt + ferramentas (function calling) + loop autônomo.
 * O modelo pode chamar ferramentas (busca web, imagens, GitHub...), o sistema
 * executa e devolve o resultado, até responder em texto final.
 * @param {string} system - system instruction (persona/contexto)
 * @param {string} userText - pergunta
 * @param {object} opts - { midia: [{dataBuffer,mimeType}], tools: [declarations], toolExecutor: fn(name,args,toolCtx), toolCtx: any }
 */
async function askSystemGeminiTools(system, userText, opts = {}) {
  if (!getGeminiKey()) throw new Error('Nenhuma chave de IA configurada.');
  criarGenAI(); // usa a chave atual da rotação

  const { midia = [], tools = [], toolExecutor, toolCtx = {}, maxRounds: maxRoundsReq, endMarker = '[FIM]', onTool = null, onStream = null, toolsGetter = null, sinal = null, missaoLongaBonus = 40 } = opts;
  // 🔋 MISSÃO LONGA: a IA pode marcar [LONGA_MISSAO] no início de tarefas pesadas
  // (criar bot/site, instalar+testar, missões longas) para GANHAR rodadas extras
  // na hora — o limite sobe e a missão continua até o fim.
  // 🛡️ ECONOMIA DE API (regra do dono): padrão agora é 30 rodadas (antes 60) —
  // cada rodada REENVIA o histórico inteiro, então quanto menos, melhor. Missões
  // realmente longas pedem +40 explícito com [LONGA_MISSAO]. NÃO existe mais
  // auto-extensão silenciosa.
  let maxRounds = maxRoundsReq || 30;
  // 🛡️ Teto ABSOLUTO de rodadas (contra loop infinito): acima disso, retorna o que tiver
  const MAX_ROUNDS = 150;
  let missaoLongaAtivada = false;

  const modeloEscolhido = escolherModelo(system, userText, opts);

  function buildModel(nomeModelo) {
    const modelOpts = { model: nomeModelo };
    if (system) modelOpts.systemInstruction = system;
    const schemas = typeof toolsGetter === 'function' ? toolsGetter() : tools;
    if (schemas.length) modelOpts.tools = [{ functionDeclarations: schemas }];
    // 🧠 RACIOCÍNIO NATIVO ANTES DE AGIR: o Gemini 2.5 pensa antes de responder
    // ou chamar QUALQUER ferramenta. Orçamento maior no modelo forte (tarefas
    // complexas = mais raciocínio), menor no flash (conversa rápida).
    // Desligável com opts.thinking === false; ajustável via opts.thinkingBudget.
    if (opts.thinking !== false) {
      // 💰 ECONOMIA (regra do dono): thinking do pro reduzido de 8192 → 4096
      // (raciocínio interno é cobrado por token e o pro é caro). Flash mantém 1024.
      // 🐛 FIX: MODEL_FORTE == MODEL ('gemini-flash-latest') hoje — comparar por
      // nome ('pro' no nome) em vez de === MODEL_FORTE, senão TUDO usaria 4096.
      const budget = opts.thinkingBudget || (/pro/i.test(nomeModelo) ? 4096 : 1024);
      modelOpts.generationConfig = {
        thinkingConfig: { thinkingBudget: budget },
      };
    }
    return genAI.getGenerativeModel(modelOpts);
  }

  let model = buildModel(modeloEscolhido);
  let tentouFallback = false;

  const userParts = [];
  for (const m of midia) {
    if (m && m.dataBuffer) {
      const b = Buffer.isBuffer(m.dataBuffer) ? m.dataBuffer : Buffer.from(m.dataBuffer);
      userParts.push({ inlineData: { data: b.toString('base64'), mimeType: m.mimeType || 'image/jpeg' } });
    }
  }
  userParts.push({ text: String(userText || '') });

  const contents = [{ role: 'user', parts: userParts }];
  let text = '';
  let totalTokens = 0;
  let usedTools = false;
  // 🏁 Flag de CONCLUSÃO da missão: só vira true quando a IA responde com [FIM]
  // (missão terminou de verdade). Se as rodadas acabarem SEM ela, o agente NÃO
  // pode parar em silêncio — roda um relatório final obrigatório (ver abaixo).
  let concluida = false;
  let lastPushMsg = '';
  // 🌀 Detector de loop: conta quantas vezes cada ferramenta+args se repete
  const repeticoes = new Map();
  // 🌀 Contador por FERRAMENTA (qualquer argumento): mesma ferramenta 8x
  // SEGUIDAS (consecutivas, sem outra ferramenta no meio) = travada nela.
  // Usar a mesma ferramenta com QUANTIDADES variadas (ex: criar_arquivo 10x
  // pra montar um projeto) NÃO é loop — o contador zera ao trocar de ferramenta.
  const vezesPorFerramenta = new Map();
  let ultimaFerramenta = null;

  for (let round = 0; round < maxRounds; round++) {
    // 🛑 Sinal de interrupção/reavaliação do usuário (missão em andamento)
    if (typeof sinal === 'function') {
      try {
        const sig = sinal();
        if (sig && sig.acao === 'parar') {
          text = `🛑 Missão interrompida a pedido do usuário.${sig.motivo ? `\nMotivo: ${sig.motivo}` : ''}\n\nSe precisar continuar depois, chame de novo que eu retomo de onde parei.`;
          return { text, tokens: totalTokens };
        }
        if (sig && sig.acao === 'reavaliar') {
          contents.push({
            role: 'user',
            parts: [{ text: `🔄 O usuário pediu para você PARAR e REAVALIAR sua abordagem. Motivo: ${sig.motivo || 'reanálise'}. Raciocine de novo: o plano atual está certo? Mude de estratégia se precisar. Depois continue as ferramentas e só termine com ${endMarker} quando estiver FEITO.` }],
          });
        }
      } catch (e) { /* ignora erro de sinal */ }
    }

    let result, textoAcumulado = '';
    try {
      // 🔑 ROTAÇÃO: tenta cada chave (zigue-zague) se a atual estourar quota
      const r = await comRotacao(async () => {
        model = buildModel(modeloEscolhido);
        return generateContentComStream(model, contents, onStream);
      });
      result = r;
      textoAcumulado = r.textoAcumulado || '';
    } catch (e) {
      // ⚠️ FALLBACK: se o modelo forte falhar (429/quota/erro), tenta o flash
      if (!tentouFallback && modeloEscolhido !== MODEL) {
        tentouFallback = true;
        // 🔑 O fallback TAMBÉM passa pela rotação: se a chave atual não tiver
        // acesso ao flash (404 "no longer available"), pula pra próxima.
        const r2 = await comRotacao(async () => {
          model = buildModel(MODEL); // reconstrói com persona + tools preservados
          return generateContentComStream(model, contents, onStream);
        });
        result = r2;
        textoAcumulado = r2.textoAcumulado || '';
      } else {
        throw e;
      }
    }
    totalTokens += result.response?.usageMetadata?.totalTokens || 0;
    // 📊 CONTADOR DE USO (regra do dono): registra CADA chamada real à API na
    // fonte, com os tokens reais da rodada — antes o contador só via o total da
    // última resposta e ficava zerado (890 req / 0 tokens).
    recordUsage(result.response?.usageMetadata?.totalTokens || 0);

    // 🔋 MISSÃO LONGA: se a IA marcou [LONGA_MISSAO] nesta resposta, ativa o
    // bônus de rodadas extras IMEDIATAMENTE (não espera acabar o limite).
    // Só ativa se a resposta NÃO já veio com [FIM] (missão concluída) — evita
    // bônus inútil e mensagem de confirmação à toa.
    const textoRodada = textoAcumulado || extrairTexto(result.response) || '';
    if (!missaoLongaAtivada && !textoRodada.includes(endMarker) && /\[LONGA_MISSAO\]/i.test(textoRodada)) {
      missaoLongaAtivada = true;
      maxRounds = Math.min(maxRounds + missaoLongaBonus, MAX_ROUNDS);
      contents.push({
        role: 'user',
        parts: [{ text: `🔋 MISSÃO LONGA ATIVADA: você marcou [LONGA_MISSAO] e ganhou +${missaoLongaBonus} rodadas extras (limite agora: ${maxRounds}). Continue a missão até o FIM, sem parar no meio. Finalize com ${endMarker} quando concluíres.` }],
      });
    }

    const content = result.response?.candidates?.[0]?.content;
    if (!content || !Array.isArray(content.parts)) {
      text = textoAcumulado || extrairTexto(result.response) || '';
      break;
    }

    const calls = content.parts.filter(p => p.functionCall);
    if (calls.length) {
      usedTools = true;
      contents.push(content);
      for (const c of calls) {
        const name = c.functionCall.name;
        const args = c.functionCall.args || {};
        if (typeof onTool === 'function') {
          try { onTool(name, args); } catch (e) {}
        }
        let out;
        try {
          out = toolExecutor ? await toolExecutor(name, args, toolCtx) : { erro: 'Sem executor de ferramentas' };
        } catch (e) {
          out = { erro: String(e.message || 'erro') };
        }
        contents.push({ role: 'user', parts: [{ functionResponse: { name, response: { result: out } } }] });

        // 📸 FEEDBACK DE IMAGEM: quando a ferramenta é captura_tela, a IA PRECISA VER o print
        // (páginas com anti-robô/captcha, botões, formulários). Carrega o PNG e anexa como
        // imagem na próxima chamada — senão a IA só recebe o caminho em texto e fica cega.
        if (name === 'captura_tela' && out && out.arquivo && fs.existsSync(out.arquivo)) {
          try {
            const buf = fs.readFileSync(out.arquivo);
            if (buf.length > 0) {
              contents.push({
                role: 'user',
                parts: [
                  { inlineData: { data: buf.toString('base64'), mimeType: 'image/png' } },
                  { text: '📸 Print da tela (captura_tela). Analise a imagem para decidir o próximo passo (botões, formulários, anti-robô/captcha).' },
                ],
              });
            }
          } catch (e) { /* se falhar ao anexar a imagem, segue com o texto */ }
        }

        // 🌀 ANTI-LOOP (2 níveis):
        // 1) Mesma ferramenta com os MESMOS argumentos 3x = círculo.
        // 2) Mesma ferramenta (QUALQUER argumento) 8x SEGUIDAS = travada nela.
        const chave = `${name}::${JSON.stringify(args).slice(0, 200)}`;
        repeticoes.set(chave, (repeticoes.get(chave) || 0) + 1);
        if (ultimaFerramenta !== null && ultimaFerramenta !== name) {
          vezesPorFerramenta.clear(); // trocou de ferramenta: zera a contagem
        }
        ultimaFerramenta = name;
        vezesPorFerramenta.set(name, (vezesPorFerramenta.get(name) || 0) + 1);
        const vezesMesmosArgs = repeticoes.get(chave);
        const vezesTotal = vezesPorFerramenta.get(name);
        // 🛠️ Ferramentas de arquivo são repetidas LEGITIMAMENTE (criar site com
        // N páginas = criar_arquivo x10 seguidas). O corte de 8x vale para
        // ferramentas de AÇÃO/PESQUISA, não para criar/ler/editar arquivos.
        const ferramentaDeArquivo = /^(criar_arquivo|ler_arquivo|editar_arquivo)$/i.test(name);
        if (!ferramentaDeArquivo && vezesTotal >= 8) {
          contents.push({
            role: 'user',
            parts: [{ text: `🛑 LOOP NA FERRAMENTA: você chamou ${name} ${vezesTotal} VEZES SEGUIDAS (mesmos ou diferentes argumentos) e não resolveu. ESTA FERRAMENTA ESTÁ BLOQUEADA nesta tarefa — NÃO chame mais ${name} de jeito nenhum. Reflita sobre a causa raiz e use OUTRA ferramenta ou outro método completamente diferente.` }],
          });
        } else if (vezesMesmosArgs >= 3) {
          contents.push({
            role: 'user',
            parts: [{ text: `🛑 DETECTEI LOOP: você chamou ${name} com os MESMOS argumentos ${vezesMesmosArgs} vezes e não resolveu. PAROU DE REPETIR. Reflita sobre a causa raiz e mude de estratégia — use OUTRA ferramenta ou outro caminho. Não chame mais ${name} com esses mesmos argumentos nesta tarefa.` }],
          });
        } else {
          // 🪞 REFLEXÃO: ferramenta falhou (objeto {erro} OU string 'ERRO: ...')
          // → obriga o modelo a reavaliar antes de tentar de novo
          const erroMsg = (out && typeof out === 'object' && out.erro)
            ? String(out.erro)
            : (typeof out === 'string' && /^ERRO/i.test(out) ? out : null);
          if (erroMsg) {
            contents.push({
              role: 'user',
              parts: [{ text: `❌ A ferramenta ${name} FALHOU: ${erroMsg.slice(0, 300)}\n\n🧠 REFLEXÃO OBRIGATÓRIA: por que falhou? O plano está certo? Existe OUTRA ferramenta ou outro caminho? Ajuste a estratégia e tente de novo — não repita a mesma tentativa.` }],
            });
          }
        }
      }
      continue;
    }

    text = textoAcumulado || extrairTexto(result.response);

    if (text.includes(endMarker) || !usedTools) {
      if (text.includes(endMarker)) concluida = true;
      text = text.split(endMarker).join('').trim();
      break;
    }

    if (round + 1 < maxRounds) {
      const pushMsg = `⚠️ Tarefa ainda não concluída (rodada ${round + 1}/${maxRounds}). Não desistas: raciocina o que falta fazer, escolhe a melhor ferramenta, executa e VERIFICA o resultado. Só termina quando estiver FEITO de verdade. Quando terminares, termina tua resposta com ${endMarker}.`;
      if (pushMsg !== lastPushMsg) {
        lastPushMsg = pushMsg;
        contents.push({ role: 'user', parts: [{ text: pushMsg }] });
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: `Continua! Só tens ${maxRounds - round - 1} rodadas restantes. Analisa o resultado anterior, decide o próximo passo e executa. Finaliza com ${endMarker} quando concluíres.` }],
        });
      }
    }
    // 🛑 SEM AUTO-EXTENSÃO (economia de API — regra do dono): se as rodadas
    // acabarem sem concluir, o loop termina e a IA avisa que a missão é grande
    // demais (ou o usuário re-chama com [LONGA_MISSAO] explícito).
  }

  if (text.includes(endMarker)) text = text.split(endMarker).join('').trim();
  text = String(text || '').replace(/\[LONGA_MISSAO\]/gi, '').trim();

  // 🚨 MISSÃO NÃO CONCLUÍDA: o agente usou ferramentas (estava numa missão) mas
  // as rodadas acabaram SEM [FIM] — a IA NUNCA pode parar sem explicar por quê.
  // Regra do dono: em missão, só volta com o RESULTADO; se não conseguir,
  // avisa o PROBLEMA antes de parar. Roda UMA chamada final de relatório (sem
  // ferramentas) pra IA dizer o que conseguiu, o que travou e o que faltava.
  if (usedTools && !concluida) {
    contents.push({
      role: 'user',
      parts: [{ text: '⚠️ Suas rodadas acabaram e a missão NÃO foi concluída. NÃO chame mais nenhuma ferramenta — responda APENAS em texto: (1) o que você JÁ CONSEGUIU fazer; (2) o PROBLEMA/OBSTÁCULO exato que impediu de terminar (erro, bloqueio, dado faltando, permissão negada, etc.); (3) o que ainda faltava fazer. Seja honesto e direto — não invente que terminou.' }],
    });
    try {
      // 🔒 Modelo SEM ferramentas: a IA só pode escrever o relatório, não executar
      const modelSemTools = genAI.getGenerativeModel({
        model: modeloEscolhido,
        ...(system ? { systemInstruction: system } : {}),
      });
      const rReport = await comRotacao(async () => generateContentComStream(modelSemTools, contents, onStream));
      const tokensReport = rReport.response?.usageMetadata?.totalTokens || 0;
      totalTokens += tokensReport;
      recordUsage(tokensReport);
      const relatorio = rReport.textoAcumulado || extrairTexto(rReport.response) || '';
      if (relatorio.trim()) {
        // 🧹 Limpa os marcadores de sistema do relatório ([FIM]/[LONGA_MISSAO] —
        // o modelo aprendeu a anexar [FIM] no fim e vazaria literal pro usuário)
        text = relatorio.replace(/\[LONGA_MISSAO\]/gi, '').trim();
        if (text.includes(endMarker)) text = text.split(endMarker).join('').trim();
      } else {
        text = '⚠️ Não consegui concluir essa missão e minhas rodadas acabaram no meio. O problema ficou no caminho — me chama de novo que eu retomo de onde parei.';
      }
    } catch (e) {
      text = text || '⚠️ Não consegui concluir essa missão: minhas rodadas acabaram antes do fim. Me chama de novo que eu retomo de onde parei.';
    }
  }

  if (!text && usedTools) {
    text = 'Puts, essa missão é gigante e eu ainda tô no meio dela. Continua me chamando que eu retomo de onde parei e termino.';
  }
  return { text: text || 'Sem resposta.', tokens: totalTokens };
}

/**
 * Gera resposta de texto simples
 * @param {string} prompt
 * @param {object} opts - { image?: {data(Buffer), mime}, history?: [{role,parts}] }
 */
async function askGemini(prompt, opts = {}) {
  if (!getGeminiKey()) throw new Error('Nenhuma chave de IA configurada.');

  const contents = [];
  if (Array.isArray(opts.history)) {
    for (const h of opts.history) {
      if (h && h.role && Array.isArray(h.parts)) contents.push(h);
    }
  }

  const inlineData = opts.image?.dataBuffer && opts.image?.mimeType
    ? { inlineData: { data: Buffer.from(opts.image.dataBuffer).toString('base64'), mimeType: opts.image.mimeType } }
    : null;

  contents.push({ role: 'user', parts: inlineData ? [inlineData, { text: prompt }] : [{ text: prompt }] });

  const result = await comRotacao(async () => {
    const g = new GoogleGenerativeAI(getGeminiKey());
    const m = g.getGenerativeModel({ model: opts.model || MODEL });
    return m.generateContent({ contents });
  });
  const response = result.response;
  // 📊 Conta o uso NA FONTE (cada chamada real à API), com os tokens reais
  recordUsage(response.usageMetadata?.totalTokens);
  return {
    text: extrairTexto(response) || 'Sem resposta.',
    tokens: response.usageMetadata?.totalTokens,
  };
}

/**
 * 👂 CORVO - TRANSCRIÇÃO DE ÁUDIO (ouvidos da IA)
 * Transcreve um áudio (voz/nota de voz/música) para texto usando o Gemini
 * (gemini-2.5-flash suporta áudio inline). Usa a MESMA rotação de chaves.
 * @param {Buffer} dataBuffer - buffer do áudio (mp3/ogg/wav...)
 * @param {string} mimeType - ex: 'audio/ogg', 'audio/mpeg', 'audio/wav'
 * @returns {Promise<string>} transcrição literal (ou '' se falhar)
 */
async function transcreverAudio(dataBuffer, mimeType = 'audio/ogg') {
  if (!dataBuffer || !dataBuffer.length) return '';
  const res = await askSystemGemini(
    'Você é um transcritor de áudio perfeito. Transcreva EXATAMENTE o que foi dito no áudio, na língua original (geralmente português brasileiro). Não resuma, não comente, não adicione nada além da transcrição literal do que foi falado.',
    'Transcreva literalmente o áudio abaixo.',
    [{ dataBuffer, mimeType }]
  );
  return String(res.text || '').trim();
}

const USAGE_FILE = path.join(__dirname, '..', '..', 'data', 'token_usage.json');

function loadUsage() {
  try { if (fs.existsSync(USAGE_FILE)) return JSON.parse(fs.readFileSync(USAGE_FILE)); } catch (e) {}
  return { requests: 0, tokens: 0, sessions: 0 };
}

function recordUsage(tokens = 0) {
  const u = loadUsage();
  u.requests += 1;
  u.tokens += tokens || 0;
  fs.writeFileSync(USAGE_FILE, JSON.stringify(u, null, 2));
  return u;
}

module.exports = { askGemini, askSystemGemini, askSystemGeminiTools, transcreverAudio, getGeminiKey, getGeminiKeys, getChavesExcluidas, resetarChavesExcluidas, loadUsage, recordUsage, sanitizarErroUsuario };