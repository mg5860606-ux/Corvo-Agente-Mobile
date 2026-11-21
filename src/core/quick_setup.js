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
  console.log(' Para funcionar de graça, você só precisa da chave do Google Studio.');
  console.log(' 👉 Pegue grátis em 10 segundos aqui: https://aistudio.google.com/\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const key = await askQuestion(rl, ' Cole sua chave GEMINI_API_KEY aqui: ');

  if (key) {
    if (!exists && fs.existsSync(envExamplePath)) {
      envContent = fs.readFileSync(envExamplePath, 'utf8');
    }
    // Substitui ou injeta
    if (envContent.includes('GEMINI_API_KEY=')) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${key}`);
    } else {
      envContent += `\nGEMINI_API_KEY=${key}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(' ✅ Chave salva no seu .env com sucesso!\n');
  } else {
    console.log(' ⚠️ Nenhuma chave informada. O agente tentará iniciar com as configurações padrão.\n');
    if (!exists && fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
    }
  }

  rl.close();
  return true;
}

module.exports = { checkAndConfigureEnv };
