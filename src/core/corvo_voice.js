/**
 * 🎙️ CORVO AGENTE MOBILE - VOZ ULTRA-REALISTA (ELEVENLABS + EDGE-TTS FALLBACK GRÁTIS)
 * Gera áudios ultra-realistas com voz humana para envio imediato no WhatsApp / Telegram / Termux.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const AUDIO_DIR = path.resolve(__dirname, '../../data/audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// Vozes padrão ElevenLabs
// 'EXAVITQu4vr4xnSDxMaL' = Sarah (Natural, sedutora/conversacional)
// 'cgSgspJ2msm6clMCkdW9' = Jessica
// '21m00Tcm4TlvDq8ikWAM' = Rachel
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

const voiceEngine = {
  /**
   * Gera áudio usando ElevenLabs se houver chave configurada;
   * Se não houver chave ou exceder cota, chave grátis/fallback ultra-realista via Edge-TTS / Python
   * @param {string} text Texto para falar
   * @param {string} voiceId ID opcional da voz ElevenLabs
   * @returns {Promise<{success: boolean, filePath: string, provider: string}>}
   */
  async gerarAudio(text, voiceId = ELEVENLABS_VOICE_ID) {
    const cleanText = text.replace(/[*_~`#\[\]]/g, '').trim();
    const fileName = `audio_${Date.now()}.mp3`;
    const outputPath = path.join(AUDIO_DIR, fileName);

    const elevenKey = process.env.ELEVENLABS_API_KEY;

    // 1. Tentativa via ElevenLabs Real
    if (elevenKey && elevenKey.trim() !== '') {
      try {
        console.log(`[VOICE] Gerando áudio via ElevenLabs (${voiceId})...`);
        const response = await axios({
          method: 'POST',
          url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': elevenKey
          },
          data: {
            text: cleanText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.85,
              style: 0.20,
              use_speaker_boost: true
            }
          },
          responseType: 'arraybuffer',
          timeout: 30000
        });

        fs.writeFileSync(outputPath, Buffer.from(response.data));
        console.log(`[VOICE] Áudio ElevenLabs gerado em ${outputPath}`);
        return { success: true, filePath: outputPath, provider: 'elevenlabs' };
      } catch (err) {
        console.warn(`[VOICE WARN] ElevenLabs falhou (${err.response?.status || err.message}). Alternando para Fallback Grátis Realista...`);
      }
    }

    // 2. Fallback Grátis Neural Ultra-Realista (Edge-TTS via Python ou CLI)
    try {
      console.log('[VOICE] Gerando via Neural TTS Grátis (Thalita/Francisca PT-BR)...');
      // Tenta rodar script de Edge TTS
      const pyScript = path.resolve(__dirname, '../../scripts/generate_voice.py');
      const xerecaPyScript = 'C:\\xereca017\\scripts\\generate_voice.py';

      let targetScript = null;
      if (fs.existsSync(pyScript)) targetScript = pyScript;
      else if (fs.existsSync(xerecaPyScript)) targetScript = xerecaPyScript;

      if (targetScript) {
        execSync(`python "${targetScript}" "${cleanText.replace(/"/g, '\\"')}" "${outputPath}" "pt-BR-ThalitaMultilingualNeural"`, { timeout: 30000 });
        if (fs.existsSync(outputPath)) {
          return { success: true, filePath: outputPath, provider: 'edge-neural-free' };
        }
      }

      // Caso não tenha python com edge-tts, tentar chamada direta npx/edge-tts ou fallback gtts simples
      const encoded = encodeURIComponent(cleanText.substring(0, 200));
      const gttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encoded}`;
      const gttsRes = await axios.get(gttsUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
      fs.writeFileSync(outputPath, Buffer.from(gttsRes.data));
      return { success: true, filePath: outputPath, provider: 'gtts-free' };

    } catch (fallbackError) {
      console.error('[VOICE ERROR] Todas as gerações de voz falharam:', fallbackError.message);
      return { success: false, error: fallbackError.message };
    }
  }
};

module.exports = voiceEngine;
