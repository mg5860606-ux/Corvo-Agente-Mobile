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
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3333';
const GATEWAY_AUTH_TOKEN = process.env.GATEWAY_AUTH_TOKEN || '';
const MARCOS_TG_ID = String(process.env.MARCOS_TELEGRAM_ID || process.env.OWNER_TELEGRAM_ID || '8273924319');

let isRunning = false;
let lastUpdateId = 0;
let botUsername = '';

async function getMe() {
  try {
    const res = await axios.get(`${API_URL}/getMe`);
    if (res.data && res.data.ok && res.data.result) {
      botUsername = res.data.result.username || '';
      console.log(`[TELEGRAM] Bot conectado: @${botUsername} (${res.data.result.first_name})`);
    }
  } catch (err) {
    console.error('[TG ERROR] Falha ao obter dados do bot (getMe):', err.message);
  }
}

async function sendMessage(chatId, text, replyToMessageId = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }
    const res = await axios.post(`${API_URL}/sendMessage`, payload);
    return res.data?.result || null;
  } catch (err) {
    console.error('[TG ERROR] Falha ao enviar mensagem:', err.message);
    return null;
  }
}

async function editMessage(chatId, messageId, text) {
  try {
    await axios.post(`${API_URL}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML'
    }, { timeout: 10000 });
  } catch (err) {
    // Silencia erros de texto idêntico no Telegram
  }
}

async function deleteMessage(chatId, messageId) {
  try {
    await axios.post(`${API_URL}/deleteMessage`, {
      chat_id: chatId,
      message_id: messageId
    }, { timeout: 10000 });
  } catch (err) {}
}

async function sendChatAction(chatId, action = 'typing') {
  try {
    await axios.post(`${API_URL}/sendChatAction`, {
      chat_id: chatId,
      action: action
    }, { timeout: 8000 });
  } catch (err) {}
}

async function reactToMessage(chatId, messageId) {
  const emojis = ['🔥', '⚡', '👍', '👏', '😁', '🤔', '🤯', '😱', '🎉', '🤩', '👌', '💯', '✍️', '🫡', '😎', '👾', '👀', '🤝'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  try {
    await axios.post(`${API_URL}/setMessageReaction`, {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: 'emoji', emoji }]
    }, { timeout: 8000 });
  } catch (err) {}
  return emoji;
}

async function sendPhoto(chatId, photoPath, caption = '', replyToMessageId = null) {
  try {
    if (!fs.existsSync(photoPath)) return;
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', fs.createReadStream(photoPath));
    if (caption) form.append('caption', caption);
    if (replyToMessageId) form.append('reply_to_message_id', replyToMessageId);
    await axios.post(`${API_URL}/sendPhoto`, form, {
      headers: form.getHeaders(),
      timeout: 45000
    });
  } catch (err) {
    console.error('[TG ERROR] Falha ao enviar foto:', err.message);
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

async function downloadTelegramFile(fileId) {
  try {
    const res = await axios.get(`${API_URL}/getFile?file_id=${fileId}`, { timeout: 15000 });
    if (res.data && res.data.ok && res.data.result?.file_path) {
      const filePath = res.data.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
      const fileRes = await axios.get(downloadUrl, { responseType: 'arraybuffer', timeout: 45000 });
      const buffer = Buffer.from(fileRes.data);
      return {
        buffer,
        base64: buffer.toString('base64'),
        filePath,
        fileName: path.basename(filePath)
      };
    }
  } catch (err) {
    console.error('[TG FILE DOWNLOAD ERROR]', err.message);
  }
  return null;
}

async function startPolling() {
  if (!BOT_TOKEN) {
    console.warn('[TELEGRAM] TELEGRAM_BOT_TOKEN não configurado no .env. Canal Telegram em espera.');
    return;
  }
  await getMe();
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

          const msg = update.message;
          if (!msg) continue;

          let text = (msg.text || msg.caption || '').trim();
          let filePayload = null;
          let isMedia = false;

          // Processamento Multimodal (Fotos, Voz, Áudios, Vídeos e Documentos)
          try {
            if (msg.photo && msg.photo.length > 0) {
              const photo = msg.photo[msg.photo.length - 1]; // maior resolução
              const dl = await downloadTelegramFile(photo.file_id);
              if (dl) {
                filePayload = { data: dl.base64, type: 'image/jpeg', name: dl.fileName };
                isMedia = true;
                if (!text) text = 'Analise esta foto/imagem com precisão e me informe os detalhes.';
              }
            } else if (msg.voice) {
              const dl = await downloadTelegramFile(msg.voice.file_id);
              if (dl) {
                filePayload = { data: dl.base64, type: msg.voice.mime_type || 'audio/ogg', name: 'voice_note.ogg' };
                isMedia = true;
                if (!text) text = 'Ouça este áudio de voz, transcreva e responda à ordem ou mensagem.';
              }
            } else if (msg.audio) {
              const dl = await downloadTelegramFile(msg.audio.file_id);
              if (dl) {
                filePayload = { data: dl.base64, type: msg.audio.mime_type || 'audio/mpeg', name: msg.audio.file_name || 'audio.mp3' };
                isMedia = true;
                if (!text) text = 'Analise o áudio enviado e responda.';
              }
            } else if (msg.video) {
              const dl = await downloadTelegramFile(msg.video.file_id);
              if (dl) {
                filePayload = { data: dl.base64, type: msg.video.mime_type || 'video/mp4', name: msg.video.file_name || 'video.mp4' };
                isMedia = true;
                if (!text) text = 'Analise este vídeo e me diga o que está acontecendo.';
              }
            } else if (msg.document) {
              const mime = msg.document.mime_type || '';
              if (mime.startsWith('image/') || mime.startsWith('audio/') || mime.startsWith('video/') || mime === 'application/pdf') {
                const dl = await downloadTelegramFile(msg.document.file_id);
                if (dl) {
                  filePayload = { data: dl.base64, type: mime, name: msg.document.file_name || 'documento' };
                  isMedia = true;
                  if (!text) text = `Analise este arquivo (${msg.document.file_name || 'anexo'}).`;
                }
              }
            }
          } catch (dlErr) {
            console.warn('[TG MEDIA WARN] Falha ao baixar mídia:', dlErr.message);
          }

          if (text || filePayload) {
            const senderId = String(msg.from.id);
            const chatId = msg.chat.id;
            const chatType = msg.chat.type; // 'private', 'group', 'supergroup', 'channel'
            const isDono = senderId === MARCOS_TG_ID;

            // Se for grupo/supergrupo, só responde se for chamada explicitamente
            if (chatType === 'group' || chatType === 'supergroup') {
              let isMentioned = false;

              // Verifica se foi mencionado por username (@RamOfficialBot)
              if (botUsername && text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) {
                isMentioned = true;
              }

              // Verifica menções por nome configurado/chamados comuns ('lani', 'corvo')
              if (/\b(lani|corvo)\b/i.test(text)) {
                isMentioned = true;
              }

              // Verifica se é reply para uma mensagem enviada pelo próprio bot
              if (msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.is_bot) {
                if (botUsername && msg.reply_to_message.from.username && msg.reply_to_message.from.username.toLowerCase() === botUsername.toLowerCase()) {
                  isMentioned = true;
                }
              }

              if (!isMentioned) {
                // Não foi chamada no grupo: ignora e fica em silêncio
                continue;
              }
            }

            console.log(`[TG MSG] De ${senderId} (${msg.from.first_name}) [${isMedia ? 'MÍDIA' : 'TEXTO'}]: ${text.slice(0, 80)}`);

            // Reação dinâmica com emoji na mensagem recebida (estilo OpenClaw)
            await reactToMessage(chatId, msg.message_id);

            // Inicia indicador de digitação contínuo
            await sendChatAction(chatId, 'typing');
            const typingTimer = setInterval(() => sendChatAction(chatId, 'typing'), 4500);

            const querAudio = /(áudio|audio|fala|voz)/i.test(text);
            const isMission = !filePayload && /^(?:crie|criar|fa[çc]a|fazer|desenvolva|desenvolver|abra|abrir|navegue|navegar|baixe|baixar|download|instale|instalar|escaneie|escanear|scan|recon|audite|auditar|procure|buscar|busque|rode|rodar|execute|executar|edite|editar|programe|programar|suba|subir|monte|montar)\b/i.test(text.trim());

            try {
              if (isMission) {
                // Mensagem de estado ao vivo que vai sendo editada (estilo OpenClaw)
                const statusMsg = await sendMessage(
                  chatId,
                  '⏳ <i>[Iniciando...]</i> Analisando objetivo e preparando arsenal...',
                  (isDono && chatType === 'private') ? null : msg.message_id
                );

                const autonomousLoop = require('../core/corvo_loop');
                const missionId = `mission_${Date.now()}`;

                const missionRes = await autonomousLoop.runAutonomousMission(missionId, text, {
                  maxSteps: 25,
                  onProgress: async ({ step, maxSteps, description }) => {
                    await sendChatAction(chatId, 'typing');
                    if (statusMsg && statusMsg.message_id) {
                      await editMessage(chatId, statusMsg.message_id, `⏳ <b>[Passo ${step}/${maxSteps}]</b> ${description}`);
                    }
                  }
                });

                clearInterval(typingTimer);

                // Apaga a mensagem de estado para não poluir o chat
                if (statusMsg && statusMsg.message_id) {
                  await deleteMessage(chatId, statusMsg.message_id);
                }

                const finalReport = missionRes.report || (missionRes.success ? 'Missão concluída com sucesso!' : `Missão encerrada: ${missionRes.error}`);
                const replyId = (isDono && chatType === 'private') ? null : msg.message_id;

                if (querAudio) {
                  const voiceEngine = require('../core/corvo_voice');
                  const vRes = await voiceEngine.gerarAudio(finalReport.slice(0, 350));
                  if (vRes.success) {
                    await sendVoice(chatId, vRes.filePath, `🦅 Corvo Agente`);
                  } else {
                    await sendMessage(chatId, `🦅 <b>Corvo Agente</b>:\n\n${finalReport}`, replyId);
                  }
                } else {
                  await sendMessage(chatId, `🦅 <b>Corvo Agente</b>:\n\n${finalReport}`, replyId);
                }

                // Se houver screenshot capturado durante a missão, envia a foto
                const shotsDir = path.resolve(__dirname, '../../data/browser_shots');
                if (fs.existsSync(shotsDir)) {
                  const files = fs.readdirSync(shotsDir).map(f => ({
                    path: path.join(shotsDir, f),
                    time: fs.statSync(path.join(shotsDir, f)).mtimeMs
                  })).sort((a, b) => b.time - a.time);

                  if (files.length > 0 && (Date.now() - files[0].time) < 60000) {
                    await sendPhoto(chatId, files[0].path, '📸 Captura visual da missão', replyId);
                  }
                }

              } else {
                // Mensagem conversacional / análise de mídia
                const headers = {};
                if (GATEWAY_AUTH_TOKEN) {
                  headers['Authorization'] = `Bearer ${GATEWAY_AUTH_TOKEN}`;
                }

                const chatRes = await axios.post(`${GATEWAY_URL}/chat`, {
                  message: text,
                  file: filePayload,
                  sender: isDono ? 'Marcos (DONO)' : (msg.from.first_name || 'Usuário'),
                  isDono: isDono
                }, { headers });

                clearInterval(typingTimer);

                if (chatRes.data && chatRes.data.reply) {
                  if (querAudio && chatRes.data.audioUrl) {
                    const audioFile = path.resolve(__dirname, '../../data/audio', path.basename(chatRes.data.audioUrl));
                    await sendVoice(chatId, audioFile, `🦅 Corvo Agente`);
                  } else {
                    const replyId = (isDono && chatType === 'private') ? null : msg.message_id;
                    await sendMessage(chatId, `🦅 <b>Corvo Agente</b>:\n\n${chatRes.data.reply}`, replyId);
                  }
                }
              }
            } catch (err) {
              clearInterval(typingTimer);
              const replyId = (isDono && chatType === 'private') ? null : msg.message_id;
              await sendMessage(chatId, `🦅 [ERRO]: ${err.message}`, replyId);
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
