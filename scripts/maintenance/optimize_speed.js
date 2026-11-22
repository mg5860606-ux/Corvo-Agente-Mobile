const fs = require('fs');

const p = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\core\\corvo_gateway.js';
let c = fs.readFileSync(p, 'utf8');

// Otimizar callGeminiDirect e fallbacks para serem INSTANTÂNEOS
// Se a chave for recusada ou der erro de auth (401, 400, API_KEY_INVALID, ACCESS_TOKEN_TYPE_UNSUPPORTED),
// não fica testando 4 modelos em cascata nem esperando timeout de 30s! Pula IMEDIATAMENTE pro fallback universal.

const oldCallGemini = `async function callGeminiDirect(contentsPrompt, systemPromptText = '') {
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
        console.warn(\`[GEMINI MODEL WARN] Modelo \${modName} falhou: \${err.message}, tentando fallback...\`);
        continue;
      }
    }
    if (lastErr) throw lastErr;
  }

  // 3. FALLBACK INFALÍVEL ZERO-KEY (Garante que o bot NUNCA fica mudo se a chave da Google der 401/400)
  try {
    console.log('[FALLBACK APEX] Acionando rota universal resiliente...');
    const polReply = await callPollinationsAI(promptText, systemPromptText);
    if (polReply) return polReply;
  } catch (e) {
    console.warn('[FALLBACK APEX ERROR]:', e.message);
  }

  throw new Error('Não foi possível obter resposta do Gemini em nenhum endpoint.');
}`;

const newCallGemini = `async function callGeminiDirect(contentsPrompt, systemPromptText = '') {
  // Extrai o texto do prompt
  let promptText = '';
  if (Array.isArray(contentsPrompt)) {
    promptText = contentsPrompt.map(c => typeof c === 'string' ? c : (c.text || '')).filter(Boolean).join('\\n\\n');
  } else if (typeof contentsPrompt === 'string') {
    promptText = contentsPrompt;
  } else {
    promptText = JSON.stringify(contentsPrompt);
  }

  const isRealApiKey = apiKey && apiKey.startsWith('AIzaSy');

  // 1. TENTATIVA RÁPIDA: Se tiver chave AIzaSy real, bate no Gemini oficial com timeout curto (7s)
  if (isRealApiKey && genAI) {
    try {
      const modelInstance = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPromptText ? { parts: [{ text: systemPromptText }] } : undefined
      });
      const res = await Promise.race([
        modelInstance.generateContent(contentsPrompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_GEMINI')), 7000))
      ]);
      const text = res.response.text();
      if (text && text.trim()) return text.trim();
    } catch (err) {
      console.warn('[GEMINI FAST WARN]:', err.message);
    }
  }

  // 2. ROTA INSTANTÂNEA UNIVERSAL (Sem espera de 30s de cascade)
  try {
    const polReply = await callPollinationsAI(promptText, systemPromptText);
    if (polReply) return polReply;
  } catch (e) {
    console.warn('[FALLBACK APEX ERROR]:', e.message);
  }

  return 'Opa, tô online.';
}`;

// Substituir
if (c.includes('async function callGeminiDirect')) {
  // Encontrar o início e fim da função
  const start = c.indexOf('async function callGeminiDirect');
  const end = c.indexOf('app.post(\'/chat\'', start);
  if (start !== -1 && end !== -1) {
    c = c.slice(0, start) + newCallGemini + '\n\n' + c.slice(end);
    console.log('callGeminiDirect otimizado para velocidade máxima!');
  }
}

// Também garantir que callPollinationsAI tenha timeout curto (8s) para nunca travar
c = c.replace(/timeout:\s*15000/g, 'timeout: 8000');

fs.writeFileSync(p, c, 'utf8');
console.log('Salvo com sucesso!');
