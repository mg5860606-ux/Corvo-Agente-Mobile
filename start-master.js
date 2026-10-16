#!/usr/bin/env node
/**
 * 🦅 CORVO AGENTE MOBILE - MASTER LAUNCHER
 * Inicia o Gateway Daemon HTTP e o Cliente WhatsApp simultaneamente
 * apontando para a nova estrutura de pastas (src/core e src/channels).
 */

const { spawn } = require('child_process');
const path = require('path');

function runService(relativePath) {
  const scriptPath = path.join(__dirname, relativePath);
  console.log(`[MASTER] Iniciando serviço: ${relativePath}...`);

  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  child.on('close', (code) => {
    console.warn(`[WATCHDOG] O serviço ${relativePath} parou com código ${code}. Reiniciando em 5 segundos...`);
    setTimeout(() => {
      runService(relativePath);
    }, 5000);
  });

  child.on('error', (err) => {
    console.error(`[WATCHDOG ERROR] Erro no processo ${relativePath}:`, err.message);
  });
}

console.clear();
console.log('========================================');
console.log('  🦅 CORVO AGENTE MOBILE - MASTER LAUNCHER');
console.log('========================================');
console.log(' Iniciando arquitetura estruturada...');

// 1. Inicia o Gateway HTTP Daemon (src/core/corvo_gateway.js)
runService('src/core/corvo_gateway.js');

// 2. Aguarda 3 segundos e inicia o Bot do WhatsApp (src/channels/corvo_whatsapp.js)
setTimeout(() => {
  runService('src/channels/corvo_whatsapp.js');
}, 3000);
