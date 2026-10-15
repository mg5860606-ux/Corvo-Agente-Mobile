/**
 * 🎨 CORVO - MOTOR DE CONTEÚDO VARIADO DO CANAL
 * A IA posta no canal oficial conteúdo VARIADO e PROFISSIONAL:
 *   - promo  → divulgação profissional do bot (capas geradas, templates do ia_ads)
 *   - meme   → meme da internet (buscar_imagens + download + posta foto com legenda)
 *   - video  → vídeo (caminho no PC ou baixado por URL)
 *   - auto   → a IA SORTEIA o tipo, garantindo NUNCA repetir o mesmo duas vezes seguidas
 * Agenda automática: 5 slots por dia (09:30, 10:45, 13:30, 16:15, 18:30) que
 * NÃO colidem com os anúncios do ia_ads (08:00, 11:00, 14:00, 17:00, 20:00) —
 * total de ~10 posts/dia no canal. Estado persistente em data/ia_conteudo.json
 * (nunca repete slot no mesmo dia).
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const iaCore = require('./ia_core');
// ⚠️ NÃO dar require('./ia_tools') no topo: ia_tools importa ia_conteudo (ciclo
// CJS — um dos dois pegaria exports vazio). Os helpers do ia_tools são exigidos
// LAZY dentro das funções que os usam (padrão já usado no postarPromo/ia_ads).
const { detectarTipoBuffer } = require('../media_utils');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');
const FILE = path.join(DATA_DIR, 'ia_conteudo.json');

// 🕐 Slots da agenda automática (HH:MM) — fora dos horários dos anúncios (08/11/14/17/20)
// 5 slots + 5 anúncios = ~10 posts/dia no canal
const SLOTS = ['09:30', '10:45', '13:30', '16:15', '18:30'];

// Tipos de conteúdo possíveis
const TIPOS = ['promo', 'meme', 'video'];

// 🎭 Temas de meme (PT-BR) — sorteados para variar
const TEMAS_MEME = [
  'meme engraçado', 'meme zoeira', 'meme brasileiro', 'meme programador',
  'meme segunda-feira', 'meme trabalho', 'meme internet', 'meme whatsapp',
  'meme tecnologia', 'meme gamer', 'meme estudos', 'meme relacionamento'
];

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

function carregar() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return { dia: null, postados: [], ultimoTipo: null };
  }
}

function salvar(d) {
  try { fs.writeFileSync(FILE, JSON.stringify(d)); } catch (e) { /* não quebra */ }
}

function chaveDia(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Escolhe o tipo de conteúdo, garantindo variação: nunca repete o último.
 * Se houver preferência válida (ex: dono pediu "meme"), usa ela.
 * @param {string|null} ultimoTipo - tipo do último post
 * @param {string} [preferencia] - tipo pedido (promo/meme/video/auto)
 * @returns {string} tipo escolhido
 */
function escolherTipo(ultimoTipo, preferencia) {
  const pref = String(preferencia || '').toLowerCase();
  if (TIPOS.includes(pref)) return pref;
  // auto (ou sem preferência): sorteia entre TODOS menos o último (variação garantida)
  const opcoes = TIPOS.filter(t => t !== ultimoTipo);
  return opcoes[Math.floor(Math.random() * opcoes.length)] || TIPOS[0];
}

/**
 * Sorteia um tema de meme da lista.
 * @returns {string}
 */
function sortearTemaMeme() {
  return TEMAS_MEME[Math.floor(Math.random() * TEMAS_MEME.length)];
}

/**
 * Monta a legenda PROFISSIONAL para um post de meme (nunca se identifica como IA,
 * nunca usa a persona da amante — regra máxima do canal).
 * @param {string} tema
 * @returns {string} legenda HTML
 */
function montarLegendaMeme(tema) {
  return `<b>😹 PAUSA PRO MEMENTO</b>\n\n${tema}? Só risada garantida. 😂\n\n<i>Divertido, né? E o CORVO também é: consultas, rajadas e muito mais.</i>\n\n👉 Chama no PV do bot e veja o que ele faz!`;
}

/**
 * Baixa uma imagem por URL (com detecção de tipo real por magic bytes) e devolve
 * o caminho salvo em data/downloads. Rejeita página HTML (link bloqueado).
 */
async function baixarImagem(url) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000, headers: UA, maxContentLength: 20 * 1024 * 1024 });
  const buf = Buffer.from(res.data);
  if (buf.length < 100) throw new Error('imagem vazia');
  const tipoReal = detectarTipoBuffer(buf);
  if (tipoReal === 'html') throw new Error('servidor devolveu página HTML (link bloqueado)');
  // Fallback .jpg p/ qualquer tipo não mapeado — nunca gera arquivo sem extensão
  const ext = { jpeg: '.jpg', png: '.png', gif: '.gif', webp: '.webp' }[tipoReal] || '.jpg';
  const out = path.join(DOWNLOADS_DIR, `meme_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  fs.writeFileSync(out, buf);
  return out;
}

/** Busca memes na internet e baixa UM aleatório. Devolve o caminho. */
async function buscarEBaixarMeme() {
  const iaTools = require('./ia_tools'); // lazy: evita ciclo CJS
  const tema = sortearTemaMeme();
  const resultados = await iaTools.buscarImagens(tema); // [{imagem, miniatura, titulo}]
  if (!Array.isArray(resultados) || resultados.length === 0) throw new Error('nenhuma imagem encontrada');
  // Prefere URLs com extensão de imagem direta; senão usa a primeira
  const comExt = resultados.filter(r => r && r.imagem && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(r.imagem));
  const fonte = (comExt.length ? comExt : resultados)[0];
  if (!fonte || !fonte.imagem) throw new Error('sem URL de imagem');
  const caminho = await baixarImagem(fonte.imagem);
  return { caminho, tema };
}

/** Posta um anúncio profissional (capa gerada + template do ia_ads). */
async function postarPromo() {
  const { TEMPLATES } = require('./ia_ads');
  const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const img = await iaCore.criarImagem(tpl.titulo, tpl.subtitulo);
  if (img && img.ok && img.caminho) {
    const r = await iaCore.postarFotoCanal(img.caminho, tpl.legenda);
    return { ok: !!(r && r.ok), tipo: 'promo', mensagem_id: r && r.mensagem_id, detalhe: tpl.titulo };
  }
  const r2 = await iaCore.postarCanal(tpl.legenda);
  return { ok: !!(r2 && r2.ok), tipo: 'promo', mensagem_id: r2 && r2.mensagem_id, detalhe: tpl.titulo };
}

/** Posta um meme da internet. */
async function postarMeme() {
  const { caminho, tema } = await buscarEBaixarMeme();
  const r = await iaCore.postarFotoCanal(caminho, montarLegendaMeme(tema));
  return { ok: !!(r && r.ok), tipo: 'meme', mensagem_id: r && r.mensagem_id, detalhe: tema };
}

/**
 * Posta um vídeo no canal.
 * @param {string} [caminhoOuUrl] - caminho local OU URL (baixa antes)
 */
async function postarVideo(caminhoOuUrl) {
  const iaTools = require('./ia_tools'); // lazy: evita ciclo CJS
  let caminho = String(caminhoOuUrl || '').trim();
  // 🎬 YouTube/TikTok primeiro: começam com https:// mas NÃO podem ir pro baixador
  // genérico (axios puro pega página HTML). youtube-dl-exec (yt-dlp) suporta os
  // dois. Só depois tenta o baixador genérico para URLs diretas de arquivo.
  if (/youtube|youtu\.be|tiktok|vm\.tiktok/i.test(caminho)) {
    const dl = await iaTools.baixarYouTube(caminho, 'video');
    if (!(dl && dl.ok && dl.arquivo)) throw new Error((dl && dl.erro) || 'falha no download do YouTube');
    caminho = dl.arquivo;
  } else if (/^https?:\/\//i.test(caminho)) {
    const dl = await iaTools.baixarArquivoURL(caminho);
    if (!(dl && dl.ok && dl.arquivo)) throw new Error((dl && dl.erro) || 'falha no download');
    caminho = dl.arquivo;
  }
  if (!caminho) throw new Error('informe o caminho ou URL do vídeo');
  const r = await iaCore.postarVideoCanal(caminho, '<b>🎬 CONTEÚDO FRESCO NO CANAL</b>\n\n<i>O CORVO sempre traz novidade.</i>', 'CORVO');
  return { ok: !!(r && r.ok), tipo: 'video', mensagem_id: r && r.mensagem_id, detalhe: caminho };
}

/**
 * Ponto único de postagem variada — usado pela ferramenta postar_conteudo_canal
 * (quando o dono pede "posta algo no canal") e pela agenda automática.
 * @param {string} [tipo] - auto (padrão) | promo | meme | video
 * @param {object} [extra] - { caminho } para vídeo
 */
async function postarAlgo(tipo, extra = {}) {
  const d = carregar();
  let escolhido = escolherTipo(d.ultimoTipo, tipo);
  // 🎬 Vídeo sem fonte (modo auto sem caminho/URL) não tem o que postar:
  // re-sorteia entre promo/meme em vez de degradar sempre pro promo.
  if (escolhido === 'video' && !(extra && extra.caminho)) {
    escolhido = escolherTipo(escolhido, null); // exclui 'video' (acabou de sair)
  }
  let res;
  try {
    if (escolhido === 'meme') res = await postarMeme();
    else if (escolhido === 'video') res = await postarVideo(extra && extra.caminho);
    else res = await postarPromo();
  } catch (e) {
    // 🛡️ Fallback: meme/vídeo podem falhar (internet/API). Cai pro anúncio
    // profissional (local, sempre funciona) — o slot nunca fica vazio.
    // Se o próprio promo falhou, não tenta de novo (evita dupla tentativa).
    if (escolhido === 'promo') return { ok: false, erro: e.message };
    const { logEvent } = iaCore.getCore();
    if (logEvent) logEvent('WARN', `Conteúdo '${escolhido}' falhou (${e.message}). Fallback: promo.`);
    try {
      res = await postarPromo();
      res = { ...res, fallbackDe: escolhido };
    } catch (e2) {
      return { ok: false, erro: e2.message };
    }
  }
  if (res && res.ok) {
    d.ultimoTipo = res.tipo;
    salvar(d);
  }
  return res;
}

/**
 * Verifica se é hora de postar conteúdo automático (chamado a cada minuto pelo
 * index.js). Posta no máximo 1 por slot por dia. Silencioso se não for a vez.
 */
async function verificar() {
  try {
    if (!iaCore.isReady()) return { ok: false, motivo: 'core não pronto' };
    const agora = new Date();
    const dia = chaveDia(agora);
    const agoraMin = agora.getHours() * 60 + agora.getMinutes();

    const d = carregar();
    if (d.dia !== dia) { d.dia = dia; d.postados = []; }

    // Janela de 10 min após o slot (mesmo padrão do ia_ads): o setInterval de 60s
    // pode não bater na virada exata do minuto.
    for (let i = 0; i < SLOTS.length; i++) {
      if (d.postados.includes(i)) continue;
      const [h, m] = SLOTS[i].split(':').map(Number);
      const slotMin = h * 60 + m;
      if (agoraMin >= slotMin && agoraMin - slotMin <= 10) {
        const res = await postarAlgo('auto');
        if (!(res && res.ok)) return { ok: false, motivo: res && res.erro ? res.erro : 'post falhou' };
        d.postados.push(i);
        salvar(d);
        const { logEvent } = iaCore.getCore();
        if (logEvent) logEvent('IA-CANAL', `🎨 Conteúdo automático #${i + 1} postado no canal (${SLOTS[i]}, tipo ${res.tipo}).`);
        return { ok: true, slot: i, horario: SLOTS[i], tipo: res.tipo };
      }
    }
    return { ok: false, motivo: 'fora do horário' };
  } catch (e) {
    const core = iaCore.getCore && iaCore.getCore();
    if (core && core.logEvent) core.logEvent('ERROR', `Falha no conteúdo automático do canal: ${e.message}`);
    return { ok: false, motivo: e.message };
  }
}

function getStats() {
  return carregar();
}

module.exports = {
  verificar,
  postarAlgo,
  escolherTipo,
  sortearTemaMeme,
  montarLegendaMeme,
  getStats,
  SLOTS,
  TIPOS,
  TEMAS_MEME,
};
