/**
 * 📝 CORVO - LOG DE MARCADORES DA IA
 * Registra em data/ia_marcadores.json as decisões de formatação da IA
 * ([SOLTA]/[REPLY], [CITAR], [CURTA]/[MEDIA]/[LONGA]) para acompanhar se ela
 * está exagerando nos marcadores e ajustar as regras do system.md / TOOL_GUIDE.
 * Guarda os últimos 500 registros + contadores agregados.
 */

const { loadJSON, saveJSON, DATA_DIR } = require('../grupo_utils');

const FILE = `${DATA_DIR}/ia_marcadores.json`;
const MAX_ENTRIES = 500;

const contadoresVazios = () => ({ solta: 0, reply_forcado: 0, citar: 0, curta: 0, media: 0, longa: 0, auto: 0 });

function defaultData() {
  return { total: 0, contadores: contadoresVazios(), recentes: [] };
}

/**
 * Registra uma resposta da IA e os marcadores que ela usou.
 * @param {object} opts - { userId, chatId, solta, replyForcado, citar, tamanho, query }
 */
function registrar(opts = {}) {
  try {
    const d = loadJSON(FILE, defaultData());
    if (!d.contadores) d.contadores = contadoresVazios();
    if (!Array.isArray(d.recentes)) d.recentes = [];

    d.total = (d.total || 0) + 1;
    const c = d.contadores;

    if (opts.solta) c.solta++;
    else if (opts.replyForcado) c.reply_forcado++;
    else c.auto++;

    if (opts.citar) c.citar++;

    const t = opts.tamanho;
    if (t === 'CURTA') c.curta++;
    else if (t === 'MEDIA') c.media++;
    else if (t === 'LONGA') c.longa++;

    d.recentes.push({
      ts: Date.now(),
      userId: opts.userId != null ? String(opts.userId) : null,
      chatId: opts.chatId != null ? String(opts.chatId) : null,
      solta: !!opts.solta,
      citar: !!opts.citar,
      tamanho: t || null,
      pergunta: String(opts.query || '').slice(0, 120),
    });
    if (d.recentes.length > MAX_ENTRIES) d.recentes = d.recentes.slice(-MAX_ENTRIES);

    saveJSON(FILE, d);
  } catch (e) { /* log nunca derruba o bot */ }
}

/** Estatísticas agregadas + registros recentes (para o comando /marcadores) */
function getStats() {
  const d = loadJSON(FILE, defaultData());
  if (!d.contadores) d.contadores = contadoresVazios();
  const total = d.total || 0;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  return {
    total,
    contadores: d.contadores,
    pct,
    recentes: Array.isArray(d.recentes) ? d.recentes : [],
  };
}

module.exports = { registrar, getStats };
