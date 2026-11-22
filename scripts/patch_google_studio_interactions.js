const fs = require('fs');

const gwPath = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/core/corvo_gateway.js';
let gw = fs.readFileSync(gwPath, 'utf8');

// Injetar função de chamada à Interactions API oficial do Google AI Studio antes de callGeminiDirect
const interactionsFunction = `
async function callGeminiInteractionsAPI(promptText, systemPromptText = '') {
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada no .env');

  const models = [
    process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  for (const mod of models) {
    try {
      const payload = {
        model: mod,
        input: systemPromptText ? \`[INSTRUÇÃO DE SISTEMA]: \${systemPromptText}\\n\\n\${promptText}\` : promptText,
        store: true
      };

      const res = await axios.post('https://generativelanguage.googleapis.com/v1beta/interactions', payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        timeout: 25000
      });

      if (res.data) {
        const out = res.data.outputs?.[0]?.text || 
                    res.data.output || 
                    res.data.result || 
                    (typeof res.data === 'string' ? res.data : '');
        if (out && typeof out === 'string' && out.trim()) {
          return out.trim();
        }
      }
    } catch (err) {
      console.warn(\`[GOOGLE STUDIO INTERACTIONS WARN (\${mod})]:\`, err.response?.data?.error?.message || err.message);
    }
  }
  return null;
}
`;

if (!gw.includes('callGeminiInteractionsAPI')) {
  gw = gw.replace('async function callGeminiDirect', interactionsFunction + '\nasync function callGeminiDirect');
}

// Atualizar callGeminiDirect para priorizar 100% a Interactions API (gemini-3.8-flash) e SDK Google Studio
const targetSearch = '  // 1. Google AI Studio Oficial (Gemini 2.5 Pro / Flash / 2.0 Flash)';
const replacement = `  // 1. Google AI Studio - Interactions API Prioritária (gemini-3.8-flash)
  try {
    const interRes = await callGeminiInteractionsAPI(promptText, systemPromptText);
    if (interRes) return interRes;
  } catch (e) {}

  // 2. Google AI Studio Oficial via SDK (@google/generative-ai)`;

if (gw.includes(targetSearch)) {
  gw = gw.replace(targetSearch, replacement);
}

fs.writeFileSync(gwPath, gw, 'utf8');
console.log('[OK] Google AI Studio Interactions API (gemini-3.8-flash) configurada como prioridade máxima!');
