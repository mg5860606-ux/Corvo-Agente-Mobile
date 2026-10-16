/**
 * 🚦 CORVO - FILA + LIMITES DA IA
 * - Fila global: no máximo MAX_CONCORRENTES chamadas de IA ao mesmo tempo
 *   (não estoura a cota da API Gemini e não trava o bot).
 * - 🔓 LIMITE DIÁRIO REMOVIDO (regra do dono): QUALQUER pessoa usa a IA sem
 *   teto diário. A única proteção é a fila de concorrência acima.
 */

const { loadJSON, saveJSON, DATA_DIR } = require('../grupo_utils');

const FILE = `${DATA_DIR}/ia_limites.json`;

const MAX_CONCORRENTES = 3;

let ativos = 0;
const fila = [];

/** Enfileira uma tarefa de IA (retorna Promise). Máx. de concorrência. */
function enfileirar(fn) {
  return new Promise((resolve, reject) => {
    const executar = async () => {
      ativos++;
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      } finally {
        ativos--;
        const prox = fila.shift();
        if (prox) prox();
      }
    };
    if (ativos < MAX_CONCORRENTES) executar();
    else fila.push(executar);
  });
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function carregar() {
  return loadJSON(FILE, {});
}

/** Retorna { ok, restantes, motivo } — 🔓 SEM LIMITE DIÁRIO (regra do dono) */
function checarLimite(userId, { isVip = false, isDono = false } = {}) {
  return { ok: true, restantes: Infinity, motivo: 'Sem limite diário de IA (regra do dono).' };
}

/** Registra +1 uso do usuário hoje */
function registrarUso(userId) {
  const d = carregar();
  const dia = hoje();
  const key = String(userId);
  const rec = d[key];
  if (!rec || rec.dia !== dia) d[key] = { dia, uso: 1 };
  else d[key] = { dia, uso: rec.uso + 1 };
  saveJSON(FILE, d);
}

function getStats() {
  return { ativos, naFila: fila.length, maxConcorrentes: MAX_CONCORRENTES, limiteDiario: 'removido (sem teto)' };
}

module.exports = { enfileirar, checarLimite, registrarUso, getStats, MAX_CONCORRENTES };
