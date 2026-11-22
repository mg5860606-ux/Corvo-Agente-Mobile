const fs = require('fs');
const path = require('path');

const repoPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix';
const gatewayFile = path.join(repoPath, 'src\\core\\corvo_gateway.js');
const loopFile = path.join(repoPath, 'src\\core\\corvo_loop.js');

console.log('--- REVISANDO CORVO_GATEWAY.JS ---');
let gwContent = fs.readFileSync(gatewayFile, 'utf8');

// 1. Provedor Primário e fallback resiliente de modelos Gemini
// Queremos suportar:
// - PRIMARY_PROVIDER = 'gemini' (Padrão para quem roda direto no celular com GEMINI_API_KEY)
// - Modelos oficiais do Google AI Studio: gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash
// - Fallback inteligente de modelo caso algum dê 404
// - Se PRIMARY_PROVIDER for 'gemini' ou se openaiClient não estiver disponível, vai direto pro Gemini sem passar pela ISA Cloud!

fs.writeFileSync(path.join(repoPath, 'backup_corvo_gateway.js'), gwContent, 'utf8');
console.log('Backup criado.');
