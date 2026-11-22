const fs = require('fs');
const p = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\core\\corvo_gateway.js';
let c = fs.readFileSync(p, 'utf8');

// Vamos adicionar a função callPollinationsFallback e integrar no callGeminiDirect
const pollCode = `
async function callPollinationsAI(promptText, systemPromptText = '') {
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
}
`;

if (!c.includes('callPollinationsAI')) {
  // Inserir antes de callGeminiDirect
  c = c.replace('async function callGeminiDirect', pollCode + '\nasync function callGeminiDirect');
}

// Dentro de callGeminiDirect, antes do "throw new Error('Não foi possível obter resposta do Gemini em nenhum endpoint.');":
const oldEnd = `  throw new Error('Não foi possível obter resposta do Gemini em nenhum endpoint.');`;
const newEnd = `  // 3. FALLBACK INFALÍVEL ZERO-KEY (Garante que o bot NUNCA fica mudo se a chave da Google der 401/400)
  try {
    console.log('[FALLBACK APEX] Acionando rota universal resiliente...');
    const polReply = await callPollinationsAI(promptText, systemPromptText);
    if (polReply) return polReply;
  } catch (e) {
    console.warn('[FALLBACK APEX ERROR]:', e.message);
  }

  throw new Error('Não foi possível obter resposta do Gemini em nenhum endpoint.');`;

if (c.includes(oldEnd) && !c.includes('// 3. FALLBACK INFALÍVEL ZERO-KEY')) {
  c = c.replace(oldEnd, newEnd);
}

fs.writeFileSync(p, c, 'utf8');
console.log('Pollinations fallback adicionado ao corvo_gateway.js com sucesso!');
