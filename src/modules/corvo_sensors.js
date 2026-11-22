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

  /** Informações detalhadas de bateria com múltiplos fallbacks (Termux:API, sysfs, dumpsys, adb/sh) */
  statusBateria() {
    // 1. Tenta termux-battery-status rápido
    const res = runTermuxApi('termux-battery-status', 3000);
    if (res.success && res.output && res.output.includes('{')) {
      try {
        const parsed = JSON.parse(res.output);
        if (typeof parsed.percentage === 'number' || !isNaN(parseInt(parsed.percentage, 10))) {
          return {
            success: true,
            percentage: parseInt(parsed.percentage, 10),
            status: parsed.status || 'Discharging',
            plugged: parsed.plugged,
            temperature: parsed.temperature,
            health: parsed.health,
            output: `Bateria em ${parsed.percentage}% (${parsed.status || 'Em uso'})`
          };
        }
      } catch (e) {}
    }

    // 2. Fallbacks diretos via sysfs do Linux/Android
    const sysfsCandidates = [
      '/sys/class/power_supply/battery/capacity',
      '/sys/class/power_supply/bms/capacity',
      '/sys/devices/platform/battery/power_supply/battery/capacity'
    ];
    for (const capPath of sysfsCandidates) {
      try {
        if (fs.existsSync(capPath)) {
          const cap = parseInt(fs.readFileSync(capPath, 'utf8').trim(), 10);
          if (!isNaN(cap)) {
            return {
              success: true,
              percentage: cap,
              status: 'Discharging',
              source: capPath,
              output: `Bateria em ${cap}%`
            };
          }
        }
      } catch (sysErr) {}
    }

    // 3. Fallback via dumpsys battery
    try {
      const dump = execSync('dumpsys battery 2>/dev/null || true', { encoding: 'utf8', timeout: 3000 });
      const levelMatch = dump.match(/level:\s*(\d+)/i);
      if (levelMatch) {
        const lvl = parseInt(levelMatch[1], 10);
        return {
          success: true,
          percentage: lvl,
          source: 'dumpsys',
          output: `Bateria em ${lvl}%`
        };
      }
    } catch (dumpErr) {}

    // 4. Fallback cmd battery get level
    try {
      const cmdOut = execSync('cmd battery get level 2>/dev/null || true', { encoding: 'utf8', timeout: 3000 }).trim();
      const num = parseInt(cmdOut, 10);
      if (!isNaN(num)) {
        return {
          success: true,
          percentage: num,
          source: 'cmd_battery',
          output: `Bateria em ${num}%`
        };
      }
    } catch (cmdErr) {}

    return {
      success: false,
      percentage: null,
      error: 'Não consegui ler a porcentagem da bateria.',
      hint: 'Verifique se o pacote `termux-api` e o app `Termux:API` estão instalados com permissões concedidas.'
    };
  }
};

module.exports = androidSensors;
