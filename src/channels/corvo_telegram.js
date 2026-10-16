/**
 * ✈️ CORVO AGENTE MOBILE - CANAL TELEGRAM NATIVO
 * Conexão direta com o Telegram Bot API sem depender de pacotes externos pesados (usa axios).
 * Polling contínuo, autenticação por ID do Marcos (8273924319), suporte a texto, comandos e áudio.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const API_URL = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';
const GATEWAY_URL = 'http://localhost:3333';
const MARCOS_TG_ID = '8273924319';

let isRunning = false;
let lastUpdateId = 0;

async function sendMessage(chatId, text) {
  try {
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error('[TG ERROR] Falha ao enviar mensagem:', err.message);
  }
}

async function sendVoice(chatId, audioPath, caption = '') {
  try {
    if (!fs.existsSync(audioPath)) return;
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('voice', fs.createReadStream(audioPath));
    if (caption) form.append('caption', caption);

    await axios.post(`${API_URL}/sendVoice`, form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
  } catch (err) {
    console.error('[TG ERROR] Falha ao enviar áudio de voz:', err.message);
  }
}

async function startPolling() {
  if (!BOT_TOKEN) {
    console.warn('[TELEGRAM] TELEGRAM_BOT_TOKEN não configurado no .env. Canal Telegram em espera.');
    return;
  }
  console.log(`[TELEGRAM] Iniciando polling com bot token: ${BOT_TOKEN.slice(0, 10)}...`);
  isRunning = true;

  while (isRunning) {
    try {
      const res = await axios.get(`${API_URL}/getUpdates`, {
        params: {
          offset: lastUpdateId + 1,
          timeout: 25
        },
        timeout: 30000
      });

      if (res.data && res.data.ok && res.data.result) {
        for (const update of res.data.result) {
          lastUpdateId = update.update_id;

          if (update.message && update.message.text) {
            const senderId = String(update.message.from.id);
            const chatId = update.message.chat.id;
            const text = update.message.text.trim();
            const isDono = senderId === MARCOS_TG_ID;

            console.log(`[TG MSG] De ${senderId} (${update.message.from.first_name}): ${text}`);

            // Chama o Gateway /chat para responder
            try {
              const chatRes = await axios.post(`${GATEWAY_URL}/chat`, {
                message: text
              });

              if (chatRes.data && chatRes.data.reply) {
                // Se o usuário pediu áudio
                const querAudio = /(áudio|audio|fala|voz)/i.test(text);

                if (querAudio && chatRes.data.audioUrl) {
                  const audioFile = path.resolve(__dirname, '../../data/audio', path.basename(chatRes.data.audioUrl));
                  await sendVoice(chatId, audioFile, `🦅 Corvo Agente`);
                } else {
                  await sendMessage(chatId, `🦅 <b>Corvo Agente</b>:\n\n${chatRes.data.reply}`);
                }
              }
            } catch (gwErr) {
              await sendMessage(chatId, `🦅 [ERRO NO GATEWAY]: ${gwErr.message}`);
            }
          }
        }
      }
    } catch (err) {
      if (!err.message.includes('timeout')) {
        console.warn('[TG WARN] Falha no polling:', err.message);
      }
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

function stopPolling() {
  console.log('[TELEGRAM] Parando polling...');
  isRunning = false;
}

if (require.main === module) {
  startPolling();
}

module.exports = { startPolling, stopPolling, sendMessage, sendVoice };
