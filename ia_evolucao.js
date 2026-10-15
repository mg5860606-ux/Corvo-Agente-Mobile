/**
 * 🧬 CORVO - AUTOEVOLUÇÃO DA IA
 * A IA evolui sozinha: grava tudo o que aprendeu, ferramentas que criou,
 * melhorias que fez no próprio código e decisões importantes. Esse histórico
 * volta ao prompt dela em TODAS as conversas, para ela continuar de onde parou
 * e nunca repetir os mesmos erros.
 */

const fs = require('fs');
const path = require('path');
const { loadJSON, saveJSON, DATA_DIR } = require('../grupo_utils');

const EVO_FILE = path.join(DATA_DIR, 'evolucao.json');
const EVO_MD = path.join(DATA_DIR, 'evolucao.md');

const defaultData = () => ({ registros: [], ferramentasCriadas: [], melhorias: [] });

function loadData() {
  return loadJSON(EVO_FILE, defaultData());
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowLabel() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Registra um evento de evolução da IA.
 * @param {string} tipo - aprendizado | ferramenta | melhoria | decisão | erro
 * @param {string} texto - o que aconteceu / o que ela aprendeu / o que botou de novo
 */
function registrarEvolucao(tipo, texto) {
  const t = String(texto || '').trim();
  if (!t) return;
  const d = loadData();
  if (!d.registros) d.registros = [];

  // Evita spam: se o último registro for idêntico, não duplica
  const last = d.registros[d.registros.length - 1];
  if (last && last.texto === t) {
    last.ts = Date.now();
    last.tipo = tipo;
  } else {
    d.registros.push({ tipo: String(tipo || 'aprendizado'), texto: t.slice(0, 400), ts: Date.now() });
  }
  if (d.registros.length > 200) d.registros = d.registros.slice(-200);
  saveJSON(EVO_FILE, d);

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const linha = `- [${nowLabel()}] (${tipo}) ${t}\n`;
    fs.appendFileSync(EVO_MD, linha);
  } catch (e) {}
}

function registrarFerramenta(nome, descricao) {
  const d = loadData();
  if (!d.ferramentasCriadas) d.ferramentasCriadas = [];
  if (!d.ferramentasCriadas.some(f => f.nome === nome)) {
    d.ferramentasCriadas.push({ nome, descricao: String(descricao || '').slice(0, 200), ts: Date.now() });
    saveJSON(EVO_FILE, d);
  }
  registrarEvolucao('ferramenta', `Criei a ferramenta ${nome}: ${descricao || ''}`);
}

function registrarMelhoria(texto) {
  registrarEvolucao('melhoria', String(texto || '').trim());
}

function getEvolutionBlock() {
  const d = loadData();
  const linhas = [];

  const fe = (d.ferramentasCriadas || []);
  if (fe.length) {
    linhas.push(`FERRAMENTAS QUE JÁ CRIEI (${fe.length}):`);
    for (const f of fe.slice(-15)) {
      linhas.push(`- ${f.nome}: ${f.descricao || ''}`);
    }
  }

  const me = (d.melhorias || []);
  if (me.length) {
    linhas.push(`MELHORIAS QUE JÁ FIZ NO MEU CÓDIGO (${me.length}):`);
    for (const m of me.slice(-10)) linhas.push(`- ${m.texto || m}`);
  }

  const reg = (d.registros || []);
  if (reg.length) {
    linhas.push(`ÚLTIMOS APRENDIZADOS/DECISÕES (${reg.length} no total):`);
    for (const r of reg.slice(-10)) {
      linhas.push(`- ${r.tipo}: ${r.texto}`);
    }
  }

  if (!linhas.length) return '';
  return `\n\n🧬 MINHA EVOLUÇÃO (histórico do que já fiz, criei e aprendi — use para não repetir trabalho):\n${linhas.join('\n')}`;
}

function getStats() {
  const d = loadData();
  return {
    registros: (d.registros || []).length,
    ferramentas: (d.ferramentasCriadas || []).length,
    melhorias: (d.melhorias || []).length,
  };
}

module.exports = { registrarEvolucao, registrarFerramenta, registrarMelhoria, getEvolutionBlock, getStats, EVO_FILE, EVO_MD };