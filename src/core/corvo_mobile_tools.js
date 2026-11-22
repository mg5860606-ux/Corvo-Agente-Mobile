/**
 * 📲 CORVO AGENTE MOBILE - TOOL FORGE ANDROID (FERRAMENTAS NATIVAS DE SISTEMA)
 * Conecta o loop autônomo com o hardware do celular (sensores, god mode, controle de apps).
 */

const androidGodMode = require('../modules/corvo_god_mode');
const androidSensors = require('../modules/corvo_sensors');

function registerMobileTools(toolsRegistry) {
  // 1. Informações de Hardware & Bateria
  toolsRegistry['mobile_battery_status'] = {
    description: 'Verifica porcentagem de bateria, temperatura, saúde e se está carregando no celular.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      return androidSensors.statusBateria();
    }
  };

  // 2. Tirar foto (Câmera frontal ou traseira)
  toolsRegistry['mobile_camera_photo'] = {
    description: 'Tira uma foto real usando a câmera do celular (0 = traseira, 1 = frontal).',
    parameters: {
      type: 'object',
      properties: {
        camera: { type: 'string', description: '0 para traseira, 1 para frontal', default: '0' }
      }
    },
    execute: async ({ camera = '0' } = {}) => {
      return androidSensors.tirarFoto(camera);
    }
  };

  // 3. Gravar áudio ambiente
  toolsRegistry['mobile_record_audio'] = {
    description: 'Grava áudio do microfone ambiente do celular por X segundos.',
    parameters: {
      type: 'object',
      properties: {
        seconds: { type: 'number', description: 'Duração da gravação em segundos (ex: 5)', default: 5 }
      }
    },
    execute: async ({ seconds = 5 } = {}) => {
      return androidSensors.gravarAudio(seconds);
    }
  };

  // 4. Localização GPS
  toolsRegistry['mobile_gps_location'] = {
    description: 'Obtém a localização GPS exata do celular (latitude, longitude, precisão).',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      return androidSensors.getLocalizacao();
    }
  };

  // 5. Ler e Enviar SMS
  toolsRegistry['mobile_sms_list'] = {
    description: 'Lista as últimas mensagens SMS recebidas no aparelho.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Quantidade de SMS para listar', default: 5 }
      }
    },
    execute: async ({ limit = 5 } = {}) => {
      return androidSensors.listarSms(limit);
    }
  };

  toolsRegistry['mobile_sms_send'] = {
    description: 'Envia um SMS para um número de telefone.',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Número do destinatário com DDD' },
        message: { type: 'string', description: 'Texto da mensagem SMS' }
      },
      required: ['phone', 'message']
    },
    execute: async ({ phone, message }) => {
      return androidGodMode.enviarSms(phone, message);
    }
  };

  // 6. Fazer Ligação
  toolsRegistry['mobile_make_call'] = {
    description: 'Inicia uma chamada telefônica para um número.',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Número do telefone para ligar' }
      },
      required: ['phone']
    },
    execute: async ({ phone }) => {
      return androidGodMode.fazerLigacao(phone);
    }
  };

  // 7. Área de Transferência (Clipboard)
  toolsRegistry['mobile_clipboard_get'] = {
    description: 'Lê o texto que está copiado na área de transferência do Android.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      return androidGodMode.lerClipboard();
    }
  };

  toolsRegistry['mobile_clipboard_set'] = {
    description: 'Copia um texto para a área de transferência do celular.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto para copiar' }
      },
      required: ['text']
    },
    execute: async ({ text }) => {
      return androidGodMode.copiarClipboard(text);
    }
  };

  // 8. Notificação Sonora / Vibração
  toolsRegistry['mobile_vibrate'] = {
    description: 'Faz o celular vibrar por um período em milissegundos.',
    parameters: {
      type: 'object',
      properties: {
        durationMs: { type: 'number', description: 'Tempo em milissegundos', default: 500 }
      }
    },
    execute: async ({ durationMs = 500 } = {}) => {
      return androidGodMode.vibrar(durationMs);
    }
  };

  // 9. Abrir Aplicativo
  toolsRegistry['mobile_open_app'] = {
    description: 'Abre um aplicativo instalado no Android pelo nome do pacote (ex: com.whatsapp, com.android.chrome).',
    parameters: {
      type: 'object',
      properties: {
        packageName: { type: 'string', description: 'Nome do pacote do app' }
      },
      required: ['packageName']
    },
    execute: async ({ packageName }) => {
      return androidGodMode.abrirApp(packageName);
    }
  };

  // 10. Listar Apps Instalados
  toolsRegistry['mobile_list_apps'] = {
    description: 'Lista todos os aplicativos instalados no celular (tipo: all, system ou third-party).',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['all', 'system', 'third-party'], default: 'third-party' }
      }
    },
    execute: async ({ type = 'third-party' } = {}) => {
      return androidGodMode.listarApps(type);
    }
  };

  // 11. Ajustar Volume & Wi-Fi
  toolsRegistry['mobile_set_volume'] = {
    description: 'Ajusta o volume do celular (stream: 0=voice, 1=system, 2=ring, 3=music, 4=alarm).',
    parameters: {
      type: 'object',
      properties: {
        stream: { type: 'string', default: '3' },
        volume: { type: 'string', default: '10' }
      }
    },
    execute: async ({ stream = '3', volume = '10' } = {}) => {
      return androidGodMode.ajustarVolume(stream, volume);
    }
  };

  toolsRegistry['mobile_toggle_wifi'] = {
    description: 'Liga ou desliga o Wi-Fi do celular.',
    parameters: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'true para ligar, false para desligar' }
      },
      required: ['enabled']
    },
    execute: async ({ enabled }) => {
      return androidGodMode.controlarWifi(enabled ? 'true' : 'false');
    }
  };

  
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

  console.log('[TOOL FORGE] Ferramentas nativas do Android registradas com sucesso!');
}

module.exports = { registerMobileTools };
