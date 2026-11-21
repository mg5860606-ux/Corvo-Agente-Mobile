const { spawn, execSync } = require('child_process');
const path = require('path');
const { checkAndConfigureEnv } = require('./src/core/quick_setup');

function autoUpdate() {
  console.log('[AUTO-UPDATE] Checando atualizações no GitHub...');
  try {
    // Timeout curto de 10s pra não travar se o celular tiver sem internet
    execSync('git pull origin main', {
      cwd: __dirname,
      stdio: 'inherit',
      timeout: 15000
    });
    console.log('[AUTO-UPDATE] Sistema sincronizado com a versão mais recente!');
  } catch (err) {
    console.warn('[AUTO-UPDATE WARN] Não foi possível puxar atualização agora (offline ou modificado): ' + err.message);
  }
}

function runService(name, relativePath) {
  const scriptPath = path.join(__dirname, relativePath);
  console.log('[MASTER] Iniciando ' + name + ': ' + relativePath);
  const child = spawn('node', [scriptPath], { stdio: 'inherit', shell: true, cwd: __dirname });
  child.on('close', (code) => {
    console.log('[' + name + '] Parou com codigo: ' + code);
    if (code !== 99) { // 99 = parada manual definitiva
      console.log('[' + name + '] Auto-revive ativo: reiniciando serviço em 2 segundos...');
      setTimeout(() => runService(name, relativePath), 2000);
    }
  });
  child.on('error', (err) => console.error('[' + name + ' ERRO]: ' + err.message));
}

async function main() {
  console.clear();
  
  // 1. Auto-Update obrigatório no boot (sempre atualizado com o GitHub)
  autoUpdate();

  // 2. Setup interativo caso seja primeira vez
  await checkAndConfigureEnv();

  console.log('==================================================');
  console.log('  🦅 ÍNDIA / CORVO AGENTE MOBILE // SISTEMA INICIADO');
  console.log('==================================================');
  
  runService('gateway', 'src/core/corvo_gateway.js');
  setTimeout(() => {
    runService('telegram', 'src/channels/corvo_telegram.js');
  }, 2000);
}

main();
