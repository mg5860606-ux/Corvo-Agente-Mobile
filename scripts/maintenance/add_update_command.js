const fs = require('fs');

const tgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let content = fs.readFileSync(tgPath, 'utf8');

// Vamos adicionar o comando /atualizar ou /update logo após os comandos de /status ou /restart
const targetSnippet = `            // 3. Comando /restart ou /reiniciar
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

const updateCommand = `            // 3. Comando /restart ou /reiniciar
            if (/^\\/(?:restart|reiniciar)\\b/i.test(cleanText)) {
              if (!isDono) {
                await sendMessage(chatId, '❌ Apenas o Dono tem autoridade para reiniciar o núcleo.');
                continue;
              }
              const replyId = (isDono && chatType === 'private') ? null : msg.message_id;
              await sendMessage(chatId, \`🔄 <b>Reiniciando</b>: Reiniciando serviços... voltando em instantes.\`, replyId);
              setTimeout(() => process.exit(0), 1000);
              continue;
            }

            // 3.1 Comando /atualizar ou /update (Auto-Update via Git)
            if (/^\\/(?:atualizar|update|upgrade)\\b/i.test(cleanText)) {
              if (!isDono) {
                await sendMessage(chatId, '❌ Apenas o Dono tem permissão para atualizar o agente.');
                continue;
              }
              const replyId = (isDono && chatType === 'private') ? null : msg.message_id;
              await sendMessage(chatId, '⚡ <b>Atualizando...</b> Buscando novidades no GitHub e aplicando correções.', replyId);
              try {
                const { execSync } = require('child_process');
                const repoDir = path.resolve(__dirname, '../../');
                const gitRes = execSync('git pull origin main', { cwd: repoDir, encoding: 'utf8', timeout: 30000 });
                await sendMessage(chatId, \`✅ <b>Atualizado com sucesso!</b>\\n\\n<code>\${gitRes.trim().slice(0, 300)}</code>\\n\\nReiniciando o sistema para carregar as alterações...\`, replyId);
                setTimeout(() => process.exit(0), 1500);
              } catch (gitErr) {
                await sendMessage(chatId, \`⚠️ <b>Erro ao atualizar:</b>\\n<code>\${gitErr.message.slice(0, 300)}</code>\`, replyId);
              }
              continue;
            }`;

if (content.includes(targetSnippet)) {
  content = content.replace(targetSnippet, updateCommand);
  fs.writeFileSync(tgPath, content, 'utf8');
  console.log('Comando /atualizar implementado com sucesso!');
} else {
  console.error('Snippet alvo não encontrado');
}
