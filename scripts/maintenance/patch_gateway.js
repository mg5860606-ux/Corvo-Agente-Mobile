const fs = require('fs');
const path = require('path');

const repoPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix';
const gwPath = path.join(repoPath, 'src\\core\\corvo_gateway.js');
const loopPath = path.join(repoPath, 'src\\core\\corvo_loop.js');
const tgPath = path.join(repoPath, 'src\\channels\\corvo_telegram.js');
const envExamplePath = path.join(repoPath, '.env.example');
const quickSetupPath = path.join(repoPath, 'src\\core\\quick_setup.js');

// 1. Corrigir corvo_gateway.js
let gw = fs.readFileSync(gwPath, 'utf8');

// Adicionar resolução inteligente de modelo Gemini e chamada nativa prioritária
// Quando PRIMARY_PROVIDER === 'gemini' ou se openaiClient não responder
const newProviderSetup = `
// ================= MOTOR DE IA MULTI-PROVEDOR ROBUSTO =================
const apiKey = (process.env.GEMINI_API_KEY || '').trim();
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Configuração ISA Cloud / OmniRoute (Opcional - só ativa se explicitamente configurada e não vazia)
const isaBaseUrl = (process.env.ISACLOUD_BASE_URL || process.env.OPENAI_BASE_URL || '').trim();
const isaApiKey = (process.env.ISACLOUD_API_KEY || process.env.OPENAI_API_KEY || '').trim();
const openaiClient = (isaBaseUrl && isaApiKey)
  ? new OpenAI({ baseURL: isaBaseUrl, apiKey: isaApiKey })
  : null;

const PRIMARY_PROVIDER = (process.env.PRIMARY_PROVIDER || (openaiClient ? 'isacloud' : 'gemini')).toLowerCase();
let GEMINI_MODEL = (process.env.GEMINI_MODEL || process.env.PRIMARY_MODEL || 'gemini-2.0-flash').trim();

// Lista de modelos resilientes do Google Gemini (se o usuário tiver conta recente ou antiga)
const GOOGLE_FALLBACK_MODELS = [
  GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-pro'
].filter((v, i, a) => v && a.indexOf(v) === i);
`;

gw = gw.replace(/const apiKey = process\.env\.GEMINI_API_KEY;[\s\S]*?const openaiClient = \(isaBaseUrl && isaApiKey\)[\s\S]*?: null;/, newProviderSetup.trim());

// Função helper para chamar Google Gemini com auto-fallback de versão de modelo
const geminiCallerFn = `
async function callGeminiDirect(contentsPrompt, systemPromptText = '') {
  if (!genAI) throw new Error('GEMINI_API_KEY não configurada no .env');
  
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
        GEMINI_MODEL = modName; // Registra o modelo que funcionou
        return text.trim();
      }
    } catch (err) {
      lastErr = err;
      // Se for erro de modelo não encontrado (404), tenta o próximo da lista de fallbacks
      if (err.message && (err.message.includes('404') || err.message.includes('not found') || err.message.includes('is not supported'))) {
        console.warn(\`[GEMINI FALLBACK] Modelo "\${modName}" não suportado nesta conta/chave, tentando próximo...\`);
        continue;
      }
      // Se for erro 400 de chave inválida ou outro erro fatal, propaga
      throw err;
    }
  }
  throw lastErr || new Error('Nenhum modelo Gemini compatível respondeu.');
}
`;

if (!gw.includes('function callGeminiDirect')) {
  gw = gw.replace('app.post(\'/chat\', async (req, res) => {', geminiCallerFn + '\napp.post(\'/chat\', async (req, res) => {');
}

// Substituir o miolo de chamada de IA no app.post('/chat')
const oldChatCallPattern = /let reply = '';[\s\S]*?if \(openaiClient\) {[\s\S]*?reply = fallbackResp\.response\.text\(\)\.trim\(\);[\s\S]*?}/;

const newChatCallLogic = `let reply = '';
    
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
    } else if (openaiClient) {
      // ISA Cloud / OmniRoute ativo
      const candidateModels = [
        activeModelId,
        'agy/gemini-3.8-flash-high',
        'dual/gemini-3.8-flash-high',
        'isacloud/gemini-3.8-flash-high',
        'gemini-2.5-flash'
      ];
      let lastErr = null;
      for (const mId of candidateModels) {
        try {
          const resAI = await openaiClient.chat.completions.create({
            model: mId,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent }
            ],
            temperature: 0.7,
            max_tokens: 1500
          });
          reply = resAI.choices?.[0]?.message?.content?.trim() || '';
          if (reply) { lastErr = null; break; }
        } catch (e) {
          lastErr = e;
          console.warn(\`[CHAT API WARN] Modelo \${mId} na ISA Cloud falhou (\${e.message}), tentando próximo...\`);
        }
      }
      if (!reply && genAI) {
        try {
          console.log('[CHAT API] ISA Cloud indisponível, usando fallback direto no Google Gemini...');
          reply = await callGeminiDirect(contents, systemPrompt);
        } catch (fbErr) {
          throw new Error(\`ISA Cloud erro: \${lastErr?.message} | Google fallback: \${fbErr.message}\`);
        }
      } else if (!reply && lastErr) {
        throw lastErr;
      }
    }`;

gw = gw.replace(oldChatCallPattern, newChatCallLogic);

fs.writeFileSync(gwPath, gw, 'utf8');
console.log('✅ corvo_gateway.js corrigido com sucesso!');
