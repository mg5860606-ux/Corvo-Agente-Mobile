/**
 * 📣 CORVO - ANÚNCIOS AUTOMÁTICOS NO CANAL (5x/dia)
 * Posta anúncios profissionais e bonitos no canal oficial de forma automática:
 * 5 horários por dia (08:00, 11:00, 14:00, 17:00, 20:00), cada um com um
 * template rotativo (capa criada por criar_imagem + legenda HTML).
 * Estado em data/ia_ads.json — nunca posta o mesmo slot duas vezes no mesmo dia.
 */

const fs = require('fs');
const path = require('path');
const iaCore = require('./ia_core');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'ia_ads.json');

// 🕐 Horários fixos dos 5 anúncios diários (HH:MM)
const HORARIOS = ['08:00', '11:00', '14:00', '17:00', '20:00'];

// 📝 Templates profissionais: titulo/subtitulo vão na CAPA (criar_imagem) e a
// legenda no post. Título máx ~40 chars e subtítulo máx ~60 (sem emojis no
// texto da imagem — a fonte Arial não renderiza). A legenda aceita HTML.
const TEMPLATES = [
  {
    titulo: 'CORVO • BOT COMPLETO',
    subtitulo: 'Consultas, rajadas, nuke, flood e muito mais em um só lugar',
    legenda: `<b>🐦‍⬛ O CORVO FAZ TUDO</b>\n\n▸ 🔎 Consultas: CPF, Nome, Telefone, Placa, SIPNI, SISREG e Datora\n▸ 🚀 Rajadas, nuke e flood NGL/Sendit\n▸ 💎 Planos VIP com consultas ilimitadas\n\n<i>Direto do WhatsApp, sem complicação.</i>\n\n👉 Chama no PV do bot e veja a lista completa!`
  },
  {
    titulo: 'PLANOS VIP CORVO',
    subtitulo: 'Consultas ilimitadas, prioridade e zero cooldown',
    legenda: `<b>💎 PLANOS VIP — PREÇOS DE PIX</b>\n\n▸ ⚡ Diário: R$ 3,39\n▸ 🚀 Semanal: R$ 10,90\n▸ 🎯 Quinzenal: R$ 16,29\n▸ 👑 Mensal: R$ 24,29\n▸ 🔥 Trimestral: R$ 54,49\n\n<i>Consultas ILIMITADAS, prioridade na fila e sem cooldown.</i>\n\n👉 Chama no PV do bot para comprar!`
  },
  {
    titulo: 'VELOCIDADE E PODER',
    subtitulo: 'A ferramenta mais rápida da sua área',
    legenda: `<b>⚡ RAPIDEZ QUE VOCÊ NUNCA VIU</b>\n\n▸ Consultas em segundos\n▸ Rajadas que entregam\n▸ Sistema estável 24/7\n\n<i>Enquanto os outros carregam, o CORVO já entregou.</i>\n\n👉 Testa aí e comprova!`
  },
  {
    titulo: 'JUNTE-SE AO GRUPO',
    subtitulo: 'Novidades, suporte e atualizações em primeira mão',
    legenda: `<b>👥 COMUNIDADE CORVO</b>\n\n▸ Novidades em primeira mão\n▸ Suporte direto\n▸ Atualizações do bot sempre aqui\n\n<i>É no grupo que a zoeira e as novidades acontecem.</i>\n\n👉 Entra no grupo oficial e fica por dentro!`
  },
  {
    titulo: 'RAJADAS E NUKE',
    subtitulo: 'Domine seus grupos com a ferramenta certa',
    legenda: `<b>🚀 RAJADA + NUKE NA MESMA FERRAMENTA</b>\n\n▸ Rajadas 1, 2, 3, 4, porno e gore\n▸ Nuke com proteção e configurações VIP\n▸ Flood NGL e Sendit\n\n<i>Feito pra quem manda de verdade.</i>\n\n👉 Chama no PV e desbloqueia agora!`
  },
  {
    titulo: 'CONSULTAS ILIMITADAS',
    subtitulo: 'CPF, Nome, Telefone, Placa, SIPNI, SISREG, Datora',
    legenda: `<b>🔎 TODAS AS CONSULTAS EM UM SÓ LUGAR</b>\n\n▸ CPF, Nome e Telefone\n▸ Placa, SIPNI e SISREG\n▸ Base Datora completa\n\n<i>VIP = consultas ilimitadas, sem espera.</i>\n\n👉 Chama no PV do bot e confere a tabela!`
  }
];

function carregar() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return { dia: null, postados: [] };
  }
}

function salvar(d) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(d));
  } catch (e) { /* não quebra */ }
}

function chaveDia(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Verifica se é hora de postar algum anúncio (chamado a cada minuto pelo
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

    // Janela de 10 min após o slot: o setInterval de 60s pode não bater na
    // virada exata do minuto (ex: boot 08:00:10 → próximo tique 08:01:10).
    // Com a janela, o anúncio sai mesmo assim; o estado postados impede repetir.
    for (let i = 0; i < HORARIOS.length; i++) {
      if (d.postados.includes(i)) continue;
      const [h, m] = HORARIOS[i].split(':').map(Number);
      const slotMin = h * 60 + m;
      if (agoraMin >= slotMin && agoraMin - slotMin <= 10) {
        const tpl = TEMPLATES[i % TEMPLATES.length];
        // 🖼 Cria a capa (imagem com acentos funcionando) e posta com a legenda.
        // Os botões do canal entram de vez em quando (probabilidade interna).
        const img = await iaCore.criarImagem(tpl.titulo, tpl.subtitulo);
        if (img && img.ok && img.caminho) {
          const r = await iaCore.postarFotoCanal(img.caminho, tpl.legenda);
          if (!(r && r.ok)) return { ok: false, motivo: r && r.erro ? r.erro : 'post de foto falhou' };
        } else if (tpl.texto) {
          const r = await iaCore.postarCanal(tpl.texto);
          if (!(r && r.ok)) return { ok: false, motivo: r && r.erro ? r.erro : 'post de texto falhou' };
        } else {
          return { ok: false, motivo: 'sem template viável' };
        }
        d.postados.push(i);
        salvar(d);
        if (iaCore.getCore().logEvent) {
          iaCore.getCore().logEvent('IA-CANAL', `📣 Anúncio automático #${i + 1} postado no canal (${HORARIOS[i]}).`);
        }
        return { ok: true, slot: i, horario: HORARIOS[i] };
      }
    }
    return { ok: false, motivo: 'fora do horário' };
  } catch (e) {
    if (iaCore.getCore && iaCore.getCore() && iaCore.getCore().logEvent) {
      iaCore.getCore().logEvent('ERROR', `Falha no anúncio automático do canal: ${e.message}`);
    }
    return { ok: false, motivo: e.message };
  }
}

function getStats() {
  return carregar();
}

module.exports = { verificar, getStats, HORARIOS, TEMPLATES };
