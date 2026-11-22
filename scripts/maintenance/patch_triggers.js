const fs = require('fs');

const tgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let tg = fs.readFileSync(tgPath, 'utf8');

// Modificar regras de permissão e trigger:
// 1. No privado (chatType === 'private'), se não for o dono (senderId !== MARCOS_TG_ID), não responde ou avisa que é exclusivo do dono.
// Marcos pediu: "no pv ele deve responder so o id do dono dele" -> if (chatType === 'private' && !isDono) { return / ignore; }
// 2. Em grupo/supergrupo: só responde quando @mencionar ele (@username) OU quando responderem à mensagem dele por reply! Removendo ativação por palavra avulsa.

const oldBlock = `            // Se for grupo/supergrupo, só responde se for chamada explicitamente
            if (chatType === 'group' || chatType === 'supergroup') {
              let isMentioned = false;

              // Verifica se foi mencionado por username (@RamOfficialBot)
              const lower = text.toLowerCase();
              if (botUsername && lower.includes('@' + botUsername.toLowerCase())) {
                isMentioned = true;
              }
              // Responde se chamarem pelo nome mesmo sem @ (Kronos, Índia, Corvo, Japa)
              if (/\\b(kronos|índia|india)\\b/i.test(text)) {
                isMentioned = true;
              }

              // Verifica se é reply para uma mensagem enviada pelo próprio bot
              if (msg.reply_to_message?.from?.username && botUsername && msg.reply_to_message.from.username.toLowerCase() === botUsername.toLowerCase()) {
                isMentioned = true;
              }

              if (!isMentioned) {
                // Não foi chamada no grupo: ignora e fica em silêncio
                continue;
              }
            }`;

const newBlock = `            // Trava de Privado: no PV só responde se for o dono (ID configurado)
            if (chatType === 'private' && !isDono) {
              console.log(\`[TG SILENCE PV] Mensagem no privado de usuário não autorizado (\${senderId}). Ignorando.\`);
              continue;
            }

            // Se for grupo/supergrupo, só responde se for marcada com @ ou reply direto
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

if (tg.includes(oldBlock)) {
  tg = tg.replace(oldBlock, newBlock);
  fs.writeFileSync(tgPath, tg, 'utf8');
  console.log('Regras atualizadas com sucesso!');
} else {
  console.log('Bloco antigo nao encontrado exatamente, fazendo ajuste cirúrgico.');
  // Procura por "Se for grupo/supergrupo"
  const startIdx = tg.indexOf("// Se for grupo/supergrupo");
  const endIdx = tg.indexOf("console.log(`[TG MSG] De");
  if (startIdx !== -1 && endIdx !== -1) {
    tg = tg.slice(0, startIdx) + newBlock + "\n\n            " + tg.slice(endIdx);
    fs.writeFileSync(tgPath, tg, 'utf8');
    console.log('Substituído por índice com sucesso!');
  }
}
