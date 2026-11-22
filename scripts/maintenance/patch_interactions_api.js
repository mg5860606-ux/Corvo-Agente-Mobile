const fs = require('fs');
const path = require('path');

const repoPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix';
const gwPath = path.join(repoPath, 'src\\core\\corvo_gateway.js');
const loopPath = path.join(repoPath, 'src\\core\\corvo_loop.js');

let gw = fs.readFileSync(gwPath, 'utf8');
let loop = fs.readFileSync(loopPath, 'utf8');

// Adicionar axios no corvo_gateway.js se não tiver
if (!gw.includes("const axios = require('axios');")) {
  gw = "const axios = require('axios');\n" + gw;
}
if (!loop.includes("const axios = require('axios');")) {
  loop = "const axios = require('axios');\n" + loop;
}

// Implementar callGeminiDirect com suporte nativo a:
// 1. Interactions API (https://generativelanguage.googleapis.com/v1beta/interactions)
//    - Modelo gemini-3.8-flash
//    - Header: x-goog-api-key: KEY
//    - Suporta chaves novas AQ.* e chaves padrão
// 2. Fallback para generateContent (SDK legado) se o endpoint interactions não responder ou se a chave for padrão
const newCallGeminiDirect = `
async function callGeminiDirect(contentsPrompt, systemPromptText = '') {
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada no .env');
  
  // Extrai o texto do prompt
  let promptText = '';
  if (Array.isArray(contentsPrompt)) {
    promptText = contentsPrompt.map(c => typeof c === 'string' ? c : (c.text || '')).filter(Boolean).join('\\n\\n');
  } else if (typeof contentsPrompt === 'string') {
    promptText = contentsPrompt;
  } else {
    promptText = JSON.stringify(contentsPrompt);
  }

  // 1. TENTATIVA PRIORITÁRIA: NOVA INTERACTIONS API (Gemini 3.8 Flash & Chaves AQ)
  try {
    const interactionRes = await axios.post('https://generativelanguage.googleapis.com/v1beta/interactions', {
      model: 'gemini-3.8-flash',
      input: promptText
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      timeout: 30000
    });

    if (interactionRes.data) {
      const out = interactionRes.data.outputs?.[0]?.text || 
                  interactionRes.data.output || 
                  interactionRes.data.result || 
                  (typeof interactionRes.data === 'string' ? interactionRes.data : '');
      if (out && typeof out === 'string' && out.trim()) {
        return out.trim();
      }
    }
  } catch (interErr) {
    console.warn('[INTERACTIONS API WARN]:', interErr.response?.data?.error?.message || interErr.message);
  }

  // 2. FALLBACK: GENERATE CONTENT SDK (Modelos Pro / Flash)
  if (genAI) {
    let lastErr = null;
    for (const modName of GOOGLE_FALLBACK_MODELS) {
      try {
        const modelInstance = genAI.getGenerativeModel({
          model: modName,
          systemInstruction: systemPromptText ? { parts: [{ text: systemPromptText }] } : undefined
        });
        const res = await modelInstance.generateContent(contentsPrompt);
        const text = res.response.text();
        if (text) {
          GEMINI_MODEL = modName;
          return text.trim();
        }
      } catch (err) {
        lastErr = err;
        if (err.message && (err.message.includes('404') || err.message.includes('not found') || err.message.includes('is not supported'))) {
          continue;
        }
      }
    }
    if (lastErr) throw lastErr;
  }

  throw new Error('Não foi possível obter resposta do Gemini em nenhum endpoint.');
}
`;

// Substitui a função callGeminiDirect no corvo_gateway.js
const gwFuncRegex = /async function callGeminiDirect[\s\S]*?throw lastErr \|\| new Error\('Nenhum modelo Gemini compatível respondeu\.'\);\s*\}/;
gw = gw.replace(gwFuncRegex, newCallGeminiDirect.trim());

// Implementar callGeminiForLoop no corvo_loop.js
const newCallGeminiForLoop = `
async function callGeminiForLoop(promptText) {
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY não configurada no .env');

  // 1. TENTATIVA PRIORITÁRIA: INTERACTIONS API (Gemini 3.8 Flash)
  try {
    const interactionRes = await axios.post('https://generativelanguage.googleapis.com/v1beta/interactions', {
      model: 'gemini-3.8-flash',
      input: promptText
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey
      },
      timeout: 45000
    });

    if (interactionRes.data) {
      const out = interactionRes.data.outputs?.[0]?.text || 
                  interactionRes.data.output || 
                  interactionRes.data.result || 
                  (typeof interactionRes.data === 'string' ? interactionRes.data : '');
      if (out && typeof out === 'string' && out.trim()) {
        return out.trim();
      }
    }
  } catch (interErr) {
    console.warn('[LOOP INTERACTIONS API WARN]:', interErr.response?.data?.error?.message || interErr.message);
  }

  // 2. FALLBACK NO SDK
  if (genAI) {
    let lastErr = null;
    for (const modName of GOOGLE_FALLBACK_MODELS) {
      try {
        const fbModel = genAI.getGenerativeModel({
          model: modName,
          generationConfig: { temperature: 0.2 }
        });
        const fbRes = await fbModel.generateContent(promptText);
        const resText = fbRes.response.text();
        if (resText) {
          GEMINI_MODEL = modName;
          return resText.trim();
        }
      } catch (err) {
        lastErr = err;
        if (err.message && (err.message.includes('404') || err.message.includes('not found') || err.message.includes('is not supported'))) {
          continue;
        }
      }
    }
    if (lastErr) throw lastErr;
  }

  throw new Error('Nenhum modelo Gemini respondeu no loop.');
}
`;

const loopFuncRegex = /async function callGeminiForLoop[\s\S]*?throw lastErr \|\| new Error\('Nenhum modelo Gemini compatível respondeu no loop\.'\);\s*\}/;
loop = loop.replace(loopFuncRegex, newCallGeminiForLoop.trim());

fs.writeFileSync(gwPath, gw, 'utf8');
fs.writeFileSync(loopPath, loop, 'utf8');

console.log('✅ Gateway e Loop atualizados para a nova Interactions API (Gemini 3.8 Flash)!');
