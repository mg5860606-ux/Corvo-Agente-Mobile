const fs = require('fs');
const path = require('path');

const pkgPath = 'C:\\xereca017\\Corvo-Agente-Mobile-Fix\\package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// O pacote @whiskeysockets/baileys no package.json original vinha com URL git+ssh:// que o Termux bloqueia por EALLOWGIT
// No npm registry oficial o baileys está publicado como ^6.7.9 ou ^6.6.0 estável sem requerer SSH!
// Ou podemos usar @whiskeysockets/baileys: "^6.7.9" ou 6.6.0 direto do npm
pkg.dependencies["@whiskeysockets/baileys"] = "^6.7.9";

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('package.json atualizado com baileys oficial do npm registry!');
