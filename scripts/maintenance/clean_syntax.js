const fs = require('fs');
const path = require('path');

const repo = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix';
const gwPath = path.join(repo, 'src\\core\\corvo_gateway.js');
const loopPath = path.join(repo, 'src\\core\\corvo_loop.js');

// 1. Limpar corvo_gateway.js
let gw = fs.readFileSync(gwPath, 'utf8');

// O trecho com duplicação em corvo_gateway.js:
// } catch (fbErr) {
//       throw new Error(`ISA Cloud erro: ${lastErr?.message} | Google fallback: ${fbErr.message}`);
//     }
//   } else if (!reply && lastErr) {
//     throw lastErr;
//   }
// } catch (fbErr) { ...
const badGwBlock = `    } catch (fbErr) {
          throw new Error(\`ISA Cloud erro: \${lastErr?.message} | Google fallback: \${fbErr.message}\`);
        }
      } else if (!reply && lastErr) {
        throw lastErr;
      }
    } else if (genAI) {
      const fbModel = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const fallbackResp = await fbModel.generateContent(contents);
      reply = fallbackResp.response.text().trim();
    }`;

gw = gw.replace(badGwBlock, '');

// 2. Limpar corvo_loop.js
let loop = fs.readFileSync(loopPath, 'utf8');

const badLoopBlock = `} catch (fbErr) {
            throw new Error(\`ISA Cloud: \${lastErr?.message} | Gemini Fallback: \${fbErr.message}\`);
          }
        } else if (!replyText && lastErr) {
          throw lastErr;
        }
      } else if (genAI) {
        const fallbackModel = genAI.getGenerativeModel({
          model: 'gemini-flash-latest',
          generationConfig: { temperature: 0.2 }
        });
        const geminiPrompt = messages.map(m => \`[\${m.role.toUpperCase()}]: \${m.content}\`).join('\\n\\n');
        const fbRes = await fallbackModel.generateContent(geminiPrompt);
        replyText = fbRes.response.text().trim();
      }`;

loop = loop.replace(badLoopBlock, '');

fs.writeFileSync(gwPath, gw, 'utf8');
fs.writeFileSync(loopPath, loop, 'utf8');

console.log('Arquivos limpos, verificando sintaxe com require...');
