/**
 * 🍌 CORVO - NANO BANANA (Gemini 2.5 Flash Image) — GERAÇÃO E EDIÇÃO DE IMAGENS
 * Gera imagens REAIS por IA (não é a capa de texto do criar_imagem) e edita
 * imagens existentes a partir de uma instrução. Usa a REST API do Gemini
 * (responseModalities: ['TEXT','IMAGE']) com as MESMAS chaves e rotação do
 * ia_gemini — o SDK @google/generative-ai 0.24.x não expõe responseModalities.
 *
 * Uso pelas ferramentas da IA:
 *   - gerar_imagem_ia(prompt, tamanho?)  → imagem nova (salva em data/downloads)
 *   - editar_imagem_ia(caminho, instrucao) → edita imagem existente
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getGeminiKeys, sanitizarErroUsuario } = require('./ia_gemini');

// 🍌 Modelo Nano Banana (legacy estável) — gera E edita imagens
const MODELO = 'gemini-2.5-flash-image';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DOWNLOADS = path.resolve(__dirname, '..', '..', 'data', 'downloads');

// Aspect ratios aceitos pela API do Nano Banana (imageConfig.aspectRatio)
const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16', '3:2', '2:3'];
const DEFAULT_ASPECT = '1:1';

function ehErroQuota(msg) {
  return /429|quota|RESOURCE_EXHAUSTED|rate\s*limit|exhausted|401|403|404|invalid\s*api\s*key|api\s*key\s*not\s*valid|permission\s*denied|no\s*longer\s*available|not\s*found/i.test(msg);
}

function ehErroPermanente(msg) {
  return /401|403|404|invalid\s*api\s*key|api\s*key\s*not\s*valid|permission\s*denied|no\s*longer\s*available|not\s*found|model\s*not\s*found/i.test(msg);
}

/**
 * Chama o Nano Banana tentando cada chave da rotação (mesmo padrão do
 * comRotacao do ia_gemini, mas local para não depender de export).
 * @param {Array} parts - [{text}] e/ou [{inline_data:{mime_type,data}}]
 * @param {object} [imageConfig] - { aspectRatio }
 * @returns {Promise<object>} resposta bruta da API
 */
async function chamarNano(parts, imageConfig = {}) {
  const chaves = getGeminiKeys();
  if (!chaves.length) throw new Error('Nenhuma chave de IA configurada.');
  let ultimoErro = null;
  for (const chave of chaves) {
    try {
      const url = `${BASE}/${MODELO}:generateContent?key=${encodeURIComponent(chave)}`;
      // imageConfig.aspectRatio = null → omite o campo (edição preserva a
      // proporção da imagem original em vez de forçar quadrado).
      const gc = { responseModalities: ['TEXT', 'IMAGE'] };
      if (imageConfig.aspectRatio) gc.imageConfig = { aspectRatio: imageConfig.aspectRatio };
      const res = await axios.post(url, {
        contents: [{ role: 'user', parts }],
        generationConfig: gc,
      }, { timeout: 180000 });
      return res.data;
    } catch (e) {
      const msg = `${e?.response?.status || ''} ${e?.response?.data?.error?.message || e?.message || e || ''}`;
      ultimoErro = e;
      if (ehErroQuota(msg)) continue;       // quota/indisponível → próxima chave
      if (ehErroPermanente(msg)) continue;  // chave sem acesso → próxima chave
      throw e;                              // erro não-quota → repassa na hora
    }
  }
  throw ultimoErro;
}

/**
 * Extrai a primeira imagem da resposta (base64 + mime). A REST devolve
 * inlineData (camelCase); trata também inline_data (snake_case).
 * @returns {{data:string, mime:string}|null}
 */
function extrairImagem(resposta) {
  const parts = resposta && resposta.candidates && resposta.candidates[0] && resposta.candidates[0].content && resposta.candidates[0].content.parts;
  if (!Array.isArray(parts)) return null;
  const img = parts.find(p => p && (p.inlineData || p.inline_data));
  if (!img) return null;
  const inline = img.inlineData || img.inline_data;
  const data = String(inline.data || '').replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  const mime = inline.mimeType || inline.mime_type || 'image/png';
  if (!data) return null;
  return { data, mime };
}

function salvarImagem({ data, mime }, prefixo) {
  fs.mkdirSync(DOWNLOADS, { recursive: true });
  const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }[mime] || '.png';
  const caminho = path.join(DOWNLOADS, `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  fs.writeFileSync(caminho, Buffer.from(data, 'base64'));
  return caminho;
}

/**
 * Gera uma imagem nova a partir de um prompt.
 * @param {string} prompt - descrição da imagem
 * @param {object} [opcoes] - { tamanho: '1:1'|'3:4'|'4:3'|'16:9'|'9:16'|'3:2'|'2:3' }
 * @returns {Promise<{ok:true, caminho:string, mime:string}>}
 */
async function gerarImagem(prompt, opcoes = {}) {
  const texto = String(prompt || '').trim();
  if (!texto) throw new Error('Informe o prompt da imagem.');
  const aspect = ASPECT_RATIOS.includes(opcoes.tamanho) ? opcoes.tamanho : DEFAULT_ASPECT;
  let resposta;
  try {
    resposta = await chamarNano([{ text: texto }], { aspectRatio: aspect });
  } catch (e) {
    lancarErroSanitizado(e, 'Não consegui gerar a imagem');
  }
  const img = extrairImagem(resposta);
  if (!img) {
    const erro = resposta && resposta.promptFeedback && resposta.promptFeedback.blockReason
      ? `conteúdo bloqueado pelo provedor (${resposta.promptFeedback.blockReason}).`
      : 'a resposta não veio com imagem.';
    throw new Error(erro);
  }
  const caminho = salvarImagem(img, 'nano');
  return { ok: true, caminho, mime: img.mime, tamanho: aspect };
}

/** Lança erro com mensagem SANITIZADA (nunca vaza URL da API nem a chave). */
function lancarErroSanitizado(e, contexto) {
  const msg = `${e?.response?.status ? 'status ' + e.response.status + ': ' : ''}${e?.response?.data?.error?.message || e?.message || e || ''}`;
  throw new Error(`${contexto}: ${sanitizarErroUsuario(msg)}`);
}

/**
 * Edita uma imagem existente (caminho local) a partir de uma instrução.
 * @param {string} caminho - caminho da imagem (data/downloads, data/anexos, ...)
 * @param {string} instrucao - o que mudar na imagem
 * @returns {Promise<{ok:true, caminho:string, mime:string}>}
 */
async function editarImagem(caminho, instrucao) {
  const cam = String(caminho || '').trim();
  const texto = String(instrucao || '').trim();
  if (!cam || !fs.existsSync(cam)) throw new Error('Caminho da imagem não encontrado.');
  if (!texto) throw new Error('Informe o que mudar na imagem.');
  const buf = fs.readFileSync(cam);
  const mime = ('.png' === path.extname(cam).toLowerCase()) ? 'image/png'
    : ('.jpg' === path.extname(cam).toLowerCase() || '.jpeg' === path.extname(cam).toLowerCase()) ? 'image/jpeg'
    : ('.webp' === path.extname(cam).toLowerCase()) ? 'image/webp' : 'image/png';
  // Edição NÃO força proporção: sem aspectRatio → o modelo preserva as
  // dimensões da imagem original (chamarNano omite imageConfig nesse caso).
  let resposta;
  try {
    resposta = await chamarNano([
      { inline_data: { mime_type: mime, data: buf.toString('base64') } },
      { text: texto },
    ], {});
  } catch (e) {
    lancarErroSanitizado(e, 'Não consegui editar a imagem');
  }
  const img = extrairImagem(resposta);
  if (!img) throw new Error('a resposta não veio com a imagem editada.');
  const saida = salvarImagem(img, 'nano_edit');
  return { ok: true, caminho: saida, mime: img.mime };
}

module.exports = { gerarImagem, editarImagem, extrairImagem, MODELO, ASPECT_RATIOS, DEFAULT_ASPECT };
