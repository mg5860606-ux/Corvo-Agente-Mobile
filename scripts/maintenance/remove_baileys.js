const fs = require('fs');
const path = require('path');

const pkgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// O @whiskeysockets/baileys tem como subdependencia o libsignal@git+https://github.com/whiskeysockets/libsignal-node.git
// No Termux/Android o npm vem com EALLOWGIT (fetching git packages disabled) por padrao em versoes recentes.
// A solucao limpa e definitiva para o repo:
// Remover @whiskeysockets/baileys das dependencias obrigatorias do package.json!
// Assim quem instala no celular para rodar Telegram e Gateway nao sofre com EALLOWGIT.
delete pkg.dependencies["@whiskeysockets/baileys"];

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('package.json atualizado: @whiskeysockets/baileys removido das dependencias padrao!');
