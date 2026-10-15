/**
 * 🔓 CORVO - AUTONOMIA DO DONO
 *
 * 🔓 REGRA ATUAL: o DONO está TOTALMENTE livre — o gateFor libera tudo que o
 * dono pedir (qualquer ferramenta de PC, editar/apagar arquivo, esvaziar
 * lixeira, rajar, nukar), SEM confirmação. O dono manda, executa na hora.
 *
 * Quem NÃO é dono é tratado pelo donoOnly dentro do switch de ia_tools.js
 * (recusa de ferramentas de PC).
 */

const config = require('../../config');

// Fonte única de verdade: config.js (adminId).
const DONO = String(config.adminId);

/**
 * Gate chamado no topo do executeTool.
 * Retorna { erro } (bloqueado) | null (ok).
 *
 * 🔓 DONO 100% LIVRE: quando quem pede é o dono, libera TUDO na hora — qualquer
 * ferramenta de PC, editar/apagar arquivo, esvaziar lixeira — sem confirmação.
 * Quem NÃO é dono é tratado pelo donoOnly dentro do switch (recusa de PC).
 */
function gateFor(nome, toolCtx, args = {}) {
  if (!toolCtx) return null;
  if (!toolCtx.isDono) return null;
  return null; // 🔓 dono livre; não-donos bloqueados no donoOnly do switch
}

module.exports = {
  DONO,
  gateFor,
};
