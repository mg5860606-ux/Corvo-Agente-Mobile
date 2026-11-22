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
    // 1. Tenta binário do termux-battery-status
    const termuxBins = [
      'termux-battery-status',
      '/data/data/com.termux/files/usr/bin/termux-battery-status',
      '$PREFIX/bin/termux-battery-status'
    ];
    for (const bin of termuxBins) {
      try {
        const out = execSync(bin + ' 2>/dev/null', { encoding: 'utf8', timeout: 4000 }).trim();
        if (out && out.includes('{')) {
          const parsed = JSON.parse(out);
          if (parsed && (typeof parsed.percentage === 'number' || !isNaN(parseInt(parsed.percentage, 10)))) {
            return {
              success: true,
              percentage: parseInt(parsed.percentage, 10),
              status: parsed.status || 'Discharging',
              plugged: parsed.plugged,
              temperature: parsed.temperature,
              health: parsed.health,
              output: `Bateria em ${parsed.percentage}%`
            };
          }
        }
      } catch (e) {}
    }

    // 2. Sysfs universais do Kernel Linux / Android
    const sysfsCandidates = [
      '/sys/class/power_supply/battery/capacity',
      '/sys/class/power_supply/bms/capacity',
      '/sys/devices/platform/battery/power_supply/battery/capacity',
      '/sys/class/power_supply/battery/charge_counter'
    ];
    for (const capPath of sysfsCandidates) {
      try {
        if (fs.existsSync(capPath)) {
          const cap = parseInt(fs.readFileSync(capPath, 'utf8').trim(), 10);
          if (!isNaN(cap) && cap >= 0 && cap <= 100) {
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

    // 3. Fallbacks diretos via shell do Android (sh / toybox / toolbox / dumpsys / getprop / su)
    const shellBatteryCmds = [
      '/system/bin/dumpsys battery',
      '/system/bin/cmd battery get level',
      'su -c "/system/bin/dumpsys battery" 2>/dev/null',
      'su -c "cat /sys/class/power_supply/battery/capacity" 2>/dev/null',
      'dumpsys battery',
      'cmd battery get level'
    ];
    for (const cmd of shellBatteryCmds) {
      try {
        const out = execSync(cmd + ' 2>/dev/null || true', { encoding: 'utf8', timeout: 3000 }).trim();
        const levelMatch = out.match(/level:\s*(\d+)/i);
        if (levelMatch) {
          const lvl = parseInt(levelMatch[1], 10);
          return { success: true, percentage: lvl, source: cmd, output: `Bateria em ${lvl}%` };
        }
        const directNum = parseInt(out, 10);
        if (!isNaN(directNum) && directNum >= 0 && directNum <= 100) {
          return { success: true, percentage: directNum, source: cmd, output: `Bateria em ${directNum}%` };
        }
      } catch (e) {}
    }

    return {
      success: false,
      percentage: null,
      error: 'Não consegui ler a porcentagem da bateria.',
      hint: 'Rode no Termux: pkg install termux-api e abra o app Termux:API no Android.'
    };
  }
};

module.exports = androidSensors;
