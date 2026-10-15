/**
 * 🎬 CORVO - VEO 3.1 (Google) — GERAÇÃO E EDIÇÃO DE VÍDEOS POR IA
 * Gera clipes de vídeo REAIS por IA a partir de um prompt e edita vídeos
 * existentes a partir de uma instrução. Usa a REST API do Gemini com o método
 * `predictLongRunning` (o modelo NÃO aceita videoBytes inline — para editar,
 * o vídeo é enviado pelo Files API e referenciado por `fileUri`).
 *
 * ⚠️ DIFERENÇA vs imagem (Nano Banana): o Veo NÃO devolve o vídeo na resposta
 * do POST. Ele inicia uma OPERAÇÃO LONGA (2-6 min) e a gente POLA o status até
 * `done:true`; a resposta final tem `response.generateVideoResponse.generatedSamples[0].video.uri`
 * (URL de download), que a gente baixa e salva em data/downloads.
 *
 * Uso pelas ferramentas da IA:
 *   - gerar_video_ia(prompt, duracao?, proporcao?)  → clipe novo (data/downloads)
 *   - editar_video_ia(caminho, instrucao) → edita vídeo existente
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getGeminiKeys, sanitizarErroUsuario } = require('./ia_gemini');

// 🎬 Modelos Veo 3.1 (o principal primeiro; fallback se a chave não tiver acesso)
const MODELOS = ['veo-3.1-generate-preview', 'veo-3.1-fast-generate-preview', 'veo-3.1-lite-generate-preview'];
const MODELO = MODELOS[0];
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const UPLOAD_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DOWNLOADS = path.resolve(__dirname, '..', '..', 'data', 'downloads');

// Durações (segundos) e proporções aceitas pelo Veo 3.1 — CONFIRMADO por teste
// real: só durações PARES 4/6/8 (o 5 é rejeitado) e proporções 16:9/9:16 (1:1
// não é suportado pelo Veo).
const DURACOES = [4, 6, 8];
const DEFAULT_DURACAO = 8;
const PROPORCOES = ['16:9', '9:16'];
const DEFAULT_PROPORCAO = '16:9';

// Tempo máximo esperando a operação longa (8 min) e intervalo de poll
const POLL_TIMEOUT_MS = 8 * 60 * 1000;
const POLL_INTERVAL_MS = 10000;

function ehErroQuota(msg) {
  return /429|quota|RESOURCE_EXHAUSTED|rate\s*limit|exhausted|401|403|404|invalid\s*api\s*key|api\s*key\s*not\s*valid|permission\s*denied|no\s*longer\s*available|not\s*found/i.test(msg);
}

function ehErroPermanente(msg) {
  return /401|403|404|invalid\s*api\s*key|api\s*key\s*not\s*valid|permission\s*denied|no\s*longer\s*available|not\s*found|model\s*not\s*found/i.test(msg);
}

/**
 * Envia um arquivo para o Files API do Gemini e devolve o fileUri.
 * Necessário para EDITAR vídeo (o Veo NÃO aceita videoBytes inline).
 * @param {string} caminho - caminho do arquivo local
 * @param {string} chave - chave da API
 * @returns {Promise<string>} fileUri (https://generativelanguage.googleapis.com/v1beta/files/xxx)
 */
async function uploadArquivo(caminho, chave) {
  const buf = fs.readFileSync(caminho);
  const ext = path.extname(caminho).toLowerCase();
  const mime = ('.mp4' === ext) ? 'video/mp4'
    : ('.webm' === ext) ? 'video/webm'
    : ('.mov' === ext) ? 'video/quicktime'
    : ('.mkv' === ext) ? 'video/x-matroska'
    : ('.jpg' === ext || '.jpeg' === ext) ? 'image/jpeg'
    : ('.png' === ext) ? 'image/png'
    : ('.webp' === ext) ? 'image/webp' : 'video/mp4';
  const form = new FormData();
  form.append('metadata', JSON.stringify({ file: { mime_type: mime, display_name: path.basename(caminho) } }));
  form.append('media', new Blob([buf], { type: mime }), path.basename(caminho));
  const res = await axios.post(`${UPLOAD_BASE}/files?key=${encodeURIComponent(chave)}`, form, { timeout: 180000 });
  const uri = res.data && res.data.file && res.data.file.uri;
  if (!uri) throw new Error('o upload do arquivo não devolveu o fileUri.');
  return uri;
}

/**
 * Inicia a operação longa do Veo tentando cada chave da rotação. Devolve o
 * nome da operação + a chave que funcionou (o poll TEM que usar a MESMA chave).
 * @param {Array} instances - [{ prompt, video?/image? }]
 * @param {object} [parameters] - { durationSeconds, aspectRatio }
 * @param {string} modelo - nome do modelo Veo
 * @param {string|null} [chaveForcada] - usar APENAS esta chave (edição: o
 * fileUri fica vinculado à chave do upload, então a operação TEM que usar ela)
 * @returns {Promise<{opName:string, chave:string}>}
 */
async function iniciarOperacao(instances, parameters = {}, modelo = MODELO, chaveForcada = null) {
  const chaves = chaveForcada ? [chaveForcada] : getGeminiKeys();
  if (!chaves.length) throw new Error('Nenhuma chave de IA configurada.');
  let ultimoErro = null;
  for (const chave of chaves) {
    try {
      const url = `${BASE}/${modelo}:predictLongRunning?key=${encodeURIComponent(chave)}`;
      const body = { instances };
      if (parameters && Object.keys(parameters).length) body.parameters = parameters;
      const res = await axios.post(url, body, { timeout: 180000 });
      const nome = res.data && res.data.name;
      if (!nome) throw new Error('a API não devolveu a operação de geração.');
      return { opName: nome, chave };
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
 * Pola uma operação longa do Veo até `done:true` (ou estoura o tempo).
 * @param {string} opName - ex: "models/veo-3.1-generate-preview/operations/abc"
 * @param {string} chave - a MESMA chave que iniciou a operação
 * @returns {Promise<object>} operação final (done, response)
 */
async function pollarOperacao(opName, chave, timeoutMs = POLL_TIMEOUT_MS) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const res = await axios.get(`${API_BASE}/${opName}?key=${encodeURIComponent(chave)}`, { timeout: 60000 });
    const op = res.data;
    if (op.done) {
      if (op.error) throw new Error(`o provedor falhou na geração: ${op.error.message || 'erro desconhecido'}`);
      return op;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('tempo esgotado esperando o vídeo (a geração demorou demais). Tente de novo.');
}

/**
 * Extrai o vídeo da operação final.
 * @returns {{uri:string, mime:string}|null}
 */
function extrairVideo(op) {
  const resp = op && op.response;
  const samples = resp && resp.generateVideoResponse && resp.generateVideoResponse.generatedSamples;
  if (!Array.isArray(samples) || !samples.length) return null;
  const primeiro = samples[0];
  const uri = primeiro && primeiro.video && primeiro.video.uri;
  if (!uri) return null;
  return { uri: String(uri), mime: 'video/mp4' };
}

/** Baixa o vídeo final (files/:id:download?alt=media) e salva em data/downloads. */
async function salvarVideo({ uri, mime }, prefixo, chave) {
  fs.mkdirSync(DOWNLOADS, { recursive: true });
  const ext = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-matroska': '.mkv' }[mime] || '.mp4';
  const caminho = path.join(DOWNLOADS, `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  // A URI de download precisa da MESMA chave (Files API exige key no query)
  const sep = uri.includes('?') ? '&' : '?';
  const res = await axios.get(`${uri}${sep}key=${encodeURIComponent(chave)}`, { responseType: 'arraybuffer', timeout: 300000, maxContentLength: Infinity, maxBodyLength: Infinity });
  fs.writeFileSync(caminho, Buffer.from(res.data));
  return caminho;
}

/** Lança erro com mensagem SANITIZADA (nunca vaza URL da API nem a chave). */
function lancarErroSanitizado(e, contexto) {
  const msg = `${e?.response?.status ? 'status ' + e.response.status + ': ' : ''}${e?.response?.data?.error?.message || e?.message || e || ''}`;
  throw new Error(`${contexto}: ${sanitizarErroUsuario(msg)}`);
}

/**
 * Fluxo completo: inicia a operação (com fallback de modelo) → pola → baixa.
 * @param {object} cfg - { instances, parameters, prefixo, contexto, chaveForcada? }
 */
async function gerar({ instances, parameters, prefixo, contexto, chaveForcada = null }) {
  let ultimoErro = null;
  for (const modelo of MODELOS) {
    try {
      const { opName, chave } = await iniciarOperacao(instances, parameters, modelo, chaveForcada);
      const op = await pollarOperacao(opName, chave);
      const video = extrairVideo(op);
      if (!video) throw new Error('a resposta não veio com vídeo.');
      const caminho = await salvarVideo(video, prefixo, chave);
      return { ok: true, caminho, mime: video.mime, modelo };
    } catch (e) {
      const msg = String(e?.message || e || '');
      ultimoErro = e;
      // Se a chave/modelo não tem acesso ao Veo, tenta o próximo modelo da lista.
      // ⚠️ \"not found\" SÓ dispara no contexto de modelo — senão uma falha de
      // geração (ex: recurso não encontrado) causaria uma 2ª tentativa de 2-6 min.
      const semModelo = /model.*(no longer available|not found|unavailable)|does not support|doesn't support|não.*modelo/i.test(msg);
      if (semModelo && modelo !== MODELOS[MODELOS.length - 1]) continue;
      lancarErroSanitizado(e, contexto);
    }
  }
  throw ultimoErro; // inalcançável (lancarErroSanitizado lança), mas seguro
}

/**
 * Gera um clipe de vídeo novo a partir de um prompt.
 * @param {string} prompt - descrição do vídeo
 * @param {object} [opcoes] - { duracao: 5|8, proporcao: '16:9'|'9:16'|'1:1' }
 * @returns {Promise<{ok:true, caminho:string, mime:string, modelo:string}>}
 */
async function gerarVideo(prompt, opcoes = {}) {
  const texto = String(prompt || '').trim();
  if (!texto) throw new Error('Informe o prompt do vídeo.');
  const duracao = DURACOES.includes(Number(opcoes.duracao)) ? Number(opcoes.duracao) : DEFAULT_DURACAO;
  const proporcao = PROPORCOES.includes(opcoes.proporcao) ? opcoes.proporcao : DEFAULT_PROPORCAO;
  return gerar({
    instances: [{ prompt: texto }],
    parameters: { durationSeconds: duracao, aspectRatio: proporcao },
    prefixo: 'veo',
    contexto: 'Não consegui gerar o vídeo',
  });
}

/**
 * Edita um vídeo existente (caminho local) a partir de uma instrução.
 * O vídeo é enviado pelo Files API e referenciado por fileUri (o Veo não aceita
 * bytes inline). ⚠️ O fileUri fica VINCULADO à chave do upload — por isso a
 * operação usa chaveForcada (a MESMA chave), sem re-rotacionar. Na edição não
 * forçamos duração/proporção — o Veo preserva o vídeo original.
 * @param {string} caminho - caminho do vídeo (data/downloads, data/anexos, ...)
 * @param {string} instrucao - o que mudar no vídeo
 * @returns {Promise<{ok:true, caminho:string, mime:string, modelo:string}>}
 */
async function editarVideo(caminho, instrucao) {
  const cam = String(caminho || '').trim();
  const texto = String(instrucao || '').trim();
  if (!cam || !fs.existsSync(cam)) throw new Error('Caminho do vídeo não encontrado.');
  if (!texto) throw new Error('Informe o que mudar no vídeo.');
  const buf = fs.readFileSync(cam);
  // Veo limita o vídeo de entrada (~20MB) — falha rápido em vez de travar
  if (buf.length > 20 * 1024 * 1024) throw new Error('Vídeo muito grande pra edição por IA (máx ~20MB). Envie um clipe menor ou corte antes.');
  // Upload na Files API com rotação de chaves; a operação usa a MESMA chave
  const chaves = getGeminiKeys();
  if (!chaves.length) throw new Error('Nenhuma chave de IA configurada.');
  let ultimoErro = null;
  for (const chave of chaves) {
    try {
      const fileUri = await uploadArquivo(cam, chave);
      return gerar({
        instances: [{ prompt: texto, video: { fileUri } }],
        parameters: {},
        prefixo: 'veo_edit',
        contexto: 'Não consegui editar o vídeo',
        chaveForcada: chave,
      });
    } catch (e) {
      const msg = `${e?.response?.status || ''} ${e?.response?.data?.error?.message || e?.message || e || ''}`;
      ultimoErro = e;
      if (ehErroQuota(msg)) continue;       // quota/indisponível → próxima chave
      if (ehErroPermanente(msg)) continue;  // chave sem acesso → próxima chave
      lancarErroSanitizado(e, 'Não consegui editar o vídeo');
    }
  }
  lancarErroSanitizado(ultimoErro, 'Não consegui editar o vídeo');
}

module.exports = {
  gerarVideo,
  editarVideo,
  iniciarOperacao,
  pollarOperacao,
  extrairVideo,
  uploadArquivo,
  MODELO,
  MODELOS,
  DURACOES,
  DEFAULT_DURACAO,
  PROPORCOES,
  DEFAULT_PROPORCAO,
};
