/**
 * 📱 CORVO OPENCLAW MOBILE - MÓDULO DE SENSORES E TELEMETRIA (TERMUX-API)
 * Permite ao agente coletar dados profundos do dispositivo Android sob demanda do DONO:
 * - Localização GPS
 * - Câmera (fotos remotas)
 * - Microfone (gravação de áudio ambiente)
 * - SMS e Chamadas
 * - Informações de Bateria e Hardware
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SENSORS_DIR = path.join(DATA_DIR, 'sensors');
if (!fs.existsSync(SENSORS_DIR)) fs.mkdirSync(SENSORS_DIR, { recursive: true });

function runTermuxApi(cmd) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return { success: true, output: output.trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      hint: 'Certifique-se de que o pacote termux-api está instalado (pkg install termux-api) e o app Termux:API está instalado no Android.'
    };
  }
}

const androidSensors = {
  /** Pega a localização GPS atual do celular */
  getLocalizacao() {
    return runTermuxApi('termux-location -p gps');
  },

  /** Tira uma foto usando a câmera traseira ou frontal */
  tirarFoto(camera = '0') {
    const outputPath = path.join(SENSORS_DIR, `foto_${Date.now()}.jpg`);
    const res = runTermuxApi(`termux-camera-photo -c ${camera} "${outputPath}"`);
    if (res.success && fs.existsSync(outputPath)) {
      return { success: true, path: outputPath, message: 'Foto capturada com sucesso.' };
    }
    return { success: false, error: 'Não foi possível capturar a foto.', details: res };
  },

  /** Grava áudio do microfone ambiente */
  gravarAudio(duracaoSegundos = 5) {
    const outputPath = path.join(SENSORS_DIR, `audio_${Date.now()}.m4a`);
    const res = runTermuxApi(`termux-microphone-record -d ${duracaoSegundos} -f "${outputPath}"`);
    if (res.success) {
      return { success: true, path: outputPath, message: `Áudio gravado por ${duracaoSegundos} segundos.` };
    }
    return { success: res.success, error: res.error, hint: res.hint };
  },

  /** Lista os últimos SMS recebidos */
  listarSms(limite = 5) {
    return runTermuxApi(`termux-sms-list -l ${limite}`);
  },

  /** Informações detalhadas de bateria */
  statusBateria() {
    return runTermuxApi('termux-battery-status');
  }
};

module.exports = androidSensors;
