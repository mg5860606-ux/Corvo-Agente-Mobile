const fs = require('fs');

const tgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let tg = fs.readFileSync(tgPath, 'utf8');

// O Marcos disse:
// "O id que a pessoa mandar no início pq agente vai ser pra produção"
// Na inicialização rápida (quick_setup.js), a pessoa informa:
// - GEMINI_API_KEY
// - TELEGRAM_BOT_TOKEN
// - OWNER_TELEGRAM_ID (Seu ID numérico do Telegram)
//
// No corvo_telegram.js estava:
// const MARCOS_TG_ID = String(process.env.MARCOS_TELEGRAM_ID || process.env.OWNER_TELEGRAM_ID || '8273924319');
// Se deixarmos fallback fixo para '8273924319', quando outra pessoa instalar em produção e colocar o ID dela como OWNER_TELEGRAM_ID, se OWNER_TELEGRAM_ID estiver definido, deve ser ESTRITAMENTE o OWNER_TELEGRAM_ID!
// E se não tiver OWNER_TELEGRAM_ID configurado, o primeiro ID que interagir no privado pode ser salvo como dono, OU o OWNER_TELEGRAM_ID do .env prevalece.
// Vamos deixar explícito:
// const OWNER_TG_ID = String(process.env.OWNER_TELEGRAM_ID || process.env.MARCOS_TELEGRAM_ID || '').trim();
//
// E no loop:
// const isDono = OWNER_TG_ID ? (senderId === OWNER_TG_ID) : (senderId === '8273924319');
// Se chatType === 'private':
// if (OWN_ID_CONFIGURADO && senderId !== OWN_ID_CONFIGURADO) -> não responde.

tg = tg.replace(
  "const MARCOS_TG_ID = String(process.env.MARCOS_TELEGRAM_ID || process.env.OWNER_TELEGRAM_ID || '8273924319');",
  "const OWNER_TG_ID = String(process.env.OWNER_TELEGRAM_ID || process.env.MARCOS_TELEGRAM_ID || '').trim();"
);

tg = tg.replace(
  "const isDono = senderId === MARCOS_TG_ID;",
  "const isDono = OWNER_TG_ID ? (senderId === OWNER_TG_ID) : (senderId === '8273924319');"
);

// Trava de privado:
const oldPvCheck = `            // Trava de Privado: no PV só responde se for o dono (ID configurado)
            if (chatType === 'private' && !isDono) {
              console.log(\`[TG SILENCE PV] Mensagem no privado de usuário não autorizado (\${senderId}). Ignorando.\`);
              continue;
            }`;

const newPvCheck = `            // Trava de Privado: no PV só responde se for o dono configurado no setup inicial
            if (chatType === 'private') {
              if (OWNER_TG_ID && senderId !== OWNER_TG_ID) {
                console.log(\`[TG SILENCE PV] Mensagem no privado de usuário não autorizado (\${senderId}). Ignorando.\`);
                continue;
              }
            }`;

if (tg.includes(oldPvCheck)) {
  tg = tg.replace(oldPvCheck, newPvCheck);
}

fs.writeFileSync(tgPath, tg, 'utf8');
console.log('corvo_telegram.js ajustado com sucesso para produção multi-usuário!');
