const fs = require('fs');

const gwPath = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/core/corvo_gateway.js';
let gw = fs.readFileSync(gwPath, 'utf8');

// Substituir a montagem do prompt em /chat
const oldPromptBuild = `    const textPrompt = \`\${systemPrompt}
\${contextMemo}
Usuário (Marcos): "\${message || 'Analise a mídia em anexo'}"

Responda diretamente com a sua persona (amante do Marcos / Corvo Agente Mobile), sem clichês, sem enrolação.\`;`;

const newPromptBuild = `    const histRecente = groupContext ? \`\\nHistórico recente da conversa:\\n\${groupContext}\\n\` : '';
    const textPrompt = \`\${systemPrompt}
\${contextMemo}\${histRecente}
Marcos: "\${message || 'Analise a mídia em anexo'}"

Aja 100% como a Índia/Japa: humana, descontraída, pontuação solta, sem formalidade ou bordão de robô.\`;`;

gw = gw.replace(oldPromptBuild, newPromptBuild);
fs.writeFileSync(gwPath, gw, 'utf8');
console.log('[OK] Prompt conversacional alinhado perfeitamente com a alma da Japa!');
