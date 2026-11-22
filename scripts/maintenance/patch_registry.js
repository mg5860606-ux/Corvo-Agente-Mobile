const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('C:\\xereca017\\Corvo-Agente-Mobile-Fix\\src\\core\\corvo_tools_registry.js');
let content = fs.readFileSync(targetFile, 'utf8');

// Adiciona o require do corvo_mobile_tools e registra antes do loadCustomTools
if (!content.includes('corvo_mobile_tools')) {
  const insertIndex = content.lastIndexOf('module.exports = toolsRegistry;');
  const injection = `
// Injeção de ferramentas de governo mobile do Android (Termux-API, Sensores, Apps, Hardware)
try {
  const { registerMobileTools } = require('./corvo_mobile_tools');
  registerMobileTools(toolsRegistry);
} catch (e) {
  console.warn('[MOBILE TOOLS WARN]:', e.message);
}

`;
  content = content.slice(0, insertIndex) + injection + content.slice(insertIndex);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('Injetado mobile tools em corvo_tools_registry.js com sucesso!');
} else {
  console.log('Já injetado anteriormente.');
}
