const fs = require('fs');
const path = require('path');

const repo = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix';
const gwPath = path.join(repo, 'src\\core\\corvo_gateway.js');
const loopPath = path.join(repo, 'src\\core\\corvo_loop.js');
const envPath = path.join(repo, '.env.example');

let gw = fs.readFileSync(gwPath, 'utf8');
let loop = fs.readFileSync(loopPath, 'utf8');
let env = fs.readFileSync(envPath, 'utf8');

// Definir modelos brutais de ponta do Google Gemini:
// O Google AI Studio oferece:
// - gemini-2.5-pro / gemini-2.0-pro-exp (Modelos Pro pesados de raciocínio profundo)
// - gemini-2.0-flash-thinking-exp (Gemini com thinking/raciocínio ativado)
// - gemini-1.5-pro (Pro estável)
// Desativar qualquer dependência secundária: rodar 100% puro Gemini direto da Google!

const HEAVY_MODELS = `const GOOGLE_FALLBACK_MODELS = [
  GEMINI_MODEL,
  'gemini-2.5-pro',
  'gemini-2.0-pro-exp',
  'gemini-2.0-pro-exp-02-05',
  'gemini-2.0-flash-thinking-exp',
  'gemini-1.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash'
].filter((v, i, a) => v && a.indexOf(v) === i);`;

gw = gw.replace(/const GOOGLE_FALLBACK_MODELS = \[[\s\S]*?\]\.filter\([^)]*\);/, HEAVY_MODELS);
gw = gw.replace(/let GEMINI_MODEL = [^\n]*;/, "let GEMINI_MODEL = (process.env.GEMINI_MODEL || process.env.PRIMARY_MODEL || 'gemini-2.5-pro').trim();");

loop = loop.replace(/const GOOGLE_FALLBACK_MODELS = \[[\s\S]*?\]\.filter\([^)]*\);/, HEAVY_MODELS);
loop = loop.replace(/let GEMINI_MODEL = [^\n]*;/, "let GEMINI_MODEL = (process.env.GEMINI_MODEL || process.env.PRIMARY_MODEL || 'gemini-2.5-pro').trim();");

env = env.replace(/GEMINI_MODEL=.*/, 'GEMINI_MODEL=gemini-2.5-pro');
env = env.replace(/PRIMARY_PROVIDER=.*/, 'PRIMARY_PROVIDER=gemini');

fs.writeFileSync(gwPath, gw, 'utf8');
fs.writeFileSync(loopPath, loop, 'utf8');
fs.writeFileSync(envPath, env, 'utf8');

console.log('✅ Modelos Pro brutais (2.5 Pro / Thinking Exp) configurados com sucesso!');
