const fs = require('fs');
const path = require('path');

// 1. corvo_telegram.js:
// - Adicionar comando /atualizar ou /update
// - Adicionar memória/contexto nas mensagens
const tgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let tg = fs.readFileSync(tgPath, 'utf8');

// Adicionar /atualizar no telegram
const updateCmd = `            // 3.1 Comando /atualizar ou /update (Auto-Update pelo Telegram)
            if (/^\\/(?:atualizar|update|upgrade)\\b/i.test(cleanText)) {
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

if (!tg.includes('// 3.1 Comando /atualizar')) {
  tg = tg.replace(/(if \(\/^\/(?:restart|reiniciar)\\b[\s\S]*?continue;\s*\})/, `$1\n\n${updateCmd}`);
}

fs.writeFileSync(tgPath, tg, 'utf8');

// 2. corvo_gateway.js:
// Garantir que a conversa mantenha contexto (histórico recente) para entender perguntas curtas tipo "Quanto?"
const gwPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\core\\corvo_gateway.js';
let gw = fs.readFileSync(gwPath, 'utf8');

// Em callGeminiDirect ou no /chat, garantir que groupContext seja repassado para a IA
// Procuramos onde chama callPollinationsAI(promptText, systemPromptText)
// e adicionamos o contexto anterior!
const oldCallInGateway = `    // Tentativa com provedores primários ou fallback automático resiliente
    try {
      if (PRIMARY_PROVIDER === 'gemini' || !openaiClient) {
        if (genAI) {
          reply = await callGeminiDirect(contents, systemPrompt);
        } else {
          reply = await callPollinationsAI(message || 'Oi', systemPrompt);
        }
      }
    } catch (primaryErr) {
      console.warn('[CHAT ERROR - USANDO FALLBACK UNIVERSAL]:', primaryErr.message);
      reply = await callPollinationsAI(message || 'Oi', systemPrompt);
    }`;

const newCallInGateway = `    // Contexto conversacional recente para não perder o fio da meada
    const fullConversation = groupContext ? \`Histórico recente da conversa:\\n\${groupContext}\\n\\nÚltima mensagem do usuário: "\${message}"\` : (message || 'Oi');

    // Tentativa com provedores primários ou fallback automático resiliente
    try {
      if (PRIMARY_PROVIDER === 'gemini' || !openaiClient) {
        if (genAI) {
          reply = await callGeminiDirect(contents, systemPrompt);
        } else {
          reply = await callPollinationsAI(fullConversation, systemPrompt);
        }
      }
    } catch (primaryErr) {
      console.warn('[CHAT ERROR - USANDO FALLBACK UNIVERSAL]:', primaryErr.message);
      reply = await callPollinationsAI(fullConversation, systemPrompt);
    }`;

if (gw.includes(oldCallInGateway)) {
  gw = gw.replace(oldCallInGateway, newCallInGateway);
  console.log('Contexto conversacional adicionado ao /chat!');
}

fs.writeFileSync(gwPath, gw, 'utf8');
console.log('Tudo gravado!');
