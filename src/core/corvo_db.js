/**
 * 🗄️ CORVO AGENTE MOBILE - PERSISTÊNCIA NATIVA JSON/STORE (100% JS SEM COMPILAÇÃO C++)
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'corvo_mobile_store.json');

function loadStore() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {}
  return { jobs: {}, offline_queue: [], chat_logs: [] };
}

function saveStore(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[DB Store Error]', e.message);
  }
}

module.exports = {
  db: {
    run: (sql, params, cb) => { if (typeof cb === 'function') cb(null); },
    get: (sql, params, cb) => { if (typeof cb === 'function') cb(null, null); },
    all: (sql, params, cb) => { if (typeof cb === 'function') cb(null, []); },
    serialize: (cb) => { if (typeof cb === 'function') cb(); }
  },
  async saveJob(id, status, prompt, result = null, error = null) {
    const store = loadStore();
    store.jobs[id] = {
      id,
      status,
      prompt,
      result,
      error,
      updated_at: new Date().toISOString()
    };
    saveStore(store);
    return true;
  },
  async getJob(id) {
    const store = loadStore();
    return store.jobs[id] || null;
  },
  addOfflineQueue(jid, prompt) {
    const store = loadStore();
    store.offline_queue.push({
      id: Date.now(),
      jid,
      prompt,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    saveStore(store);
  },
  async getPendingQueue() {
    const store = loadStore();
    return store.offline_queue.filter(q => q.status === 'pending');
  },
  markQueueProcessed(id) {
    const store = loadStore();
    const item = store.offline_queue.find(q => q.id === id);
    if (item) {
      item.status = 'processed';
      saveStore(store);
    }
  },
  logChat(channel, sender, message, response) {
    const store = loadStore();
    store.chat_logs.push({
      id: Date.now(),
      channel,
      sender,
      message,
      response,
      created_at: new Date().toISOString()
    });
    if (store.chat_logs.length > 500) store.chat_logs.shift();
    saveStore(store);
  }
};
