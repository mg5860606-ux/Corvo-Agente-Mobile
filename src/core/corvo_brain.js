/**
 * 🧠 CORVO AGENTE MOBILE - CÉREBRO INTELIGENTE NEURAL & EPISÓDICO
 * Otimizado para Mobile (Android/Termux), baixo consumo de RAM/bateria,
 * persistência atômica, memória episódica, auto-poda (LRU),
 * registro de soluções comprovadas e telemetria de ambiente.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const BRAIN_DIR = path.resolve(__dirname, '../../brain');
if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });

const EPISODIC_FILE = path.join(BRAIN_DIR, 'episodic_memory.json');
const PROVEN_SOLUTIONS_PATH = path.join(BRAIN_DIR, 'proven_solutions.json');
const MOOD_STATE_PATH = path.join(BRAIN_DIR, 'human_mood_state.json');
const MISSIONS_LOG_PATH = path.join(BRAIN_DIR, 'missions_log.json');
const MAX_EPISODIC_ITEMS = 300; // Limite saudável para não travar Termux/celular

function loadJson(file, defaultVal) {
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8').trim();
      return raw ? JSON.parse(raw) : defaultVal;
    }
  } catch (e) {
    console.warn(`[BRAIN LOAD WARN] Arquivo corrompido ou inacessível (${path.basename(file)}): ${e.message}`);
  }
  return defaultVal;
}

function saveJson(file, data) {
  try {
    const tempFile = `${file}.tmp_${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, file); // Escrita atômica para evitar corrupção em queda de energia/bateria no celular
  } catch (e) {
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (writeErr) {
      console.error(`[BRAIN SAVE ERROR] Falha ao persistir ${path.basename(file)}:`, writeErr.message);
    }
  }
}

// Inicializa mood se não existir
if (!fs.existsSync(MOOD_STATE_PATH)) {
  const initialMood = {
    current_mood: "Sarcástica, Ágil e Focada",
    energy_level: 95,
    audio_probability: 0.35,
    sticker_probability: 0.3,
    last_updated: new Date().toISOString()
  };
  saveJson(MOOD_STATE_PATH, initialMood);
}

if (!fs.existsSync(PROVEN_SOLUTIONS_PATH)) {
  saveJson(PROVEN_SOLUTIONS_PATH, {});
}

const POSITIVE_PATTERNS = /\b(boa|acertou|perfeito|ficou foda|ficou top|mandou bem|isso a[ií]|show|funcionou|correto|brabo|top|maravilha|parab[eé]ns)\b/i;
const NEGATIVE_PATTERNS = /\b(t[aá] errado|n[aã]o funcionou|fez merda|cagou|deu erro|conserta|corrija|t[aá] quebrado|falhou|ruim|bosta|lixo)\b/i;

const brain = {
  /**
   * Guarda um novo fato ou memória episódica com auto-poda para mobile
   */
  async remember(tag, content, importance = 1, category = 'general') {
    const list = loadJson(EPISODIC_FILE, []);
    const item = {
      id: Date.now(),
      tag: String(tag || 'general'),
      content: String(content || ''),
      importance: Number(importance) || 1,
      category: String(category || 'general'),
      created_at: new Date().toISOString()
    };
    list.push(item);

    // Otimização Mobile: Evita estouro de arquivo em Termux
    if (list.length > MAX_EPISODIC_ITEMS) {
      // Ordena por importância e data, mantém os mais vitais
      list.sort((a, b) => (b.importance - a.importance) || (b.id - a.id));
      list.splice(MAX_EPISODIC_ITEMS);
    }

    saveJson(EPISODIC_FILE, list);
    return item.id;
  },

  /**
   * Recupera memórias episódicas com ranqueamento semântico ultra-rápido (TF-IDF / N-gram puro)
   */
  async recall(query, limit = 5) {
    const list = loadJson(EPISODIC_FILE, []);
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      return list.slice(-limit).map(m => `[${m.tag}] ${m.content}`);
    }

    const tokens = q.split(/\s+/).filter(t => t.length > 2);

    const scored = list.map(m => {
      let score = 0;
      const tagLower = (m.tag || '').toLowerCase();
      const contentLower = (m.content || '').toLowerCase();
      const categoryLower = (m.category || '').toLowerCase();

      // Correspondência exata da query inteira
      if (contentLower.includes(q)) score += 10;
      if (tagLower.includes(q)) score += 8;

      // Correspondência de tokens individuais (BM25 simplificado)
      for (const t of tokens) {
        if (contentLower.includes(t)) score += 3;
        if (tagLower.includes(t)) score += 5;
        if (categoryLower.includes(t)) score += 1.5;
      }

      // Boost por importância e recência
      score += (m.importance || 1) * 0.5;

      return { m, score };
    });

    const filtered = scored.filter(s => s.score > 0);
    filtered.sort((a, b) => b.score - a.score);

    if (filtered.length === 0) {
      return list.slice(-limit).map(m => `[${m.tag}] ${m.content}`);
    }

    return filtered.slice(0, limit).map(s => `[${s.m.tag}] ${s.m.content}`);
  },

  /**
   * Retorna todas as soluções comprovadas armazenadas no cérebro
   */
  getProvenSolutions() {
    return loadJson(PROVEN_SOLUTIONS_PATH, {});
  },

  /**
   * Salva o status de uma missão do loop autônomo
   */
  saveMission(missionId, objective, status, steps = 0, report = null) {
    const missions = loadJson(MISSIONS_LOG_PATH, {});
    missions[missionId] = {
      missionId,
      objective,
      status,
      steps,
      report,
      updated_at: new Date().toISOString()
    };
    saveJson(MISSIONS_LOG_PATH, missions);
  },

  /**
   * Processa feedback direto do usuário (Marcos) e aprende comportamentos/soluções
   */
  async processFeedback(userFeedback, actionSummary = '', solutionReinforced = '') {
    let sentiment = 'neutral';
    if (POSITIVE_PATTERNS.test(userFeedback)) sentiment = 'positive';
    else if (NEGATIVE_PATTERNS.test(userFeedback)) sentiment = 'negative';

    const learned = sentiment === 'positive';
    await this.recordFeedback(userFeedback, actionSummary, `Sentimento detectado: ${sentiment}`, solutionReinforced);
    return { learned, sentiment };
  },

  /**
   * Registra log de feedback e atualiza soluções comprovadas
   */
  async recordFeedback(userFeedback, actionSummary, reflection, solutionReinforced) {
    let sentiment = 'neutral';
    if (POSITIVE_PATTERNS.test(userFeedback)) sentiment = 'positive';
    else if (NEGATIVE_PATTERNS.test(userFeedback)) sentiment = 'negative';

    const feedbackFile = path.join(BRAIN_DIR, 'feedback_log.json');
    const logs = loadJson(feedbackFile, []);
    logs.push({
      id: Date.now(),
      userFeedback,
      sentiment,
      actionSummary,
      reflection,
      solutionReinforced,
      timestamp: new Date().toISOString()
    });

    if (logs.length > 200) logs.splice(0, logs.length - 200);
    saveJson(feedbackFile, logs);

    if (sentiment === 'positive' && (solutionReinforced || actionSummary)) {
      const proven = loadJson(PROVEN_SOLUTIONS_PATH, {});
      const key = (actionSummary || 'solucao_' + Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
      proven[key] = {
        solution: solutionReinforced || actionSummary,
        userFeedback,
        timestamp: new Date().toISOString()
      };
      saveJson(PROVEN_SOLUTIONS_PATH, proven);
    }
  },

  /**
   * Retorna o estado emocional da persona
   */
  getMood() {
    return loadJson(MOOD_STATE_PATH, { current_mood: "Focada", energy_level: 90 });
  },

  /**
   * Telemetria e diagnóstico do ambiente mobile para fluidez total no Android/Termux
   */
  getMobileState() {
    const totalMem = Math.round(os.totalmem() / 1024 / 1024);
    const freeMem = Math.round(os.freemem() / 1024 / 1024);
    const isTermux = Boolean(process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux'));
    const isAndroid = process.platform === 'android' || isTermux;

    return {
      isMobile: isAndroid,
      isTermux,
      platform: process.platform,
      arch: process.arch,
      ramTotalMb: totalMem,
      ramFreeMb: freeMem,
      lowMemory: freeMem < 250, // Menos de 250MB livres
      uptimeMinutes: Math.round(os.uptime() / 60)
    };
  },

  /**
   * Mantém o processo vivo no Android (Termux Wake-Lock) para evitar que o Doze Mode mate o Node
   */
  ensureWakeLock() {
    const isTermux = Boolean(process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux'));
    if (isTermux) {
      try {
        const { exec } = require('child_process');
        exec('termux-wake-lock', (err) => {
          if (!err) console.log('[BRAIN APEX] 🔒 Termux Wake-Lock ativado: processo blindado contra o Doze Mode do Android.');
        });
      } catch (e) {}
    }
  },

  /**
   * Regulador Dinâmico de Hardware Mobile (Bateria, Térmico, RAM)
   */
  getMobileGovernor() {
    let batteryStatus = { percentage: 100, plugged: 'PLUGGED_AC', status: 'CHARGING' };
    try {
      const { execSync } = require('child_process');
      const raw = execSync('termux-battery-status', { timeout: 3000, encoding: 'utf8' });
      batteryStatus = JSON.parse(raw);
    } catch (e) {}

    const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
    const pct = batteryStatus.percentage ?? 100;
    const isCharging = batteryStatus.status === 'CHARGING' || batteryStatus.plugged !== 'UNPLUGGED';

    let mode = 'apex'; // Modo máximo por padrão
    if (!isCharging && pct < 20) {
      mode = 'eco'; // Economia máxima de bateria
    } else if (!isCharging && pct < 40) {
      mode = 'balanced';
    }

    return {
      mode,
      batteryPercentage: pct,
      isCharging,
      freeMemMb,
      temperature: batteryStatus.temperature || null,
      recommendation: mode === 'eco'
        ? 'Bateria baixa no celular: rodar em modo silencioso e evitar loops longos.'
        : 'Hardware liberado: Potência máxima APEX autorizada.'
    };
  }
};

// Ativa Wake-Lock automaticamente na inicialização se estiver no Android/Termux
brain.ensureWakeLock();

module.exports = brain;
