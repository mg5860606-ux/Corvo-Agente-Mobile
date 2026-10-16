/**
 * 📱 CORVO OPENCLAW MOBILE - CONTROLE TOTAL DO ANDROID (GOD MODE)
 * Capacidade de interagir com qualquer aspecto do dispositivo Android via Termux-API / ADB / Shell:
 * - Controle de chamadas, contatos e SMS
 * - Gerenciamento de pacotes e aplicativos (instalar, desinstalar, abrir apps)
 * - Volume, brilho, Wi-Fi, Bluetooth e configurações de sistema
 * - Captura de tela (screenshot) e gravação de tela
 * - Execução de comandos root (se o dispositivo tiver root)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, 'data', 'android_storage');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function runCommand(cmd) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 45000 });
    return { success: true, output: output.trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout || '',
      hint: 'Certifique-se de que os pacotes termux-api e as permissões do sistema Android estão ativas.'
    };
  }
}

const androidGodMode = {
  /** Executa qualquer comando shell no Android com suporte opcional a root */
  executarShell(comando, usarRoot = false) {
    const cmdFinal = usarRoot && fs.existsSync('/system/bin/su') ? `su -c "${comando}"` : comando;
    return runCommand(cmdFinal);
  },

  /** Lista todos os aplicativos instalados no celular */
  listarApps(tipo = 'all') {
    // tipo: 'all', 'system', 'third-party'
    const flag = tipo === 'system' ? '-s' : tipo === 'third-party' ? '-3' : '';
    return runCommand(`pm list packages ${flag}`);
  },

  /** Abre um aplicativo instalado pelo nome do pacote (ex: com.whatsapp) */
  abrirApp(packageName) {
    return runCommand(`am start -n ${packageName}/.MainActivity || monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
  },

  /** Tira um print da tela atual (requer permissão de root ou adb) */
  tirarPrint() {
    const outPath = path.join(DATA_DIR, `screenshot_${Date.now()}.png`);
    const res = runCommand(`screencap -p ${outPath}`);
    if (res.success && fs.existsSync(outPath)) {
      return { success: true, path: outPath, message: 'Screenshot capturado com sucesso.' };
    }
    return { success: false, error: 'Falha ao tirar print da tela. Verifique privilégios de root/suporte a screencap.' };
  },

  /** Controla configurações de volume (stream: 0=voice, 1=system, 2=ring, 3=music, 4=alarm) */
  ajustarVolume(stream = '3', volume = '10') {
    return runCommand(`termux-volume ${stream} ${volume}`);
  },

  /** Controla Wi-Fi (ligar/desligar) */
  controlarWifi(estado) {
    // estado: 'true' ou 'false'
    return runCommand(`termux-wifi-enable ${estado}`);
  },

  /** Faz uma ligação telefônica (exige permissão de chamada) */
  fazerLigacao(numero) {
    return runCommand(`am start -a android.intent.action.CALL -d tel:${numero}`);
  },

  /** Envia um SMS para um número */
  enviarSms(numero, mensagem) {
    return runCommand(`termux-sms-send -n ${numero} "${mensagem}"`);
  },

  /** Copia texto para a área de transferência do Android */
  copiarClipboard(texto) {
    return runCommand(`termux-clipboard-set "${texto}"`);
  },

  /** Lê o conteúdo atual da área de transferência */
  lerClipboard() {
    return runCommand('termux-clipboard-get');
  },

  /** Vibra o celular */
  vibrar(milissegundos = 500) {
    return runCommand(`termux-vibrate -d ${milissegundos}`);
  }
};

module.exports = androidGodMode;
