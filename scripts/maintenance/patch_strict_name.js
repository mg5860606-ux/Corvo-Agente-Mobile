const fs = require('fs');

const tgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\channels\\corvo_telegram.js';
let tg = fs.readFileSync(tgPath, 'utf8');

// Ajustar o regex para pegar estritamente 'kronos' ou 'índia'/'india'
const oldStr = "if (/\\b(kronos|índia|india|corvo|japa)\\b/i.test(text)) {";
const newStr = "if (/\\b(kronos|índia|india)\\b/i.test(text)) {";

if (tg.includes(oldStr)) {
  tg = tg.replace(oldStr, newStr);
  fs.writeFileSync(tgPath, tg, 'utf8');
  console.log('Regex atualizado com sucesso: apenas Kronos e Índia!');
} else {
  console.log('Nao encontrou oldStr exata');
}
