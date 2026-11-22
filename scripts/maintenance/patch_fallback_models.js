const fs = require('fs');

const p = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\core\\corvo_gateway.js';
let c = fs.readFileSync(p, 'utf8');

// 1. Substituir a lista de fallback models
const oldModels = `const GOOGLE_FALLBACK_MODELS = [
  GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-pro'
].filter((v, i, a) => v && a.indexOf(v) === i);`;

const newModels = `const GOOGLE_FALLBACK_MODELS = [
  GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest'
].filter((v, i, a) => v && a.indexOf(v) === i);`;

if (c.includes(oldModels)) {
  c = c.replace(oldModels, newModels);
  console.log('Modelos de fallback atualizados no corvo_gateway.js');
}

// 2. Corrigir tratamento no loop de fallback:
// Se o modelo falhar com 404, não suportado ou erro de API, continuar tentando os próximos antes de estourar erro!
const oldLoop = `      } catch (err) {
        lastErr = err;
        if (err.message && (err.message.includes('404') || err.message.includes('not found') || err.message.includes('is not supported'))) {
          continue;
        }
      }`;

const newLoop = `      } catch (err) {
        lastErr = err;
        console.warn(\`[GEMINI MODEL WARN] Modelo \${modName} falhou: \${err.message}, tentando fallback...\`);
        continue;
      }`;

if (c.includes(oldLoop)) {
  c = c.replace(oldLoop, newLoop);
  console.log('Loop de fallback resiliente ajustado!');
}

fs.writeFileSync(p, c, 'utf8');
