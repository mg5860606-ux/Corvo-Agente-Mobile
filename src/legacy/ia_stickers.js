/**
 * 🟩 CORVO - POOL DE FIGURINHAS DA IA
 * Coleta as figurinhas que o pessoal manda no grupo (file_id + emoji) e guarda
 * em data/ia_stickers.json. Quando a IA marca [STICKER: ...], o sistema sorteia
 * uma figurinha do pool (preferindo as que combinam com o emoji/hint pedido) e
 * envia — assim a IA manda figurinhas REAIS do Telegram sem depender de pack fixo.
 * Se o pool estiver vazio, o envio cai para um dado animado (emoji) como fallback.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'ia_stickers.json');
const MAX_POOL = 400;

function carregar() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function salvar(arr) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(arr));
  } catch (e) { /* disco cheio/travado — não quebra o bot */ }
}

/** Coleta uma figurinha vista no grupo (dedupe por file_id). */
function coletar(fileId, emoji = '') {
  if (!fileId) return;
  const arr = carregar();
  if (arr.some(s => s.file_id === fileId)) return; // já tem
  arr.unshift({ file_id: String(fileId), emoji: String(emoji || '').slice(0, 12), ts: Date.now() });
  salvar(arr.slice(0, MAX_POOL));
}

/**
 * Sorteia uma figurinha do pool. Se o hint (ex: um emoji ou palavra) combinar
 * com o emoji de alguma figurinha coletada, prefere uma dessas; senão, sorteia
 * qualquer uma. Retorna o file_id (ou null se o pool estiver vazio).
 */
function sorteiar(hint = '') {
  const arr = carregar();
  if (!arr.length) return null;
  const h = String(hint || '').trim();
  if (h) {
    const match = arr.filter(s => s.emoji && s.emoji.includes(h));
    if (match.length) return match[Math.floor(Math.random() * match.length)].file_id;
  }
  return arr[Math.floor(Math.random() * arr.length)].file_id;
}

function getStats() {
  return { total: carregar().length };
}

module.exports = { coletar, sorteiar, getStats, MAX_POOL };
