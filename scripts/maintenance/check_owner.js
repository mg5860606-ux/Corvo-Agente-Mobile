const fs = require('fs');

const tgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let tg = fs.readFileSync(tgPath, 'utf8');

// O Marcos disse: "O id que a pessoa mandar no início pq agente vai ser pra produção"
// No topo do corvo_telegram.js:
// const MARCOS_TG_ID = String(process.env.MARCOS_TELEGRAM_ID || process.env.OWNER_TELEGRAM_ID || '8273924319');
// Se for produção, o dono deve ser o ID que o usuário configurou no .env!
// Além disso, se o usuário não configurou ou se o dono é dinâmico:
// Se OWNER_TELEGRAM_ID ou MARCOS_TELEGRAM_ID foi passado no setup, usa ele.
// Se for vazio no .env, o primeiro usuário que mandar mensagem no PV pode ser considerado o dono ou usar o OWNER_TELEGRAM_ID configurado.

// Vamos checar como está definido:
console.log('MARCOS_TG_ID definition check');
