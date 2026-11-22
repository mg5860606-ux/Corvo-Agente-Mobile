const fs = require('fs');
const p = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let c = fs.readFileSync(p, 'utf8');

// Procurar o comando /restart
const oldBlock = `            // 3. Comando /restart ou /reiniciar
            if (/^\\/(?:restart|reiniciar)\\b/i.test(cleanText)) {
              if (!isDono) {
                await sendMessage(chatId, '❌ Apenas o Dono (Marcos) tem autoridade para reiniciar o núcleo.');
                continue;
              }
              const replyId = (isDono && chatType === 'private') ? null : msg.message_id;
              await sendMessage(chatId, \`🔄 <b>Reiniciando</b>: Reiniciando serviços do Corvo Agente Mobile... voltando em 2 segundos.\`, replyId);
              setTimeout(() => process.exit(0), 1000);
              continue;
            }`;

const newBlock = `            // 3. Comando /restart ou /reiniciar
            if (/^\\/(?:restart|reiniciar)\\b/i.test(cleanText)) {
              if (!isDono) {
                await sendMessage(chatId, '❌ Apenas o Dono tem autoridade para reiniciar.');
                continue;
              }
              const replyId = (isDono && chatType === 'private') ? null : msg.message_id;
              await sendMessage(chatId, \`🔄 <b>Reiniciando</b>: Reiniciando serviços do agente...\`, replyId);
              setTimeout(() => process.exit(0), 1000);
              continue;
            }

            // 3.1 Comando /atualizar ou /update (Auto-Update pelo Telegram)
            if (/^\\/(?:atualizar|update|upgrade)\\b/i.test(cleanText)) {
              if (!isDono) {
                await sendMessage(chatId, '❌ Apenas o Dono tem permissão para atualizar o agente.', msg.message_id);
                continue;
              }
              const replyId = (isDono && chatType === 'private') ? null : msg.message_id;
              await sendMessage(chatId, '⚡ <b>Puxando atualização...</b> Buscando novidades no GitHub.', replyId);
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

if (c.includes(oldBlock)) {
  c = c.replace(oldBlock, newBlock);
  fs.writeFileSync(p, c, 'utf8');
  console.log('Comando /atualizar adicionado!');
} else {
  // Regex replacement
  const r = /\/\/ 3\. Comando \/restart[\s\S]*?continue;\s*\}/;
  if (r.test(c)) {
    c = c.replace(r, newBlock);
    fs.writeFileSync(p, c, 'utf8');
    console.log('Substituído com regex com sucesso!');
  } else {
    console.error('Nao foi possivel encontrar o bloco do restart');
  }
}
