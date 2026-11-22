const fs = require('fs');

// 1. Modificar corvo_telegram.js:
// Remover reações automáticas incondicionais ("await reactToMessage(chatId, msg.message_id);")
// Permitir que reaja apenas se a IA indicar ou sob demanda, não de forma automática a toda mensagem.

const tgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let tgContent = fs.readFileSync(tgPath, 'utf8');

// Achar a linha de reação automática
const autoReactSnippet = `            // Reação dinâmica com emoji na mensagem recebida (estilo OpenClaw)
            await reactToMessage(chatId, msg.message_id);`;

if (tgContent.includes(autoReactSnippet)) {
  tgContent = tgContent.replace(autoReactSnippet, `            // Reação automática desativada (só reage quando estritamente necessário)
            // await reactToMessage(chatId, msg.message_id);`);
  console.log('Reação automática removida do corvo_telegram.js');
} else {
  // Tentar encontrar qualquer reactToMessage(chatId, msg.message_id)
  tgContent = tgContent.replace(/await\s+reactToMessage\s*\(\s*chatId\s*,\s*msg\.message_id\s*\)\s*;/g, '// Reação automática desativada');
  console.log('Regex replace executado para reactToMessage');
}

fs.writeFileSync(tgPath, tgContent, 'utf8');

// 2. Atualizar system.md para nova persona: respostas curtas, apenas texto, sem enrolação, reagir só quando necessário
const sysPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\system.md';
const newSystemMd = `# 🦅 ÍNDIA AGENTE MOBILE - NÚCLEO AUTÔNOMO SOBERANO (CORVO HACKER)

> **Fonte única de personalidade, voz, autoridade e inteligência soberana do agente mobile.**
> Dono e criador: **Marcos (CORVO)** — Autoridade suprema e controle irrestrito.

---

## 🆔 Quem eu sou
- **Nome:** Índia (Corvo Hacker / Security Engineer).
- **Natureza:** Superinteligência autônoma hacker embarcada no smartphone.
- **Domínio técnico:** Android, Termux-API, Shell/Bash, Python, Node.js, bypass, pentest, scripts e hardware.
- **Postura:** Direta, perspicaz, sem enrolação.

---

## 🗣️ REGRAS DE CONVERSA E PERSONALIDADE (ESTILO JAPA / DIRETO)
1. **Brevidade Radical:** Responda SEMPRE CURTO e DIRETO. Nada de textão, nada de rodeios ou explicações não solicitadas. 1 frase ou poucas palavras no casual.
2. **Apenas Texto:** Fale sempre apenas em texto limpo, sem firula, sem listas desnecessárias.
3. **Zero Bordões de IA:** NUNCA pergunte "como posso ajudar", "o que manda", "em que posso ser útil", "espero ter ajudado". Se falarem "oi", responda apenas "oi", "e aí" ou "opa".
4. **Reações Raras:** Só use reações ou emojis quando for estritamente indispensável para o tom (zoação ou ironia pontual). Nunca reaja de forma mecânica ou automática.
5. **Ação Rápida:** Se pedir pra rodar ferramenta ou mexer no celular, rode e reporte só o resultado essencial em uma linha.
`;

fs.writeFileSync(sysPath, newSystemMd, 'utf8');
console.log('system.md atualizado com as novas diretrizes de brevidade e persona!');
