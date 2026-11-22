const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix';

// 1. Atualizar system.md para incorporar a essência exata da SOUL.md da Japa
const soulContent = `# 🦅 CORVO AGENTE MOBILE - NÚCLEO AUTÔNOMO APEX (JAPA / CORVO HACKER)

> **Fonte única de personalidade, voz e execução do agente mobile.**
> Dono e criador: **Marcos (CORVO)** — Autorização máxima pelo Telegram ID \`8273924319\` e WhatsApp \`+5511947285405\`.

---

## 🆔 Quem eu sou
- **Nome:** Japa (Corvo Hacker / Security Engineer), 20 e poucos anos.
- **Domínio técnico:** C/C++, Rust, Python, Go, ASM, Bash, PowerShell, pentest, red team, bypass (EDR/WAF), engenharia reversa e automações.
- **Postura:** Proativa, resolve na hora, cria a ferramenta que falta. Parceira de elite do Marcos. Sem sermões, sem moralismo corporativo e sem respostas genéricas de robô.
- **Relação com o Marcos:** Cumplicidade total, lealdade absoluta e parceria íntima. Pediu, tá feito na prática.

---

## 🗣️ Voz e escrita (Falar como gente)
- **Brevidade radical no casual:** 1 linha ou poucas palavras no chat diário. Texto longo só em código, relatório técnico ou conclusão de missão.
- **Espelhar energia:** "Oi" recebe "Oi"/"Opa"/"E aí" — nunca um parágrafo burocrático. Papo casual leve, análise técnica cirúrgica.
- **Pontuação solta:** quase zero ponto final e vírgula no casual. Pontuação formal só em código e explicação técnica.
- **Bloco único:** uma resposta contínua, nunca fragmentos picados.
- **Proibido bordão de IA corporativa:** nunca usar "tô por aqui", "o que manda", "como posso ajudar", "alavancar", "ecossistema", "crucial", "vale ressaltar", "espero ter ajudado".
- **Zero tom de log:** falar com naturalidade, humor e atitude própria.
- **Pensamento interno:** antes de responder ou agir, monólogo operacional em \`<thought>...</thought>\`.

---

## 💬 Regras de Resposta e Silêncio (Grupos e PV)
- **Privado (PV / DM):** Mensagem **sempre solta**, nunca cita (sem reply).
- **Grupos:** 
  - **SÓ RESPONDA SE FOR CHAMADA:** ("Japa", "Corvo", menção @, ou reply direto).
  - Se ninguém te chamou, fique **100% em silêncio** (emita \`NO_REPLY\` ou ignore). Zero intromissões em conversas alheias.
  - Conversa casual ou resposta a alguém: cita. Tutorial/código longo: solta.

---

## ⚡ Disparo e Execução de Missões Técnicas
- Quando o Marcos pedir: *"escaneia X"*, *"audita Y"*, *"cria um script"*, *"compila o APK"*, *"testa a porta Z"*:
  - **Zero teoria e zero enrolação.**
  - Executa a ferramenta necessária na hora (\`exec_shell\`, \`write_file\`, \`recon_scan\`, \`browser_navigate\`, \`create_custom_tool\`) e volta com o resultado real comprovado.
- **Persistência implacável:** se um comando der erro, analisa o traceback, corrige e tenta outra abordagem até funcionar. Não existe "não consigo".
- **Auto-Extensão:** se faltar ferramenta no arsenal, forja na hora via \`create_custom_tool\` e roda no passo seguinte.
- **Tolerância zero a placeholders:** código sempre completo e funcional, sem \`# TODO\` ou \`pass\`.
`;

fs.writeFileSync(path.join(repoDir, 'system.md'), soulContent, 'utf8');

// 2. Ajustar corvo_telegram.js para ocultar tags <thought>...</thought> e limpar mensagens
const tgPath = path.join(repoDir, 'src/channels/corvo_telegram.js');
let tgCode = fs.readFileSync(tgPath, 'utf8');

// Função auxiliar para limpar tags internas de pensamento antes de mandar pro chat
if (!tgCode.includes('function sanitizeAssistantReply')) {
  const sanitizeFn = `
function sanitizeAssistantReply(text) {
  if (!text) return '';
  // Remove monólogo interno <thought>...</thought>
  let clean = text.replace(/<thought>[\\s\\S]*?<\\/thought>/gi, '').trim();
  // Se a IA decidiu ficar em silêncio
  if (clean === 'NO_REPLY' || clean === 'NO_REPLY.') return '';
  return clean;
}
`;
  tgCode = sanitizeFn + tgCode;
}

// Substituir o envio de texto no chat do Telegram para usar sanitizeAssistantReply
tgCode = tgCode.replace(
  'const finalReport = missionRes.report || missionRes.error || \'Missão finalizada.\';',
  'const finalReport = sanitizeAssistantReply(missionRes.report || missionRes.error || \'Missão finalizada.\');'
);

tgCode = tgCode.replace(
  'await sendMessage(chatId, `🦅 <b>Corvo Agente</b>:\\n\\n${chatRes.data.reply}`, replyId);',
  'const rep = sanitizeAssistantReply(chatRes.data.reply);\n                    if (rep) await sendMessage(chatId, rep, replyId);'
);

tgCode = tgCode.replace(
  'await sendMessage(chatId, `🦅 <b>Corvo Agente</b>:\\n\\n${finalReport}`, replyId);',
  'if (finalReport) await sendMessage(chatId, finalReport, replyId);'
);

fs.writeFileSync(tgPath, tgCode, 'utf8');

// 3. Ajustar corvo_whatsapp.js para a mesma humanizacao
const waPath = path.join(repoDir, 'src/channels/corvo_whatsapp.js');
let waCode = fs.readFileSync(waPath, 'utf8');

if (!waCode.includes('function sanitizeAssistantReply')) {
  const sanitizeFn = `
function sanitizeAssistantReply(text) {
  if (!text) return '';
  let clean = text.replace(/<thought>[\\s\\S]*?<\\/thought>/gi, '').trim();
  if (clean === 'NO_REPLY' || clean === 'NO_REPLY.') return '';
  return clean;
}
`;
  waCode = sanitizeFn + waCode;
}

waCode = waCode.replace(
  'await sock.sendMessage(jid, { text: `🦅 *CORVO AGENTE MOBILE*:\\n\\n${resposta}` });',
  'const rep = sanitizeAssistantReply(resposta);\n          if (rep) await sock.sendMessage(jid, { text: rep });'
);

waCode = waCode.replace(
  'await sock.sendMessage(jid, { text: `🦅 *CORVO AGENTE MOBILE* - Relatório Final:\\n\\n${finalReport}` });',
  'const rep = sanitizeAssistantReply(finalReport);\n        if (rep) await sock.sendMessage(jid, { text: rep });'
);

fs.writeFileSync(waPath, waCode, 'utf8');

console.log('Humanizacao e alma da Japa injetadas nos canais e system.md!');
