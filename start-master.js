const { spawn } = require('child_process');
const path = require('path');

function runService(name, relativePath) {
  const scriptPath = path.join(__dirname, relativePath);
  console.log('[MASTER] Iniciando ' + name + ': ' + relativePath);
  const child = spawn('node', [scriptPath], { stdio: 'inherit', shell: true, cwd: __dirname });
  child.on('close', (code) => console.log('[' + name + '] Parou com codigo: ' + code));
  child.on('error', (err) => console.error('[' + name + ' ERRO]: ' + err.message));
}

console.log('=== CORVO AGENTE MOBILE INICIANDO ===');
runService('gateway', 'src/core/corvo_gateway.js');
setTimeout(() => {
  runService('telegram', 'src/channels/corvo_telegram.js');
}, 2000);