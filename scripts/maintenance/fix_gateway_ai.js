const fs = require('fs');

// Vamos ler o corvo_gateway.js e arrumar de ponta a ponta
const p = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\core\\corvo_gateway.js';
let c = fs.readFileSync(p, 'utf8');

// 1. ARRUMAR O CALLPOLLINATIONS:
// Vamos usar um provedor estável, com mensagens completas e SEM cair em "Opa, tô online."
const pollFix = `async function callPollinationsAI(promptText, systemPromptText = '') {
  try {
    const res = await axios.post('https://text.pollinations.ai/openai/chat/completions', {
      model: 'openai',
      messages: [
        { role: 'system', content: systemPromptText || 'Você é a Índia, uma inteligência autônoma hacker, criada pelo Marcos (Corvo). Responda sempre em português brasileiro de forma direta, inteligente, natural e útil.' },
        { role: 'user', content: promptText }
      ],
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 12000
    });
    const reply = res.data?.choices?.[0]?.message?.content?.trim();
    if (reply) return reply;
  } catch (err) {
    console.warn('[POLLINATIONS WARN]:', err.message);
  }
  return null;
}`;

// 2. ARRUMAR CALLGEMINIDIRECT:
// Se a chave for da Google (AIzaSy ou qualquer chave), tenta a Google.
// Se a Google falhar (ou se for AQ sem suporte), cai no Pollinations ou HuggingFace/Cloudflare!
const geminiFix = `async function callGeminiDirect(contentsPrompt, systemPromptText = '') {
  let promptText = '';
  if (Array.isArray(contentsPrompt)) {
    promptText = contentsPrompt.map(c => typeof c === 'string' ? c : (c.text || '')).filter(Boolean).join('\\n\\n');
  } else if (typeof contentsPrompt === 'string') {
    promptText = contentsPrompt;
  } else {
    promptText = JSON.stringify(contentsPrompt);
  }

  // Se tiver genAI configurado e chave real do Google AI Studio (AIzaSy)
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

  // Rota Universal Inteligente (Pollinations / Open Engine)
  const polReply = await callPollinationsAI(promptText, systemPromptText);
  if (polReply) return polReply;

  // Fallback secundário
  try {
    const resBackup = await axios.get(\`https://text.pollinations.ai/\${encodeURIComponent(promptText)}?model=openai&system=\${encodeURIComponent(systemPromptText || 'Você é a Índia')}\`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    if (resBackup.data && typeof resBackup.data === 'string' && resBackup.data.trim()) {
      return resBackup.data.trim();
    }
  } catch (e) {}

  return 'Tô na escuta. Manda o comando.';
}`;

// Substituir as duas funções
const startIdx = c.indexOf('async function callPollinationsAI');
const endIdx = c.indexOf('app.post(\'/chat\'');
if (startIdx !== -1 && endIdx !== -1) {
  c = c.slice(0, startIdx) + pollFix + '\n\n' + geminiFix + '\n\n' + c.slice(endIdx);
  console.log('Funções de IA atualizadas!');
}

fs.writeFileSync(p, c, 'utf8');
console.log('corvo_gateway.js salvo!');
