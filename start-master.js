#!/usr/bin/env node
/**
 * 🦅 CORVO AGENTE MOBILE - MASTER LAUNCHER (MODULAR & SOBERANO)
 * Inicia o Gateway Daemon HTTP com Painel Web OpenClaw.
 * O WhatsApp fica disponível sob demanda pelo painel ou argumento --with-wa.
 */

const { spawn } = require('child_process');
const path = require('path');

const services = new Map();

function runService(name, relativePath) {
  const scriptPath = path.join(__dirname, relativePath);
  console.log(`[MASTER] Iniciando serviço [${name}]: ${relativePath}...`);

  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  services.set(name, child);

  child.on('close', (code) => {
    console.warn(`[WATCHDOG] O serviço [${name}] parou com código ${code}.`);
    services.delete(name);
  });

  child.on('error', (err) => {
    console.error(`[WATCHDOG ERROR] Erro no processo [${name}]:`, err.message);
  });
}

console.clear();
console.log('========================================================');
console.log('  🦅 CORVO AGENTE MOBILE - MASTER SOVEREIGN LAUNCHER');
console.log('========================================================');
console.log(' [✔] Gateway Core & Web UI OpenClaw: ATIVO na porta 3333');
console.log(' [ℹ] WhatsApp: Standby (Pode ser ligado a qualquer momento)');
console.log('--------------------------------------------------------');

// 1. Inicia o Gateway HTTP Daemon + Web UI
runService('gateway', 'src/core/corvo_gateway.js');

// Se o usuário passou --with-wa ou variável START_WA=true
if (process.argv.includes('--with-wa') || process.env.START_WA === 'true') {
  setTimeout(() => {
    runService('whatsapp', 'src/channels/corvo_whatsapp.js');
  }, 3000);
}
