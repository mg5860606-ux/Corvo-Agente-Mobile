#!/usr/bin/env node
/**
 * 🦅 CORVO AGENTE MOBILE - MASTER LAUNCHER
 * Inicia o Gateway Daemon HTTP e o Cliente WhatsApp simultaneamente
 * com Watchdog de auto-recuperação (Anti-Crash).
 */

const { spawn } = require('child_process');
const path = require('path');

function runService(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  console.log(`[MASTER] Iniciando serviço: ${scriptName}...`);

  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  child.on('close', (code) => {
    console.warn(`[WATCHDOG] O serviço ${scriptName} parou com código ${code}. Reiniciando em 5 segundos...`);
    setTimeout(() => {
      runService(scriptName);
    }, 5000);
  });

  child.on('error', (err) => {
    console.error(`[WATCHDOG ERROR] Erro no processo ${scriptName}:`, err.message);
  });
}

console.clear();
console.log('========================================');
console.log('  🦅 CORVO AGENTE MOBILE - MASTER LAUNCHER');
console.log('========================================');
console.log(' Iniciando arquitetura Mini-CORVO AGENTE MOBILE...');

// 1. Inicia o Gateway HTTP Daemon
runService('corvo_gateway.js');

// 2. Aguarda 3 segundos e inicia o Bot do WhatsApp
setTimeout(() => {
  runService('corvo_whatsapp.js');
}, 3000);
