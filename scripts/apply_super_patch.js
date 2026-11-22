const fs = require('fs');
const path = require('path');

const ROOT = 'C:/xereca017/Corvo-Agente-Mobile-Fix';

// 1. ATUALIZAR CORVO_GOD_MODE.JS COM TOUCH, SWIPE, DIGITAÇÃO E KEYEVENTS
const godModePath = path.join(ROOT, 'src/modules/corvo_god_mode.js');
let god = fs.readFileSync(godModePath, 'utf8');

const touchCode = `
  /** Clica em uma coordenada exata da tela (requer ADB ou Root ou Termux X11) */
  tocarNaTela(x, y) {
    return runCommand(\`input tap \${x} \${y} || su -c "input tap \${x} \${y}"\`);
  },

  /** Rola ou arrasta a tela de (x1, y1) até (x2, y2) */
  deslizarTela(x1, y1, x2, y2, duracao = 300) {
    return runCommand(\`input swipe \${x1} \${y1} \${x2} \${y2} \${duracao} || su -c "input swipe \${x1} \${y1} \${x2} \${y2} \${duracao}"\`);
  },

  /** Digita um texto no campo focado da tela */
  digitarTexto(texto) {
    const textoSanitizado = String(texto).replace(/["\\\\]/g, '\\\\$&').replace(/ /g, '%s');
    return runCommand(\`input text "\${textoSanitizado}" || su -c "input text '\${textoSanitizado}'"\`);
  },

  /** Pressiona teclas do Android (ex: 3=Home, 4=Voltar, 66=Enter, 26=Power) */
  pressionarTecla(keyCode) {
    return runCommand(\`input keyevent \${keyCode} || su -c "input keyevent \${keyCode}"\`);
  },
`;

if (!god.includes('tocarNaTela')) {
  god = god.replace('vibrar(milissegundos = 500) {', touchCode + '  vibrar(milissegundos = 500) {');
  fs.writeFileSync(godModePath, god, 'utf8');
  console.log('[OK] corvo_god_mode.js atualizado com touch/swipe/type');
}

// 2. ATUALIZAR CORVO_MOBILE_TOOLS.JS COM REGISTRO DESSAS TOOLS PARA A IA USAR
const mobileToolsPath = path.join(ROOT, 'src/core/corvo_mobile_tools.js');
let mob = fs.readFileSync(mobileToolsPath, 'utf8');

const touchTools = `
  // 12. Tocar na tela (Touch / Click em coordenadas X, Y)
  toolsRegistry['mobile_touch_tap'] = {
    description: 'Toca/clica em uma coordenada exata (X, Y) na tela do celular Android.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Coordenada horizontal X na tela (pixels)' },
        y: { type: 'number', description: 'Coordenada vertical Y na tela (pixels)' }
      },
      required: ['x', 'y']
    },
    execute: async ({ x, y }) => {
      return androidGodMode.tocarNaTela(x, y);
    }
  };

  // 13. Deslizar / Rolar Tela (Swipe)
  toolsRegistry['mobile_touch_swipe'] = {
    description: 'Desliza ou rola a tela do celular do ponto (x1, y1) até (x2, y2).',
    parameters: {
      type: 'object',
      properties: {
        x1: { type: 'number', description: 'X inicial' },
        y1: { type: 'number', description: 'Y inicial' },
        x2: { type: 'number', description: 'X final' },
        y2: { type: 'number', description: 'Y final' },
        durationMs: { type: 'number', description: 'Duração em ms', default: 300 }
      },
      required: ['x1', 'y1', 'x2', 'y2']
    },
    execute: async ({ x1, y1, x2, y2, durationMs = 300 }) => {
      return androidGodMode.deslizarTela(x1, y1, x2, y2, durationMs);
    }
  };

  // 14. Digitar texto na tela
  toolsRegistry['mobile_type_text'] = {
    description: 'Digita um texto no campo que estiver atualmente em foco na tela do Android.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto a ser digitado' }
      },
      required: ['text']
    },
    execute: async ({ text }) => {
      return androidGodMode.digitarTexto(text);
    }
  };

  // 15. Tecla física / virtual do Android
  toolsRegistry['mobile_press_key'] = {
    description: 'Pressiona botão do Android (3=HOME, 4=VOLTAR, 66=ENTER, 26=TELA_LIGAR_DESLIGAR, 24=VOL_UP, 25=VOL_DOWN).',
    parameters: {
      type: 'object',
      properties: {
        keyCode: { type: 'number', description: 'Código do Keyevent do Android (ex: 4 para Voltar, 3 para Home)' }
      },
      required: ['keyCode']
    },
    execute: async ({ keyCode }) => {
      return androidGodMode.pressionarTecla(keyCode);
    }
  };

  // 16. Tirar Screenshot da tela do Android
  toolsRegistry['mobile_take_screenshot'] = {
    description: 'Tira uma captura de tela real (screenshot) do display do Android.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      return androidGodMode.tirarPrint();
    }
  };
`;

if (!mob.includes('mobile_touch_tap')) {
  mob = mob.replace("console.log('[TOOL FORGE] Ferramentas nativas do Android registradas com sucesso!');", touchTools + "\n  console.log('[TOOL FORGE] Ferramentas nativas do Android registradas com sucesso!');");
  fs.writeFileSync(mobileToolsPath, mob, 'utf8');
  console.log('[OK] corvo_mobile_tools.js atualizado com touch tools');
}

// 3. ATUALIZAR TELEGRAM COM /reset, /atualizar, /stop e LIVE EDIT ESTILO OPENCLAW
const tgPath = path.join(ROOT, 'src/channels/corvo_telegram.js');
let tg = fs.readFileSync(tgPath, 'utf8');

// Garante que /atualizar, /stop, /reset estejam perfeitos
// E melhora o live edit para manter a timeline estilo OpenClaw
const oldDelete = `                // Apaga a mensagem de estado para manter o chat 100% limpo
                if (statusMsg && statusMsg.message_id) {
                  await deleteMessage(chatId, statusMsg.message_id);
                }`;

const newLiveEdit = `                // Atualização final estilo OpenClaw na mensagem de status ao vivo
                if (statusMsg && statusMsg.message_id) {
                  const tagIcon = missionRes.success ? '✅' : '🛑';
                  const shortSummary = missionRes.success ? 'Missão cumprida com sucesso' : (missionRes.error || 'Missão interrompida');
                  await editMessage(chatId, statusMsg.message_id, \`\${tagIcon} <b>Status da Missão:</b> <i>\${shortSummary}</i>\`);
                }`;

if (tg.includes(oldDelete)) {
  tg = tg.replace(oldDelete, newLiveEdit);
  fs.writeFileSync(tgPath, tg, 'utf8');
  console.log('[OK] Telegram live-edit estilo OpenClaw atualizado');
}

// 4. ATUALIZAR WHATSAPP COM /atualizar E LIVE EDIT
const waPath = path.join(ROOT, 'src/channels/corvo_whatsapp.js');
let wa = fs.readFileSync(waPath, 'utf8');

const waUpdateCmd = `
    // 3.1 Comando /atualizar ou /update (Auto-Update pelo WhatsApp)
    if (/^\\/(?:atualizar|update|upgrade)\\b/i.test(cleanText)) {
      if (!isMarcos) {
        await sock.sendMessage(jid, { text: '❌ Apenas o Dono (Marcos) tem autoridade para atualizar.' });
        return;
      }
      await sock.sendMessage(jid, { text: '⚡ *Puxando atualização do GitHub...*' });
      try {
        const { execSync } = require('child_process');
        const repoDir = path.resolve(__dirname, '../../');
        const gitRes = execSync('git pull origin main', { cwd: repoDir, encoding: 'utf8', timeout: 35000 });
        await sock.sendMessage(jid, { text: \`✅ *Atualizado com sucesso!*\\n\\n\` + gitRes.trim().slice(0, 300) + '\\n\\n🔄 *Reiniciando motores para aplicar...*' });
        setTimeout(() => process.exit(0), 1500);
      } catch (gitErr) {
        await sock.sendMessage(jid, { text: \`⚠️ *Erro ao atualizar:*\\n\` + gitErr.message.slice(0, 300) });
      }
      return;
    }
`;

if (!wa.includes('git pull origin main')) {
  wa = wa.replace('// 4. Comando /status ou /info', waUpdateCmd + '\n    // 4. Comando /status ou /info');
  fs.writeFileSync(waPath, wa, 'utf8');
  console.log('[OK] WhatsApp /atualizar adicionado');
}

console.log('TODAS AS ATUALIZAÇÕES APLICADAS COM SUCESSO!');
