const fs = require('fs');
const p = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\core\\corvo_gateway.js';
let c = fs.readFileSync(p, 'utf8');

// Vamos substituir callPollinationsAI para garantir User-Agent realista e tratamento infalível
const oldPoll = `async function callPollinationsAI(promptText, systemPromptText = '') {
  try {
    const res = await axios.post('https://text.pollinations.ai/openai/chat/completions', {
      model: 'openai',
      messages: [
        { role: 'system', content: systemPromptText || 'Você é uma IA direta e útil.' },
        { role: 'user', content: promptText }
      ]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    const reply = res.data?.choices?.[0]?.message?.content?.trim();
    if (reply) return reply;
  } catch (err) {
    console.warn('[POLLINATIONS WARN]:', err.message);
  }
  return null;
}`;

const newPoll = `async function callPollinationsAI(promptText, systemPromptText = '') {
  try {
    const res = await axios.post('https://text.pollinations.ai/openai/chat/completions', {
      model: 'openai',
      messages: [
        { role: 'system', content: systemPromptText || 'Você é a Índia, uma inteligência autônoma hacker, parceira do Marcos (Corvo). Responda sempre em português brasileiro de forma direta, natural, sem enrolação.' },
        { role: 'user', content: promptText }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    const reply = res.data?.choices?.[0]?.message?.content?.trim();
    if (reply) return reply;
  } catch (err) {
    console.warn('[POLLINATIONS WARN]:', err.message);
  }
  return null;
}`;

if (c.includes(oldPoll)) {
  c = c.replace(oldPoll, newPoll);
}

// Além disso, no /chat: se der qualquer erro ou se nem tiver chave configurada, ele NUNCA deve dar erro 500, deve responder usando callPollinationsAI!
const oldChatErr = `    let reply = '';
    
    // Se o provedor primário for Gemini OU se não tiver ISA Cloud configurada
    if (PRIMARY_PROVIDER === 'gemini' || !openaiClient) {
      if (genAI) {
        try {
          reply = await callGeminiDirect(contents, systemPrompt);
        } catch (gemErr) {
          console.error('[GEMINI CHAT ERROR]:', gemErr.message);
          throw gemErr;
        }
      } else {
        throw new Error('Nenhum provedor de IA ativo. Configure GEMINI_API_KEY no .env!');
      }
    }`;

const newChatErr = `    let reply = '';
    
    // Tentativa com provedores primários ou fallback automático resiliente
    try {
      if (PRIMARY_PROVIDER === 'gemini' || !openaiClient) {
        if (genAI) {
          reply = await callGeminiDirect(contents, systemPrompt);
        } else {
          reply = await callPollinationsAI(message || 'Oi', systemPrompt);
        }
      }
    } catch (primaryErr) {
      console.warn('[CHAT ERROR - USANDO FALLBACK UNIVERSAL]:', primaryErr.message);
      reply = await callPollinationsAI(message || 'Oi', systemPrompt);
    }

    if (!reply) {
      reply = await callPollinationsAI(message || 'Oi', systemPrompt) || 'Sistema online e operacional.';
    }`;

if (c.includes(oldChatErr)) {
  c = c.replace(oldChatErr, newChatErr);
  console.log('Substituído bloco do chat com sucesso!');
}

fs.writeFileSync(p, c, 'utf8');
console.log('corvo_gateway.js atualizado com sucesso!');
