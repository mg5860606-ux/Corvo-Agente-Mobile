const { registerMobileTools } = require('./corvo_mobile_tools');

// [Injeção Mobile Tools] Adiciona ferramentas nativas do Android ao catálogo
try {
  registerMobileTools(toolsRegistry);
} catch (mobileErr) {
  console.warn('[MOBILE TOOLS WARN] Falha ao carregar mobile tools:', mobileErr.message);
}
