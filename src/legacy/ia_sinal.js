/**
 * 📡 CORVO - SINAIS DE INTERRUPÇÃO/REAVALIAÇÃO DE MISSÃO
 * Permite que o usuário interrompa ou peça reavaliação do agente DURANTE
 * uma missão em andamento (loop de rodadas), respondendo uma mensagem do bot.
 * Em memória: sinais são efêmeros (por chat), sem persistência.
 */

const sinais = new Map(); // chatId -> { missaoAtiva, parar, reavaliar, motivo, ts }

function iniciarMissao(chatId) {
  sinais.set(String(chatId), { missaoAtiva: true, parar: false, reavaliar: false, motivo: null, ts: Date.now() });
}

function finalizarMissao(chatId) {
  sinais.delete(String(chatId));
}

function missaoAtiva(chatId) {
  const s = sinais.get(String(chatId));
  return !!(s && s.missaoAtiva);
}

function pedirParada(chatId, motivo) {
  const key = String(chatId);
  const s = sinais.get(key) || { missaoAtiva: true, parar: false, reavaliar: false, motivo: null };
  s.parar = true;
  s.motivo = motivo || null;
  sinais.set(key, s);
}

function pedirReavaliacao(chatId, motivo) {
  const key = String(chatId);
  const s = sinais.get(key) || { missaoAtiva: true, parar: false, reavaliar: false, motivo: null };
  s.reavaliar = true;
  s.motivo = motivo || null;
  sinais.set(key, s);
}

/**
 * Consulta (e limpa) o sinal atual do chat. Retorna null se não houver.
 * @returns {null | {acao: 'parar'|'reavaliar', motivo: string|null}}
 */
function consumirSinal(chatId) {
  const s = sinais.get(String(chatId));
  if (!s) return null;
  if (s.parar) {
    s.parar = false;
    return { acao: 'parar', motivo: s.motivo };
  }
  if (s.reavaliar) {
    s.reavaliar = false;
    return { acao: 'reavaliar', motivo: s.motivo };
  }
  return null;
}

module.exports = { iniciarMissao, finalizarMissao, missaoAtiva, pedirParada, pedirReavaliacao, consumirSinal };