/**
 * 📱 CORVO OPENCLAW MOBILE - MÓDULO DE SENSORES E TELEMETRIA RESILIENTE
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SENSORS_DIR = path.join(DATA_DIR, 'sensors');
if (!fs.existsSync(SENSORS_DIR)) fs.mkdirSync(SENSORS_DIR, { recursive: true });

function runTermuxApi(cmd, timeoutMs = 4000) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: timeoutMs });
    return { success: true, output: output.trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      hint: 'Termux:API indisponível ou permissão pendente no Android.'
    };
  }
}

const androidSensors = {
  /** Pega a localização GPS atual do celular */
  getLocalizacao() {
    return runTermuxApi('termux-location -p gps', 5000);
  },

  /** Tira uma foto usando a câmera traseira ou frontal */
  tirarFoto(camera = '0') {
    const outputPath = path.join(SENSORS_DIR, `foto_${Date.now()}.jpg`);
    const res = runTermuxApi(`termux-camera-photo -c ${camera} "${outputPath}"`, 8000);
    if (res.success && fs.existsSync(outputPath)) {
      return { success: true, path: outputPath, message: 'Foto capturada com sucesso.' };
    }
    return { success: false, error: 'Não foi possível capturar a foto.', details: res };
  },

  /** Grava áudio do microfone ambiente */
  gravarAudio(duracaoSegundos = 5) {
    const outputPath = path.join(SENSORS_DIR, `audio_${Date.now()}.m4a`);
    const res = runTermuxApi(`termux-microphone-record -d ${duracaoSegundos} -f "${outputPath}"`, (duracaoSegundos + 3) * 1000);
    if (res.success) {
      return { success: true, path: outputPath, message: `Áudio gravado por ${duracaoSegundos} segundos.` };
    }
    return { success: res.success, error: res.error, hint: res.hint };
  },

  /** Lista os últimos SMS recebidos */
  listarSms(limite = 5) {
    return runTermuxApi(`termux-sms-list -l ${limite}`, 5000);
  },

  /** Informações detalhadas de bateria com fallback inteligente para sysfs do Linux/Android */
  statusBateria() {
    // 1. Tenta termux-battery-status rápido (timeout de 3s para nunca travar o processo)
    const res = runTermuxApi('termux-battery-status', 3000);
    if (res.success && res.output && res.output.includes('{')) {
      try {
        const parsed = JSON.parse(res.output);
        return {
          success: true,
          percentage: parsed.percentage,
          status: parsed.status,
          plugged: parsed.plugged,
          temperature: parsed.temperature,
          health: parsed.health,
          output: res.output
        };
      } catch (e) {}
    }

    // 2. Fallback nativo direto do Kernel Linux / Android (/sys/class/power_supply)
    try {
      const capacityPath = '/sys/class/power_supply/battery/capacity';
      const statusPath = '/sys/class/power_supply/battery/status';
      if (fs.existsSync(capacityPath)) {
        const cap = fs.readFileSync(capacityPath, 'utf8').trim();
        const stat = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, 'utf8').trim() : 'Discharging';
        return {
          success: true,
          percentage: parseInt(cap, 10),
          status: stat,
          source: 'sysfs_kernel',
          output: JSON.stringify({ percentage: parseInt(cap, 10), status: stat })
        };
      }
    } catch (sysErr) {}

    // 3. Fallback dumpsys se tiver permissão
    try {
      const dump = execSync('dumpsys battery', { encoding: 'utf8', timeout: 3000 });
      const levelMatch = dump.match(/level:\s*(\d+)/i);
      if (levelMatch) {
        const lvl = parseInt(levelMatch[1], 10);
        return {
          success: true,
          percentage: lvl,
          source: 'dumpsys',
          output: JSON.stringify({ percentage: lvl })
        };
      }
    } catch (dumpErr) {}

    return {
      success: false,
      percentage: null,
      error: 'Sensor de bateria indisponível no momento (Termux:API não respondeu).',
      hint: 'Abra o app Termux:API no Android para conceder as permissões.'
    };
  }
};

module.exports = androidSensors;
