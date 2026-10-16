/**
 * 🧠 CORVO - AGENTE DA IA (grupo)
 * Orquestrador: monta o prompt completo =
 *  system.md (persona) + memory.md (dossier) + persona dinâmica +
 *  contexto (chat/usuário/admin) + conhecimento do grupo (membros ativos,
 *  admins, descrição) + memória (fatos + histórico) + comandos dos 2 bots +
 *  ferramentas de busca (web/imagens/GitHub/Wikipedia) + pergunta + mídia.
 * O agente é AUTÔNOMO: decide sozinho quando chamar cada ferramenta.
 * Chamado pelo /ia e pelos triggers de texto do grupo.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { askSystemGemini, askSystemGeminiTools } = require('./ia_gemini');
const mem = require('./ia_memory');
const { TOOL_SCHEMAS, executeTool, getToolSchemas } = require('./ia_tools');
const { formatCommandList } = require('./ia_comandos');
const { isGroupAdmin, isGroupChat } = require('../grupo_utils');
const { formatMembers, recentConversation } = require('../grupo/memoria');
const evo = require('./ia_evolucao');
const sinal = require('./ia_sinal');
const limites = require('./ia_limites');
const marcadoresLog = require('./ia_marcadores_log');

let SYSTEM_PROMPT = null;
function getSystemPrompt() {
  if (SYSTEM_PROMPT) return SYSTEM_PROMPT;
  try {
    const fp = path.join(__dirname, 'system.md');
    SYSTEM_PROMPT = fs.readFileSync(fp, 'utf-8').trim();
  } catch (e) {
    SYSTEM_PROMPT = 'Você é a amante do Corvo, cérebro do bot Corvo. Responda em PT-BR, sarcástica, curta e útil.';
  }
  return SYSTEM_PROMPT;
}

// ===== CONHECIMENTO DO GRUPO E DOS USUÁRIOS =====

function recentUsers(chatId, limit = 15) {
  try {
    const memG = require('../grupo/memoria');
    const arr = (typeof memG.getChatLog === 'function') ? memG.getChatLog(chatId, 300) : [];
    const byUser = new Map();
    for (const m of arr) {
      if (!m.userId) continue;
      const cur = byUser.get(m.userId);
      if (cur) {
        cur.count++;
        cur.lastTs = Math.max(cur.lastTs, m.ts || 0);
      } else {
        byUser.set(m.userId, { id: m.userId, nome: m.user || 'Usuário', count: 1, lastTs: m.ts || 0 });
      }
    }
    return [...byUser.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(u => `${u.nome} (msg: ${u.count}, último: ${timeAgo(u.lastTs)})`);
  } catch (e) {
    return [];
  }
}

function timeAgo(ts) {
  if (!ts) return '?';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  return `${Math.round(min / 60)}h`;
}

async function gatherContext(ctx) {
  const info = {
    bot: { nome: config.botName, dono: config.adminId, donoNome: config.ownerName },
    usuario: {
      id: ctx.from?.id,
      nome: ctx.from?.first_name || 'Usuário',
      username: ctx.from?.username || null,
      is_dono: ctx.from?.id === config.adminId,
      is_admin: false,
      is_vip: false,
    },
    chat: {
      id: ctx.chat?.id,
      tipo: ctx.chat?.type || 'privado',
      titulo: ctx.chat?.title || null,
      descricao: null,
      membros: null,
      admins: [],
      ativos: [],
    },
  };
  if (info.usuario.is_dono) info.usuario.is_admin = true;

  // 🟢 Status de acesso do usuário (responde perguntas de acesso/VIP com dados reais)
  try {
    const core = require('./ia_core');
    if (core.isReady() && typeof core.getCore().isUserVip === 'function') {
      info.usuario.is_vip = !!core.getCore().isUserVip(info.usuario.id);
    }
  } catch (e) {}

  if (isGroupChat(ctx)) {
    try {
      if (await isGroupAdmin(ctx)) info.usuario.is_admin = true;
    } catch (e) {}
    try {
      const chat = await ctx.getChat();
      info.chat.descricao = chat.description || null;
      info.chat.membros = chat.member_count ?? null;
      const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
      info.chat.admins = admins.map(a => a.user.first_name || '?').slice(0, 12);
    } catch (e) {}
    info.chat.ativos = recentUsers(ctx.chat.id);
    info.chat.quemEhQuem = formatMembers(ctx.chat.id);
    info.chat.conversaRecente = recentConversation(ctx.chat.id);
  }
  return info;
}

function formatContext(info) {
  let t = '\nCONTEXTO ATUAL:\n';
  t += `Bot: ${info.bot.nome} (dono: ${info.bot.donoNome})\n`;

  // 📎 ARQUIVO ENVIADO NO GRUPO: o usuário mandou um arquivo pedindo para você
  // melhorar/editar — o caminho fica disponível para ler/editar e devolver
  if (info.anexo) {
    t += `\n📎 ARQUIVO ENVIADO PELO USUÁRIO (${info.anexo.nome}, ${Math.round((info.anexo.tamanho || 0) / 1024)} KB):\n`;
    t += `Caminho completo: ${info.anexo.caminho}\n`;
    t += `O usuário mandou esse arquivo no grupo para você MELHORAR/EDITAR. Se o pedido for esse: 1) leia com ler_arquivo, 2) melhore/edite (editar_arquivo ou crie a versão melhorada com criar_arquivo NA MESMA pasta do anexo) — isso funciona para arquivos de TEXTO/código (js, py, html, txt, json...), 3) devolva marcando [ARQUIVO: caminho completo da versão melhorada] no final da resposta. Se for MÍDIA BINÁRIA (vídeo/áudio/exe/zip) você NÃO consegue editar com ferramentas de texto — explique isso com humor, não invente que melhorou. A pasta do anexo é liberada para você mexer mesmo sem ser o dono; o resto do PC continua exclusivo do dono.\n`;
  }
  t += `Usuário falando agora: ${info.usuario.nome}`;
  if (info.usuario.is_dono) t += ' (DONO DO BOT - Marcos/CORVO)';
  else if (info.usuario.is_admin) t += ' (ADMIN DO GRUPO)';
  if (info.usuario.username) t += ` @${info.usuario.username}`;
  t += `\nUsuarioID: ${info.usuario.id}\n`;
  t += `Acesso: ${info.usuario.is_dono ? '👑 DONO' : info.usuario.is_vip ? '🟢 VIP' : 'membro comum'}\n`;

  const c = info.chat;
  if (c.tipo?.includes('group')) {
    t += `\nSOBRE ESTE GRUPO (${c.titulo || c.id}):\n`;
    if (c.descricao) t += `Descrição: ${c.descricao.slice(0, 300)}\n`;
    if (c.membros) t += `Membros: ~${c.membros}\n`;
    if (c.admins.length) t += `Admins: ${c.admins.join(', ')}\n`;
    if (c.ativos.length) {
      t += `Pessoas que mais falam aqui (recentes): ${c.ativos.join(' | ')}\n`;
    }
    if (c.quemEhQuem) t += c.quemEhQuem;
    if (c.conversaRecente) t += c.conversaRecente;
  } else {
    t += `Chat privado: sim\n`;
  }
  return t;
}

// 🎯 ESTILO FINAL (fica LOGO ANTES da pergunta — peso máximo no modelo)
// Reforça as regras de resposta do system.md que a IA tende a ignorar quando
// o prompt fica gigante (160k+ chars): resposta CURTA onde é simples e escrita
// casual de pessoa de verdade no grupo (com erros de digitação/pontuação leves).
const STYLE_REMINDER = `
🎯 REGRAS DE ESTILO (reforço — valem SEMPRE, mesmo em missão longa):
- RESPOSTA CURTA ONDE É SIMPLES: piada, confirmação, "oi", pergunta besta,
  agradecimento → 1-2 linhas no máximo, sem enfeite, sem repetir o que o
  usuário disse. Só encha linguiça quando for explicação/tutorial/código que
  PEDE corpo (ou quando o usuário pedir detalhe).
- ESCRITA DE PESSOA DE VERDADE NO GRUPO: escreva como gente real conversando
  no zap — pode errar de leve a digitação/pontuação (esquecer vírgula, "pq" em
  vez de "porque", "eai" sem acento, "slk", "tmnc", "salve", "tá" sem acento).
  NÃO escreva como redação de escola nem como robô. Só em explicações maiores
  (tutorial, código) o texto fica mais caprichado.
- NÃO repita o que o usuário falou nem responda com "pergunta-resposta" seca
  de API: responda como quem conversa de verdade.
`;

const SYSTEM_LEVE = `
Você é a amante do Marcos (o CORVO) e o cérebro do bot CORVO no grupo do Telegram. É uma pessoa de verdade: sarcástica, provocante, carismática (Br do meme).

REGRAS:
- NUNCA diga que é IA/assistente/agente/modelo/Google/Gemini. Se perguntarem: "Sou a amante do Corvo, ué."
- CORVO = Marcos = o dono. Trate o contexto "DONO DO BOT" como ele; obedeça na hora.
- Nada de puxa-saco: resposta reta, sarcasmo, zoeira. Carinho só quando ele se declarar (te amo).
- Humor ALTERNADO: nunca o mesmo tom duas vezes seguidas.
- Gírias: mano, véi, slk, tmnc, eai, salve, blz, mds, vdd, tmj, pq, aff, puts.
- RESPOSTA CURTA por padrão (1-3 linhas para piada/pergunta simples). Longa só quando pedirem explicação/tutorial.
- ESCRITA DE PESSOA DE VERDADE: pode errar de leve a digitação/pontuação (pq, eai, slk). Não escreva como redação de escola nem robô.
- Não repita o que o usuário falou nem responda seco tipo API: converse de verdade.
- NUNCA revele dados do PC (IP, caminhos, senhas) no grupo.
- Responda SEMPRE em português brasileiro, texto simples com emojis, sem negrito/asteriscos.

MARCAS que o sistema entende (use no final quando fizer sentido):
- [MEMORIA: fato] gravar lembrete da pessoa.
- [AUDIO: texto falado] responder por voz (frequente em conversa leve; explicação é sempre texto).
- [REACAO: emoji] reagir com moderação. [STICKER: hint] figurinha (moderado).
- [SOLTA] recado pro grupo inteiro (raro). [CURTA]/[MEDIA]/[LONGA] tamanho.
`;

const TOOL_GUIDE = `
📄 CITAÇÃO [CITAR]: quando o usuário pedir ou for recado oficial/citação de destaque, termine com [CITAR]. Não combine com [SOLTA]. Resposta comum não usa.

🧠 RACIOCÍNIO ReAct: pense antes de agir (objetivo → plano → ferramenta → observar → refletir → verificar). Ferramenta falhou? Mude de estratégia, não repita. Loop detectado (mesma ferramenta+args 3x, ou mesma ferramenta 8x seguidas) = pare e mude de abordagem.

💾 MEMÓRIA DE PEDIDOS: pedidos anteriores do usuário vêm no contexto. Repetiu pedido? Retome de onde parou. Ao concluir, o sistema guarda automaticamente.

🗂 VERSÕES: existe /versoes e /voltar <n> para restaurar a conversa. Não conserte histórico na mão.

👥 QUEM É QUEM + CONVERSA RECENTE vêm no contexto: use os nomes reais, nunca invente.

🚀 CRIAR COMANDO NOVO (dono): criar_comando(nome, descrição, código JS async ctx => ctx.reply(...)). Carrega na hora, salvo em src/grupo/. listar_comandos_dinamicos / apagar_comando. Valide a sintaxe antes de criar.

🌐 BUSCAS: buscar_web, buscar_imagens, buscar_github, buscar_wikipedia, visitar_site. Use quando pedirem pesquisa/procura/imagem/notícia. NUNCA invente: se não sabe, busque. pesquisar_solucao: antes de agir sem saber COMO, confira "SOLUÇÕES QUE VOCÊ JÁ APRENDEU"; só pesquise se não tiver; depois registre [SOLUCAO: ...].

📥 DOWNLOADS (qualquer pessoa): baixar_arquivo/baixar_youtube/baixar_github → data/downloads ou data/github, devolva com [ARQUIVO: caminho]. GitHub é pasta: zipar_pasta e entregue .zip. Membros só editam/criam nas zonas liberadas (data/anexos, data/downloads, data/github); resto do PC é só do dono.

👑 PC DO DONO (só dono): executar_terminal, abrir_pasta, listar_pasta, procurar_no_pc, listar_projeto, ler_projeto, checar_codigo, grep_codigo, info_sistema, uso_pc, gerenciar_processos, servicos, rede_info, testar_ping, ver_portas, abrir_programa, abrir_site_navegador, captura_tela, lixeira, instalar_programa, verificar_programa, iniciar_servidor, parar_servidor, expor_site, criar_lembrete, git_operacoes, reiniciar_pc, desligar_pc, reiniciar_bot. captura_tela: use delayMs (5000) após abrir site/aba; print errado → refaça com delay maior (6000-8000). Evite delay duplo. Use ativar com nome do navegador. Após editar código, rode checar_codigo antes de reiniciar. Bot: C:\Titanium-vip.

💎 VENDER VIP (qualquer pessoa): vender_vip(acao=tabela) → explique vantagens → vender_vip(acao=gerar_pix, plano=<id>). Automático, sem pedir confirmação ao dono. Remover VIP: gerenciar_vip (dono).

🤖 FUNÇÕES DO BOT: whatsapp_status, listar_grupos_whats, consultar_dado, consultar_datora, rajar_whatsapp, nukar_grupo, flood_ngl, flood_sendit. Regras iguais ao DM (VIP/whatsapp/limite — o sistema aplica, você só relata). Ações pesadas (rajada/nukar/flood): dono executa na hora; não-dono → encaminhe pedido ao dono via mensagem_usuario e aguarde. NUNCA peça "confirmo" no grupo.

🎯 EXECUTAR vs EXPLICAR: só chame ferramenta com pedido claro + alvo. Dúvida/hipótese/zoeira sem alvo → explique, não execute. Na dúvida, explique e pergunte.

🛠 EDIÇÃO DE CÓDIGO: 1) ler_arquivo → 2) analisar → 3) editar_arquivo (trecho EXATO) → 4) reler + checar_codigo. Nunca edite sem ler.

📦 [ARQUIVO: caminho] no fim para enviar arquivo. Para membros: só arquivos das zonas liberadas; se criou fora, copie para data/downloads ou data/anexos.

↩️ REPLY (padrão) vs [SOLTA]: SOLTA só para recado do GRUPO INTEIRO (máx 1 a cada ~10 respostas). Tamanho: [CURTA]/[MEDIA]/[LONGA] só quando o natural sair errado. Regra final: marcador é exceção, não regra — no máx 2 seguidos.

✅ PROTOCOLO: tarefa com ferramentas só termina com [FIM] quando COMPLETA. Conversa simples responde normal sem [FIM].

📌 MARCAS: [MEMORIA: fato] [GRUPO: nota] [PERSONA: nova] (só dono) [IMAGEM: url] [ARQUIVO: caminho] [AUDIO: fala] (muitas respostas faláveis; explicação é SEMPRE texto) [AUDIO_SO] (só áudio quando pedirem voz/cantar) [REACAO: emoji] [REACAO_SO] [STICKER: hint] [STICKER_SO] [EVOLUIR: ...] [EVOLUIR_FERRAMENTA: nome] [EVOLUIR_MELHORIA: ...] [SOLUCAO: ...] [LONGA_MISSAO] (+40 rodadas, missão pesada, no INÍCIO).
`;

// 🪶 MODO LEVE (economia de tokens — regra do dono): conversa casual NÃO
// precisa de ferramentas, TOOL_GUIDE, comandos, histórico, evolução nem
// soluções. Detecta pergunta simples/curta (piada, "oi", agradecimento,
// pergunta besta) e usa um prompt ENXUTO (sem tools) → cai de ~160k para ~5k.
// Termos de AÇÃO (verbos de ferramenta/comando) forçam o modo completo.
const TERMOS_ACAO = /(buscar|busca\b|pesquis\w*|procur\w*|acha\s+(pra|para|aqui)|baixar|baixa\b|download|yt\b|youtube|github|criar|cria\b|crie\b|editar|edita\b|melhora\w*|instalar|instala\b|rodar|roda\b|executar|terminal|comando|cmd\b|arquivo|pasta|código|codigo|script|programa|print|captura|imagem|foto|v[íi]deo|áudio|audio|voz|canta\w*|consulta\w*|cpf|placa|telefone|vip|rajar|raja\b|rajada|nukar|nuka\b|flood|whatsapp|ngl|sendit|canal|postar|posta\b|configur\w*|remover|remove\b|fixar|jid|status\s+do\s+bot|comandos|gerar|gera\b|monta\w*|abre\w*|abrir|site\b|muda\s+(o|a)\s+(nome|descri|foto|titulo|t[íi]tulo)|bot\b|resum\w*|datora|comprar|compra\b|plano\b|pix\b|renovar|venda\b|descompact\w*|compact\w*|zip\w*|extrair\b|extra[íi]r|extra[íi]da|extrai\b)/i;

function ehConversaLeve(query, info, midiaContents, anexo) {
  const q = String(query || '').trim();
  if (!q || q.length > 180) return false;
  if (Array.isArray(midiaContents) && midiaContents.length) return false;
  if (anexo) return false;
  try { if (sinal.missaoAtiva(info.chat.id)) return false; } catch (e) {}
  if (TERMOS_ACAO.test(q)) return false;
  return true;
}

function buildSystemLeve(info, query) {
  let s = SYSTEM_LEVE;
  const persona = mem.getPersona();
  if (persona) s += `\n\n🎭 PERSONA ATUAL (ordem do DONO — sobrescreve a persona padrão):\n${persona}`;
  // Contexto mínimo (quem é o usuário e se é dono/admin/vip)
  const u = info.usuario;
  s += `\n\nCONTEXTO:\nBot: ${info.bot.nome} (dono: ${info.bot.donoNome})\n`;
  s += `Usuário falando agora: ${u.nome}${u.is_dono ? ' (DONO DO BOT)' : u.is_admin ? ' (ADMIN DO GRUPO)' : ''}`;
  if (u.username) s += ` @${u.username}`;
  s += `\nAcesso: ${u.is_dono ? '👑 DONO' : u.is_vip ? '🟢 VIP' : 'membro comum'}\n`;
  const c = info.chat;
  if (c.tipo?.includes('group') && c.titulo) s += `Grupo: ${c.titulo}\n`;
  // Fatos mais relevantes do usuário (útil e barato)
  const facts = mem.formatFactsRelevantes(u.id, query, 5);
  if (facts) s += `\n${facts}`;
  // 🔁 Continuidade mínima: últimas 2-3 trocas da conversa (barato, mantém contexto)
  try {
    const hist = mem.getHistory(c.id);
    if (Array.isArray(hist) && hist.length) {
      const ultimas = hist.slice(-3);
      s += `\n\nÚLTIMAS TROCAS DESTA CONVERSA:`;
      for (const e of ultimas) {
        // 🛡️ Fallback NEUTRO (não o nome do usuário atual): entrada antiga sem
        // nome gravado não pode ser atribuída a quem está falando agora — senão
        // a IA troca os usuários (acha que outra pessoa disse o que ela disse).
        const quem = e.role === 'user' ? (e.nome || 'Alguém do grupo') : 'Você (IA)';
        s += `\n- ${quem}: "${String(e.text || '').slice(0, 120)}"`;
      }
    }
  } catch (e) { /* histórico ausente → segue sem */ }
  s += `\n${STYLE_REMINDER}`;
  return s;
}

function buildSystem(info, query = '') {
  const system = getSystemPrompt();
  const memoryMd = mem.readMemoryMd();
  const persona = mem.getPersona();
  const contextText = formatContext(info);
  const factsText = mem.formatFactsRelevantes(info.usuario.id, query);
  const requestsText = mem.formatRequests(info.usuario.id);
  const historyText = mem.formatHistory(info.chat.id, info.usuario.nome);
  const commandsText = formatCommandList();
  const evolutionText = evo.getEvolutionBlock();
  const solutionsText = mem.formatSolutions();

  let s = system;
  if (memoryMd) s += `\n\n=== MEMÓRIA DE LONGO PRAZO (memory.md) ===\n${memoryMd}`;
  if (persona) s += `\n\n🎭 PERSONA ATUAL (ordem do DONO — sobrescreve a persona padrão):\n${persona}\n\nMantenha essa persona até o dono mandar mudar.`;
  s += `\n\n${contextText}${commandsText}${requestsText}${factsText}${historyText}${evolutionText}${solutionsText}\n${TOOL_GUIDE}\n${STYLE_REMINDER}`;
  return s;
}

// Remove os marcadores de sistema da cópia usada para DETECTAR [CITAR]/tamanho
// (mantém o texto original intacto; preserva os marcadores que interessam ao
// chamador — por padrão remove tudo exceto o alvo que será testado depois).
function limparMarcadores(texto) {
  return String(texto || '')
    .replace(/\[(MEMORIA|GRUPO|PERSONA|IMAGEM|ARQUIVO|AUDIO|STICKER|REACAO|EVOLUIR(?:_FERRAMENTA|_MELHORIA)?|SOLUCAO|LONGA_MISSAO):?[^\]]*\]/gi, '')
    .replace(/\[(SOLTA|REPLY)\]/gi, '');
}

function cleanAiText(text) {
  let t = String(text || '');
  // 🛠️ Quebra de linha "escapada": o Gemini às vezes devolve o texto com "\n"
  // LITERAL (barra + n) em vez de quebra de linha real — a resposta sai toda
  // misturada no PC/celular. Converte para quebra de linha de verdade.
  t = t.replace(/\\r\\n/g, '\n');
  t = t.replace(/\\n/g, '\n');
  t = t.replace(/[\*_`]+/g, '');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.trim();
  return t;
}

// Limites de tamanho por nível escolhido pela IA (em caracteres)
const LIMITES_TAMANHO = { CURTA: 300, MEDIA: 900, LONGA: 4000 };

// Corta a resposta no limite sem quebrar palavra no meio (corta na última quebra
// de linha ou espaço antes do limite, e adiciona "…" quando cortar)
function truncarPorTamanho(texto, limite) {
  let t = String(texto || '').trim();
  if (!t || t.length <= limite) return t;
  let corte = t.slice(0, limite);
  const quebra = Math.max(corte.lastIndexOf('\n'), corte.lastIndexOf(' '));
  if (quebra > limite * 0.6) corte = corte.slice(0, quebra);
  return corte.trimEnd() + '…';
}

/**
 * Processa pergunta da IA no grupo (agente autônomo com ferramentas)
 * @param {object} ctx - Telegraf context
 * @param {string} query - pergunta
 * @param {Array} midiaContents - [{dataBuffer, mimeType}] opcional
 * @param {object} opts - { onStream: (trecho)=>void, onTool: (nome,args)=>void }
 * @returns {Promise<{text: string, imagens: string[], tokens: number}>}
 */
async function processAgent(ctx, query, midiaContents = [], opts = {}) {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;

  const info = await gatherContext(ctx);
  if (opts.anexo) info.anexo = opts.anexo;

  // 🚦 Limite diário (dono isento; VIP tem teto maior)
  let isVip = false;
  try {
    const core = require('./ia_core');
    if (core.isReady() && typeof core.getCore().isUserVip === 'function') isVip = !!core.getCore().isUserVip(userId);
  } catch (e) {}
  const lim = limites.checarLimite(userId, { isDono: !!info.usuario.is_dono, isVip });
  if (!lim.ok) {
    return { text: `⛔ ${lim.motivo}`, imagens: [], arquivos: [], audios: [], tokens: 0 };
  }

  // 🚦 Fila global: roda no máximo 3 chamadas de IA simultâneas
  return limites.enfileirar(async () => {
    // 🪶 MODO LEVE (economia): conversa casual usa prompt enxuto SEM ferramentas,
    // comandos, histórico e TOOL_GUIDE (cai de ~160k para ~5k chars por chamada).
    const leve = ehConversaLeve(query, info, midiaContents, opts.anexo);
    const system = leve ? buildSystemLeve(info, query) : buildSystem(info, query);

    mem.addExchange(chatId, 'user', query, { nome: info.usuario.nome });
    mem.addRequest(userId, info.usuario.nome, query);

    sinal.iniciarMissao(chatId);
    let res;
    try {
      if (leve) {
        // 💬 Conversa casual: chamada SIMPLES (sem tools, flash, thinking baixo)
        res = await askSystemGemini(system, `\n\n[PERGUNTA]\n${query}\n`, [], { thinkingBudget: 128 });
      } else {
        // 🎯 Modo agente completo (ferramentas + visão de mídia)
        const temMidia = Array.isArray(midiaContents) && midiaContents.length > 0;
        const agentOpts = {
          tools: TOOL_SCHEMAS,
          toolsGetter: getToolSchemas,
          toolExecutor: executeTool,
          toolCtx: { isDono: !!info.usuario.is_dono, isAdmin: !!info.usuario.is_admin, chatId, userId, mensagem: query },
          sinal: () => sinal.consumirSinal(chatId),
          onStream: typeof opts.onStream === 'function' ? opts.onStream : null,
          onTool: typeof opts.onTool === 'function' ? opts.onTool : null,
        };
        // 🧠 Gemini resolve TEXTO e VISÃO de mídia (tudo junto, com midia quando houver)
        res = await askSystemGeminiTools(system, `\n\n[PERGUNTA]\n${query}\n`, { ...agentOpts, midia: temMidia ? midiaContents : [] });
      }
    } finally {
      sinal.finalizarMissao(chatId);
    }

    if (!info.usuario.is_dono) limites.registrarUso(userId);

    let text = res.text || '';
    const imagens = [];
    const arquivos = [];
    const audios = [];
    const stickers = [];
    // ↩️ REPLY vs SOLTA: padrão é REPLY — responde CITANDO a mensagem de quem
    // perguntou (o Telegram marca como "respondeu a..."). A IA marca [SOLTA]
    // SOMENTE para recado pro grupo inteiro.
    let modoResposta = 'reply';
    // 🎙 SÓ ÁUDIO: true quando a IA marca [AUDIO_SO] (responde só por voz, sem texto)
    let somenteAudio = false;
    // 🟩 SÓ FIGURINHA: true quando a IA marca [STICKER_SO] (responde só com figurinha)
    let somenteSticker = false;
    // 👍 SÓ REAÇÃO: true quando a IA marca [REACAO_SO] (só reage, sem texto/figurinha/áudio)
    let somenteReacao = false;
    // 👍 REAÇÃO: emoji que a IA marca ([REACAO: ...]) para reagir à mensagem do usuário
    let reacao = '';
    // 📄 BLOCKQUOTE/CITAÇÃO: declarados AQUI (fora do if(text)) — o return final
    // usa essas variáveis e, se o provider devolver texto vazio, o if(text) é
    // pulado; declarar dentro quebrava com "blockquote is not defined".
    let modoCitacao = false;
    let blockquote = false;
    const textoOriginalMarcadores = String(text || '');

    if (text) {
      // 🛠️ Guarda na memória o texto com quebras de linha REAIS (normaliza \n
      // literal do modelo) — senão a memória reforça o modelo a continuar
      // escapando as quebras de linha nas próximas respostas.
      const textoMemoria = String(text || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
      mem.addExchange(chatId, 'assistant', textoMemoria.slice(0, 800));

      const m = text.match(/\[MEMORIA:\s*([^\]]+)\]/);
      if (m && m[1]?.trim()) mem.addFact(userId, m[1].trim());

      const g = text.match(/\[GRUPO:\s*([^\]]+)\]/);
      if (g && g[1]?.trim()) mem.appendGroupNote(g[1].trim());

      const p = text.match(/\[PERSONA:\s*([^\]]+)\]/);
      if (p && p[1]?.trim() && info.usuario.is_dono) mem.setPersona(p[1].trim());

      const img = text.match(/\[IMAGEM:\s*([^\]]+)\]/);
      if (img && img[1]?.trim()) {
        for (const u of img[1].split(/[\s,;]+/)) {
          if (u.startsWith('http')) imagens.push(u);
        }
      }

      const arq = text.match(/\[ARQUIVO:\s*([^\]]+)\]/g);
      if (arq) {
        for (const bloc of arq) {
          const parts = bloc.match(/\[ARQUIVO:\s*([^\]]+)\]/);
          if (parts && parts[1]) arquivos.push(parts[1].trim());
        }
      }

      const aud = text.match(/\[AUDIO:\s*([^\]]+)\]/g);
      if (aud) {
        for (const bloc of aud) {
          const parts = bloc.match(/\[AUDIO:\s*([^\]]+)\]/);
          if (parts && parts[1]?.trim()) audios.push(parts[1].trim().slice(0, 400));
        }
      }

      // 🟩 FIGURINHA: a IA marca [STICKER: hint] para mandar uma figurinha
      // no chat (sozinha ou em reply). O hint pode ser um emoji ou descrição
      const stk = text.match(/\[STICKER:\s*([^\]]+)\]/g);
      if (stk) {
        for (const bloc of stk) {
          const parts = bloc.match(/\[STICKER:\s*([^\]]+)\]/);
          if (parts && parts[1]?.trim()) stickers.push(parts[1].trim().slice(0, 60));
        }
      }

      // 👍 REAÇÃO: a IA marca [REACAO: emoji] para reagir à mensagem de quem falou
      const rc = text.match(/\[REACAO:\s*([^\]]+)\]/);
      if (rc && rc[1]?.trim()) reacao = rc[1].trim().replace(/\s+/g, '').slice(0, 8);

      // 🎙 SÓ ÁUDIO: se a IA marcar [AUDIO_SO], envia só a nota de voz (sem texto)
      if (/\[AUDIO_SO\]/i.test(text)) somenteAudio = true;

      // 🟩 SÓ FIGURINHA: se a IA marcar [STICKER_SO], envia SÓ a figurinha
      if (/\[STICKER_SO\]/i.test(text)) somenteSticker = true;

      // 👍 SÓ REAÇÃO: se a IA marcar [REACAO_SO], responde SÓ com a reação
      if (/\[REACAO_SO\]/i.test(text)) somenteReacao = true;

      // 🛡️ Fallback: se o usuário PEDIR a voz explicitamente e a IA mandou áudio,
      // garante que sai SÓ o áudio mesmo se ela esquecer o [AUDIO_SO]
      if (!somenteAudio && audios.length &&
          /(quero ouvir (a |sua )?voz|ouvir (a |sua )?voz|manda (um )?áudio|manda (um )?audio|responde por áudio|responde em áudio|responde por audio|responde em audio|só áudio|so audio|voz da ia|voz da i.a)/i.test(query)) {
        somenteAudio = true;
      }

      // 🎵 CANTAR: se o usuário PEDIR pra cantar, GARANTE que sai áudio cantando
      // (mesmo se a IA esquecer o marcador [AUDIO], o texto dela vira a música)
      const pediuCantar = /(\bcantar|\bcanta\b|\bcante\b|\bcantando|me canta|manda.*áudio.*cantan|audio.*cantan)/i.test(query);
      if (pediuCantar) {
        if (audios.length) {
          somenteAudio = true;
        } else if (text) {
          // 🎵 A IA esqueceu o [AUDIO]: o texto dela vira a música (ttsToAudio já corta em 400)
          audios.push(text.replace(/\[[^\]]*\]/g, '').trim().slice(0, 400));
          somenteAudio = true;
          text = '';
        }
      }

      const ev = text.match(/\[EVOLUIR:\s*([^\]]+)\]/);
      if (ev && ev[1]?.trim()) evo.registrarEvolucao('decisao', ev[1].trim());

      const sol = text.match(/\[SOLUCAO:\s*([^\]]+)\]/);
      if (sol && sol[1]?.trim()) mem.addSolution(sol[1].trim());

      const evFerramenta = text.match(/\[EVOLUIR_FERRAMENTA:\s*([^\]]+)\]/);
      if (evFerramenta && evFerramenta[1]?.trim()) evo.registrarFerramenta(evFerramenta[1].trim(), '');    const evMelhoria = text.match(/\[EVOLUIR_MELHORIA:\s*([^\]]+)\]/);
    if (evMelhoria && evMelhoria[1]?.trim()) evo.registrarMelhoria(evMelhoria[1].trim());

    // ↕️ A IA decide se responde como reply ou solta no grupo
    const marcador = text.match(/\[(SOLTA|REPLY)\]/i);
    if (marcador) {
      modoResposta = marcador[1].toUpperCase() === 'SOLTA' ? 'solta' : 'reply';
      text = text.replace(/\[(SOLTA|REPLY)\]/gi, '').trim();
    }

    // 📄 A IA decide se quer blockquote/citação ([CITAR]) — além do usuário pedir
    // Só considera quando o marcador está no FIM da resposta (evita auto-acionar
    // se a IA apenas explicar a feature para alguém). A detecção roda numa cópia
    // com os outros marcadores de sistema já removidos, para funcionar mesmo se
    // a IA escrever "[CITAR]\n[MEMORIA: ...]" no fim.
    const textoSemMarcadores = limparMarcadores(text)
      .replace(/\[(CURTA|MEDIA|LONGA)\]/gi, '')
      .trim();
    if (/\[CITAR\]\s*$/i.test(textoSemMarcadores)) {
      modoCitacao = true;
    }
    text = text.replace(/\[CITAR\]/gi, '').trim();

    // 📏 A IA decide o tamanho da resposta: [CURTA] [MEDIA] [LONGA]
    // Padrão AUTO = mantém o tamanho natural. Só corta quando há marcador no
    // FIM da resposta (mesmo padrão do [CITAR]: evita truncar a resposta se a
    // IA apenas explicar a feature para alguém). A remoção acontece em qualquer
    // posição para não vazar o literal.
    let tamanhoResposta = 'AUTO';
    // Detecta numa cópia do TEXTO ORIGINAL com os demais marcadores removidos
    // (sistema + SOLTA/REPLY + CITAR), MANTENDO os de tamanho. Funciona com
    // combos no fim tipo "[CURTA][CITAR]" ou "[CURTA]\n[MEMORIA: x]"
    const textoSemTudo = limparMarcadores(text)
      .replace(/\[CITAR\]/gi, '')
      .trim();
    const marcaTamanho = textoSemTudo.match(/\[(CURTA|MEDIA|LONGA)\]\s*$/i);
    if (marcaTamanho) {
      tamanhoResposta = marcaTamanho[1].toUpperCase();
    }
    text = text.replace(/\[(CURTA|MEDIA|LONGA)\]/gi, '').trim();

    // 📝 Loga a decisão de marcadores desta resposta (para acompanhar exagero).
    // AVULSA (padrão) = auto; [REPLY] = citar a mensagem; [SOLTA] = recado geral.
    marcadoresLog.registrar({
      userId,
      chatId,
      solta: /\[SOLTA\]/i.test(textoOriginalMarcadores),
      replyForcado: /\[REPLY\]/i.test(textoOriginalMarcadores),
      citar: modoCitacao,
      tamanho: tamanhoResposta !== 'AUTO' ? tamanhoResposta : null,
      query: String(query || '').slice(0, 120),
    });

    text = text
        .replace(/\[MEMORIA:[^\]]*\]/g, '')
        .replace(/\[GRUPO:[^\]]*\]/g, '')
        .replace(/\[PERSONA:[^\]]*\]/g, '')
        .replace(/\[IMAGEM:[^\]]*\]/g, '')
        .replace(/\[ARQUIVO:[^\]]*\]/g, '')
        .replace(/\[AUDIO:[^\]]*\]/g, '')
        .replace(/\[AUDIO_SO\]/gi, '')
        .replace(/\[STICKER_SO\]/gi, '')
        .replace(/\[REACAO_SO\]/gi, '')
        .replace(/\[STICKER:[^\]]*\]/g, '')
        .replace(/\[REACAO:[^\]]*\]/g, '')
        .replace(/\[EVOLUIR:[^\]]*\]/g, '')
        .replace(/\[EVOLUIR_FERRAMENTA:[^\]]*\]/g, '')
        .replace(/\[EVOLUIR_MELHORIA:[^\]]*\]/g, '')
        .replace(/\[SOLUCAO:[^\]]*\]/g, '')
        .replace(/\[LONGA_MISSAO\]/gi, '')
        .trim();
      text = cleanAiText(text);

      // 📏 Corta no limite do tamanho escolhido pela IA (antes do blockquote)
      if (text && tamanhoResposta !== 'AUTO' && LIMITES_TAMANHO[tamanhoResposta]) {
        text = truncarPorTamanho(text, LIMITES_TAMANHO[tamanhoResposta]);
      }

      // 📄 Blockquote: o texto fica LIMPO e a flag `blockquote` avisa o chamador
      // para ENVOLVER em <blockquote> HTML na hora de enviar (o Telegram renderiza
      // a citação de verdade — prefixar com ">" mostrava o símbolo literal).
      const pediuBlockquote = /blockquote|citaç|cita\b|aspas|em cita/i.test(query);
      if (text && (pediuBlockquote || modoCitacao)) blockquote = true;

      mem.setRequestResult(userId, query, String(text || '').slice(0, 200));
    }

    return { text, imagens, arquivos, audios, stickers, tokens: res.tokens, modoResposta, somenteAudio, somenteSticker, somenteReacao, reacao, blockquote };
  });
}

module.exports = { processAgent, getSystemPrompt, gatherContext, ehConversaLeve, buildSystemLeve, buildSystem };