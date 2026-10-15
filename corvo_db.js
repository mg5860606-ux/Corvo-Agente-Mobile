/**
 * 🗄️ CORVO OPENCLAW MOBILE - PERSISTÊNCIA SQLITE (ATUALIZADO COM OFFLINE QUEUE)
 * Gerencia histórico de conversas, estado de subagentes e fila de mensagens pendentes sem internet.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'corvo_mobile.db');
const db = new sqlite3.Database(dbPath);

function initDb() {
  db.serialize(() => {
    // Tabela de Jobs / Subagentes Assíncronos
    db.run(`CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT,
      prompt TEXT,
      result TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de Fila Offline (Queue de mensagens quando sem internet)
    db.run(`CREATE TABLE IF NOT EXISTS offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jid TEXT,
      prompt TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de Log de Mensagens / Chat
    db.run(`CREATE TABLE IF NOT EXISTS chat_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT,
      sender TEXT,
      message TEXT,
      response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

initDb();

module.exports = {
  db,
  saveJob(id, status, prompt, result = null, error = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO jobs (id, status, prompt, result, error, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET status = ?, result = ?, error = ?, updated_at = CURRENT_TIMESTAMP`,
        [id, status, prompt, result, error, status, result, error],
        (err) => (err ? reject(err) : resolve(true))
      );
    });
  },
  getJob(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM jobs WHERE id = ?`, [id], (err, row) => (err ? reject(err) : resolve(row)));
    });
  },
  addOfflineQueue(jid, prompt) {
    db.run(`INSERT INTO offline_queue (jid, prompt, status) VALUES (?, ?, 'pending')`, [jid, prompt]);
  },
  getPendingQueue() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM offline_queue WHERE status = 'pending'`, [], (err, rows) => (err ? reject(err) : resolve(rows)));
    });
  },
  markQueueProcessed(id) {
    db.run(`UPDATE offline_queue SET status = 'processed' WHERE id = ?`, [id]);
  },
  logChat(channel, sender, message, response) {
    db.run(
      `INSERT INTO chat_logs (channel, sender, message, response) VALUES (?, ?, ?, ?)`,
      [channel, sender, message, response]
    );
  }
};
