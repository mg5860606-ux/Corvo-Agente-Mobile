const fs = require('fs');
const p = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let c = fs.readFileSync(p, 'utf8');

// 1. O comando /atualizar ou /update
// 2. Além disso, vamos garantir que o histórico (contexto recente) seja mantido na memória da conversa
// para ela não perder o fio da meada ("Quanto?", "O que você acha?", etc.)

console.log('Verificando corvo_telegram.js...');
