const fs = require('fs');

// 1. CORRIGIR NO TELEGRAM: COMANDOS / SEMPRE PASSAM MESMO EM GRUPO SEM @
const tgPath = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/channels/corvo_telegram.js';
let tg = fs.readFileSync(tgPath, 'utf8');

const oldCheckTg = `            // Se for grupo/supergrupo, só responde se for marcada com @ ou reply direto
            if (chatType === 'group' || chatType === 'supergroup') {
              let isMentioned = false;

              // 1. Mencionado com @ (@botUsername)
              const lower = text.toLowerCase();
              if (botUsername && lower.includes('@' + botUsername.toLowerCase())) {
                isMentioned = true;
              }

              // 2. Reply direto para uma mensagem do bot
              if (msg.reply_to_message?.from?.username && botUsername && msg.reply_to_message.from.username.toLowerCase() === botUsername.toLowerCase()) {
                isMentioned = true;
              }

              if (!isMentioned) {
                // Nenhuma menção direta com @ nem reply: silêncio absoluto no grupo
                continue;
              }
            }`;

const newCheckTg = `            // Se for grupo/supergrupo, comandos com barra (tipo /atualizar, /stop, /reset, /status) SEMPRE são reconhecidos!
            const isCommand = /^\\/(?:atualizar|update|upgrade|stop|parar|cancelar|reset|clear|novo|limpar|restart|reiniciar|status|info|sistema)\\b/i.test(cleanText);

            if ((chatType === 'group' || chatType === 'supergroup') && !isCommand) {
              let isMentioned = false;

              // 1. Mencionado com @ (@botUsername)
              const lower = text.toLowerCase();
              if (botUsername && lower.includes('@' + botUsername.toLowerCase())) {
                isMentioned = true;
              }

              // 2. Reply direto para uma mensagem do bot
              if (msg.reply_to_message?.from?.username && botUsername && msg.reply_to_message.from.username.toLowerCase() === botUsername.toLowerCase()) {
                isMentioned = true;
              }

              if (!isMentioned) {
                // Nenhuma menção direta nem reply e não é comando: silêncio no grupo
                continue;
              }
            }`;

tg = tg.replace(oldCheckTg, newCheckTg);
fs.writeFileSync(tgPath, tg, 'utf8');

// 2. CORRIGIR NO WHATSAPP: COMANDOS / SEMPRE PASSAM MESMO EM GRUPO SEM @
const waPath = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/channels/corvo_whatsapp.js';
let wa = fs.readFileSync(waPath, 'utf8');

const oldCheckWa = `    // Regra anti-ruído: Em grupos, silêncio absoluto se estiver respondendo a outro bot ou se não for marcado
    if (isGroup) {
      const contextInfo = m.message.extendedTextMessage?.contextInfo;
      const mentionedJid = contextInfo?.mentionedJid || [];
      const quotedParticipant = contextInfo?.participant || '';

      const isMentioned = (myJid && mentionedJid.includes(myJid)) ||
                          (myPhone && text.includes(myPhone)) ||
                          (new RegExp(\`@\${myPhone}\`, 'i').test(text));

      const isReplyingToMe = quotedParticipant && (quotedParticipant === myJid || (myPhone && quotedParticipant.includes(myPhone)));

      // Se não foi marcada diretamente e não é resposta ao bot, FICA EM SILÊNCIO
      if (!isMentioned && !isReplyingToMe) {
        return;
      }
    }`;

const newCheckWa = `    // Comandos de sistema (/atualizar, /stop, /reset, /status) passam SEMPRE mesmo em grupo sem marcar!
    const isCommand = /^\\/(?:atualizar|update|upgrade|stop|parar|cancelar|reset|clear|novo|limpar|restart|reiniciar|status|info|sistema)\\b/i.test(cleanText);

    if (isGroup && !isCommand) {
      const contextInfo = m.message.extendedTextMessage?.contextInfo;
      const mentionedJid = contextInfo?.mentionedJid || [];
      const quotedParticipant = contextInfo?.participant || '';

      const isMentioned = (myJid && mentionedJid.includes(myJid)) ||
                          (myPhone && text.includes(myPhone)) ||
                          (new RegExp(\`@\${myPhone}\`, 'i').test(text));

      const isReplyingToMe = quotedParticipant && (quotedParticipant === myJid || (myPhone && quotedParticipant.includes(myPhone)));

      if (!isMentioned && !isReplyingToMe) {
        return;
      }
    }`;

wa = wa.replace(oldCheckWa, newCheckWa);
fs.writeFileSync(waPath, wa, 'utf8');

console.log('[OK] Comandos soltos com barra liberados para responder em GRUPOS sem precisar de @ nem reply!');
