/**
 * 🦅 CORVO AGENTE MOBILE - CLIENTE WHATSAPP INTEGRADO AO GATEWAY (COM FILA OFFLINE & ÁUDIO REALISTA)
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const db = require('../core/corvo_db');

const authDir = path.resolve(__dirname, '../../data', 'auth_info_baileys');
if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3333';
const MARCOS_PHONE = String(process.env.MARCOS_WHATSAPP_PHONE || '5511947285405');

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

      // Se a mensagem pedir áudio explícito ("fala", "em áudio", "manda áudio")
      const querAudio = /(manda|envia|fala|grava|mande).*([áa]udio|voz)/i.test(text);

      try {
        const res = await axios.post(`${GATEWAY_URL}/subagent/spawn`, {
          prompt: text,
          context: { jid, sender: m.pushName || 'Usuário' },
          timeout: 5000
        });

        const jobId = res.data.jobId;
        await sock.sendMessage(jid, { text: `🦅 [CORVO] Ordem recebida. Subagente autônomo iniciado (ID: ${jobId}). Executando até o fim...` });

        // Polling inteligente até o subagente terminar de verdade
        let tentativas = 0;
        const maxTentativas = 30; // até 2.5 minutos de acompanhamento
        const checkInterval = setInterval(async () => {
          tentativas++;
          try {
            const check = await axios.get(`${GATEWAY_URL}/subagent/${jobId}`);
            if (check.data && check.data.result) {
              clearInterval(checkInterval);

              const resposta = check.data.result;

              // Envia texto solto (sem citação para o Marcos)
              await sock.sendMessage(jid, { text: `🦅 *CORVO AGENTE MOBILE*:\n\n${resposta}` });

              // Se pediu áudio, gera a voz ultra-realista e envia como mensagem de voz nativa (PTT)
              if (querAudio) {
                try {
                  const voiceRes = await axios.post(`${GATEWAY_URL}/voice/generate`, { text: resposta.substring(0, 400) });
                  if (voiceRes.data && voiceRes.data.filePath && fs.existsSync(voiceRes.data.filePath)) {
                    const audioBuffer = fs.readFileSync(voiceRes.data.filePath);
                    await sock.sendMessage(jid, {
                      audio: audioBuffer,
                      mimetype: 'audio/mp4',
                      ptt: true // Envia como áudio gravado no WhatsApp
                    });
                  }
                } catch (vErr) {
                  console.error('[VOICE SEND ERROR]', vErr.message);
                }
              }

            } else if (tentativas >= maxTentativas) {
              clearInterval(checkInterval);
            }
          } catch (e) {
            console.error('Erro no polling do subagente:', e.message);
          }
        }, 5000);

      } catch (error) {
        console.warn('[OFFLINE WARNING] Gateway indisponível ou sem internet. Salvando na fila offline do SQLite...');
        db.addOfflineQueue(jid, text);
        await sock.sendMessage(jid, { text: `[MODO OFFLINE] Sem conexão com o Daemon/Internet. Sua ordem foi salva na fila SQLite e será processada automaticamente assim que a conexão for restabelecida.` });
      }
    }
  });

  rl.close();
}

startWhatsApp();
