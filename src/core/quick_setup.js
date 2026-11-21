const fs = require('fs');
const path = require('path');
const readline = require('readline');

const repoDir = path.resolve(__dirname);
const envPath = path.join(repoDir, '.env');
const envExamplePath = path.join(repoDir, '.env.example');

function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, (ans) => resolve(ans.trim())));
}

async function checkAndConfigureEnv() {
  let envContent = '';
  let exists = fs.existsSync(envPath);

  if (exists) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, 'utf8');
  }

  // Verifica se já tem chave válida do Gemini configurada
  const hasGeminiKey = envContent.includes('GEMINI_API_KEY=') && 
                       !envContent.includes('GEMINI_API_KEY=sua_chave') &&
                       !envContent.includes('GEMINI_API_KEY=');

  // Se já tiver chave configurada ou se estiver rodando em ambiente não interativo
  if (hasGeminiKey || !process.stdin.isTTY) {
    if (!exists && fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
    }
    return true;
  }

  console.log('\n======================================================');
  console.log('  🦅 BEM-VINDO AO CORVO AGENTE MOBILE // SETUP RÁPIDO');
  console.log('======================================================');
  console.log(' Parece que é a sua primeira vez iniciando o agente!');
  console.log(' Vamos configurar as informações básicas para rodar liso.\n');
  console.log(' 1. Inteligência Grátis (Google Studio):');
  console.log('    👉 Pegue grátis em: https://aistudio.google.com/\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  const geminiKey = await askQuestion(rl, ' 🔑 Cole sua chave GEMINI_API_KEY: ');

  console.log('\n 2. Bot do Telegram (Opcional - aperte Enter para pular):');
  console.log('    👉 Crie um bot no @BotFather para pegar o Token e pegue seu ID no @userinfobot\n');
  const tgToken = await askQuestion(rl, ' 🤖 Token do Bot Telegram (ou Enter): ');
  let tgOwnerId = '';
  if (tgToken) {
    tgOwnerId = await askQuestion(rl, ' 👤 Seu ID numérico do Telegram (ou Enter): ');
  }

  console.log('\n 3. WhatsApp do Dono (Opcional - aperte Enter para pular):');
  console.log('    Exemplo com DDI e DDD: 5511999999999\n');
  const waPhone = await askQuestion(rl, ' 📱 Seu número de WhatsApp (ou Enter): ');

  if (!exists && fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, 'utf8');
  }

  // Atualiza ou injeta Gemini
  if (geminiKey) {
    if (envContent.includes('GEMINI_API_KEY=')) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${geminiKey}`);
    } else {
      envContent += `\nGEMINI_API_KEY=${geminiKey}\n`;
    }
  }

  // Atualiza Telegram
  if (tgToken) {
    if (envContent.includes('TELEGRAM_BOT_TOKEN=')) {
      envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/, `TELEGRAM_BOT_TOKEN=${tgToken}`);
    } else {
      envContent += `\nTELEGRAM_BOT_TOKEN=${tgToken}\n`;
    }
  }
  if (tgOwnerId) {
    if (envContent.includes('MARCOS_TELEGRAM_ID=')) {
      envContent = envContent.replace(/MARCOS_TELEGRAM_ID=.*/, `MARCOS_TELEGRAM_ID=${tgOwnerId}`);
    } else {
      envContent += `\nMARCOS_TELEGRAM_ID=${tgOwnerId}\n`;
    }
  }

  // Atualiza WhatsApp
  if (waPhone) {
    const cleanPhone = waPhone.replace(/\D/g, '');
    if (envContent.includes('MARCOS_WHATSAPP_PHONE=')) {
      envContent = envContent.replace(/MARCOS_WHATSAPP_PHONE=.*/, `MARCOS_WHATSAPP_PHONE=${cleanPhone}`);
    } else {
      envContent += `\nMARCOS_WHATSAPP_PHONE=${cleanPhone}\n`;
    }
    if (envContent.includes('WHATSAPP_PAIRING_NUMBER=')) {
      envContent = envContent.replace(/WHATSAPP_PAIRING_NUMBER=.*/, `WHATSAPP_PAIRING_NUMBER=${cleanPhone}`);
    }
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('\n ✅ Configurações salvas no seu .env com sucesso!');
  console.log(' 🚀 Iniciando os serviços do agente...\n');

  rl.close();
  return true;
}

module.exports = { checkAndConfigureEnv };
