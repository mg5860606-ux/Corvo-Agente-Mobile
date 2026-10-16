/**
 * 🐦‍⬛ CORVO - PROATIVIDADE (retomar pedidos antigos)
 * Periodicamente (a cada 3h), se houver pedidos do grupo sem conclusão com
 * mais de 6h, a IA manda UMA lembrança no chat (máx. 1 por chat a cada 24h)
 * oferecendo retomar. Dá a impressão de agente "vivo" e recupera trabalhos
 * abandonados.
 */

const { loadJSON, saveJSON, DATA_DIR } = require('../grupo_utils');

const FILE = `${DATA_DIR}/ia_proativo.json`;

const PEDIDO_MAX_AGE = 6 * 60 * 60 * 1000; // pedidos com +6h sem conclusão
const LEMBRETE_INTERVALO = 24 * 60 * 60 * 1000; // max 1 lembrete por chat a cada 24h

function carregar() {
  return loadJSON(FILE, { ultimoLembrete: {}, totalEnviados: 0 });
}

/**
 * Verifica pedidos pendentes e devolve um texto de lembrete (ou null).
 * @param {Array} pedidos - lista {nome, text, ts, resultado}
 * @param {string} chatKey - identificador do chat
 */
function gerarLembrete(pedidos, chatKey) {
  if (!Array.isArray(pedidos) || !pedidos.length) return null;
  const d = carregar();
  const agora = Date.now();
  const ultimo = d.ultimoLembrete[String(chatKey)] || 0;
  if (agora - ultimo < LEMBRETE_INTERVALO) return null;

  // Acha o pedido mais recente sem resultado e com mais de 6h
  const pendente = [...pedidos]
    .filter(p => p && !p.resultado && agora - (p.ts || 0) > PEDIDO_MAX_AGE)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
  if (!pendente) return null;

  d.ultimoLembrete[String(chatKey)] = agora;
  d.totalEnviados = (d.totalEnviados || 0) + 1;
  saveJSON(FILE, d);

  const nome = pendente.nome || 'aí';
  const pedido = String(pendente.text || '').slice(0, 120);
  return `🐦‍⬛ *Lembrete:* ${nome}, aquele pedido \"${pedido}\" ficou pela metade. Quer que eu retome de onde parei? É só chamar a IA.`;
}

function getStats() {
  return carregar();
}

module.exports = { gerarLembrete, getStats, PEDIDO_MAX_AGE, LEMBRETE_INTERVALO };
