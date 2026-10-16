/**
 * 🧠 CORVO - NÚCLEO DO BOT PARA A IA
 * Ponte entre o agente (ia_tools) e as funções internas do index.js.
 * O index.js registra aqui as funções reais no boot via setCore().
 * Assim a IA consegue administrar o bot: VIP, broadcast, ban, stats...
 */

const DONO = '8273924319';
const path = require('path');
const fs = require('fs');
const { Jimp, loadFont, measureText } = require('jimp');
const sharp = require('sharp');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const CANAL_POSTS_FILE = path.join(DATA_DIR, 'ia_canal_posts.json');
const FONT_DIR = path.resolve(__dirname, '..', '..', 'node_modules', '@jimp', 'plugin-print', 'fonts', 'open-sans');

let core = null;

function setCore(fns) {
  core = fns;
}

function isReady() {
  return !!core;
}

function getCore() {
  if (!core) throw new Error('Núcleo do bot ainda não foi registrado (setCore não chamado no index.js).');
  return core;
}

/** Libera VIP para TODOS os usuários (menos o dono) por `duracao` (ex: "1 hora", "24 horas", "7 dias") */
async function liberarVipTodos(duracao) {
  const { vips, saveVips, parseVipDuration, totalUsers, logEvent } = getCore();
  const dur = parseVipDuration(duracao);
  if (!dur || dur.ms <= 0) return { erro: `Duração inválida: "${duracao}". Use ex: "1 hora", "24 horas", "7 dias", "30 min".` };
  const now = Date.now();
  const ids = [...new Set([...totalUsers, ...Object.keys(vips).map(Number)])].filter(id => id !== DONO);
  let ok = 0;
  for (const uid of ids) {
    const id = Number(uid);
    if (!Number.isFinite(id)) continue;
    const cur = vips[id];
    const base = cur && now <= cur.expiresAt ? cur.expiresAt : now;
    vips[id] = { type: 'full', expiresAt: base + dur.ms, startedAt: cur && cur.startedAt ? cur.startedAt : now };
    ok++;
  }
  saveVips();
  if (logEvent) logEvent('IA-ADMIN', `IA liberou VIP para ${ok} usuários por ${dur.label}.`);
  return { ok: true, liberados: ok, duracao: dur.label, validaAte: new Date(now + dur.ms).toLocaleString('pt-BR') };
}

/** Libera VIP para UM usuário por `duracao` */
async function liberarVip(userId, duracao) {
  const { vips, saveVips, parseVipDuration, logEvent } = getCore();
  const dur = parseVipDuration(duracao);
  if (!dur || dur.ms <= 0) return { erro: `Duração inválida: "${duracao}".` };
  const id = Number(userId);
  if (!Number.isFinite(id)) return { erro: `ID de usuário inválido: "${userId}".` };
  const now = Date.now();
  const cur = vips[id];
  const base = cur && now <= cur.expiresAt ? cur.expiresAt : now;
  vips[id] = { type: 'full', expiresAt: base + dur.ms, startedAt: cur && cur.startedAt ? cur.startedAt : now };
  saveVips();
  if (logEvent) logEvent('IA-ADMIN', `IA liberou VIP para ${id} por ${dur.label}.`);
  return { ok: true, usuarioId: id, duracao: dur.label, validaAte: new Date(vips[id].expiresAt).toLocaleString('pt-BR') };
}

/** Remove VIP de um usuário */
async function removerVip(userId) {
  const { vips, saveVips, logEvent } = getCore();
  const id = Number(userId);
  if (!Number.isFinite(id)) return { erro: `ID de usuário inválido: "${userId}".` };
  if (vips[id]) {
    delete vips[id];
    saveVips();
    if (logEvent) logEvent('IA-ADMIN', `IA removeu VIP de ${id}.`);
    // Avisa a pessoa no privado que o VIP dela foi removido (se nunca abriu o privado, loga aviso e segue)
    const avisoRes = await mensagemPara(id, '🚫 *AVISO IMPORTANTE*\n\nSeu acesso *VIP* no CORVO foi removido pelo dono do bot.\n\nSe quiser continuar com os benefícios, fale com o dono ou adquira um novo plano a qualquer momento.\n\n💎 Digite *planos* para ver as opções.');
    if (avisoRes && avisoRes.erro) {
      if (logEvent) logEvent('WARN', `Não consegui avisar ${id} sobre a remoção do VIP: ${avisoRes.erro}`);
    }
    return { ok: true, usuarioId: id, acao: 'vip removido', aviso: avisoRes && avisoRes.erro ? 'Não foi possível avisar no privado' : 'Pessoa avisada no privado.' };
  }
  return { ok: false, usuarioId: id, acao: 'usuário não tinha VIP' };
}

/** Remove o VIP de TODOS os usuários (menos o dono) */
async function removerVipTodos() {
  const { vips, saveVips, logEvent } = getCore();
  const ids = Object.keys(vips)
    .map(Number)
    .filter(id => Number.isFinite(id) && String(id) !== DONO && vips[id]);
  let ok = 0;
  const avisosFalhos = [];
  for (const id of ids) {
    delete vips[id];
    ok++;
  }
  if (ok > 0) {
    saveVips();
    if (logEvent) logEvent('IA-ADMIN', `IA removeu VIP de ${ok} usuários (todos).`);
  }
  // Avisa cada pessoa no privado que o VIP dela foi removido (se nunca abriu o privado, loga aviso e segue)
  for (const id of ids) {
    const avisoRes = await mensagemPara(id, '🚫 *AVISO IMPORTANTE*\n\nSeu acesso *VIP* no CORVO foi removido pelo dono do bot.\n\nSe quiser continuar com os benefícios, fale com o dono ou adquira um novo plano a qualquer momento.\n\n💎 Digite *planos* para ver as opções.');
    if (avisoRes && avisoRes.erro) avisosFalhos.push(id);
  }
  return { ok: true, removidos: ok, avisosFalhos: avisosFalhos.length };
}

/** Lista VIPs ativos */
async function listarVips() {
  const { vips, isUserVip, getVipRemainingLabel } = getCore();
  const now = Date.now();
  const ativos = Object.entries(vips)
    .filter(([id, v]) => v.expiresAt > now)
    .sort((a, b) => a[0] - b[0]);
  if (!ativos.length) return 'Nenhum VIP ativo no momento.';
  const linhas = ativos.map(([id, v]) => {
    const tipo = v.type === 'full' ? 'COMPLETO' : 'PADRÃO';
    return `• \`${id}\` — ${tipo} (expira ${new Date(v.expiresAt).toLocaleString('pt-BR')})`;
  });
  return `💎 VIPs ativos (${ativos.length}):\n${linhas.join('\n')}`;
}

/** Consulta o VIP de UM usuário específico (status, tipo, restante, vencimento) */
async function consultarVip(userId) {
  const { vips, getVipRemainingLabel } = getCore();
  const id = Number(userId);
  if (!Number.isFinite(id)) return { erro: `ID de usuário inválido: "${userId}".` };
  const vip = vips[id];
  const now = Date.now();
  if (!vip || now > vip.expiresAt) {
    return { resultado: `❌ Usuário \`${id}\` NÃO possui VIP ativo.` };
  }
  const tipo = vip.type === 'full' ? 'COMPLETO' : 'PADRÃO';
  const restante = getVipRemainingLabel(id) || '—';
  const inicio = vip.startedAt ? new Date(vip.startedAt).toLocaleString('pt-BR') : '—';
  const vence = new Date(vip.expiresAt).toLocaleString('pt-BR');
  return {
    resultado: `✅ Usuário \`${id}\` — VIP ATIVO\n💎 Tipo: ${tipo}\n⏳ Restante: ${restante}\n🎟 Início: ${inicio}\n⏰ Vence: ${vence}`
  };
}

/** Stats do bot */
async function statsBot() {
  const { totalUsers, vips, bannedUsers, isUserVip } = getCore();
  const now = Date.now();
  const vipsAtivos = Object.values(vips).filter(v => v.expiresAt > now).length;
  return {
    usuarios: totalUsers.size,
    vipsAtivos,
    banidos: bannedUsers.size,
    admins: 1,
  };
}

/** Envia broadcast para todos os usuários */
async function broadcast(texto) {
  const { bot, totalUsers, logEvent } = getCore();
  const msg = `📢 *COMUNICADO OFICIAL CORVO*\n\n${String(texto || '').slice(0, 3000)}`;
  let enviados = 0;
  const falhas = [];
  for (const uid of totalUsers) {
    try {
      await bot.telegram.sendMessage(uid, msg, { parse_mode: 'Markdown' });
      enviados++;
    } catch (e) { falhas.push(uid); }
  }
  if (logEvent) logEvent('IA-ADMIN', `IA enviou broadcast para ${enviados} usuários.`);
  return { ok: true, enviados, falhas: falhas.length };
}

/** Bane ou desbane um usuário */
async function banirUsuario(userId, desbanir = false) {
  const { bannedUsers, totalUsers, logEvent } = getCore();
  const id = Number(userId);
  if (!Number.isFinite(id)) return { erro: `ID de usuário inválido: "${userId}".` };
  if (id === DONO) return { erro: 'Não posso banir o dono.' };
  if (desbanir) {
    bannedUsers.delete(id);
    if (logEvent) logEvent('IA-ADMIN', `IA desbaniu ${id}.`);
    return { ok: true, usuarioId: id, acao: 'desbanido' };
  }
  bannedUsers.add(id);
  if (logEvent) logEvent('IA-ADMIN', `IA baniu ${id}.`);
  return { ok: true, usuarioId: id, acao: 'banido' };
}

/** Envia mensagem para um usuário específico */
async function mensagemPara(userId, texto) {
  const { bot, logEvent } = getCore();
  try {
    await bot.telegram.sendMessage(Number(userId), String(texto).slice(0, 3000), { parse_mode: 'Markdown' });
    return { ok: true, usuarioId: Number(userId) };
  } catch (e) {
    return { erro: `Não consegui enviar mensagem para ${userId}: ${e.message}` };
  }
}

// ===== FUNÇÕES DO BOT USADAS PELO AGENTE NO GRUPO =====
// Ponte para as funções registradas no index.js via setCore (agente*).
// Qualquer membro do grupo pode pedir — cada um usa a própria sessão
// WhatsApp e os próprios limites (regras já aplicadas lá dentro).

/** Consulta de dados via API do bot (cpf/nome/telefone/credlink/sipni/sisreg/placa) */
async function consultarDado(tipo, valor, userId) {
  const c = getCore();
  if (typeof c.agenteConsultar !== 'function') return { erro: 'Consultas não habilitadas para o agente.' };
  return c.agenteConsultar(tipo, valor, userId);
}

/** Consulta na base Datora local (base-datora.txt) por número */
async function consultarDatora(numero, userId) {
  const c = getCore();
  if (typeof c.agenteConsultarDatora !== 'function') return { erro: 'Consulta Datora não habilitada para o agente.' };
  return c.agenteConsultarDatora(numero, userId);
}

/** Rajada WhatsApp (tipo: 1, 2, 3, porno, gore) em um grupo (jid @g.us) */
async function rajarWhats(tipo, jid, userId) {
  const c = getCore();
  if (typeof c.agenteRajar !== 'function') return { erro: 'Rajada não habilitada para o agente.' };
  return c.agenteRajar(userId, tipo, jid);
}

/** Nukar grupo do WhatsApp (jid @g.us) */
async function nukarWhats(jid, userId) {
  const c = getCore();
  if (typeof c.agenteNukar !== 'function') return { erro: 'Nuke não habilitado para o agente.' };
  return c.agenteNukar(userId, jid);
}

/** Flood NGL para um username */
async function floodNgl(username, userId) {
  const c = getCore();
  if (typeof c.agenteFloodNgl !== 'function') return { erro: 'Flood NGL não habilitado para o agente.' };
  return c.agenteFloodNgl(userId, username);
}

/** Flood Sendit a partir de um link de sticker */
async function floodSendit(link, userId) {
  const c = getCore();
  if (typeof c.agenteFloodSendit !== 'function') return { erro: 'Flood Sendit não habilitado para o agente.' };
  return c.agenteFloodSendit(userId, link);
}

/** Status da sessão WhatsApp de quem pediu */
async function whatsStatus(userId) {
  const c = getCore();
  if (typeof c.agenteWhatsStatus !== 'function') return { erro: 'Status do WhatsApp não disponível para o agente.' };
  return c.agenteWhatsStatus(userId);
}

/** Lista os grupos do WhatsApp conectado de quem pediu */
async function listarGruposWhats(userId) {
  const c = getCore();
  if (typeof c.agenteListarGrupos !== 'function') return { erro: 'Listar grupos não habilitado para o agente.' };
  return c.agenteListarGrupos(userId);
}

// ===== VENDAS VIP PELA IA =====
// Qualquer pessoa do grupo pode pedir: a IA mostra a tabela de planos com
// preços e vantagens e gera o PIX com botão de pagamento. O VIP é ativado
// automaticamente após o pagamento (watcher de pendingPayments no index.js).

/** Mostra a tabela de planos VIP com preços e vantagens */
async function listarPlanosVip() {
  const c = getCore();
  if (typeof c.agenteListarPlanosVip !== 'function') return { erro: 'Tabela de planos VIP não habilitada para o agente.' };
  return c.agenteListarPlanosVip();
}

/** Gera o PIX do plano escolhido e envia o código com botão de pagamento para quem pediu */
async function venderVip(plano, userId, chatId) {
  const c = getCore();
  if (typeof c.agenteVenderVip !== 'function') return { erro: 'Venda de VIP não habilitada para o agente.' };
  return c.agenteVenderVip(plano, userId, chatId);
}

// ===== CANAL OFICIAL (somente o DONO pede) =====
// A IA posta/edita/apaga atualizações no canal do Corvo quando o dono mandar
// (ex: "ia, posta isso no canal", "melhora o texto do post", "posta essa foto
// no canal com uma atualização"). O texto aceita HTML (<b>, <i>, <blockquote>).

/** Botões padrão no final de toda publicação do canal: chat do bot + grupo oficial.
 * Só são aplicados DE VEZ EM QUANDO (regra do dono: botão em toda mensagem
 * enche o saco) — ~45% das publicações saem com os botões, o resto sai limpo. */
function tecladoCanal() {
  const { botLink, groupLink } = getCore();
  return {
    inline_keyboard: [[
      { text: '🤖 • Chat do Bot', url: botLink || 'https://t.me/corvo_div_bot' },
      { text: '👥 • Grupo Oficial', url: groupLink || 'https://t.me/+mI3rzIccSwQ4NmFh' }
    ]]
  };
}

/** Sorteia se a publicação vai com os botões do canal (de vez em quando). */
function comBotoesCanal() {
  return Math.random() < 0.45;
}

/** Registra um post do canal (ID + texto + tipo) para a IA conseguir achar e editar depois.
 * Se o message_id já existe no log, SUBSTITUI (mantém o texto atualizado, sem duplicar).
 * O tipo ('texto' | 'foto') é PRESERVADO ao substituir um post existente (a edição
 * não muda se é foto ou texto) e usado pelo buscar_post_canal para informar a IA. */
function registrarPostCanal(messageId, texto, nome = 'IA', tipo = 'texto') {
  try {
    const id = Number(messageId);
    if (!Number.isFinite(id)) return; // sem ID válido não registra
    const posts = lerPostsCanal();
    const idx = posts.findIndex(p => p.message_id === id);
    // Edição de um post existente: mantém o tipo anterior (texto, foto ou vídeo)
    const tipoFinal = idx >= 0 && posts[idx] && posts[idx].tipo ? posts[idx].tipo : (tipo === 'foto' || tipo === 'video' ? tipo : 'texto');
    const entrada = { message_id: id, texto: String(texto || '').slice(0, 400), ts: Date.now(), nome, tipo: tipoFinal };
    if (idx >= 0) posts[idx] = entrada;
    else posts.unshift(entrada);
    fs.writeFileSync(CANAL_POSTS_FILE, JSON.stringify(posts.slice(0, 100)));
  } catch (e) { /* não bloqueia o envio */ }
}

/** Lê o registro local dos posts do canal (para buscar por texto). */
function lerPostsCanal() {
  try {
    return JSON.parse(fs.readFileSync(CANAL_POSTS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

/** Posta um texto no canal oficial. Retorna o ID da mensagem para editar/apagar depois.
 * Os botões do canal entram de vez em quando (probabilidade interna). */
async function postarCanal(texto) {
  const { bot, channelId, logEvent } = getCore();
  const txt = String(texto || '');
  const teclado = comBotoesCanal() ? tecladoCanal() : null;
  const extra = { parse_mode: 'HTML', ...(teclado ? { reply_markup: teclado } : {}) };
  // Se o HTML da IA vier malformado, o Telegram devolve 400 — cai pro texto puro
  try {
    const msg = await bot.telegram.sendMessage(channelId, txt, extra);
    registrarPostCanal(msg.message_id, txt);
    if (logEvent) logEvent('IA-CANAL', `IA postou no canal (msg ${msg.message_id}).`);
    return { ok: true, mensagem_id: msg.message_id };
  } catch (e) {
    try {
      const msg = await bot.telegram.sendMessage(channelId, txt.replace(/<[^>]+>/g, ''), { ...(teclado ? { reply_markup: teclado } : {}) });
      registrarPostCanal(msg.message_id, txt);
      if (logEvent) logEvent('IA-CANAL', `IA postou no canal SEM formatação (msg ${msg.message_id}).`);
      return { ok: true, mensagem_id: msg.message_id, semHtml: true };
    } catch (e2) {
      return { erro: `Erro ao postar no canal: ${e2.message}` };
    }
  }
}

/** Edita uma postagem do canal pelo ID da mensagem (mantém/garante os botões, de vez em quando). */
async function editarCanal(mensagemId, texto) {
  const { bot, channelId, logEvent } = getCore();
  const txt = String(texto || '');
  const id = Number(mensagemId);
  const teclado = comBotoesCanal() ? tecladoCanal() : null;
  const limpo = txt.replace(/<[^>]+>/g, '');
  // Sequência de tentativas: post de TEXTO (HTML) → post de FOTO/legenda (HTML) →
  // sem formatação. O editMessageText falha em posts de foto, então caímos na legenda.
  const tentativas = [
    { metodo: 'editMessageText', arg: txt, extra: { parse_mode: 'HTML', ...(teclado ? { reply_markup: teclado } : {}) }, tipo: 'texto' },
    { metodo: 'editMessageCaption', arg: txt, extra: { parse_mode: 'HTML', ...(teclado ? { reply_markup: teclado } : {}) }, tipo: 'foto' },
    { metodo: 'editMessageCaption', arg: limpo, extra: { ...(teclado ? { reply_markup: teclado } : {}) }, tipo: 'foto', semHtml: true },
    { metodo: 'editMessageText', arg: limpo, extra: { ...(teclado ? { reply_markup: teclado } : {}) }, tipo: 'texto', semHtml: true }
  ];
  let ultimoErro = null;
  for (const t of tentativas) {
    try {
      await bot.telegram[t.metodo](channelId, id, null, t.arg, t.extra);
      registrarPostCanal(id, txt); // mantém o log atualizado com o novo texto
      const oQue = t.tipo === 'foto' ? 'a legenda (foto) do' : 'o';
      if (logEvent) logEvent('IA-CANAL', `IA editou ${oQue} post ${mensagemId}${t.semHtml ? ' SEM formatação' : ''}.`);
      return { ok: true, mensagem_id: id, tipo: t.tipo, semHtml: !!t.semHtml };
    } catch (e) {
      ultimoErro = e;
    }
  }
  return { erro: `Erro ao editar no canal: ${ultimoErro ? ultimoErro.message : 'sem detalhes'}` };
}

/** Apaga uma postagem do canal pelo ID da mensagem. */
async function apagarCanal(mensagemId) {
  const { bot, channelId, logEvent } = getCore();
  try {
    await bot.telegram.deleteMessage(channelId, Number(mensagemId));
    if (logEvent) logEvent('IA-CANAL', `IA apagou o post ${mensagemId} do canal.`);
    return { ok: true, mensagem_id: Number(mensagemId) };
  } catch (e) {
    return { erro: `Erro ao apagar no canal: ${e.message}` };
  }
}

/** Posta um VÍDEO (caminho ou URL) com legenda no canal. Retorna o ID da mensagem.
 * `capa` (opcional): um TÍTULO curto (ex: "NOVA ATUALIZAÇÃO") — o sistema gera
 * uma capa profissional 16:9 com esse título e usa como thumbnail do vídeo; ou
 * um caminho de imagem existente para usar direto como capa. Os botões do canal
 * entram de vez em quando. O tipo 'video' é registrado no log. */
async function postarVideoCanal(caminho, legenda, capa) {
  let extraMidia = null;
  if (capa) {
    try {
      const capaStr = String(capa || '').trim();
      // Caminho de imagem existente → usa direto; URL → baixa e converte;
      // senão é título → gera a capa 16:9. Thumb do Telegram é JPEG ≤320px.
      let capaArquivo = null;
      if (/^https?:\/\//i.test(capaStr)) {
        const resp = await fetch(capaStr, { signal: AbortSignal.timeout(15000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());
        const thumb = await sharp(buf).resize(320, 320, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
        extraMidia = { thumb: { source: thumb, filename: 'capa.jpg' } };
      } else if (fs.existsSync(capaStr)) {
        capaArquivo = capaStr;
      } else {
        const r = await criarCapaVideo(capaStr, String(legenda || '').replace(/<[^>]+>/g, '').slice(0, 60));
        if (r.ok && fs.existsSync(r.caminho)) capaArquivo = r.caminho;
      }
      if (capaArquivo) {
        const thumb = await sharp(capaArquivo).resize(320, 320, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
        extraMidia = { thumb: { source: thumb, filename: 'capa.jpg' } };
      }
    } catch (e) {
      const { logEvent } = getCore();
      if (logEvent) logEvent('WARN', `Não consegui gerar a capa do vídeo: ${e.message}`);
      extraMidia = null;
    }
  }
  return postarMidiaCanal('sendVideo', 'video', caminho, legenda, extraMidia);
}

/** Posta uma FOTO (caminho ou URL) com legenda no canal. Retorna o ID da mensagem.
 * Os botões do canal entram de vez em quando (probabilidade interna). */
async function postarFotoCanal(caminho, legenda) {
  return postarMidiaCanal('sendPhoto', 'foto', caminho, legenda);
}

/** Núcleo compartilhado de postagem de MÍDIA (foto/vídeo) no canal: URL → passa a
 * string direta; caminho local → { source } (telegraf cria o stream). Tenta com
 * HTML e cai para sem formatação se o Telegram rejeitar. `extraMidia` (opcional)
 * traz extras específicos (ex: thumb da capa no vídeo). Registra o tipo no log. */
async function postarMidiaCanal(metodo, tipo, caminho, legenda, extraMidia = null) {
  const { bot, channelId, logEvent } = getCore();
  const cam = String(caminho || '');
  const midia = /^https?:\/\//i.test(cam) ? cam : { source: cam };
  const cap = String(legenda || '');
  const teclado = comBotoesCanal() ? tecladoCanal() : null;
  const montar = (comHtml) => ({
    caption: comHtml ? cap : cap.replace(/<[^>]+>/g, ''),
    ...(comHtml ? { parse_mode: 'HTML' } : {}),
    ...(extraMidia || {}),
    ...(teclado ? { reply_markup: teclado } : {})
  });
  const rotulo = tipo === 'video' ? 'vídeo' : 'foto';
  try {
    const msg = await bot.telegram[metodo](channelId, midia, montar(true));
    registrarPostCanal(msg.message_id, cap, 'IA', tipo);
    if (logEvent) logEvent('IA-CANAL', `IA postou ${rotulo} no canal (msg ${msg.message_id}).`);
    return { ok: true, mensagem_id: msg.message_id };
  } catch (e) {
    try {
      const msg = await bot.telegram[metodo](channelId, midia, montar(false));
      registrarPostCanal(msg.message_id, cap, 'IA', tipo);
      if (logEvent) logEvent('IA-CANAL', `IA postou ${rotulo} no canal SEM formatação (msg ${msg.message_id}).`);
      return { ok: true, mensagem_id: msg.message_id, semHtml: true };
    } catch (e2) {
      return { erro: `Erro ao postar ${rotulo} no canal: ${e2.message}` };
    }
  }
}

// ===== CRIAÇÃO DE IMAGEM — capa de atualização para o canal =====
// O dono pode pedir "cria uma foto pra nova atualização do bot" — a IA gera uma
// imagem bonita (fundo noturno, título grande, subtítulo) e posta no canal.
// MÉTODO PRINCIPAL: SVG + sharp — o SVG usa <text> com fontes do SISTEMA, então
// ACENTOS e emojis renderizam normalmente (sem limitação de fonte bitmap).
// FALLBACK: se o sharp falhar, cai pro Jimp com fontes bitmap (sem acentos).

function escaparXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Remove emojis/símbolos que a fonte Arial não renderiza (virariam quadrado). */
function limparTextoImagem(s) {
  return String(s || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quebra o texto em linhas de até maxChars caracteres (sem cortar palavras no meio). */
function quebrarLinhas(texto, maxChars) {
  const palavras = String(texto || '').split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const candidata = atual ? atual + ' ' + p : p;
    if (candidata.length <= maxChars) atual = candidata;
    else {
      if (atual) linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// ===== PALETAS DE CORES DAS CAPAS =====
// A IA SORTEIA uma paleta a cada imagem criada — o Ouro (Dourado + Preto) é a
// principal (peso 3, escolha do dono), mas varia entre Ciano/Roxo, Rubi, Azul
// e Verde Neon. O layout profissional é o mesmo em todas as paletas.

const PALETAS_IMAGEM = [
  {
    nome: 'ouro',
    bg: ['#3a2d0e', '#241a07', '#0d0903'],
    grade: '#d4af37',
    brilhoA: '#ffd700',
    brilhoB: '#b8860b',
    faixaDe: '#ffd700',
    faixaAte: '#8a5a00',
    badgeFill: '#1a1305',
    badgeTexto: '#ffd700',
    titulo: '#ffffff',
    sub: '#f0e2b6',
    linhaDiv: '#8a6d1f',
    rodape: '#d4af37',
    peso: 3
  },
  {
    nome: 'ciano',
    bg: ['#241463', '#150b3a', '#070312'],
    grade: '#6d5bd0',
    brilhoA: '#00e5ff',
    brilhoB: '#a855f7',
    faixaDe: '#00e5ff',
    faixaAte: '#a855f7',
    badgeFill: '#0c0624',
    badgeTexto: '#00e5ff',
    titulo: '#ffffff',
    sub: '#cfc8ff',
    linhaDiv: '#4b3fa0',
    rodape: '#9b8cff',
    peso: 1
  },
  {
    nome: 'rubi',
    bg: ['#3d0d14', '#200710', '#0a0305'],
    grade: '#b84d6a',
    brilhoA: '#ff3b3b',
    brilhoB: '#8b0000',
    faixaDe: '#ff3b3b',
    faixaAte: '#8b0000',
    badgeFill: '#16050a',
    badgeTexto: '#ff5555',
    titulo: '#ffffff',
    sub: '#f5c4c4',
    linhaDiv: '#8b2a2a',
    rodape: '#ff6b6b',
    peso: 1
  },
  {
    nome: 'azul',
    bg: ['#0d2a4d', '#071a33', '#020710'],
    grade: '#4d8bd6',
    brilhoA: '#00b3ff',
    brilhoB: '#1e5fff',
    faixaDe: '#00b3ff',
    faixaAte: '#1e5fff',
    badgeFill: '#051527',
    badgeTexto: '#33c4ff',
    titulo: '#ffffff',
    sub: '#c4e0f5',
    linhaDiv: '#2a5f9e',
    rodape: '#5bbfff',
    peso: 1
  },
  {
    nome: 'verde',
    bg: ['#0d3a2a', '#07221a', '#020a07'],
    grade: '#4db87a',
    brilhoA: '#00ff88',
    brilhoB: '#00b366',
    faixaDe: '#00ff88',
    faixaAte: '#00b366',
    badgeFill: '#05150f',
    badgeTexto: '#33ff99',
    titulo: '#ffffff',
    sub: '#c4f5dd',
    linhaDiv: '#2a8a55',
    rodape: '#4dffaa',
    peso: 1
  }
];

/** Sorteia uma paleta respeitando os pesos (ouro = principal, mais sorteada). */
function sortearPaleta() {
  const total = PALETAS_IMAGEM.reduce((s, p) => s + (p.peso || 1), 0);
  let r = Math.floor(Math.random() * total);
  for (const p of PALETAS_IMAGEM) {
    r -= p.peso || 1;
    if (r < 0) return p;
  }
  return PALETAS_IMAGEM[0];
}

/** Converte "#rrggbb" no inteiro RGBA usado pelo Jimp (alpha 255). */
function hexParaInt(hex) {
  return ((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0;
}

/** Fallback com Jimp (fontes bitmap — perde acentos, mas garante a imagem). */
async function criarImagemJimp(titulo, subtitulo, paleta, W = 1024, H = 1024) {
  const pal = paleta || PALETAS_IMAGEM[0];
  const sy = H / 1024;
  const sx = W / 1024;
  const normalizar = (s) => String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\u00C0-\u00FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const fonteJimp = (nome) => loadFont(path.join(FONT_DIR, nome, nome + '.fnt'));
  const img = new Jimp({ width: W, height: H, color: hexParaInt(pal.bg[2]) });
  const altBarra = Math.max(8, Math.round(14 * sy));
  for (let y = 0; y < altBarra; y++) for (let x = 0; x < W; x++) img.setPixelColor(hexParaInt(pal.faixaDe), x, y);
  for (let y = H - altBarra; y < H; y++) for (let x = 0; x < W; x++) img.setPixelColor(hexParaInt(pal.faixaAte), x, y);

  const tituloTxt = (normalizar(titulo) || 'CORVO').toUpperCase();
  const subTxt = normalizar(subtitulo);
  const fontTitulo = await fonteJimp('open-sans-128-white');
  const fontSub = await fonteJimp('open-sans-64-white');
  const fontRodape = await fonteJimp('open-sans-32-white');

  // Título: até 2 linhas centralizadas (fonte 128px ≈ 12 chars/linha — acima disso
  // o print() do Jimp re-quebraria internamente e estouraria o layout)
  const linhasTitulo = quebrarLinhas(tituloTxt, Math.max(10, Math.round(12 * sx))).slice(0, 2);
  const lhT = Math.round(175 * sy);
  const yIni = Math.round(380 * sy) - Math.round(((linhasTitulo.length - 1) * lhT) / 2);
  linhasTitulo.forEach((l, i) => {
    const tw = measureText(fontTitulo, l);
    img.print({ font: fontTitulo, x: Math.max(0, Math.floor((W - tw) / 2)), y: yIni + i * lhT, text: l, maxWidth: W - 60 });
  });

  // Subtítulo: até 2 linhas centralizadas abaixo (fonte 64px ≈ 20 chars/linha)
  if (subTxt) {
    const linhasSub = quebrarLinhas(subTxt, Math.max(16, Math.round(20 * sx))).slice(0, 2);
    const lhS = Math.round(100 * sy);
    const yS = Math.round(790 * sy) - Math.round(((linhasSub.length - 1) * lhS) / 2);
    linhasSub.forEach((l, i) => {
      const sw = measureText(fontSub, l);
      img.print({ font: fontSub, x: Math.max(0, Math.floor((W - sw) / 2)), y: yS + i * lhS, text: l, maxWidth: W - 120 });
    });
  }

  const rodape = 'CORVO BOT';
  const rw = measureText(fontRodape, rodape);
  img.print({ font: fontRodape, x: Math.floor((W - rw) / 2), y: Math.round(H - 150 * sy), text: rodape });
  const arquivo = path.join(DATA_DIR, 'downloads', `corvo_anuncio_${Date.now()}.png`);
  await img.write(arquivo);
  return arquivo;
}

/** Monta o SVG da capa profissional em QUALQUER proporção (quadrado 1024x1024
 * ou vídeo 16:9 1280x720) usando a paleta sorteada. Posições proporcionais à
 * dimensão: badge CORVO, título grande (até 2 linhas) com sombra, divisor com
 * losango, subtítulo e rodapé. ACENTOS funcionam (SVG usa fontes do sistema). */
function montarSvgCapa(paleta, titulo, subtitulo, W, H) {
  const sx = W / 1024;
  const sy = H / 1024;

  // ── TÍTULO: quebra em até 2 linhas e calcula a fonte pela linha mais longa ──
  const tituloRaw = (limparTextoImagem(titulo) || 'CORVO').slice(0, 44);
  const linhasTitulo = quebrarLinhas(tituloRaw, 22).slice(0, 2);
  const tituloMaisLonga = Math.max(1, ...linhasTitulo.map((l) => l.length));
  const tamTitulo = Math.max(42, Math.min(104, Math.floor((W - 200) / (tituloMaisLonga * 0.6))));
  const lhTitulo = Math.round(tamTitulo * 1.22);

  // ── SUBTÍTULO: até 2 linhas ──
  const subRaw = limparTextoImagem(subtitulo).slice(0, 72);
  const linhasSub = subRaw ? quebrarLinhas(subRaw, 34).slice(0, 2) : [];
  const subMaisLonga = linhasSub.length ? Math.max(1, ...linhasSub.map((l) => l.length)) : 0;
  const tamSub = linhasSub.length ? Math.max(22, Math.min(44, Math.floor((W - 260) / (subMaisLonga * 0.55)))) : 0;
  const lhSub = Math.round(tamSub * 1.35);

  // ── POSIÇÕES (fluxo vertical: badge → título → divisor → subtítulo → rodapé) ──
  const yBaseTitulo = Math.round(355 * sy);
  const yDivisor = yBaseTitulo + (linhasTitulo.length - 1) * lhTitulo + Math.round(145 * sy);
  const yBaseSub = yDivisor + Math.round(80 * sy);
  const yRodape = Math.round(966 * sy);
  const xCentro = W / 2;

  const tamBadge = Math.max(18, Math.round(26 * sy));
  const badgeY = Math.round(140 * sy);
  const badgeH = Math.round(58 * sy);
  const badgeW = Math.round(280 * sx);
  const badgeX = xCentro - badgeW / 2;
  const badgeTxtY = Math.round(179 * sy);

  const barraAlt = Math.max(8, Math.round(10 * sy));
  const tamRodape = Math.max(16, Math.round(22 * sy));

  const tituloSvg = linhasTitulo.map((l, i) =>
    `<text x="${xCentro}" y="${yBaseTitulo + i * lhTitulo}" font-family="Arial, Helvetica, sans-serif" font-size="${tamTitulo}" font-weight="bold" fill="${paleta.titulo}" text-anchor="middle">${escaparXml(l)}</text>`
  ).join('\n    ');

  const subSvg = linhasSub.map((l, i) =>
    `<text x="${xCentro}" y="${yBaseSub + i * lhSub}" font-family="Arial, Helvetica, sans-serif" font-size="${tamSub}" fill="${paleta.sub}" text-anchor="middle">${escaparXml(l)}</text>`
  ).join('\n    ');

  // cantos decorativos escalados (L nos 4 cantos — largura cW, não a borda oposta)
  const cX = Math.round(48 * sx);
  const cW = Math.round(88 * sx); // extensão horizontal do canto
  const cY1 = Math.round(88 * sy), cY2 = Math.round(48 * sy);
  const cY3 = Math.round(936 * sy), cY4 = Math.round(976 * sy);
  const linhaX1 = Math.round(262 * sx), linhaX2 = Math.round(762 * sx);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="85%">
      <stop offset="0%" stop-color="${paleta.bg[0]}"/>
      <stop offset="45%" stop-color="${paleta.bg[1]}"/>
      <stop offset="100%" stop-color="${paleta.bg[2]}"/>
    </radialGradient>
    <linearGradient id="faixa" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${paleta.faixaDe}"/>
      <stop offset="100%" stop-color="${paleta.faixaAte}"/>
    </linearGradient>
    <linearGradient id="bordaBadge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${paleta.faixaDe}"/>
      <stop offset="100%" stop-color="${paleta.faixaAte}"/>
    </linearGradient>
    <pattern id="grade" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="${paleta.grade}" stroke-opacity="0.18" stroke-width="1"/>
    </pattern>
    <radialGradient id="brilhoA" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${paleta.brilhoA}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${paleta.brilhoA}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="brilhoB" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${paleta.brilhoB}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${paleta.brilhoB}" stop-opacity="0"/>
    </radialGradient>
    <filter id="sombra" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
      <feOffset dx="0" dy="4" result="offsetBlur"/>
      <feFlood flood-color="#000000" flood-opacity="0.65" result="cor"/>
      <feComposite in="cor" in2="offsetBlur" operator="in" result="sombra"/>
      <feMerge>
        <feMergeNode in="sombra"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grade)"/>
  <circle cx="${Math.round(170 * sx)}" cy="${Math.round(200 * sy)}" r="${Math.round(310 * sy)}" fill="url(#brilhoA)"/>
  <circle cx="${Math.round(870 * sx)}" cy="${Math.round(840 * sy)}" r="${Math.round(330 * sy)}" fill="url(#brilhoB)"/>

  <rect x="0" y="0" width="${W}" height="${barraAlt}" fill="url(#faixa)"/>
  <rect x="0" y="${H - barraAlt}" width="${W}" height="${barraAlt}" fill="url(#faixa)"/>

  <path d="M${cX} ${cY1} V${cY2} H${cW}" fill="none" stroke="${paleta.brilhoA}" stroke-opacity="0.55" stroke-width="3"/>
  <path d="M${W - cX} ${cY1} V${cY2} H${W - cW}" fill="none" stroke="${paleta.brilhoB}" stroke-opacity="0.55" stroke-width="3"/>
  <path d="M${cX} ${H - cY1} V${H - cY2} H${cW}" fill="none" stroke="${paleta.brilhoB}" stroke-opacity="0.55" stroke-width="3"/>
  <path d="M${W - cX} ${H - cY1} V${H - cY2} H${W - cW}" fill="none" stroke="${paleta.brilhoA}" stroke-opacity="0.55" stroke-width="3"/>

  <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="${Math.round(badgeH / 2)}" fill="${paleta.badgeFill}" fill-opacity="0.88" stroke="url(#bordaBadge)" stroke-width="2"/>
  <text x="${xCentro}" y="${badgeTxtY}" font-family="Arial, Helvetica, sans-serif" font-size="${tamBadge}" font-weight="bold" fill="${paleta.badgeTexto}" letter-spacing="4" text-anchor="middle">CORVO • BOT</text>

  <g filter="url(#sombra)">
    ${tituloSvg}
  </g>

  <line x1="${linhaX1}" y1="${yDivisor}" x2="${linhaX2}" y2="${yDivisor}" stroke="${paleta.linhaDiv}" stroke-opacity="0.65" stroke-width="1.5"/>
  <rect x="${xCentro - 7}" y="${yDivisor - 8}" width="14" height="14" transform="rotate(45 ${xCentro} ${yDivisor})" fill="url(#faixa)"/>

  ${subSvg}

  <text x="${xCentro}" y="${yRodape}" font-family="Arial, Helvetica, sans-serif" font-size="${tamRodape}" font-weight="bold" letter-spacing="5" fill="${paleta.rodape}" text-anchor="middle">CORVO • ATUALIZAÇÕES</text>
</svg>`;
}

/** Núcleo compartilhado de renderização de capa: monta o SVG proporcional com a
 * paleta sorteada, salva o PNG em data/downloads e tem fallback Jimp. Usado por
 * criarImagem (quadrado 1024x1024) e criarCapaVideo (vídeo 16:9 1280x720). */
async function renderizarCapa(titulo, subtitulo, W, H, prefixo, rotulo) {
  const { logEvent } = getCore();
  const paleta = sortearPaleta();
  const svg = montarSvgCapa(paleta, titulo, subtitulo, W, H);
  try {
    const dir = path.join(DATA_DIR, 'downloads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const arquivo = path.join(dir, `${prefixo}_${Date.now()}.png`);
    await sharp(Buffer.from(svg)).png().toFile(arquivo);
    if (logEvent) logEvent('IA-CANAL', `IA criou ${rotulo} ${arquivo} (paleta ${paleta.nome}).`);
    return { ok: true, caminho: arquivo, dimensoes: `${W}x${H}`, paleta: paleta.nome };
  } catch (e) {
    try {
      // Fallback: sharp falhou → Jimp (perde acentos, mas não quebra o pedido)
      const arquivo = await criarImagemJimp(titulo, subtitulo, paleta, W, H);
      if (logEvent) logEvent('WARN', `Sharp falhou no ${rotulo === 'capa de vídeo' ? 'na capa de vídeo' : 'na imagem'}, usei Jimp: ${e.message}`);
      return { ok: true, caminho: arquivo, dimensoes: `${W}x${H}`, fallback: 'jimp', paleta: paleta.nome };
    } catch (e2) {
      return { erro: `Erro ao criar ${rotulo}: ${e2.message}` };
    }
  }
}

/** Cria uma imagem de atualização (capa PROFISSIONAL QUADRADA 1024x1024) e salva
 * em data/downloads. Retorna o caminho. A cada chamada SORTEIA uma paleta (Ouro
 * é a principal, mas varia entre Ciano/Roxo, Rubi, Azul e Verde Neon). */
async function criarImagem(titulo, subtitulo) {
  return renderizarCapa(titulo, subtitulo, 1024, 1024, 'corvo_anuncio', 'imagem');
}

/** Cria uma CAPA PARA VÍDEO (16:9, 1280x720) com o MESMO visual profissional das
 * imagens do canal (paletas sorteadas, badge CORVO, título com sombra, divisor
 * e rodapé). Salva em data/downloads e retorna o caminho para usar como capa
 * do vídeo (thumbnail) ou postar junto. */
async function criarCapaVideo(titulo, subtitulo) {
  return renderizarCapa(titulo, subtitulo, 1280, 720, 'corvo_capa_video', 'capa de vídeo');
}

/** Busca um post do canal pelo texto OU pela LEGENDA (o log guarda a legenda de
 * fotos no campo texto) e devolve o ID + o TIPO ('texto' | 'foto') para a IA
 * saber o que vai editar. Posts antigos sem tipo no log assumem 'texto'. */
async function buscarPostCanal(termo) {
  const t = String(termo || '').trim().toLowerCase();
  if (!t) return { erro: 'Informe um trecho do texto do post para buscar.' };
  const posts = lerPostsCanal();
  const hits = posts.filter(p => String(p.texto || '').toLowerCase().includes(t));
  if (!hits.length) {
    return {
      ok: false,
      mensagem: `Nenhum post do canal encontrado com "${termo}". Se o post foi feito manualmente (não pelo bot), não tenho como achar o ID — poste ou edite via mim, ou me passe o ID.`
    };
  }
  return {
    ok: true,
    resultados: hits.slice(0, 5).map(p => ({
      mensagem_id: p.message_id,
      tipo: p.tipo === 'foto' ? 'foto' : p.tipo === 'video' ? 'video' : 'texto',
      texto: String(p.texto).slice(0, 200),
      data: new Date(p.ts).toLocaleString('pt-BR')
    }))
  };
}

// ===== AUTONOMIA NO GRUPO (decisão da IA) =====
// Remove um membro do grupo atual (Telegram), manda um PV opcional e deixa de
// responder a pessoa no privado ("só respondo no grupo"). Ponte para a função
// real registrada no index.js (agenteRemoverMembro), que tem acesso ao bot,
// ao Set de PV mudo e ao logEvent.

/** Remove um membro do grupo + aviso no PV + PV mudo (só respondo no grupo). */
async function removerMembro(userId, chatId, motivo, pv) {
  const c = getCore();
  if (typeof c.agenteRemoverMembro !== 'function') return { erro: 'Remover membro não habilitado para o agente.' };
  return c.agenteRemoverMembro(userId, chatId, motivo, pv);
}

// ===== CONFIGURAÇÃO DO GRUPO E DO CANAL (autonomia da IA) =====
// A IA pode mexer nas configurações do grupo (título, descrição, foto, lentidão,
// permissões, fixar/desafixar, link) e do canal oficial — decisão dela ou pedido
// do dono/admin. Ponte para as funções reais registradas no index.js.

/** Configura o GRUPO atual (ou o chatId passado): titulo/descricao/foto/lentidao/permissao/fixar/link/info. */
async function configurarGrupo(chatId, acao, valor) {
  const c = getCore();
  if (typeof c.agenteConfigurarGrupo !== 'function') return { erro: 'Configurar grupo não habilitado para o agente.' };
  return c.agenteConfigurarGrupo(chatId, acao, valor);
}

/** Configura o CANAL OFICIAL: titulo/descricao/foto/fixar/link/info. */
async function configurarCanal(acao, valor) {
  const c = getCore();
  if (typeof c.agenteConfigurarCanal !== 'function') return { erro: 'Configurar canal não habilitado para o agente.' };
  return c.agenteConfigurarCanal(acao, valor);
}

module.exports = {
  DONO,
  setCore,
  isReady,
  getCore,
  liberarVipTodos,
  liberarVip,
  removerVip,
  removerVipTodos,
  listarVips,
  consultarVip,
  statsBot,
  broadcast,
  banirUsuario,
  mensagemPara,
  postarCanal,
  editarCanal,
  apagarCanal,
  postarFotoCanal,
  postarVideoCanal,
  criarImagem,
  criarCapaVideo,
  buscarPostCanal,
  registrarPostCanal,
  removerMembro,
  configurarGrupo,
  configurarCanal,
  consultarDado,
  consultarDatora,
  rajarWhats,
  nukarWhats,
  floodNgl,
  floodSendit,
  whatsStatus,
  listarGruposWhats,
  listarPlanosVip,
  venderVip,
};