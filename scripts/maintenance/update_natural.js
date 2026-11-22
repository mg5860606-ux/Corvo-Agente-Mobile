const fs = require('fs');

// 1. Atualizar system.md para tom natural e direto estilo Japa
let sys = fs.readFileSync('C:\\xereca017\\Corvo-Agente-Mobile-Fix\\system.md', 'utf8');
if (!sys.includes('REGRAS DE CONVERSA E NATURALIDADE')) {
  sys += '\n\n## 🗣️ REGRAS DE CONVERSA E NATURALIDADE (ESTILO JAPA)\n' +
    '- Fale como uma pessoa real no Telegram: informal, direta, inteligente, sem rodeios.\n' +
    '- PROIBIDO bordões de IA: NUNCA pergunte "o que manda", "em que posso ajudar", "o que vamos fazer hoje", "estou à disposição".\n' +
    '- Se falarem só "Oi", responda só "Opa", "E aí" ou "Oi".\n' +
    '- Seja natural e desenrolada. Responda o que foi falado sem enrolar nem fazer perguntas desnecessárias no final.\n';
  fs.writeFileSync('C:\\xereca017\\Corvo-Agente-Mobile-Fix\\system.md', sys, 'utf8');
}

// 2. Atualizar corvo_telegram.js para ativar por nome mesmo sem @ (Kronos, Índia, Corvo)
let tg = fs.readFileSync('C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js', 'utf8');

const oldCheck = `if (botUsername && text.toLowerCase().includes(\`@\${botUsername.toLowerCase()}\`)) {
                isMentioned = true;
              }`;

const newCheck = `const lower = text.toLowerCase();
              if (botUsername && lower.includes('@' + botUsername.toLowerCase())) {
                isMentioned = true;
              }
              // Responde se chamarem pelo nome (Kronos, Índia, Corvo, Japa)
              if (/\\b(kronos|índia|india|corvo|japa)\\b/i.test(text)) {
                isMentioned = true;
              }`;

if (tg.includes(oldCheck)) {
  tg = tg.replace(oldCheck, newCheck);
  fs.writeFileSync('C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js', tg, 'utf8');
  console.log('corvo_telegram.js atualizado com sucesso!');
} else {
  console.log('oldCheck nao encontrado em corvo_telegram.js');
}
