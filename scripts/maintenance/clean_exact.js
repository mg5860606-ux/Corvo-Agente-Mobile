const fs = require('fs');
const path = require('path');

const repo = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix';
const gwPath = path.join(repo, 'src\\core\\corvo_gateway.js');
const loopPath = path.join(repo, 'src\\core\\corvo_loop.js');

// 1. Limpar e reescrever o bloco problemático em corvo_gateway.js
let gw = fs.readFileSync(gwPath, 'utf8');

// Localiza o bloco de chamada no /chat
const gwTargetStart = "      if (!reply && genAI) {";
const gwTargetEnd = "    // Registra no banco";

const p1 = gw.indexOf(gwTargetStart);
const p2 = gw.indexOf(gwTargetEnd, p1);

if (p1 !== -1 && p2 !== -1) {
  const cleanGwMiddle = `      if (!reply && genAI) {
        try {
          console.log('[CHAT API] ISA Cloud indisponível, usando fallback direto no Google Gemini...');
          reply = await callGeminiDirect(contents, systemPrompt);
        } catch (fbErr) {
          throw new Error(\`ISA Cloud erro: \${lastErr?.message} | Google fallback: \${fbErr.message}\`);
        }
      } else if (!reply && lastErr) {
        throw lastErr;
      }
    }

`;
  gw = gw.slice(0, p1) + cleanGwMiddle + gw.slice(p2);
  fs.writeFileSync(gwPath, gw, 'utf8');
  console.log('✅ corvo_gateway.js limpo!');
} else {
  console.log('❌ Não encontrou limites em corvo_gateway.js');
}

// 2. Limpar e reescrever o bloco em corvo_loop.js
let loop = fs.readFileSync(loopPath, 'utf8');

const loopTargetStart = "        if (!replyText && genAI) {";
const loopTargetEnd = "      console.log(`[AGENTE RACIOCÍNIO]:";

const lp1 = loop.indexOf(loopTargetStart);
const lp2 = loop.indexOf(loopTargetEnd, lp1);

if (lp1 !== -1 && lp2 !== -1) {
  const cleanLoopMiddle = `        if (!replyText && genAI) {
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
  loop = loop.slice(0, lp1) + cleanLoopMiddle + loop.slice(lp2);
  fs.writeFileSync(loopPath, loop, 'utf8');
  console.log('✅ corvo_loop.js limpo!');
} else {
  console.log('❌ Não encontrou limites em corvo_loop.js');
}
