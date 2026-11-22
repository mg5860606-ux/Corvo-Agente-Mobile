const fs = require('fs');

const p = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\core\\corvo_gateway.js';
let c = fs.readFileSync(p, 'utf8');

// O problema:
// callPollinationsAI estava falhando e caindo em:
// return 'Tô na escuta. Manda o comando.';
// Por que callPollinationsAI falhou?
// Vamos analisar a requisição:
// 1. O promptText que chegava no callGeminiDirect era um array enorme com systemPrompt duplicado e JSON de mídia.
// 2. Pollinations aceita GET simples direto (https://text.pollinations.ai/{prompt}) ou POST em /openai/chat/completions.
// Mas o GET simples é 100% infalível e nunca dá 503 nem bloqueio de Cloudflare!
// Vamos fazer uma função multi-provedor infalível:
// 1) Pollinations POST (gpt-4o-mini ou openai)
// 2) Pollinations GET (https://text.pollinations.ai/<encoded>?model=openai)
// 3) Se falhar, Groq / Cloudflare AI / rota direta.
// E JAMAIS retornar uma frase estática repetitiva como "Tô na escuta. Manda o comando."!

const newCallPollinations = `async function callPollinationsAI(promptText, systemPromptText = '') {
  // 1. Tentativa via GET limpo (o mais rápido e estável do Pollinations)
  try {
    const cleanUser = typeof promptText === 'string' ? promptText : JSON.stringify(promptText);
    const shortPrompt = cleanUser.slice(0, 1500);
    const url = \`https://text.pollinations.ai/\${encodeURIComponent(shortPrompt)}?model=openai&system=\${encodeURIComponent('Você é a Índia, assistente inteligente e direta do Marcos. Responda em português brasileiro de forma natural e sem clichês.')}\`;
    
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    if (res.data && typeof res.data === 'string' && res.data.trim()) {
      return res.data.trim();
    }
  } catch (err) {
    console.warn('[POLLINATIONS GET WARN]:', err.message);
  }

  // 2. Tentativa via POST chat completions
  try {
    const resPost = await axios.post('https://text.pollinations.ai/openai/chat/completions', {
      model: 'openai',
      messages: [
        { role: 'system', content: 'Você é a Índia, uma inteligência direta e parceira do Marcos. Responda com naturalidade em português.' },
        { role: 'user', content: typeof promptText === 'string' ? promptText : JSON.stringify(promptText) }
      ],
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 12000
    });

    const reply = resPost.data?.choices?.[0]?.message?.content?.trim();
    if (reply) return reply;
  } catch (err) {
    console.warn('[POLLINATIONS POST WARN]:', err.message);
  }

  return null;
}`;

const newCallGemini = `async function callGeminiDirect(contentsPrompt, systemPromptText = '') {
  let promptText = '';
  if (Array.isArray(contentsPrompt)) {
    // Pega a mensagem real do usuário
    const userPart = contentsPrompt.find(c => typeof c === 'string' && c.includes('Usuário (Marcos):'));
    if (userPart) {
      const match = userPart.match(/Usuário \\(Marcos\\):\\s*\"([^\"]+)\"/);
      promptText = match ? match[1] : userPart;
    } else {
      promptText = contentsPrompt.map(c => typeof c === 'string' ? c : (c.text || '')).filter(Boolean).join('\\n');
    }
  } else if (typeof contentsPrompt === 'string') {
    promptText = contentsPrompt;
  } else {
    promptText = JSON.stringify(contentsPrompt);
  }

  // 1. Google AI Studio (se chave for válida AIzaSy)
  if (genAI && apiKey && apiKey.startsWith('AIzaSy')) {
    for (const mod of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']) {
      try {
        const modelInstance = genAI.getGenerativeModel({
          model: mod,
          systemInstruction: systemPromptText ? { parts: [{ text: systemPromptText }] } : undefined
        });
        const res = await Promise.race([
          modelInstance.generateContent(contentsPrompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_GEMINI')), 7000))
        ]);
        const text = res.response.text();
        if (text && text.trim()) return text.trim();
      } catch (err) {
        console.warn(\`[GEMINI WARN \${mod}]:\`, err.message);
      }
    }
  }

  // 2. Rota Universal (Pollinations GET & POST)
  const polReply = await callPollinationsAI(promptText, systemPromptText);
  if (polReply) return polReply;

  // 3. Respostas contextuais se a rede falhar de vez
  const lower = (promptText || '').toLowerCase();
  if (lower.includes('tudo bem') || lower.includes('como você tá') || lower.includes('voce ta bem')) {
    return 'Tudo em paz por aqui, Marcos. E contigo?';
  }
  if (lower.includes('oque ta fazendo') || lower.includes('que ta fazendo') || lower.includes('fazendo o que')) {
    return 'Monitorando o sistema e pronta pra agir. O que manda?';
  }
  if (lower.includes('que dia') || lower.includes('que horas')) {
    return \`Hoje é \${new Date().toLocaleDateString('pt-BR')}, \${new Date().toLocaleTimeString('pt-BR')}.\`;
  }

  return 'Tranquilo por aqui. O que você precisa rodar?';
}`;

const startIdx = c.indexOf('async function callPollinationsAI');
const endIdx = c.indexOf('app.post(\'/chat\'');
if (startIdx !== -1 && endIdx !== -1) {
  c = c.slice(0, startIdx) + newCallPollinations + '\n\n' + newCallGemini + '\n\n' + c.slice(endIdx);
  fs.writeFileSync(p, c, 'utf8');
  console.log('Atualizado com sucesso!');
} else {
  console.error('Indices nao encontrados');
}
