const fs = require('fs');
const p = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/channels/corvo_telegram.js';
let content = fs.readFileSync(p, 'utf8');

content = content.replace(/\r\n/g, '\n');

const regex = /if\s*\(statusMsg\s*&&\s*statusMsg\.message_id\)\s*\{\s*await\s*deleteMessage\(chatId,\s*statusMsg\.message_id\);\s*\}/;

if (regex.test(content)) {
  const replacement = `if (statusMsg && statusMsg.message_id) {
                  const tagIcon = missionRes.success ? '✅' : '🛑';
                  const desc = missionRes.success ? 'Missão concluída com sucesso!' : (missionRes.error || 'Missão interrompida.');
                  await editMessage(chatId, statusMsg.message_id, \`<b>\${tagIcon} Status:</b> <i>\${desc}</i>\`);
                }`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(p, content, 'utf8');
  console.log('[OK] Telegram live-message atualizado com sucesso!');
} else {
  console.log('[WARN] Regex não encontrou no telegram');
}
