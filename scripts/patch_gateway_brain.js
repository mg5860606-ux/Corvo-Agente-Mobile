const fs = require('fs');
const path = require('path');

const gwPath = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/core/corvo_gateway.js';
let gw = fs.readFileSync(gwPath, 'utf8');

// 1. ATUALIZAR callGeminiDirect PARA USAR GOOGLE AI STUDIO COM FALLBACK ROBUSTO
const oldCallGemini = `  // 1. Google AI Studio (se chave for válida AIzaSy)
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

  return 'Tranquilo por aqui. O que você precisa rodar?';`;

const newCallGemini = `  // 1. Google AI Studio Oficial (Gemini 2.5 Pro / Flash / 2.0 Flash)
  if (genAI && apiKey) {
    const modelsToTry = [
      process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-flash-latest'
    ];

    for (const mod of modelsToTry) {
      try {
        const modelInstance = genAI.getGenerativeModel({
          model: mod,
          systemInstruction: systemPromptText ? { parts: [{ text: systemPromptText }] } : undefined
        });
        const res = await Promise.race([
          modelInstance.generateContent(contentsPrompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_GEMINI')), 15000))
        ]);
        const text = res.response.text();
        if (text && text.trim()) return text.trim();
      } catch (err) {
        console.warn(\`[GEMINI WARN \${mod}]:\`, err.message);
      }
    }
  }

  // 2. Fallback de IA Real via Pollinations (sem frases engessadas)
  const polReply = await callPollinationsAI(promptText, systemPromptText);
  if (polReply) return polReply;

  return 'Minha conexão com a IA oscilou por um segundo, Marcos. Pode mandar de novo?';`;

gw = gw.replace(oldCallGemini, newCallGemini);

// 2. REMOVER O SEQUESTRO DE MENSAGENS EM if (/\b(bateria...)/)
// Em vez de retornar JSON cru no meio da conversa, passa a informação para o prompt da IA responder naturalmente!
const oldIntercept = `      // Bateria
      if (/\\b(bateria|status da bateria|nível de bateria)\\b/i.test(message)) {
        const bat = sensors.statusBateria();
        return res.json({
          reply: \`Status da bateria, Marcos:\\n\${bat.output || JSON.stringify(bat, null, 2)}\`
        });
      }`;

const newIntercept = `      // Telemetria contextual da bateria (injetada no cérebro da IA para resposta 100% natural)
      if (/\\b(bateria|nível de bateria|por cento|porcentagem|carga|carregando)\\b/i.test(message)) {
        const bat = sensors.statusBateria();
        const batContext = bat.success 
          ? \`[INFO DO HARDWARE: O celular está com \${bat.percentage}% de bateria, status: \${bat.status || 'normal'}]\`
          : \`[INFO DO HARDWARE: Não foi possível ler a porcentagem da bateria agora. Motivo: \${bat.error || 'Termux:API não respondeu'}]\`;
        contents.push(batContext);
      }`;

gw = gw.replace(oldIntercept, newIntercept);

fs.writeFileSync(gwPath, gw, 'utf8');
console.log('[OK] corvo_gateway.js atualizado com IA Google Studio pura e natural!');
