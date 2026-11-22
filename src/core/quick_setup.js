const fs = require('fs');
const path = require('path');
const readline = require('readline');

const repoDir = path.resolve(__dirname, '../../');
const envPath = path.join(repoDir, '.env');
const envExamplePath = path.join(repoDir, '.env.example');

function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, (ans) => resolve(ans.trim())));
}

async function checkAndConfigureEnv() {
  let envContent = '';
  const exists = fs.existsSync(envPath);

  if (exists) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, 'utf8');
  }

  // Verifica se já tem chave válida do Gemini configurada (não vazia e não placeholder)
  const hasGeminiKey = envContent.includes('GEMINI_API_KEY=') &&
    !envContent.includes('GEMINI_API_KEY=sua_chave') &&
    !envContent.includes('GEMINI_API_KEY=***') &&
    /GEMINI_API_KEY=[A-Za-z0-9_\-\.]{15,}/.test(envContent);

  // Se já tiver chave configurada ou se não for terminal interativo, passa batido sem incomodar
  if (hasGeminiKey || !process.stdin.isTTY) {
    if (!exists && fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
    }
    return true;
  }

  console.log('\n======================================================');
  console.log('  🦅 BEM-VINDO AO CORVO / ÍNDIA AGENTE MOBILE');
  console.log('======================================================');
  console.log(' Configuração rápida inicial para rodar liso no celular:\n');
  console.log(' 1. Inteligência Grátis (Google AI Studio):');
  console.log('    👉 Pegue grátis em: https://aistudio.google.com/\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const geminiKey = await askQuestion(rl, ' 🔑 Cole sua chave GEMINI_API_KEY: ');

  console.log('\n 2. Bot do Telegram (Opcional - aperte Enter para pular):');
  console.log('    👉 Crie no @BotFather e pegue seu ID no @userinfobot\n');
  const tgToken = await askQuestion(rl, ' 🤖 Token do Bot Telegram (ou Enter): ');
  let tgOwnerId = '';
  if (tgToken) {
    tgOwnerId = await askQuestion(rl, ' 👤 Seu ID numérico do Telegram (ou Enter): ');
  }

  if (!exists && fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, 'utf8');
  }

  // Atualiza ou injeta configurações de forma limpa sem quebras de linha Windows (\r)
  const cleanKey = geminiKey.replace(/[\r\n\t ]/g, '');
  const cleanTg = tgToken.replace(/[\r\n\t ]/g, '');
  const cleanOwner = tgOwnerId.replace(/\D/g, '');

  let lines = envContent.split(/\r?\n/).filter(Boolean);
  const setVal = (k, v) => {
    if (!v) return;
    const idx = lines.findIndex(l => l.startsWith(`${k}=`));
    if (idx >= 0) lines[idx] = `${k}=${v}`;
    else lines.push(`${k}=${v}`);
  };

  setVal('GEMINI_API_KEY', cleanKey);
  setVal('TELEGRAM_BOT_TOKEN', cleanTg);
  setVal('OWNER_TELEGRAM_ID', cleanOwner);

  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
  rl.close();

  console.log('\n✅ Configuração gravada no .env com sucesso!');
  console.log('🚀 Iniciando os motores do agente...\n');
  return true;
}

module.exports = { checkAndConfigureEnv };
if (require.main === module) {
  checkAndConfigureEnv();
}
