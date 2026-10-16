/**
 * 📋 CORVO - FILA DE TAREFAS (execução em background)
 * O agente agenda tarefas longas (baixar, instalar, testar, servidores) que
 * rodam EM SEGUNDO PLANO sem travar o bot: o dono continua conversando e, ao
 * terminar, o resultado é enviado no chat e fica registrado para consulta.
 * Persistente em data/tarefas.json → retoma pendentes após reinício.
 */

const { loadJSON, saveJSON, DATA_DIR } = require('../grupo_utils');
const FILE = `${DATA_DIR}/tarefas.json`;

const defaultData = () => ({ seq: 1, tasks: [] });

function load() {
  const d = loadJSON(FILE, defaultData());
  if (!Array.isArray(d.tasks)) d.tasks = [];
  if (!d.seq) d.seq = 1;
  return d;
}

let runner = null;   // async (tipo, args, toolCtx) => resultado
let notifier = null; // (chatId, texto) => void
let chain = Promise.resolve();

function setTaskRunner(fn) { runner = fn; }
function setTaskNotifier(fn) { notifier = fn; }

const PESO = { alta: 3, normal: 2, baixa: 1 };

function agendar({ chatId, userId, descricao, tipo, args, prioridade = 'normal' }) {
  const d = load();
  const id = d.seq++;
  d.tasks.push({
    id,
    chatId: String(chatId),
    userId: String(userId || ''),
    descricao: String(descricao || tipo).slice(0, 200),
    tipo: String(tipo || ''),
    args: args || {},
    prioridade,
    status: 'pendente', // pendente | rodando | concluida | falha | cancelada
    criadaEm: Date.now(),
    iniciadaEm: null,
    concluidaEm: null,
    resultado: null,
  });
  saveJSON(FILE, d);
  processar();
  return { ok: true, id, descricao: String(descricao || tipo).slice(0, 200), status: 'pendente' };
}

function processar() {
  chain = chain.then(async () => {
    const d = load();
    const pendentes = d.tasks
      .filter(t => t.status === 'pendente')
      .sort((a, b) => (PESO[b.prioridade] || 2) - (PESO[a.prioridade] || 2) || a.criadaEm - b.criadaEm);
    const tarefa = pendentes[0];
    if (!tarefa) return;

    tarefa.status = 'rodando';
    tarefa.iniciadaEm = Date.now();
    saveJSON(FILE, load().seq ? d : d);

    let resultado;
    try {
      if (!runner) throw new Error('Executor de tarefas não configurado.');
      resultado = await runner(tarefa.tipo, tarefa.args, { isDono: true, chatId: tarefa.chatId, userId: tarefa.userId });
    } catch (e) {
      resultado = { erro: String(e.message || e) };
    }

    const d2 = load();
    const done = d2.tasks.find(t => t.id === tarefa.id);
    if (done) {
      const texto = typeof resultado === 'string' ? resultado : JSON.stringify(resultado || {});
      done.status = resultado && resultado.erro ? 'falha' : 'concluida';
      done.concluidaEm = Date.now();
      done.resultado = String(texto).slice(0, 2000);
      saveJSON(FILE, d2);

      if (notifier) {
        try {
          const ok = done.status === 'concluida';
          notifier(
            tarefa.chatId,
            `${ok ? '✅' : '⚠️'} *TAREFA #${tarefa.id} ${ok ? 'CONCLUÍDA' : 'FALHOU'}*\n📌 ${tarefa.descricao}\n🛠 ${tarefa.tipo}\n\n${done.resultado.slice(0, 1200)}`,
          );
        } catch (e) {}
      }
    }
  }).catch(() => {});
}

/**
 * Retoma tarefas que ficaram pendentes/rodando (ex: bot reiniciou no meio).
 * Chame uma vez no boot.
 */
function retomarPendentes() {
  const d = load();
  let n = 0;
  for (const t of d.tasks) {
    if (t.status === 'rodando') { t.status = 'pendente'; n++; }
  }
  saveJSON(FILE, d);
  if (n) processar();
  return n;
}

function listar(chatId) {
  const d = load();
  const arr = d.tasks.filter(t => String(t.chatId) === String(chatId)).slice(-15);
  if (!arr.length) return 'Nenhuma tarefa registrada neste chat.';
  return arr.map(t => {
    const q = new Date(t.criadaEm).toLocaleString('pt-BR');
    const res = t.status === 'concluida' ? '✅' : t.status === 'falha' ? '❌' : t.status === 'rodando' ? '⏳' : t.status === 'cancelada' ? '🗑' : '🕐';
    return `${res} #${t.id} [${t.status.toUpperCase()}] ${t.descricao} (${t.tipo}) — ${q}`;
  }).join('\n');
}

function cancelar(chatId, id) {
  const d = load();
  const t = d.tasks.find(x => x.id === Number(id) && String(x.chatId) === String(chatId) && x.status === 'pendente');
  if (!t) return `Tarefa #${id} não encontrada (ou já não está pendente).`;
  t.status = 'cancelada';
  saveJSON(FILE, d);
  return `Tarefa #${id} cancelada.`;
}

function getStats() {
  const d = load();
  return {
    total: d.tasks.length,
    pendentes: d.tasks.filter(t => t.status === 'pendente').length,
    rodando: d.tasks.filter(t => t.status === 'rodando').length,
    concluidas: d.tasks.filter(t => t.status === 'concluida').length,
  };
}

module.exports = { agendar, listar, cancelar, retomarPendentes, setTaskRunner, setTaskNotifier, getStats };