/**
 * 👍👎 CORVO - FEEDBACK DO GRUPO (reações nas respostas da IA)
 * - Guarda em memória as últimas respostas da IA (msg_id → texto resumido).
 * - Quando alguém reage 👍/❤️/👎 na resposta, registra o feedback na evolução
 *   da IA e como fato do usuário, para ela aprender o que o grupo gosta.
 * Persistente em data/ia_feedback.json (últimos 200).
 */

const { loadJSON, saveJSON, DATA_DIR } = require('../grupo_utils');

const FILE = `${DATA_DIR}/ia_feedback.json`;
// 📝 Respostas RECENTES da IA persistidas (últimas 200): sem isso, após um
// restart o mapa em memória fica vazio e o reply a qualquer mensagem antiga
// da IA falha (ehRespostaDaIA = false) — o bot parecia "não responder" a
// replies de conversas anteriores.
const FILE_RECENTES = `${DATA_DIR}/ia_respostas.json`;

// `${chatId}:${msgId}` -> { chatId, texto, ts } (respostas recentes da IA)
const recentes = new Map();

// Recarrega do disco no boot para o reply continuar funcionando após restart
(function carregarRecentes() {
  try {
    const d = loadJSON(FILE_RECENTES, []);
    for (const r of d) {
      if (r && r.chatId != null && r.msgId != null) {
        recentes.set(`${String(r.chatId)}:${String(r.msgId)}`, {
          chatId: String(r.chatId), texto: String(r.texto || '').slice(0, 250), ts: r.ts || Date.now()
        });
      }
    }
  } catch (e) {}
})();

const POSITIVOS = new Set(['👍', '❤️', '🔥', '😍', '👏', '🎉', '💯', '✅']);
const NEGATIVOS = new Set(['👎', '😡', '💩', '❌']);

/** Registra uma resposta enviada pela IA (para mapear reações) */
function registrarResposta(msgId, chatId, texto) {
  try {
    if (!msgId || !chatId) return;
    recentes.set(`${String(chatId)}:${String(msgId)}`, { chatId: String(chatId), texto: String(texto || '').slice(0, 250), ts: Date.now() });
    if (recentes.size > 300) {
      const primeiro = recentes.keys().next().value;
      recentes.delete(primeiro);
    }
    // Persiste (últimas 200) para sobreviver a restart — sem duplicar chave
    let d = loadJSON(FILE_RECENTES, []);
    d = d.filter(x => !(x && String(x.chatId) === String(chatId) && String(x.msgId) === String(msgId)));
    d.push({ chatId: String(chatId), msgId: String(msgId), texto: String(texto || '').slice(0, 250), ts: Date.now() });
    if (d.length > 200) d.splice(0, d.length - 200);
    saveJSON(FILE_RECENTES, d);
  } catch (e) {}
}

/**
 * ✅ True se o msgId é uma resposta RECENTE enviada pela IA neste chat.
 * Usado pelos triggers de texto/voz: só "continua a conversa" quando o usuário
 * respondeu a uma mensagem que a IA de fato enviou — NUNCA quando respondeu ao
 * menu, botões, confirmações de rajada ou qualquer outra mensagem do bot.
 */
function ehRespostaDaIA(chatId, msgId) {
  try {
    return recentes.has(`${String(chatId)}:${String(msgId)}`);
  } catch (e) {
    return false;
  }
}

/**
 * Processa uma reação em uma resposta da IA.
 * @returns {string|null} texto do feedback registrado (ou null)
 */
function processarReacao(chatId, msgId, userId, emojis = []) {
  try {
    const reg = recentes.get(`${String(chatId)}:${String(msgId)}`);
    if (!reg) return null;
    const pos = emojis.some(e => POSITIVOS.has(e));
    const neg = emojis.some(e => NEGATIVOS.has(e));
    if (!pos && !neg) return null;

    const sentimento = pos ? 'positivo 👍' : 'negativo 👎';
    const texto = reg.texto.slice(0, 120);
    const feedback = `Usuário ${userId} reagiu ${sentimento} à minha resposta: "${texto}"`;

    // Registra na evolução (a IA lê isso nas próximas conversas)
    const evo = require('./ia_evolucao');
    evo.registrarEvolucao('feedback', feedback);

    // Grava como fato do usuário (a IA lembra o que ele gosta)
    const mem = require('./ia_memory');
    if (userId) mem.addFact(String(userId), pos
      ? `Gostou da minha resposta sobre: ${texto}`
      : `Não gostou da minha resposta sobre: ${texto}`);

    // Persiste
    const d = loadJSON(FILE, []);
    d.push({ chatId: String(chatId), msgId: String(msgId), userId: String(userId), pos: !!pos, texto: texto.slice(0, 150), ts: Date.now() });
    if (d.length > 200) d.splice(0, d.length - 200);
    saveJSON(FILE, d);

    return feedback;
  } catch (e) {
    return null;
  }
}

function getStats() {
  return { emMemoria: recentes.size, total: loadJSON(FILE, []).length };
}

module.exports = { registrarResposta, processarReacao, getStats, ehRespostaDaIA };
