const fs = require('fs');

const tgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let c = fs.readFileSync(p = tgPath, 'utf8');

// Limpar duplicação do restart e deixar /atualizar e /restart tinindo
const restartClean = `            // 3. Comando /restart ou /reiniciar
            if (/^\\/(?:restart|reiniciar)\\b/i.test(cleanText)) {
              if (!isDono) {
                await sendMessage(chatId, '❌ Apenas o Dono tem autoridade para reiniciar.', msg.message_id);
                continue;
              }
              const replyId = (isDono && chatType === 'private') ? null : msg.message_id;
              await sendMessage(chatId, \`🔄 <b>Reiniciando</b>: Reiniciando serviços do agente...\`, replyId);
              setTimeout(() => process.exit(0), 1000);
              continue;
            }

            // 3.1 Comando /atualizar ou /update (Auto-Update pelo Telegram sem mexer no Termux)
            if (/^\\/(?:atualizar|update|upgrade)\\b/i.test(cleanText)) {
              if (!isDono) {
                await sendMessage(chatId, '❌ Apenas o Dono tem autoridade para atualizar.', msg.message_id);
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

// Remover trecho duplicado
const duplicatedRegex = /\/\/\s*3\. Comando \/restart[\s\S]*?\/\/ 4\. Comando \/status/;
if (duplicatedRegex.test(c)) {
  c = c.replace(duplicatedRegex, restartClean + '\n\n            // 4. Comando /status');
  fs.writeFileSync(p, c, 'utf8');
  console.log('corvo_telegram.js ajustado perfeitamente!');
} else {
  console.error('Regex de restart duplicado nao bateu');
}
