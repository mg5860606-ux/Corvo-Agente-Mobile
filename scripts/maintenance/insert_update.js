const fs = require('fs');

const tgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let content = fs.readFileSync(tgPath, 'utf8');

// Vamos adicionar o comando /atualizar ou /update
// Procuramos pelo comando /restart:
const searchStr = `if (/^\\/(?:restart|reiniciar)\\b/i.test(cleanText)) {`;
const idx = content.indexOf(searchStr);

if (idx !== -1) {
  // Acha o fim do bloco do restart
  const endBlock = content.indexOf('continue;\n            }', idx);
  if (endBlock !== -1) {
    const insertPos = endBlock + 'continue;\n            }'.length;
    
    const updateSnippet = `\n\n            // 3.1 Comando /atualizar ou /update (Auto-Update pelo Telegram)
            if (/^\\/(?:atualizar|update|upgrade)\\b/i.test(cleanText)) {
              if (!isDono) {
                await sendMessage(chatId, '❌ Apenas o Dono tem permissão para atualizar o agente.', msg.message_id);
                continue;
              }
              const replyId = (isDono && chatType === 'private') ? null : msg.message_id;
              await sendMessage(chatId, '⚡ <b>Puxando atualização...</b> Buscando as últimas novidades no GitHub.', replyId);
              try {
                const { execSync } = require('child_process');
                const repoDir = path.resolve(__dirname, '../../');
                const gitRes = execSync('git pull origin main', { cwd: repoDir, encoding: 'utf8', timeout: 35000 });
                await sendMessage(chatId, \`✅ <b>Atualizado com sucesso!</b>\\n\\n<code>\${gitRes.trim().slice(0, 300)}</code>\\n\\n🔄 Reiniciando os motores para aplicar...\`, replyId);
                setTimeout(() => process.exit(0), 1500);
              } catch (gitErr) {
                await sendMessage(chatId, \`⚠️ <b>Erro ao atualizar:</b>\\n<code>\${gitErr.message.slice(0, 300)}</code>\`, replyId);
              }
              continue;
            }`;
    
    content = content.slice(0, insertPos) + updateSnippet + content.slice(insertPos);
    fs.writeFileSync(tgPath, content, 'utf8');
    console.log('Comando /atualizar inserido com sucesso!');
  } else {
    console.error('endBlock nao encontrado');
  }
} else {
  console.error('searchStr nao encontrado');
}
