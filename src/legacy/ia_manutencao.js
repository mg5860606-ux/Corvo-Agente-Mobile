/**
 * 🛠️ CORVO - AUTO-MANUTENÇÃO (autonomia)
 * Cron interno que roda SOZINHO, sem o dono pedir:
 *  - Verifica a sintaxe de todos os .js do projeto (node --check)
 *  - Monitora memória/RAM do processo (avisa o dono se estiver alta)
 *  - Limpa temporários antigos (data/ps_tmp, data/downloads, caches)
 *  - Gera um dossiê de estado (saúde do bot) para o agente usar
 * O resultado é enviado no privado do dono (notifier) e fica registrado
 * em data/manutencao.json para consulta (/estado).
 *
 * ⚠️ Toda verificação de sintaxe é ASSÍNCRONA (exec promisificado) para
 * não travar o event loop do bot — o /estado pode ser chamado a qualquer hora.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { loadJSON, saveJSON, DATA_DIR } = require('../grupo_utils');

const FILE = path.join(DATA_DIR, 'manutencao.json');

const INTERVALO_VERIFICACAO = 6 * 60 * 60 * 1000; // 6h
const MEMORIA_ALTA_MB = 700; // avisa se o processo passar disso
const TEMP_MAX_IDADE_MS = 24 * 60 * 60 * 1000; // limpa temporários com +24h

let notifier = null; // (texto) => void — enviado no privado do dono

function setNotifier(fn) { notifier = fn; }

const defaultData = () => ({
  ultimaVerificacao: null,
  ultimaLimpeza: null,
  errosSintaxe: [],
  avisos: [],
  estado: null,
});

function load() {
  const d = loadJSON(FILE, defaultData());
  if (!d.errosSintaxe) d.errosSintaxe = [];
  if (!d.avisos) d.avisos = [];
  return d;
}

function save(d) { saveJSON(FILE, d); }

function log(d, msg) {
  d.avisos.push({ ts: Date.now(), msg });
  if (d.avisos.length > 50) d.avisos = d.avisos.slice(-50);
}

/** node --check assíncrono: resolve '' (ok) ou o texto do erro */
function checkSintaxeAsync(arq) {
  return new Promise((resolve) => {
    exec(`node --check "${arq}"`, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) resolve(String(stderr || err.message || err).split('\n')[0]);
      else resolve('');
    });
  });
}

/** Lista os arquivos .js do projeto (só código-fonte de verdade).
 * Ignora pastas de dados/temporários (data, media, configs, assets, node_modules,
 * sessions, videos, .git) para não gerar falsos positivos de sintaxe com
 * arquivos gerados ou incompletos. */
function listarJs() {
  const raiz = path.join(__dirname, '..', '..');
  const ignorar = new Set(['node_modules', 'sessions', 'videos', '.git', 'data', 'media', 'configs', 'assets']);
  const out = [];
  function walk(dir) {
    let itens = [];
    try { itens = fs.readdirSync(dir); } catch (e) { return; }
    for (const it of itens) {
      if (ignorar.has(it)) continue;
      const p = path.join(dir, it);
      let st = null;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) walk(p);
      else if (it.endsWith('.js')) out.push(p);
    }
  }
  walk(raiz);
  return out;
}

/** Roda node --check em todos os .js do projeto (assíncrono, sem travar o bot) */
async function verificarSintaxe(d) {
  const arquivos = listarJs();
  const comErro = [];
  // Roda em lotes de 5 para não saturar o CPU nem estourar spawns simultâneos
  const LOTE = 5;
  for (let i = 0; i < arquivos.length; i += LOTE) {
    const lote = arquivos.slice(i, i + LOTE);
    const resultados = await Promise.all(lote.map(a => checkSintaxeAsync(a)));
    resultados.forEach((erro, j) => {
      if (erro) comErro.push(`${path.relative(path.join(__dirname, '..', '..'), lote[j])}: ${erro}`);
    });
  }
  d.errosSintaxe = comErro;
  d.ultimaVerificacao = Date.now();
  if (comErro.length) {
    log(d, `Sintaxe: ${comErro.length} arquivo(s) com erro.`);
    if (notifier) {
      try {
        notifier(`⚠️ *AUTO-MANUTENÇÃO:* ${comErro.length} arquivo(s) .js com erro de sintaxe:\n${comErro.slice(0, 5).join('\n')}`);
      } catch (e) {}
    }
  }
  return comErro;
}

/** Monitora a memória do processo; avisa o dono se estiver alta */
function checarMemoria(d) {
  const rss = process.memoryUsage().rss / 1024 / 1024;
  const carga = os.loadavg ? os.loadavg()[0] : 0;
  const estado = {
    rssMB: Math.round(rss * 10) / 10,
    heapMB: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10,
    uptimeMin: Math.floor(process.uptime() / 60),
    loadavg: Math.round(carga * 100) / 100,
    plataforma: process.platform,
    node: process.version,
  };
  d.estado = estado;
  if (rss > MEMORIA_ALTA_MB) {
    log(d, `Memória alta: ${Math.round(rss)}MB (limite ${MEMORIA_ALTA_MB}MB).`);
    if (notifier) {
      try {
        notifier(`🔴 *AUTO-MANUTENÇÃO:* memória em ${Math.round(rss)}MB. Se continuar subindo, me peça para reiniciar o bot.`);
      } catch (e) {}
    }
  }
  return estado;
}

/** Limpa temporários antigos do bot (data/ps_tmp, data/downloads antigos) */
function limparTemporarios(d) {
  const alvos = [path.join(DATA_DIR, 'ps_tmp'), path.join(DATA_DIR, 'downloads')];
  let removidos = 0;
  const agora = Date.now();
  for (const pasta of alvos) {
    let itens = [];
    try { itens = fs.readdirSync(pasta); } catch (e) { continue; }
    for (const it of itens) {
      const p = path.join(pasta, it);
      try {
        const st = fs.statSync(p);
        if (agora - st.mtimeMs > TEMP_MAX_IDADE_MS) {
          if (st.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
          else fs.unlinkSync(p);
          removidos++;
        }
      } catch (e) { /* segue */ }
    }
  }
  d.ultimaLimpeza = Date.now();
  if (removidos) log(d, `Limpeza: ${removidos} temporário(s) antigo(s) removido(s).`);
  return removidos;
}

// Serializa os ciclos: cron e /estado nunca rodam ao mesmo tempo
// (evita read-modify-write concorrente no manutencao.json).
let chain = Promise.resolve();

async function _rodarCiclo() {
  const d = load();
  await verificarSintaxe(d);
  checarMemoria(d);
  limparTemporarios(d);
  save(d);
  return d;
}

/** Roda o ciclo completo de manutenção (async — nunca trava o event loop) */
function rodarCiclo() {
  chain = chain.then(() => _rodarCiclo()).catch(() => {});
  return chain;
}

/** Inicia o cron em segundo plano */
function iniciarCron() {
  // Primeira verificação após 2min do boot (dá tempo de carregar tudo)
  setTimeout(() => {
    rodarCiclo().catch(() => { /* nunca derruba o bot */ });
  }, 2 * 60 * 1000);
  setInterval(() => {
    rodarCiclo().catch(() => { /* nunca derruba o bot */ });
  }, INTERVALO_VERIFICACAO);
}

/** Formata o dossiê de estado para exibir ao dono ou injetar no prompt */
function formatarEstado() {
  const d = load();
  const est = d.estado || checarMemoria(d);
  const linhas = [
    '🛠 *ESTADO DO BOT (auto-manutenção)*',
    '',
    `⏱ Uptime: *${est.uptimeMin}min*`,
    `💾 RAM: *${est.rssMB}MB* (heap ${est.heapMB}MB)`,
    `🌐 Plataforma: ${est.plataforma} | Node ${est.node}`,
    `⚙️ Load: ${est.loadavg}`,
    '',
    `📄 Última verificação de sintaxe: ${d.ultimaVerificacao ? new Date(d.ultimaVerificacao).toLocaleString('pt-BR') : 'nunca'}`,
    `❌ Erros de sintaxe: *${(d.errosSintaxe || []).length}*`,
    `🧹 Última limpeza: ${d.ultimaLimpeza ? new Date(d.ultimaLimpeza).toLocaleString('pt-BR') : 'nunca'}`,
  ];
  const erros = (d.errosSintaxe || []).slice(0, 5);
  if (erros.length) linhas.push('', '🔧 *Com erros:*', ...erros.map(e => `- ${e}`));
  const avisos = (d.avisos || []).slice(-3);
  if (avisos.length) linhas.push('', '📌 *Últimos avisos:*', ...avisos.map(a => `- ${a.msg}`));
  return linhas.join('\n');
}

module.exports = { setNotifier, rodarCiclo, iniciarCron, formatarEstado, FILE };
