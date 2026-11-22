const fs = require('fs');
const path = require('path');

const repo = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix';
const gwPath = path.join(repo, 'src\\core\\corvo_gateway.js');
const loopPath = path.join(repo, 'src\\core\\corvo_loop.js');

let gw = fs.readFileSync(gwPath, 'utf8');

// Vamos inspecionar exatamente o trecho entre "throw lastErr;" e "// Registra no banco" em corvo_gateway.js
const p1 = gw.indexOf('throw lastErr;');
const p2 = gw.indexOf('// Registra no banco', p1);
console.log('--- TRECHO GW ---');
console.log(gw.slice(p1, p2 + 30));

// No corvo_gateway.js, após "throw lastErr;", deve fechar o bloco do "if (openaiClient)" ou "if (PRIMARY_PROVIDER...)"
// Vamos reestruturar esse miolo de forma 100% limpa:
