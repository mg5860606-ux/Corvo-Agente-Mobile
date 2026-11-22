const fs = require('fs');

// Vamos ler o corvo_gateway.js para garantir que o contexto das mensagens anteriores seja incluído na chamada de IA!
// No momento atual:
// Quando o usuário manda "Quanto?", o agente recebia apenas "Quanto?" sem as últimas mensagens de contexto!
// Por isso ele não sabia sobre o que era a pergunta!
const gwPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\core\\corvo_gateway.js';
let gwContent = fs.readFileSync(gwPath, 'utf8');

// Veja onde o /chat recupera o histórico:
// const groupContext = chatId ? brain.getGroupContext(chatId, 15) : '';
// Mas em callPollinationsAI só era passado promptText (apenas a mensagem atual!).
// Vamos fazer com que o promptText passado para a IA inclua o histórico recente da conversa!

console.log('Verificando /chat...');
