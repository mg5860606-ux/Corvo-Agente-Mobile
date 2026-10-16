/**
 * 🦅 CORVO AGENTE MOBILE - CLIENTE WHATSAPP INTEGRADO AO GATEWAY (COM FILA OFFLINE)
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const db = require('./corvo_db');

const authDir = path.resolve(__dirname, 'data', 'auth_info_baileys');
if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

const GATEWAY_URL = 'http://localhost:3333';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function perguntar(pergunta) {
  return new Promise((resolve) => {
    rl.question(pergunta, (resposta) => resolve(resposta.trim()));
  });
}

/** Processa fila pendente quando a internet volta */
async function processarFilaOffline(sock) {
  try {
    const pendentes = await db.getPendingQueue();
    if (pendentes && pendentes.length > 0) {
      console.log(`[QUEUE] Encontradas ${pendentes.length} mensagens pendentes na fila offline. Processando...`);
      for (const item of pendentes) {
        try {
          await axios.post(`${GATEWAY_URL}/subagent/spawn`, {
            prompt: item.prompt,
            context: { jid: item.jid, origem: 'offline_queue' }
          });
          await sock.sendMessage(item.jid, { text: `[CORVO RECONECTADO] Processando comando que estava na fila offline: "${item.prompt}"` });
          db.markQueueProcessed(item.id);
        } catch (e) {
          console.error(`[QUEUE] Falha ao reprocessar item ${item.id}:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error('[QUEUE ERROR]', err.message);
  }
}

async function startWhatsApp() {
  console.clear();
  console.log('========================================');
  console.log('  🦅 CORVO AGENTE MOBILE - WHATSAPP');
  console.log('========================================');
  console.log(' Escolha o método de conexão:');
  console.log(' [1] QR Code (Ler com a câmera do celular)');
  console.log(' [2] Code Pairing (Digitar número e gerar código de 8 dígitos)');
  console.log('----------------------------------------');

  const opcao = await perguntar('Digite a opção desejada (1 ou 2): ');

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
    },
    printQRInTerminal: opcao === '1'
  });

  sock.ev.on('creds.update', saveCreds);

  if (opcao === '2' && !sock.authState.creds.registered) {
    const phoneNumber = await perguntar('Digite o seu número do WhatsApp com DDI e DDD (ex: 5511999999999): ');
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('\n========================================');
        console.log(` 🔑 SEU CÓDIGO DE PAREAMENTO: ${code}`);
        console.log('========================================\n');
      } catch (err) {
        console.error('Erro ao gerar código de pareamento:', err.message);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log('Conexão fechada, reconectando...', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(startWhatsApp, 5000);
      }
    } else if (connection === 'open') {
      console.log('🦅 CORVO WHATSAPP CONECTADO COM SUCESSO!');
      // Processa fila pendente assim que reconectar
      processarFilaOffline(sock);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const jid = m.key.remoteJid;
    const text = m.message.conversation || m.message.extendedTextMessage?.text;

    if (text) {
      console.log(`[MSG RECEBIDA] De ${jid}: ${text}`);

      try {
        // Tenta disparar no Gateway local
        const res = await axios.post(`${GATEWAY_URL}/subagent/spawn`, {
          prompt: text,
          context: { jid, sender: m.pushName || 'Usuário' },
          timeout: 5000
        });

        const jobId = res.data.jobId;
        await sock.sendMessage(jid, { text: `[CORVO] Ordem recebida. Subagente disparado (ID: ${jobId}). Processando...` }, { quoted: m });

        setTimeout(async () => {
          try {
            const check = await axios.get(`${GATEWAY_URL}/subagent/${jobId}`);
            if (check.data && check.data.result) {
              await sock.sendMessage(jid, { text: `🤖 *RESPOSTA DO SUBAGENTE*:\n\n${check.data.result}` });
            }
          } catch (e) {
            console.error('Erro ao buscar resultado do job:', e.message);
          }
        }, 10000);

      } catch (error) {
        // Se a API falhou ou está sem internet, salva na fila offline do SQLite
        console.warn('[OFFLINE WARNING] Gateway indisponível ou sem internet. Salvando na fila offline do SQLite...');
        db.addOfflineQueue(jid, text);
        await sock.sendMessage(jid, { text: `[MODO OFFLINE] Sem conexão com o Daemon/Internet. Sua ordem foi salva na fila SQLite e será processada automaticamente assim que a conexão for restabelecida.` }, { quoted: m });
      }
    }
  });

  rl.close();
}

startWhatsApp();
