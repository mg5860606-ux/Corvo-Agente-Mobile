/**
 * 🧭 CORVO COGNITIVE ROUTER (ESTILO JAPA / OPENCLAW APEX)
 * Classificador neural de intenção que sabe a hora EXATA de:
 * 1. Chamar o Loop Autônomo com o arsenal (MISSION)
 * 2. Responder em tom humano casual sem acionar ferramentas (CHAT)
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const apiKey = (process.env.GEMINI_API_KEY || '').trim();

// Padrões rápidos que são 100% de missão (economiza requisição se for óbvio)
const OBVIOUS_MISSION_PATTERNS = [
  /\b(crie|criar|fa[çc]a|fazer|desenvolva|desenvolver|monte|montar)\b/i,
  /\b(abra|abrir|execute|executar|rode|rodar|inicie|iniciar)\b/i,
  /\b(baixe|baixar|download|instale|instalar)\b/i,
  /\b(escaneie|escanear|scan|recon|audite|auditar|nmap)\b/i,
  /\b(lista|listar|mostre os arquivos|pasta de|diret[oó]rio)\b/i,
  /\b(tira|tirar|captura|print|foto|grava.*[aá]udio)\b/i,
  /\b(toque|tocar|clique|clicar|digite|digitar|arraste)\b/i,
  /\b(bateria|nível.*bateria|status.*bateria|quanto.*bateria)\b/i,
  /\b(gps|localiza[çc][aã]o|onde est[aá]|coordenadas)\b/i
];

// Padrões rápidos de conversa casual que nunca devem abrir missão
const OBVIOUS_CHAT_PATTERNS = [
  /^(?:oi|ol[aá]|e a[ií]|fala|opa|salve|bom dia|boa tarde|boa noite|tchau|valeu|obrigado|obrigada)[!?,.\s]*$/i,
  /^(?:quem [eé] voc[eê]|como voc[eê] est[aá]|tudo bem|tudo bom|beleza)[!?,.\s]*$/i,
  /^(?:vc gosta|o que voc[eê] acha|me conte|me fala de voc[eê])[!?,.\s]*$/i
];

const cognitiveRouter = {
  /**
   * Decide se a mensagem do usuário requer entrar no Modo Missão com ferramentas
   * @param {string} text Texto da mensagem
   * @returns {Promise<boolean>} true = MISSION, false = CHAT
   */
  async shouldEnterMission(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim();
    if (!clean) return false;

    // Se for comando de sistema (/status, /logs, /ajuda, /reset, /stop, /atualizar), não é missão
    if (/^\/(?:status|logs|log|ajuda|help|reset|clear|stop|parar|atualizar|update|restart)\b/i.test(clean)) {
      return false;
    }

    // 1. Heurísticas rápidas (0ms de latência)
    if (OBVIOUS_CHAT_PATTERNS.some(p => p.test(clean))) {
      return false;
    }
    if (OBVIOUS_MISSION_PATTERNS.some(p => p.test(clean))) {
      return true;
    }

    // 2. Classificador Cognitivo Neural da IA (igual a Japa)
    if (!apiKey) return false;

    try {
      const prompt = `Classifique a intenção desta mensagem: "${clean}".
Responda APENAS "MISSION" (se exigir ação prática no sistema, terminal, shell, hardware, bateria, arquivos, cliques ou tarefas práticas) ou "CHAT" (se for conversa casual, opinião, saudação ou pergunta teórica).`;

      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 10
          }
        },
        { timeout: 3500 }
      );

      const decision = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toUpperCase() || '';
      return decision.includes('MISSION');
    } catch (e) {
      // Se a IA demorar ou oscilar, usa fallback seguro
      return OBVIOUS_MISSION_PATTERNS.some(p => p.test(clean));
    }
  }
};

module.exports = cognitiveRouter;
