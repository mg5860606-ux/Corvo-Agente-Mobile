const fs = require('fs');

// ==============================================================
// 1. AJUSTAR CORVO_GATEWAY.JS: USAR ESTRITAMENTE GEMINI-3.8-FLASH INTERACTIONS API
// ==============================================================
const gwPath = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/core/corvo_gateway.js';
let gw = fs.readFileSync(gwPath, 'utf8');

// Substituir a função callGeminiInteractionsAPI e callGeminiDirect para rodar SOMENTE o gemini-3.8-flash com store: true
const cleanGatewayAIFunctions = `
async function callGeminiInteractionsAPI(promptText, systemPromptText = '') {
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada no .env');

  const payload = {
    model: 'gemini-3.8-flash',
    input: systemPromptText ? \`[INSTRUÇÃO DE SISTEMA]: \${systemPromptText}\\n\\n\${promptText}\` : promptText,
    store: true
  };

  const res = await axios.post('https://generativelanguage.googleapis.com/v1beta/interactions', payload, {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    timeout: 35000
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
  throw new Error('Sem resposta válida da Google Studio Interactions API.');
}

async function callGeminiDirect(contentsPrompt, systemPromptText = '') {
  let promptText = '';
  if (Array.isArray(contentsPrompt)) {
    const userPart = contentsPrompt.find(c => typeof c === 'string' && c.includes('Usuário (Marcos):'));
    if (userPart) {
      const match = userPart.match(/Usuário \\(Marcos\\):\\s*"([^"]+)"/);
      promptText = match ? match[1] : userPart;
    } else {
      promptText = contentsPrompt.map(c => typeof c === 'string' ? c : (c.text || '')).filter(Boolean).join('\\n');
    }
  } else if (typeof contentsPrompt === 'string') {
    promptText = contentsPrompt;
  } else {
    promptText = JSON.stringify(contentsPrompt);
  }

  // ESTRITAMENTE Google AI Studio Interactions API (gemini-3.8-flash)
  return await callGeminiInteractionsAPI(promptText, systemPromptText);
}
`;

// Substitui tudo desde callPollinationsAI até o final de callGeminiDirect
const startIdx = gw.indexOf('async function callPollinationsAI');
const endIdx = gw.indexOf('app.post(\'/chat\'');

if (startIdx !== -1 && endIdx !== -1) {
  gw = gw.substring(0, startIdx) + cleanGatewayAIFunctions + '\n' + gw.substring(endIdx);
  console.log('[OK] corvo_gateway.js: Removidos modelos antigos, fixado apenas gemini-3.8-flash');
}

// Limpa também o bloco /chat para chamar diretamente callGeminiDirect
const oldTryChat = `    try {
      if (PRIMARY_PROVIDER === 'gemini' || !openaiClient) {
        if (genAI) {
          reply = await callGeminiDirect(contents, systemPrompt);
        } else {
          reply = await callPollinationsAI(fullConversation, systemPrompt);
        }
      }
    } catch (primaryErr) {
      console.warn('[CHAT ERROR - USANDO FALLBACK UNIVERSAL]:', primaryErr.message);
      reply = await callPollinationsAI(fullConversation, systemPrompt);
    }

    if (!reply) {
      reply = await callPollinationsAI(message || 'Oi', systemPrompt) || 'Sistema online e operacional.';
    } else if (openaiClient) {`;

const newTryChat = `    try {
      reply = await callGeminiDirect(contents, systemPrompt);
    } catch (primaryErr) {
      console.error('[GEMINI 3.8 FLASH INTERACTIONS ERROR]:', primaryErr.response?.data?.error?.message || primaryErr.message);
      reply = 'Minha conexão com a API do Google Studio oscilou, Marcos. Tenta de novo agora.';
    }

    if (false && openaiClient) {`;

gw = gw.replace(oldTryChat, newTryChat);
fs.writeFileSync(gwPath, gw, 'utf8');

// ==============================================================
// 2. AJUSTAR CORVO_LOOP.JS: USAR SOMENTE GEMINI-3.8-FLASH INTERACTIONS API
// ==============================================================
const loopPath = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/core/corvo_loop.js';
let loop = fs.readFileSync(loopPath, 'utf8');

const cleanCallGeminiForLoop = `
async function callGeminiForLoop(promptText) {
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY não configurada no .env');

  const interactionRes = await axios.post('https://generativelanguage.googleapis.com/v1beta/interactions', {
    model: 'gemini-3.8-flash',
    input: promptText,
    store: true
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
  throw new Error('Falha na resposta do Gemini 3.8 Flash Interactions API.');
}
`;

const loopStart = loop.indexOf('async function callGeminiForLoop');
const loopEnd = loop.indexOf('// Controle de Missões Ativas');

if (loopStart !== -1 && loopEnd !== -1) {
  loop = loop.substring(0, loopStart) + cleanCallGeminiForLoop + '\n' + loop.substring(loopEnd);
  console.log('[OK] corvo_loop.js: Fixado apenas gemini-3.8-flash');
}

// Forçar no corvo_loop para sempre chamar callGeminiForLoop
const oldLoopCall = `      if (PRIMARY_PROVIDER === 'gemini' || !openaiClient) {
        if (genAI) {
          try {
            replyText = await callGeminiForLoop(geminiPrompt);
          } catch (gemErr) {
            console.error('[LOOP GEMINI ERROR]:', gemErr.message);
            throw gemErr;
          }
        } else {
          throw new Error('Nenhum provedor de IA configurado no loop.');
        }
      } else if (openaiClient) {`;

const newLoopCall = `      try {
        replyText = await callGeminiForLoop(geminiPrompt);
      } catch (gemErr) {
        console.error('[LOOP GEMINI 3.8 FLASH ERROR]:', gemErr.message);
        throw gemErr;
      }
      if (false && openaiClient) {`;

loop = loop.replace(oldLoopCall, newLoopCall);
fs.writeFileSync(loopPath, loop, 'utf8');

console.log('TODOS OS MODELOS SECUNDÁRIOS REMOVIDOS COM SUCESSO! APENAS GEMINI-3.8-FLASH ATIVO.');
