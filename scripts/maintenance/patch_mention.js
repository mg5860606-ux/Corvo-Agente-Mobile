const fs = require('fs');

let tg = fs.readFileSync('C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js', 'utf8');

// Substituição limpa usando indexOf
const target = "if (botUsername && text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) {\r\n                isMentioned = true;\r\n              }";
const targetUnix = "if (botUsername && text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) {\n                isMentioned = true;\n              }";

const replacement = `const lower = text.toLowerCase();
              if (botUsername && lower.includes('@' + botUsername.toLowerCase())) {
                isMentioned = true;
              }
              // Responde se chamarem pelo nome mesmo sem @ (Kronos, Índia, Corvo, Japa)
              if (/\\b(kronos|índia|india|corvo|japa)\\b/i.test(text)) {
                isMentioned = true;
              }`;

if (tg.includes(target)) {
  tg = tg.replace(target, replacement);
  fs.writeFileSync('C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js', tg, 'utf8');
  console.log('Atualizado CRLF com sucesso!');
} else if (tg.includes(targetUnix)) {
  tg = tg.replace(targetUnix, replacement);
  fs.writeFileSync('C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js', tg, 'utf8');
  console.log('Atualizado LF com sucesso!');
} else {
  // Substituicao por regex segura
  tg = tg.replace(/if\s*\(botUsername\s*&&\s*text\.toLowerCase\(\)\.includes\(`@\$\{botUsername\.toLowerCase\(\)\}`\)\)\s*\{\s*isMentioned\s*=\s*true;\s*\}/, replacement);
  fs.writeFileSync('C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js', tg, 'utf8');
  console.log('Atualizado via Regex!');
}
