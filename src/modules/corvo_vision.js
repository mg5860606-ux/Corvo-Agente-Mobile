/**
 * 👁️ CORVO AGENTE MOBILE - MOTOR DE VISÃO & AÇÃO NO DISPOSITIVO (VISION-ACTION ENGINE)
 * Permite ao agente enxergar a tela do Android, localizar elementos visuais
 * e executar toques precisos (Touch / Tap / Click) usando a inteligência multimodal do Gemini.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const androidGodMode = require('../modules/corvo_god_mode');

const ROOT_DIR = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT_DIR, 'data', 'vision');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const visionEngine = {
  /**
   * Captura a tela atual do Android e salva em imagem
   */
  capturarTela() {
    const outPath = path.join(DATA_DIR, `screen_${Date.now()}.png`);
    try {
      // 1. Tenta screencap direto
      execSync(`screencap -p "${outPath}" || su -c "screencap -p '${outPath}'"`, { timeout: 10000 });
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 100) {
        return { success: true, filePath: outPath };
      }
    } catch (e) {
      // 2. Se falhar no Android normal, tenta via adb shell screencap
      try {
        execSync(`adb exec-out screencap -p > "${outPath}"`, { timeout: 10000, shell: true });
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 100) {
          return { success: true, filePath: outPath };
        }
      } catch (adbErr) {}
    }
    return { success: false, error: 'Falha ao capturar a tela. Requer Root, Termux:API ou ADB Wireless ativo.' };
  },

  /**
   * Envia o print da tela para a IA localizar as coordenadas [X, Y] de um elemento visual
   * @param {string} targetDesc Descrição do que deve ser clicado (ex: "botão Enviar", "foto de perfil", "ícone da lupa")
   */
  async localizarElementoNaTela(targetDesc) {
    const cap = this.capturarTela();
    if (!cap.success) return { success: false, error: cap.error };

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return { success: false, error: 'GEMINI_API_KEY não configurada no .env' };
    }

    try {
      const imgBase64 = fs.readFileSync(cap.filePath).toString('base64');
      const prompt = `Você é um motor de automação visual de smartphones.
Analise a captura de tela do smartphone Android anexada.
Alvo a localizar: "${targetDesc}".

Responda ESTRITAMENTE em formato JSON puro, sem markdown, com as coordenadas estimadas em pixels para clicar no centro do elemento alvo:
{
  "found": true,
  "x": 540,
  "y": 1200,
  "confidence": 0.95,
  "description": "Botão verde de enviar no canto inferior direito"
}

Se o elemento não estiver visível na tela, retorne:
{
  "found": false,
  "reason": "Elemento não está visível na tela atual"
}`;

      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/png', data: imgBase64 } }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        },
        { timeout: 30000 }
      );

      const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw);
      parsed.screenshotPath = cap.filePath;
      return { success: true, ...parsed };
    } catch (err) {
      return { success: false, error: `Erro na análise de visão: ${err.message}` };
    }
  },

  /**
   * Enxerga o elemento na tela e clica nele automaticamente
   * @param {string} targetDesc Ex: "ícone de pesquisar", "botão entrar"
   */
  async clicarEmElementoVisual(targetDesc) {
    console.log(`[VISION ACTION] Localizando visualmente: "${targetDesc}"...`);
    const loc = await this.localizarElementoNaTela(targetDesc);

    if (!loc.success) {
      return { success: false, error: loc.error };
    }

    if (!loc.found) {
      return { success: false, error: `Elemento "${targetDesc}" não foi localizado na tela. Motivo: ${loc.reason || 'Não visível'}` };
    }

    console.log(`[VISION ACTION] Elemento encontrado em (${loc.x}, ${loc.y}) [${loc.description}]. Executando toque...`);
    const tapRes = androidGodMode.tocarNaTela(loc.x, loc.y);

    return {
      success: tapRes.success,
      target: targetDesc,
      coordinates: { x: loc.x, y: loc.y },
      details: loc.description,
      tapResult: tapRes
    };
  }
};

module.exports = visionEngine;
