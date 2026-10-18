/**
 * 🦅 CORVO AGENTE MOBILE - CLIENTE WHATSAPP INTEGRADO AO GATEWAY (COM FILA OFFLINE & ÁUDIO REALISTA)
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadMediaMessage } = require('@whiskeysockets/baileys');
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
const GATEWAY_AUTH_TOKEN = process.env.GATEWAY_AUTH_TOKEN || '';
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
      const headers = {};
      if (GATEWAY_AUTH_TOKEN) headers['Authorization'] = `Bearer ${GATEWAY_AUTH_TOKEN}`;

      for (const item of pendentes) {
        try {
          await axios.post(`${GATEWAY_URL}/subagent/spawn`, {
            prompt: item.prompt,
            context: { jid: item.jid, origem: 'offline_queue' }
          }, { headers, timeout: 10000 });
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
    let text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    let filePayload = null;
    let isMedia = false;

    // Processamento Multimodal (Fotos, Áudios de Voz, Vídeos e Documentos no WhatsApp)
    try {
      if (m.message.imageMessage) {
        text = text || m.message.imageMessage.caption || 'Analise esta imagem/foto recebida.';
        const buffer = await downloadMediaMessage(m, 'buffer', {});
        filePayload = {
          data: buffer.toString('base64'),
          type: m.message.imageMessage.mimetype || 'image/jpeg',
          name: `img_${Date.now()}.jpg`
        };
        isMedia = true;
      } else if (m.message.audioMessage) {
        text = text || 'Ouça e responda a este áudio de voz recebido.';
        const buffer = await downloadMediaMessage(m, 'buffer', {});
        filePayload = {
          data: buffer.toString('base64'),
          type: m.message.audioMessage.mimetype || 'audio/ogg; codecs=opus',
          name: `audio_${Date.now()}.ogg`
        };
        isMedia = true;
      } else if (m.message.videoMessage) {
        text = text || m.message.videoMessage.caption || 'Analise este vídeo recebido.';
        const buffer = await downloadMediaMessage(m, 'buffer', {});
        filePayload = {
          data: buffer.toString('base64'),
          type: m.message.videoMessage.mimetype || 'video/mp4',
          name: `video_${Date.now()}.mp4`
        };
        isMedia = true;
      } else if (m.message.documentMessage) {
        text = text || m.message.documentMessage.caption || `Analise este documento (${m.message.documentMessage.fileName || 'arquivo'}).`;
        const buffer = await downloadMediaMessage(m, 'buffer', {});
        filePayload = {
          data: buffer.toString('base64'),
          type: m.message.documentMessage.mimetype || 'application/octet-stream',
          name: m.message.documentMessage.fileName || 'documento'
        };
        isMedia = true;
      }
    } catch (mediaErr) {
      console.warn('[WA MEDIA DOWNLOAD WARN]', mediaErr.message);
    }

    if (!text && !filePayload) return;

    const isGroup = jid.endsWith('@g.us');
    const myJid = sock.user?.id ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : '';
    const myPhone = sock.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : '';
    const sender = m.key.participant || jid;
    const isMarcos = sender.includes(MARCOS_PHONE);

    // Regra anti-ruído: Em grupos, silêncio absoluto se estiver respondendo a outro bot ou se não for marcado
    if (isGroup) {
      const contextInfo = m.message.extendedTextMessage?.contextInfo;
      const mentionedJid = contextInfo?.mentionedJid || [];
      const quotedParticipant = contextInfo?.participant || '';

      const isMentioned = (myJid && mentionedJid.includes(myJid)) ||
                          (myPhone && text.includes(myPhone)) ||
                          (new RegExp(`@${myPhone}`, 'i').test(text));

      const isReplyingToMe = quotedParticipant && (quotedParticipant === myJid || (myPhone && quotedParticipant.includes(myPhone)));

      // Se não foi marcada diretamente e não é resposta ao bot, FICA EM SILÊNCIO
      if (!isMentioned && !isReplyingToMe) {
        return;
      }
    }

    console.log(`[MSG RECEBIDA] De ${jid} (${isMarcos ? 'MARCOS [DONO]' : 'USUÁRIO'}) [${isMedia ? 'MÍDIA' : 'TEXTO'}]: ${text.slice(0, 80)}`);

    // Reage com emoji dinâmico à mensagem recebida
    const emojis = ['🦅', '🔥', '⚡', '💀', '🧠', '🖤', '🎯', '👑', '😈', '🚀', '👀', '🫡', '💯', '👾', '😎', '✍️'];
    const chosenEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    try {
      await sock.sendMessage(jid, { react: { text: chosenEmoji, key: m.key } });
    } catch (e) {}

    // Indicador de "digitando..." contínuo no WhatsApp
    await sock.sendPresenceUpdate('composing', jid);
    const typingTimer = setInterval(async () => {
      try { await sock.sendPresenceUpdate('composing', jid); } catch (e) {}
    }, 4500);

    const querAudio = /(manda|envia|fala|grava|mande).*([áa]udio|voz)/i.test(text);
    const isMission = !filePayload && /^(?:crie|criar|fa[çc]a|fazer|desenvolva|desenvolver|abra|abrir|navegue|navegar|baixe|baixar|download|instale|instalar|escaneie|escanear|scan|recon|audite|auditar|procure|buscar|busque|rode|rodar|execute|executar|edite|editar|programe|programar|suba|subir|monte|montar)\b/i.test(text.trim());

    const headers = {};
    if (GATEWAY_AUTH_TOKEN) headers['Authorization'] = `Bearer ${GATEWAY_AUTH_TOKEN}`;

    try {
      if (isMission) {
        // Envia mensagem de estado ao vivo que vai sendo editada (estilo OpenClaw)
        const statusMsg = await sock.sendMessage(jid, {
          text: '⏳ *[Iniciando...]* Analisando objetivo e preparando arsenal...'
        });

        const autonomousLoop = require('../core/corvo_loop');
        const missionId = `mission_${Date.now()}`;

        const missionRes = await autonomousLoop.runAutonomousMission(missionId, text, {
          maxSteps: 25,
          onProgress: async ({ step, maxSteps, description }) => {
            try {
              await sock.sendPresenceUpdate('composing', jid);
              if (statusMsg && statusMsg.key) {
                await sock.sendMessage(jid, {
                  text: `⏳ *[Passo ${step}/${maxSteps}]* ${description}`,
                  edit: statusMsg.key
                });
              }
            } catch (pErr) {}
          }
        });

        clearInterval(typingTimer);

        // Apaga a mensagem de estado para manter o chat limpo
        if (statusMsg && statusMsg.key) {
          try {
            await sock.sendMessage(jid, { delete: statusMsg.key });
          } catch (delErr) {}
        }

        const finalReport = missionRes.report || (missionRes.success ? 'Missão concluída com sucesso!' : `Missão encerrada: ${missionRes.error}`);

        // Envia resposta solta (sem reply) no WhatsApp
        await sock.sendMessage(jid, { text: `🦅 *CORVO AGENTE MOBILE*:\n\n${finalReport}` });

        // Se pediu áudio, gera a voz ultra-realista e envia como mensagem de voz nativa (PTT)
        if (querAudio) {
          try {
            const voiceRes = await axios.post(`${GATEWAY_URL}/voice/generate`, { text: finalReport.substring(0, 400) }, { headers, timeout: 35000 });
            if (voiceRes.data && voiceRes.data.filePath && fs.existsSync(voiceRes.data.filePath)) {
              const audioBuffer = fs.readFileSync(voiceRes.data.filePath);
              await sock.sendMessage(jid, {
                audio: audioBuffer,
                mimetype: 'audio/mp4',
                ptt: true
              });
            }
          } catch (vErr) {
            console.error('[VOICE SEND ERROR]', vErr.message);
          }
        }

        // Se houver screenshot capturado durante a missão, envia a foto
        const shotsDir = path.resolve(__dirname, '../../data/browser_shots');
        if (fs.existsSync(shotsDir)) {
          const files = fs.readdirSync(shotsDir).map(f => ({
            path: path.join(shotsDir, f),
            time: fs.statSync(path.join(shotsDir, f)).mtimeMs
          })).sort((a, b) => b.time - a.time);

          if (files.length > 0 && (Date.now() - files[0].time) < 60000) {
            const shotBuffer = fs.readFileSync(files[0].path);
            await sock.sendMessage(jid, {
              image: shotBuffer,
              caption: '📸 Captura visual da missão'
            });
          }
        }

      } else {
        // Envia direto ao Gateway /chat para resposta instantânea e multimodal
        const chatRes = await axios.post(`${GATEWAY_URL}/chat`, {
          message: text,
          file: filePayload,
          sender: isMarcos ? 'Marcos (DONO)' : (m.pushName || 'Usuário'),
          isDono: isMarcos
        }, { headers, timeout: 60000 });

        clearInterval(typingTimer);

        if (chatRes.data && chatRes.data.reply) {
          const resposta = chatRes.data.reply;

          // Envia mensagem solta (sem reply) no WhatsApp
          await sock.sendMessage(jid, { text: `🦅 *CORVO AGENTE MOBILE*:\n\n${resposta}` });

          // Se pediu áudio ou se o gateway gerou áudio
          if (querAudio || chatRes.data.audioUrl) {
            const audioFileName = path.basename(chatRes.data.audioUrl || '');
            const audioFile = path.resolve(__dirname, '../../data/audio', audioFileName);
            if (fs.existsSync(audioFile)) {
              const audioBuffer = fs.readFileSync(audioFile);
              await sock.sendMessage(jid, {
                audio: audioBuffer,
                mimetype: 'audio/mp4',
                ptt: true // Envia como áudio gravado nativo no WhatsApp
              });
            }
          }
        }
      }
    } catch (error) {
      clearInterval(typingTimer);
      console.warn('[OFFLINE WARNING] Gateway indisponível ou sem internet. Salvando na fila offline do SQLite...');
      db.addOfflineQueue(jid, text);
      await sock.sendMessage(jid, { text: `[MODO OFFLINE] Sem conexão com o Daemon/Internet. Sua ordem foi salva na fila SQLite e será processada automaticamente assim que a conexão for restabelecida.` });
    }
  });

  rl.close();
}

startWhatsApp();
