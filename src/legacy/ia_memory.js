/**
 * 💾 CORVO - MEMÓRIA DA IA (persistente)
 * - Histórico de conversa por chat (até N trocas)
 * - Fatos/preferências por usuário (fatos → lembrados em qualquer chat)
 * - Arquivo único JSON em data/ia_memory.json
 */

const fs = require('fs');
const path = require('path');
const { loadJSON, saveJSON, DATA_DIR } = require('../grupo_utils');

const FILE = path.join(DATA_DIR, 'ia_memory.json');
const MD_FILE = path.join(__dirname, 'memory.md');
const PERSONA_FILE = path.join(DATA_DIR, 'ia_persona.txt');
const MAX_HISTORY = 10;
const MAX_REQUESTS = 10;

// ===== VERSÕES DA CONVERSA (checkpoints) =====
// Igual ao histórico que um agente guarda: salva versões da conversa para
// poder VOLTAR a um estado anterior se precisar. O dono controla com
// /checkpoint (salvar), /versoes (listar) e /voltar <n> (restaurar).
const MAX_CHECKPOINTS = 15;
const AUTO_CHECKPOINT_TROCAS = 6;   // salva versão automática a cada 6 trocas novas
const AUTO_CHECKPOINT_MIN_MS = 5 * 60 * 1000; // e no mínimo 5min desde a última

const defaultData = () => ({ conversations: {}, facts: {}, requests: {}, checkpoints: {}, solutions: [] });

const DEFAULT_MD = `# 🧠 MEMÓRIA.md — CÉREBRO DA IA DO CORVO

> Arquivo de memória de longo prazo da IA.
> A IA lê este arquivo em TODAS as conversas e usa o que está aqui.
> O DONO (Marcos/CORVO) pode editar este arquivo manualmente.

## 📁 NOTAS SOBRE O GRUPO

## 💬 PESSOAS E FATOS

## 🎭 PERSONA ATUAL

- (vazio = usar a persona padrão do system.md)
`;

// ===== MEMÓRIA.md (dossier de longo prazo, legível/ediável) =====

function readMemoryMd() {
  try {
    if (fs.existsSync(MD_FILE)) {
      const t = fs.readFileSync(MD_FILE, 'utf-8');
      return t.length > 2200 ? t.slice(0, 2200) + '\n…(arquivo maior, resumo acima)' : t;
    }
  } catch (e) {}
  return '';
}

function appendGroupNote(text) {
  const t = String(text || '').trim();
  if (!t) return;
  try {
    let cur = fs.existsSync(MD_FILE) ? fs.readFileSync(MD_FILE, 'utf-8') : DEFAULT_MD;
    if (!cur.includes('# 🧠')) cur = DEFAULT_MD;
    const line = `- ${t}\n`;
    if (cur.includes(line.trim())) return;
    const j = cur.indexOf('\n## ');
    cur = j > 0 ? cur.slice(0, j + 1) + line + cur.slice(j + 1) : cur + '\n' + line;
    if (cur.length > 12000) cur = cur.slice(0, 12000);
    fs.writeFileSync(MD_FILE, cur);
  } catch (e) {}
}

// ===== PERSONA DINÂMICA (mudança sob pedido do dono) =====

function setPersona(text) {
  try {
    fs.writeFileSync(PERSONA_FILE, String(text || '').trim());
  } catch (e) {}
}

function getPersona() {
  try {
    if (fs.existsSync(PERSONA_FILE)) return fs.readFileSync(PERSONA_FILE, 'utf-8').trim();
  } catch (e) {}
  return '';
}

function loadData() {
  const d = loadJSON(FILE, defaultData());
  if (!d.conversations) d.conversations = {};
  if (!d.facts) d.facts = {};
  if (!d.requests) d.requests = {};
  if (!d.checkpoints) d.checkpoints = {};
  if (!Array.isArray(d.solutions)) d.solutions = [];
  return d;
}

// ===== HISTÓRICO POR CHAT =====

function getHistory(chatId) {
  const d = loadData();
  return d.conversations[String(chatId)] || [];
}

function addExchange(chatId, role, text, meta = {}) {
  const d = loadData();
  const key = String(chatId);
  if (!d.conversations[key]) d.conversations[key] = [];
  d.conversations[key].push({ role, text: String(text || '').slice(0, 800), ts: Date.now(), ...meta });
  if (d.conversations[key].length > MAX_HISTORY) d.conversations[key] = d.conversations[key].slice(-MAX_HISTORY);
  // Auto-checkpoint: salva uma versão da conversa periodicamente (igual um
  // agente guarda o histórico, para poder voltar atrás se precisar)
  tentarAutoCheckpoint(d, key);
  saveJSON(FILE, d);
}

// Salva uma versão automática quando a conversa teve atividade nova suficiente
// desde a última versão (ou passou tempo suficiente). Nunca duplica idêntica.
function tentarAutoCheckpoint(d, key) {
  if (!d.checkpoints) d.checkpoints = {};
  if (!d.checkpoints[key]) d.checkpoints[key] = [];
  const arr = d.checkpoints[key];
  const hist = d.conversations[key] || [];
  const agora = Date.now();
  const last = arr[arr.length - 1];
  const desdeUltimo = last ? hist.filter(e => e.ts > last.ts).length : hist.length;
  const passouTempo = last ? (agora - last.ts) >= AUTO_CHECKPOINT_MIN_MS : true;
  if (desdeUltimo >= AUTO_CHECKPOINT_TROCAS || (passouTempo && desdeUltimo >= 2)) {
    arr.push({ ts: agora, motivo: 'auto', history: hist.map(e => ({ ...e })) });
    if (arr.length > MAX_CHECKPOINTS) arr.shift();
  }
}

// ===== VERSÕES (checkpoints) — API usada pelos comandos do dono =====

/** Salva uma versão manual da conversa. Retorna {ok, versao, total} ou {ok:false, motivo} */
function salvarCheckpoint(chatId, motivo = 'manual') {
  const d = loadData();
  const key = String(chatId);
  const hist = d.conversations[key] || [];
  if (!hist.length) return { ok: false, motivo: 'a conversa ainda está vazia' };
  if (!d.checkpoints) d.checkpoints = {};
  if (!d.checkpoints[key]) d.checkpoints[key] = [];
  const last = d.checkpoints[key][d.checkpoints[key].length - 1];
  if (last && JSON.stringify(last.history) === JSON.stringify(hist)) {
    return { ok: false, motivo: 'nada mudou desde a última versão' };
  }
  d.checkpoints[key].push({ ts: Date.now(), motivo: String(motivo || 'manual').slice(0, 60), history: hist.map(e => ({ ...e })) });
  if (d.checkpoints[key].length > MAX_CHECKPOINTS) d.checkpoints[key].shift();
  saveJSON(FILE, d);
  return { ok: true, versao: d.checkpoints[key].length - 1, total: d.checkpoints[key].length };
}

/** Lista as versões da conversa: [{versao, ts, motivo, trocas}] */
function listarCheckpoints(chatId) {
  const d = loadData();
  const arr = (d.checkpoints || {})[String(chatId)] || [];
  return arr.map((c, i) => ({
    versao: i,
    ts: c.ts,
    motivo: c.motivo,
    trocas: (c.history || []).length,
  }));
}

/** Restaura a conversa para uma versão anterior. Retorna {ok, versao, trocas, ts, motivo} */
function restaurarCheckpoint(chatId, versao) {
  const d = loadData();
  const key = String(chatId);
  const arr = (d.checkpoints || {})[key] || [];
  const idx = Number(versao);
  const cp = arr[idx];
  if (!cp) return { ok: false, motivo: `versão ${versao} não existe` };
  d.conversations[key] = cp.history.map(e => ({ ...e }));
  saveJSON(FILE, d);
  return { ok: true, versao: idx, trocas: cp.history.length, ts: cp.ts, motivo: cp.motivo };
}

function clearHistory(chatId) {
  const d = loadData();
  delete d.conversations[String(chatId)];
  saveJSON(FILE, d);
}

// ===== PEDIDOS POR USUÁRIO (ele lembrar quando você repetir) =====
// Cada pedido importante é gravado com nome, horário e resultado, para o
// agente lembrar de trabalhos anteriores mesmo dias depois.

function addRequest(userId, nome, text) {
  const d = loadData();
  const key = String(userId);
  if (!d.requests[key]) d.requests[key] = [];
  const t = String(text || '').trim();
  if (!t) return;
  // Se o usuário repetir o MESMO pedido (mesmo texto), atualiza em vez de duplicar
  const last = d.requests[key][d.requests[key].length - 1];
  if (last && last.text === t) {
    last.ts = Date.now();
    last.nome = nome;
  } else {
    d.requests[key].push({ nome: nome || 'Usuário', text: t.slice(0, 500), ts: Date.now(), resultado: null });
  }
  if (d.requests[key].length > MAX_REQUESTS) d.requests[key].shift();
  saveJSON(FILE, d);
}

function setRequestResult(userId, text, resultado) {
  const d = loadData();
  const key = String(userId);
  const arr = d.requests[key] || [];
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].text === String(text || '').trim()) {
      arr[i].resultado = String(resultado || '').slice(0, 400);
      break;
    }
  }
  saveJSON(FILE, d);
}

function formatRequests(userId) {
  const d = loadData();
  const arr = d.requests[String(userId)] || [];
  if (!arr.length) return '';
  const last = arr.slice(-6);
  return '\n🎯 PEDIDOS ANTERIORES DESTE USUÁRIO (LEMBRE DELES!):\n' +
    last.map((r) => {
      const quando = timeAgo(r.ts);
      const res = r.resultado ? ` → RESULTADO: ${r.resultado.slice(0, 100)}` : '';
      return `• ${r.nome} (${quando}): "${r.text}"${res}`;
    }).join('\n');
}

/** Todos os pedidos de todos os usuários (para a proatividade) */
function getAllRequests() {
  const d = loadData();
  const out = [];
  for (const [uid, arr] of Object.entries(d.requests || {})) {
    for (const r of arr) {
      out.push({ userId: uid, nome: r.nome, text: r.text, ts: r.ts, resultado: r.resultado });
    }
  }
  return out;
}

function timeAgo(ts) {
  if (!ts) return '?';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

function formatHistory(chatId, userName = 'Usuário') {
  const h = getHistory(chatId);
  if (!h.length) return '';
  let out = '\n\nHISTÓRICO RECENTE DESTA CONVERSA:\n';
  for (const e of h) {
    // 🛡️ Fallback NEUTRO (não o nome do usuário atual): entrada antiga sem nome
    // gravado NÃO pode ser atribuída a quem está falando agora — isso fazia a
    // IA "trocar os usuários" e achar que outra pessoa disse o que ela disse.
    const quem = e.role === 'user' ? (e.nome || 'Alguém do grupo') : 'Você (IA)';
    out += e.role === 'user'
      ? `- ${quem}: "${e.text}"\n`
      : `- Você (IA): "${e.text.slice(0, 250)}"\n`;
  }
  return out;
}

// ===== FATOS DO USUÁRIO (longo prazo) =====

// ----- BUSCA SEMÂNTICA LEVE (RAG sem embeddings) -----
// Tokeniza o texto, remove stopwords em PT e pontua fatos/pedidos pela
// relevância (sobreposição de tokens ponderada por raridade).

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'para', 'com', 'que', 'por', 'uma', 'um', 'uma', 'o', 'a', 'os', 'as', 'e', 'é', 'ou', 'se', 'ao', 'aos', 'não', 'nao', 'mais', 'mas', 'como', 'sobre', 'ser', 'tem', 'ter', 'está', 'esta', 'são', 'sao', 'foi', 'era', 'meu', 'minha', 'eu', 'tu', 'você', 'voce', 'ele', 'ela', 'eles', 'elas']);

function tokenizar(texto) {
  return String(texto || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

// TF com penalização de tokens comuns: tokens raros pesam mais
function pontuarRelevancia(queryTokens, texto) {
  const tokens = tokenizar(texto);
  if (!queryTokens.length || !tokens.length) return 0;
  let score = 0;
  for (const qt of queryTokens) {
    let ocorrencias = 0;
    for (const t of tokens) if (t === qt) ocorrencias++;
    if (ocorrencias) score += 1 + Math.log(1 + ocorrencias);
  }
  // Normaliza pelo tamanho do texto (evita texto enorme dominar)
  return score / (1 + Math.log(1 + tokens.length));
}

/** Retorna os fatos do usuário mais RELEVANTES à consulta (RAG) */
function buscarFatos(userId, query, limit = 12) {
  const f = getFacts(userId);
  if (!f.length || !query) return f.slice(-limit);
  const qTokens = tokenizar(query);
  return [...f]
    .map(x => ({ x, score: pontuarRelevancia(qTokens, x.text) }))
    .sort((a, b) => b.score - a.score)
    .filter(e => e.score > 0)
    .slice(0, limit)
    .map(e => e.x);
}

/** Formata os fatos relevantes (fallback: últimos fatos se não houver consulta) */
function formatFactsRelevantes(userId, query, limit = 12) {
  const f = buscarFatos(userId, query, limit);
  if (!f.length) return '';
  return '\nMEMÓRIA DE LONGO PRAZO SOBRE ESTE USUÁRIO (mais relevantes):\n- ' + f.map(x => x.text).join('\n- ') + '\n';
}

function getFacts(userId) {
  const d = loadData();
  return d.facts[String(userId)] || [];
}

function addFact(userId, text) {
  const d = loadData();
  const key = String(userId);
  if (!d.facts[key]) d.facts[key] = [];
  const t = String(text || '').trim();
  if (!t) return;
  if (d.facts[key].length >= 40) d.facts[key].shift();
  d.facts[key].push({ text: t, ts: Date.now() });
  saveJSON(FILE, d);
}

function removeFact(userId, index) {
  const d = loadData();
  const key = String(userId);
  if (d.facts[key]) {
    d.facts[key].splice(index, 1);
    saveJSON(FILE, d);
  }
}

function formatFacts(userId) {
  const f = getFacts(userId);
  if (!f.length) return '';
  return '\nMEMÓRIA DE LONGO PRAZO SOBRE ESTE USUÁRIO:\n- ' + f.map(x => x.text).join('\n- ') + '\n';
}

// ===== SOLUÇÕES APRENDIDAS (conhecimento global do agente) =====
// A IA registra aqui soluções que descobriu/executou (ex: "ffmpeg instalado
// via winget") para NÃO precisar pesquisar de novo na próxima vez. São
// globais (valem para o PC do dono em qualquer chat) e aparecem no prompt.
const MAX_SOLUTIONS = 40;

function getSolutions() {
  const d = loadData();
  return d.solutions || [];
}

/** Registra uma solução aprendida (deduplica por texto). */
function addSolution(text) {
  const d = loadData();
  const t = String(text || '').trim();
  if (!t) return;
  if (!Array.isArray(d.solutions)) d.solutions = [];
  const jaExiste = d.solutions.some(s => s.text.toLowerCase() === t.toLowerCase());
  if (!jaExiste) {
    d.solutions.push({ text: t.slice(0, 300), ts: Date.now() });
    if (d.solutions.length > MAX_SOLUTIONS) d.solutions.shift();
    saveJSON(FILE, d);
  }
}

/** Formata as soluções para o prompt (mais recentes primeiro). */
function formatSolutions(limit = 10) {
  const arr = getSolutions();
  if (!arr.length) return '';
  const recentes = [...arr].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, limit);
  return '\n🧠 SOLUÇÕES QUE VOCÊ JÁ APRENDEU NESTE PC (use SEM pesquisar de novo quando for o mesmo caso):\n- ' +
    recentes.map(s => s.text).join('\n- ') + '\n';
}

function getStats() {
  const d = loadData();
  const chats = Object.keys(d.conversations).length;
  let msgs = 0, facts = 0;
  for (const c of Object.values(d.conversations)) msgs += c.length;
  for (const f of Object.values(d.facts)) facts += f.length;
  return { chats, mensagens: msgs, fatos: facts, solucoes: (d.solutions || []).length };
}

module.exports = {
  getHistory, addExchange, clearHistory, formatHistory,
  getFacts, addFact, removeFact, formatFacts, getStats,
  readMemoryMd, appendGroupNote, setPersona, getPersona,
  addRequest, setRequestResult, formatRequests, getAllRequests,
  buscarFatos, formatFactsRelevantes, tokenizar, pontuarRelevancia,
  salvarCheckpoint, listarCheckpoints, restaurarCheckpoint,
  getSolutions, addSolution, formatSolutions,
};