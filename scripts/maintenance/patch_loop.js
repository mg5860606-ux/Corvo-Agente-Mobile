const fs = require('fs');
const path = require('path');

const repoPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix';
const loopPath = path.join(repoPath, 'src\\core\\corvo_loop.js');

let loop = fs.readFileSync(loopPath, 'utf8');

// 1. Corrigir imports e setup de provedores em corvo_loop.js
const oldLoopHeaderPattern = /const openaiBaseUrl = process\.env\.ISACLOUD_BASE_URL[\s\S]*?const genAI = geminiApiKey \? new GoogleGenerativeAI\(geminiApiKey\) : null;/;

const newLoopHeader = `
const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

const openaiBaseUrl = (process.env.ISACLOUD_BASE_URL || process.env.OPENAI_BASE_URL || '').trim();
const openaiApiKey = (process.env.ISACLOUD_API_KEY || process.env.OPENAI_API_KEY || '').trim();
const openaiClient = (openaiBaseUrl && openaiApiKey)
  ? new OpenAI({ baseURL: openaiBaseUrl, apiKey: openaiApiKey })
  : null;

const PRIMARY_PROVIDER = (process.env.PRIMARY_PROVIDER || (openaiClient ? 'isacloud' : 'gemini')).toLowerCase();
let GEMINI_MODEL = (process.env.GEMINI_MODEL || process.env.PRIMARY_MODEL || 'gemini-2.0-flash').trim();

const GOOGLE_FALLBACK_MODELS = [
  GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-pro'
].filter((v, i, a) => v && a.indexOf(v) === i);

async function callGeminiForLoop(promptText) {
  if (!genAI) throw new Error('GEMINI_API_KEY não configurada no .env');
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
        console.warn(\`[LOOP GEMINI FALLBACK] Modelo "\${modName}" não suportado, tentando próximo...\`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Nenhum modelo Gemini compatível respondeu no loop.');
}
`;

loop = loop.replace(oldLoopHeaderPattern, newLoopHeader.trim());

// 2. Corrigir a chamada de IA dentro da execução da missão
const oldLoopCallPattern = /if \(openaiClient\) {[\s\S]*?replyText = fbRes\.response\.text\(\)\.trim\(\);[\s\S]*?}/;

const newLoopCall = `
      const geminiPrompt = messages.map(m => \`[\${m.role.toUpperCase()}]: \${m.content}\`).join('\\n\\n');

      if (PRIMARY_PROVIDER === 'gemini' || !openaiClient) {
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
      } else if (openaiClient) {
        const candidateModels = [
          activeModel,
          'agy/gemini-3.8-flash-high',
          'dual/gemini-3.8-flash-high',
          'isacloud/gemini-3.8-flash-high',
          'gemini-2.5-flash'
        ];
        let lastErr = null;
        for (const mId of candidateModels) {
          try {
            const completion = await openaiClient.chat.completions.create({
              model: mId,
              messages: messages.slice(-12),
              temperature: 0.2
            });
            replyText = completion.choices[0]?.message?.content?.trim() || '';
            if (replyText) { lastErr = null; break; }
          } catch (omniErr) {
            lastErr = omniErr;
            console.warn(\`[LOOP WARN] Modelo (\${mId}) falhou: \${omniErr.message}. Tentando próximo...\`);
          }
        }
        if (!replyText && genAI) {
          try {
            console.log('[LOOP] ISA Cloud indisponível, usando fallback no Gemini...');
            replyText = await callGeminiForLoop(geminiPrompt);
          } catch (fbErr) {
            throw new Error(\`ISA Cloud: \${lastErr?.message} | Gemini Fallback: \${fbErr.message}\`);
          }
        } else if (!replyText && lastErr) {
          throw lastErr;
        }
      }
`;

loop = loop.replace(oldLoopCallPattern, newLoopCall.trim());

fs.writeFileSync(loopPath, loop, 'utf8');
console.log('✅ corvo_loop.js corrigido com sucesso!');
