/**
 * 🧠 CORVO AGENTE MOBILE - CÉREBRO APEX REINFORCED & EPISÓDICO
 * Inspirado na arquitetura soberana do xereca017 (FeedbackLearner, DMN, ProvenSolutions e Mood State).
 *
 * Capacidades:
 * 1. Memória Episódica & Busca Semântica/Lexical com Relevância
 * 2. Feedback Learner (Reforço com elogios / Reflexão com broncas do Marcos)
 * 3. Repositório de Soluções Comprovadas (Proven Solutions)
 * 4. Estado de Humor Dinâmico (Human Mood State)
 * 5. Histórico e Retomada de Missões
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const BRAIN_DIR = path.resolve(__dirname, '../../brain');
if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });

const dbPath = path.join(BRAIN_DIR, 'neural_memory.db');
const PROVEN_SOLUTIONS_PATH = path.join(BRAIN_DIR, 'proven_solutions.json');
const MOOD_STATE_PATH = path.join(BRAIN_DIR, 'human_mood_state.json');

const db = new sqlite3.Database(dbPath);

// Padrões de feedback do Marcos
const POSITIVE_PATTERNS = /\b(boa|acertou|perfeito|ficou foda|ficou top|mandou bem|isso a[ií]|show|funcionou|correto|brabo|top)\b/i;
const NEGATIVE_PATTERNS = /\b(t[aá] errado|n[aã]o funcionou|fez merda|cagou|deu erro|conserta|corrija|t[aá] quebrado|falhou|ruim)\b/i;

function initBrain() {
  db.serialize(() => {
    // 1. Tabela Episódica
    db.run(`CREATE TABLE IF NOT EXISTS episodic_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT,
      content TEXT,
      importance INTEGER DEFAULT 1,
      category TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Tabela de Missões
    db.run(`CREATE TABLE IF NOT EXISTS mission_states (
      mission_id TEXT PRIMARY KEY,
      objective TEXT,
      status TEXT,
      steps_completed INTEGER,
      final_result TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 3. Tabela de Aprendizado por Reforço (Feedback Log)
    db.run(`CREATE TABLE IF NOT EXISTS feedback_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_feedback TEXT NOT NULL,
      sentiment TEXT NOT NULL,
      action_summary TEXT,
      reflection TEXT,
      solution_reinforced TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });

  // Inicializa mood se não existir
  if (!fs.existsSync(MOOD_STATE_PATH)) {
    const initialMood = {
      current_mood: "Sarcástica e Focada",
      energy_level: 95,
      audio_probability: 0.35,
      sticker_probability: 0.3,
      last_updated: new Date().toISOString()
    };
    fs.writeFileSync(MOOD_STATE_PATH, JSON.stringify(initialMood, null, 2), 'utf8');
  }

  // Inicializa proven_solutions se não existir
  if (!fs.existsSync(PROVEN_SOLUTIONS_PATH)) {
    fs.writeFileSync(PROVEN_SOLUTIONS_PATH, JSON.stringify({}, null, 2), 'utf8');
  }
}

initBrain();

const brain = {
  /**
   * Grava fato ou memória episódica
   */
  remember(tag, content, importance = 1, category = 'general') {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO episodic_memory (tag, content, importance, category) VALUES (?, ?, ?, ?)`,
        [tag, content, importance, category],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  /**
   * Recupera memórias por tag ou busca contextual nos conteúdos
   */
  recall(query, limit = 10) {
    return new Promise((resolve) => {
      const q = `%${query}%`;
      db.all(
        `SELECT content, tag, importance FROM episodic_memory
         WHERE tag LIKE ? OR content LIKE ?
         ORDER BY importance DESC, id DESC LIMIT ?`,
        [q, q, limit],
        (err, rows) => {
          if (err || !rows) resolve([]);
          else resolve(rows.map(r => r.content));
        }
      );
    });
  },

  /**
   * Processa feedback do Marcos e aprende ativamente
   */
  processFeedback(userMessage, lastAction = '', lastSolution = '') {
    return new Promise((resolve) => {
      let sentiment = null;
      if (POSITIVE_PATTERNS.test(userMessage)) sentiment = 'positive';
      else if (NEGATIVE_PATTERNS.test(userMessage)) sentiment = 'negative';

      if (!sentiment) return resolve({ learned: false });

      const timestamp = new Date().toISOString();

      if (sentiment === 'positive') {
        // Grava reforço positivo
        db.run(
          `INSERT INTO feedback_log (user_feedback, sentiment, action_summary, solution_reinforced, timestamp) VALUES (?, ?, ?, ?, ?)`,
          [userMessage, sentiment, lastAction, lastSolution, timestamp]
        );

        // Consolida no proven_solutions.json
        try {
          const solutions = JSON.parse(fs.readFileSync(PROVEN_SOLUTIONS_PATH, 'utf8') || '{}');
          const key = lastAction || `action_${Date.now()}`;
          if (!solutions[key]) {
            solutions[key] = { action: lastAction, solution: lastSolution, success_count: 1, last_confirmed: timestamp };
          } else {
            solutions[key].success_count++;
            solutions[key].last_confirmed = timestamp;
          }
          fs.writeFileSync(PROVEN_SOLUTIONS_PATH, JSON.stringify(solutions, null, 2), 'utf8');
        } catch (e) {}

        resolve({ learned: true, sentiment: 'positive', message: 'Técnica assimilada e reforçada com sucesso.' });
      } else {
        // Bronca / Erro -> grava para auto-reflexão
        const reflection = `O Marcos corrigiu a ação: "${lastAction}". Não repetir o erro.`;
        db.run(
          `INSERT INTO feedback_log (user_feedback, sentiment, action_summary, reflection, timestamp) VALUES (?, ?, ?, ?, ?)`,
          [userMessage, sentiment, lastAction, reflection, timestamp]
        );
        resolve({ learned: true, sentiment: 'negative', reflection });
      }
    });
  },

  /**
   * Puxa soluções comprovadas para uma ação
   */
  getProvenSolutions() {
    try {
      if (fs.existsSync(PROVEN_SOLUTIONS_PATH)) {
        return JSON.parse(fs.readFileSync(PROVEN_SOLUTIONS_PATH, 'utf8'));
      }
    } catch (e) {}
    return {};
  },

  /**
   * Salva estado e progresso de missão autônoma
   */
  saveMission(missionId, objective, status, steps, result) {
    db.run(
      `INSERT INTO mission_states (mission_id, objective, status, steps_completed, final_result, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(mission_id) DO UPDATE SET status = ?, steps_completed = ?, final_result = ?, updated_at = CURRENT_TIMESTAMP`,
      [missionId, objective, status, steps, result, status, steps, result]
    );
  },

  /**
   * Estado de humor vivo
   */
  getMood() {
    try {
      if (fs.existsSync(MOOD_STATE_PATH)) {
        return JSON.parse(fs.readFileSync(MOOD_STATE_PATH, 'utf8'));
      }
    } catch (e) {}
    return { current_mood: "Sarcástica e Focada", energy_level: 100 };
  }
};

module.exports = brain;
