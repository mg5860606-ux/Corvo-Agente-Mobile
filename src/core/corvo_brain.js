/**
 * 🧠 CORVO AGENTE MOBILE - CÉREBRO DE MEMÓRIA EPISÓDICA E NEURAL
 * Gerencia fatos de longo prazo, contexto de missões e persistência neural.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const BRAIN_DIR = path.resolve(__dirname, '../../brain');
if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });

const dbPath = path.join(BRAIN_DIR, 'neural_memory.db');
const db = new sqlite3.Database(dbPath);

function initBrain() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS episodic_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT,
      content TEXT,
      importance INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS mission_states (
      mission_id TEXT PRIMARY KEY,
      objective TEXT,
      status TEXT,
      steps_completed INTEGER,
      final_result TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

initBrain();

const brain = {
  remember(tag, content, importance = 1) {
    db.run(`INSERT INTO episodic_memory (tag, content, importance) VALUES (?, ?, ?)`, [tag, content, importance]);
  },

  recall(tag, callback) {
    db.all(`SELECT content FROM episodic_memory WHERE tag = ? ORDER BY id DESC LIMIT 10`, [tag], (err, rows) => {
      if (err) callback([]);
      else callback(rows.map(r => r.content));
    });
  },

  saveMission(missionId, objective, status, steps, result) {
    db.run(
      `INSERT INTO mission_states (mission_id, objective, status, steps_completed, final_result, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(mission_id) DO UPDATE SET status = ?, steps_completed = ?, final_result = ?, updated_at = CURRENT_TIMESTAMP`,
      [missionId, objective, status, steps, result, status, steps, result]
    );
  }
};

module.exports = brain;
