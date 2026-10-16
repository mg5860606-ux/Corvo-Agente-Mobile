/**
 * 🦅 CORVO AGENTE MOBILE - DAEMON CORE & MOTOR DE SUBAGENTES
 * Arquitetura de Gateway central, execução assíncrona em background,
 * persistência de estado, carregamento dinâmico de skills,
 * Cérebro de Memória Episódica, Autonomous Loop, Síntese de Voz e
 * PAINEL WEB OPENCLAW SOVEREIGN (Com upload de Fotos, Vídeos, Áudios, seletor de Modelos em Tempo Real e controle de Canais WhatsApp/Telegram).
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./corvo_db');
const sensors = require('../modules/corvo_sensors');
const selfCoding = require('../modules/corvo_self_coding');
const godMode = require('../modules/corvo_god_mode');
const brain = require('./corvo_brain');
const autonomousLoop = require('./corvo_loop');
const voiceEngine = require('./corvo_voice');
const toolsRegistry = require('./corvo_tools_registry');
const telegramChannel = require('../channels/corvo_telegram');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ================= MIDDLEWARE DE AUTENTICAÇÃO (SEGURANÇA) =================
const GATEWAY_AUTH_TOKEN = process.env.GATEWAY_AUTH_TOKEN || '';

function authMiddleware(req, res, next) {
  // Se não há token configurado, desabilita autenticação (avisa no console)
  if (!GATEWAY_AUTH_TOKEN) return next();

  // Verifica Bearer Token no header Authorization OU query param ?token=
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const queryToken = req.query.token || '';

  if (bearerToken === GATEWAY_AUTH_TOKEN || queryToken === GATEWAY_AUTH_TOKEN) {
    return next();
  }

  return res.status(401).json({ error: 'Acesso negado. Token de autenticação inválido ou ausente.' });
}

// Rotas protegidas: todos os endpoints que executam ações no sistema
const protectedPaths = [
  '/chat', '/god/', '/sensors/', '/code/', '/tools/',
  '/subagent/', '/mission/', '/voice/', '/whatsapp/', '/telegram/', '/model/'
];

app.use((req, res, next) => {
  const needsAuth = protectedPaths.some(p => req.path.startsWith(p));
  if (needsAuth && req.method !== 'GET') {
    return authMiddleware(req, res, next);
  }
  // GET em /god/ e /sensors/ também precisa de auth (podem expor dados sensíveis)
  if (needsAuth && (req.path.startsWith('/god/') || req.path.startsWith('/sensors/'))) {
    return authMiddleware(req, res, next);
  }
  next();
});

const PORT = process.env.PORT || 3333;
const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const SKILLS_DIR = path.join(ROOT_DIR, 'skills');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Modelos Suportados no Gateway (Estilo OpenClaw)
let AVAILABLE_MODELS = [
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest (Rápido / Padrão)', type: 'cloud' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Multimodal)', type: 'cloud' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Reasoning)', type: 'cloud' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen)', type: 'cloud' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Estável)', type: 'cloud' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Avançado)', type: 'cloud' },
  { id: 'qwen2.5-coder-7b-instruct', name: 'Qwen 2.5 Coder 7B (Llama.cpp Local)', type: 'local' }
];

async function refreshModelsFromGoogle() {
  const currentKey = process.env.GEMINI_API_KEY;
  if (!currentKey) return;
  try {
    const axios = require('axios');
    const resp = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${currentKey}`, { timeout: 8000 });
    if (resp.data && Array.isArray(resp.data.models)) {
      const live = resp.data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => {
          const id = m.name.replace('models/', '');
          return { id, name: `${m.displayName || id} (${id})`, type: 'cloud' };
        });
      if (live.length > 0) {
        // Preserva o local
        AVAILABLE_MODELS = [...live, { id: 'qwen2.5-coder-7b-instruct', name: 'Qwen 2.5 Coder 7B (Llama.cpp Local)', type: 'local' }];
        console.log(`[MODELS] Sincronizados ${live.length} modelos dinâmicos da API Google Gemini.`);
      }
    }
  } catch (err) {
    // Mantém os modelos de fallback se a chave for inválida ou offline
    console.warn('[MODELS] Usando lista de modelos padrão offline:', err.message);
  }
}
refreshModelsFromGoogle();

let activeModelId = process.env.PRIMARY_MODEL || 'gemini-flash-latest';
const activeJobs = new Map();
let whatsappProcess = null;
let telegramRunning = false;

function loadDynamicSkills() {
  const skills = [];
  try {
    if (!fs.existsSync(SKILLS_DIR)) return skills;
    const items = fs.readdirSync(SKILLS_DIR);
    for (const item of items) {
      const itemPath = path.join(SKILLS_DIR, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const skillMd = path.join(itemPath, 'SKILL.md');
        if (fs.existsSync(skillMd)) {
          skills.push({ name: item, content: fs.readFileSync(skillMd, 'utf8') });
        }
      }
    }
  } catch (e) {
    console.error('Erro ao carregar skills dinâmicas:', e.message);
  }
  return skills;
}

async function spawnSubagent(jobId, prompt, contextData = {}) {
  await db.saveJob(jobId, 'running', prompt);
  activeJobs.set(jobId, { id: jobId, status: 'running', prompt, startTime: Date.now() });

  try {
    autonomousLoop.runAutonomousMission(jobId, prompt, {
      maxSteps: 25,
      onComplete: async (res) => {
        await db.saveJob(jobId, 'completed', prompt, res.report);
        activeJobs.set(jobId, { id: jobId, status: 'completed', prompt, result: res.report });
      }
    });
  } catch (error) {
    await db.saveJob(jobId, 'failed', prompt, null, error.message);
    activeJobs.set(jobId, { id: jobId, status: 'failed', prompt, error: error.message });
    brain.remember('subagent_error', `Job ${jobId} falhou: ${error.message}`);
  }
}

// ================= PAINEL WEB PROFISSIONAL ESTILO OPENCLAW =================

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🦅 CORVO AGENTE MOBILE // APEX SOVEREIGN GATEWAY</title>
  <style>
    :root {
      --bg-dark: #080b12;
      --bg-panel: #0f172a;
      --bg-chat: #131d35;
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.25);
      --border: #1e293b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
      --danger: #ef4444;
      --tg-color: #229ed9;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg-dark); color: var(--text-main); height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

    /* HEADER */
    header {
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      z-index: 10;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { font-size: 24px; filter: drop-shadow(0 0 8px var(--accent)); }
    .brand-title { font-size: 16px; font-weight: 800; letter-spacing: 1px; color: var(--text-main); }
    .brand-badge { font-size: 10px; background: rgba(56, 189, 248, 0.15); color: var(--accent); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 700; }

    .header-actions { display: flex; align-items: center; gap: 10px; }
    .btn-channel {
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      background: #1e293b;
      color: var(--text-muted);
    }
    .btn-channel.wa-active { background: #064e3b; color: #34d399; border-color: #059669; }
    .btn-channel.tg-active { background: #0c4a6e; color: #38bdf8; border-color: #0284c7; }

    .model-selector {
      background: #1e293b;
      color: #38bdf8;
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      outline: none;
      cursor: pointer;
    }

    /* LAYOUT PRINCIPAL */
    .main-wrapper { flex: 1; display: flex; overflow: hidden; }

    /* SIDEBAR / TELEMETRIA */
    .sidebar {
      width: 290px;
      background: var(--bg-panel);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 14px;
      overflow-y: auto;
    }
    .side-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
    }
    .side-title { font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; justify-content: space-between; }
    .stat-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
    .stat-val { color: var(--accent); font-weight: 600; }

    /* CHAT PRINCIPAL */
    .chat-view { flex: 1; display: flex; flex-direction: column; background: var(--bg-dark); }
    .chat-feed { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }

    .msg-wrap { display: flex; flex-direction: column; max-width: 75%; }
    .msg-wrap.user { align-self: flex-end; align-items: flex-end; }
    .msg-wrap.corvo { align-self: flex-start; align-items: flex-start; }

    .msg-sender { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; font-weight: 600; }
    .bubble {
      padding: 14px 18px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .msg-wrap.user .bubble {
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: #fff;
      border-bottom-right-radius: 2px;
      box-shadow: 0 4px 15px rgba(2, 132, 199, 0.25);
    }
    .msg-wrap.corvo .bubble {
      background: var(--bg-chat);
      color: #f1f5f9;
      border: 1px solid var(--border);
      border-bottom-left-radius: 2px;
    }
    .media-preview { max-width: 320px; max-height: 240px; border-radius: 8px; margin-top: 8px; border: 1px solid var(--border); }
    audio { margin-top: 8px; width: 280px; height: 36px; border-radius: 8px; }

    /* BOTTOM CONTROLS & TOOLBAR */
    .chat-bar {
      background: var(--bg-panel);
      border-top: 1px solid var(--border);
      padding: 14px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .toolbar-quick { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
    .quick-pill {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 12px;
      padding: 5px 12px;
      border-radius: 16px;
      cursor: pointer;
      white-space: nowrap;
      transition: 0.15s;
    }
    .quick-pill:hover { border-color: var(--accent); color: var(--accent); background: rgba(56, 189, 248, 0.08); }

    .input-row { display: flex; gap: 10px; align-items: center; }
    .input-field {
      flex: 1;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      color: #fff;
      font-size: 14px;
      padding: 12px 16px;
      border-radius: 10px;
      outline: none;
      transition: border 0.2s;
    }
    .input-field:focus { border-color: var(--accent); box-shadow: 0 0 10px var(--accent-glow); }

    .btn-action {
      background: var(--bg-chat);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 10px 14px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      transition: all 0.2s;
    }
    .btn-action:hover { border-color: var(--accent); color: #fff; }
    .btn-send {
      background: var(--accent);
      color: #0b0f19;
      font-weight: 800;
      border: none;
      padding: 12px 22px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-send:hover { background: #7dd3fc; box-shadow: 0 0 15px var(--accent-glow); }

    #mediaInput { display: none; }

    /* RESPONSIVIDADE MOBILE CIRÚRGICA (CELULAR / TABLET) */
    @media (max-width: 768px) {
      body { height: 100dvh; }
      header { padding: 10px 14px; flex-wrap: wrap; gap: 8px; }
      .brand-title { font-size: 14px; }
      .header-actions { width: 100%; justify-content: space-between; overflow-x: auto; padding-bottom: 2px; }
      .btn-channel, .model-selector { font-size: 11px; padding: 5px 8px; }

      /* Oculta sidebar no mobile para dar foco 100% ao chat */
      .sidebar { display: none; }

      .chat-feed { padding: 12px; gap: 12px; }
      .msg-wrap { max-width: 90%; }
      .bubble { font-size: 13.5px; padding: 10px 14px; }
      .media-preview { max-width: 100%; height: auto; }
      audio { width: 100%; }

      .chat-bar { padding: 10px 12px; }
      .toolbar-quick { gap: 6px; }
      .quick-pill { font-size: 11px; padding: 4px 10px; }
      .input-field { font-size: 14px; padding: 10px 12px; }
      .btn-action { padding: 8px 10px; font-size: 12px; }
      .btn-action span { display: none; } /* Deixa só o ícone do clipe no celular */
      .btn-send { padding: 10px 16px; font-size: 13px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span class="brand-icon">🦅</span>
      <span class="brand-title">CORVO APEX GATEWAY</span>
      <span class="brand-badge">OPENCLAW SOVEREIGN</span>
    </div>
    <div class="header-actions">
      <!-- Seletor de Modelo Ativo -->
      <select class="model-selector" id="modelSelect" onchange="changeModel(this.value)">
        ${AVAILABLE_MODELS.map(m => `<option value="${m.id}" ${m.id === activeModelId ? 'selected' : ''}>${m.name}</option>`).join('')}
      </select>

      <!-- Toggle WhatsApp -->
      <button class="btn-channel" id="waBtn" onclick="toggleWhatsApp()">
        <span>💬</span> <span id="waText">WhatsApp: OFF</span>
      </button>

      <!-- Toggle Telegram -->
      <button class="btn-channel" id="tgBtn" onclick="toggleTelegram()">
        <span>✈️</span> <span id="tgText">Telegram: OFF</span>
      </button>
    </div>
  </header>

  <div class="main-wrapper">
    <!-- SIDEBAR DE ARSENAL E TELEMETRIA -->
    <div class="sidebar">
      <div class="side-card">
        <div class="side-title">Motor de Inteligência</div>
        <div class="stat-row"><span>Modelo Ativo:</span> <span class="stat-val" id="dispModel">${activeModelId}</span></div>
        <div class="stat-row"><span>Persona:</span> <span class="stat-val">Amante do Corvo</span></div>
        <div class="stat-row"><span>Persistência:</span> <span class="stat-val">OpenClaw Loop</span></div>
        <div class="stat-row"><span>Voz Ativa:</span> <span class="stat-val">Sarah (PT-BR)</span></div>
      </div>

      <div class="side-card">
        <div class="side-title">Canais Conectados</div>
        <div class="stat-row"><span>Web Gateway:</span> <span class="stat-val" style="color: var(--success);">ONLINE (Porta 3333)</span></div>
        <div class="stat-row"><span>WhatsApp:</span> <span class="stat-val" id="sideWaStatus">Desconectado</span></div>
        <div class="stat-row"><span>Telegram:</span> <span class="stat-val" id="sideTgStatus">Desconectado</span></div>
      </div>

      <div class="side-card">
        <div class="side-title">Arsenal & Ferramentas</div>
        <div style="font-size: 11px; color: var(--text-muted); line-height: 1.6;">
          ✓ Terminal & Shell Root<br>
          ✓ Kali Linux WSL2 Integrado<br>
          ✓ Scanner Ofensivo 1-Click<br>
          ✓ Auditoria de SPAs & Chaves<br>
          ✓ Self-Coding com Backup<br>
          ✓ Visão de Tela (Screen Capture)<br>
          ✓ Sensores Mobile (GPS, Áudio, Bateria)
        </div>
      </div>

      <div class="side-card">
        <div class="side-title">Memória & Reforço</div>
        <div class="stat-row"><span>Feedback Learner:</span> <span class="stat-val">Reinforced</span></div>
        <div class="stat-row"><span>Soluções:</span> <span class="stat-val">Proven Active</span></div>
      </div>
    </div>

    <!-- ÁREA DO CHAT -->
    <div class="chat-view">
      <div class="chat-feed" id="chatFeed">
        <div class="msg-wrap corvo">
          <div class="msg-sender">🦅 Amante do Corvo (Agente Apex)</div>
          <div class="bubble">Pronta, Marcos. O Gateway é soberano: você comanda tudo por aqui sem precisar ligar WhatsApp nem Telegram se não quiser. Mas se quiser, clica ali em cima e conecta na hora. Pode trocar de modelo, mandar foto, áudio ou vídeo. O que você manda agora?</div>
        </div>
      </div>

      <div class="chat-bar">
        <div class="toolbar-quick">
          <div class="quick-pill" onclick="sendQuick('Tira um print da tela agora')">📷 Print da Tela</div>
          <div class="quick-pill" onclick="sendQuick('Status da máquina e da bateria')">🔋 Telemetria</div>
          <div class="quick-pill" onclick="sendQuick('Me manda um áudio da sua situação')">🎙️ Áudio de Voz</div>
          <div class="quick-pill" onclick="sendQuick('Lista todos os arquivos do projeto')">📁 Código do Projeto</div>
          <div class="quick-pill" onclick="sendQuick('Quais são suas ferramentas ativas?')">🛠️ Arsenal Completo</div>
        </div>

        <div class="input-row">
          <input type="file" id="mediaInput" accept="image/*,video/*,audio/*" onchange="handleFileSelected(event)">
          <button class="btn-action" onclick="document.getElementById('mediaInput').click()">
            📎 <span>Anexar Mídia</span>
          </button>
          <input type="text" id="promptInput" class="input-field" placeholder="Envie sua ordem direta para o agente..." onkeypress="if(event.key === 'Enter') submitMessage()">
          <button class="btn-send" onclick="submitMessage()">Enviar</button>
        </div>
        <div id="mediaNotice" style="font-size: 11px; color: var(--accent); display: none;"></div>
      </div>
    </div>
  </div>

  <script>
    const AUTH_TOKEN = '${GATEWAY_AUTH_TOKEN}';
    function authHeaders(extra) {
      const h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
      if (AUTH_TOKEN) h['Authorization'] = 'Bearer ' + AUTH_TOKEN;
      return h;
    }
    let attachedFile = null;

    function handleFileSelected(e) {
      const file = e.target.files[0];
      if (!file) return;
      attachedFile = file;
      const notice = document.getElementById('mediaNotice');
      notice.style.display = 'block';
      notice.textContent = '📎 Arquivo selecionado: ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
    }

    async function submitMessage() {
      const input = document.getElementById('promptInput');
      const text = input.value.trim();
      if (!text && !attachedFile) return;

      appendUserMessage(text, attachedFile);
      input.value = '';

      const notice = document.getElementById('mediaNotice');
      notice.style.display = 'none';

      const fileToSend = attachedFile;
      attachedFile = null;
      document.getElementById('mediaInput').value = '';

      const typingId = appendCorvoLoading();

      try {
        let base64Data = null;
        let fileType = null;
        let fileName = null;

        if (fileToSend) {
          fileName = fileToSend.name;
          fileType = fileToSend.type;
          base64Data = await toBase64(fileToSend);
        }

        const res = await fetch('/chat', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            message: text,
            file: base64Data ? { data: base64Data, type: fileType, name: fileName } : null
          })
        });

        const data = await res.json();
        removeElement(typingId);

        appendCorvoMessage(data.reply || data.error || 'Sem resposta.', data.audioUrl, data.mediaUrl);
      } catch (err) {
        removeElement(typingId);
        appendCorvoMessage('Erro de conexão ao processar comando: ' + err.message);
      }
    }

    function sendQuick(txt) {
      document.getElementById('promptInput').value = txt;
      submitMessage();
    }

    function toBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
      });
    }

    function appendUserMessage(text, file) {
      const feed = document.getElementById('chatFeed');
      const wrap = document.createElement('div');
      wrap.className = 'msg-wrap user';

      let mediaHtml = '';
      if (file) {
        if (file.type.startsWith('image/')) {
          mediaHtml = '<br><img src="' + URL.createObjectURL(file) + '" class="media-preview">';
        } else if (file.type.startsWith('video/')) {
          mediaHtml = '<br><video src="' + URL.createObjectURL(file) + '" class="media-preview" controls></video>';
        } else if (file.type.startsWith('audio/')) {
          mediaHtml = '<br><audio src="' + URL.createObjectURL(file) + '" controls></audio>';
        } else {
          mediaHtml = '<br>📄 ' + file.name;
        }
      }

      wrap.innerHTML = '<div class="msg-sender">Você (Marcos)</div><div class="bubble">' + escapeHtml(text) + mediaHtml + '</div>';
      feed.appendChild(wrap);
      feed.scrollTop = feed.scrollHeight;
    }

    function appendCorvoMessage(text, audioUrl, mediaUrl) {
      const feed = document.getElementById('chatFeed');
      const wrap = document.createElement('div');
      wrap.className = 'msg-wrap corvo';

      let extras = '';
      if (mediaUrl) {
        if (mediaUrl.endsWith('.png') || mediaUrl.endsWith('.jpg') || mediaUrl.endsWith('.jpeg')) {
          extras += '<br><img src="' + mediaUrl + '" class="media-preview">';
        } else if (mediaUrl.endsWith('.mp4')) {
          extras += '<br><video src="' + mediaUrl + '" class="media-preview" controls></video>';
        }
      }

      if (audioUrl) {
        extras += '<br><audio src="' + audioUrl + '" controls autoplay></audio>';
      }

      wrap.innerHTML = '<div class="msg-sender">🦅 Amante do Corvo (Agente Apex)</div><div class="bubble">' + escapeHtml(text) + extras + '</div>';
      feed.appendChild(wrap);
      feed.scrollTop = feed.scrollHeight;
    }

    function appendCorvoLoading() {
      const feed = document.getElementById('chatFeed');
      const wrap = document.createElement('div');
      const id = 'load_' + Date.now();
      wrap.id = id;
      wrap.className = 'msg-wrap corvo';
      wrap.innerHTML = '<div class="msg-sender">🦅 Amante do Corvo</div><div class="bubble" style="color: var(--accent);">⚡ Analisando ordem e orquestrando arsenal...</div>';
      feed.appendChild(wrap);
      feed.scrollTop = feed.scrollHeight;
      return id;
    }

    function removeElement(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }

    function escapeHtml(string) {
      return String(string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async function changeModel(modelId) {
      try {
        const res = await fetch('/model/switch', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ model: modelId })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('dispModel').textContent = data.activeModel;
          console.log('[MODELO] Alterado para: ' + data.activeModel);
        }
      } catch (e) {
        alert('Erro ao trocar modelo: ' + e.message);
      }
    }

    async function loadDynamicModels() {
      try {
        const res = await fetch('/models');
        const data = await res.json();
        if (data.availableModels && data.availableModels.length > 0) {
          const sel = document.getElementById('modelSelect');
          sel.innerHTML = data.availableModels.map(function(m) {
            var selAttr = (m.id === data.activeModel) ? ' selected' : '';
            return '<option value="' + m.id + '"' + selAttr + '>' + m.name + '</option>';
          }).join('');
          document.getElementById('dispModel').textContent = data.activeModel;
        }
      } catch (e) {
        console.warn('Erro ao carregar modelos dinâmicos:', e.message);
      }
    }
    loadDynamicModels();

    async function toggleWhatsApp() {
      const btn = document.getElementById('waBtn');
      const text = document.getElementById('waText');
      const side = document.getElementById('sideWaStatus');
      text.textContent = 'Iniciando WhatsApp...';

      try {
        const res = await fetch('/whatsapp/toggle', { method: 'POST', headers: authHeaders() });
        const data = await res.json();
        if (data.running) {
          btn.className = 'btn-channel wa-active';
          text.textContent = 'WhatsApp: ON';
          side.textContent = 'Conectado';
          side.style.color = 'var(--success)';
        } else {
          btn.className = 'btn-channel';
          text.textContent = 'WhatsApp: OFF';
          side.textContent = 'Desconectado';
          side.style.color = 'var(--text-muted)';
        }
      } catch (e) {
        text.textContent = 'Erro ao alternar WhatsApp';
      }
    }

    async function toggleTelegram() {
      const btn = document.getElementById('tgBtn');
      const text = document.getElementById('tgText');
      const side = document.getElementById('sideTgStatus');
      text.textContent = 'Iniciando Telegram...';

      try {
        const res = await fetch('/telegram/toggle', { method: 'POST', headers: authHeaders() });
        const data = await res.json();
        if (data.running) {
          btn.className = 'btn-channel tg-active';
          text.textContent = 'Telegram: ON';
          side.textContent = 'Conectado';
          side.style.color = 'var(--accent)';
        } else {
          btn.className = 'btn-channel';
          text.textContent = 'Telegram: OFF';
          side.textContent = 'Desconectado';
          side.style.color = 'var(--text-muted)';
        }
      } catch (e) {
        text.textContent = 'Erro ao alternar Telegram';
      }
    }
  </script>
</body>
</html>`);
});

// Endpoint para trocar de modelo ativo em tempo real (Estilo OpenClaw)
app.post('/model/switch', (req, res) => {
  const { model } = req.body;
  const match = AVAILABLE_MODELS.find(m => m.id === model);
  if (!match) return res.status(400).json({ error: 'Modelo não reconhecido.' });

  activeModelId = match.id;
  console.log(`[MODEL SWITCH] Modelo ativo alterado para: ${activeModelId}`);
  res.json({ success: true, activeModel: activeModelId });
});

app.get('/models', async (req, res) => {
  await refreshModelsFromGoogle();
  res.json({ activeModel: activeModelId, availableModels: AVAILABLE_MODELS });
});

// Endpoint conversacional robusto com Multimodal (Texto, Fotos, Áudios, Vídeos)
app.post('/chat', async (req, res) => {
  const { message, file } = req.body;
  if (!message && !file) return res.status(400).json({ error: 'Mensagem ou arquivo vazio' });

  try {
    if (!genAI) {
      return res.json({ reply: 'GEMINI_API_KEY não configurada no servidor.' });
    }

    const model = genAI.getGenerativeModel({ model: activeModelId });
    const systemPrompt = fs.readFileSync(path.resolve(__dirname, '../../system.md'), 'utf8');

    // Recupera memórias e soluções comprovadas
    const recalled = await brain.recall(message ? message.slice(0, 30) : 'midia', 4);
    const contextMemo = recalled.length > 0 ? `\nMemórias:\n${recalled.join('\n')}\n` : '';

    const contents = [];

    let fileSavedPath = null;
    let mediaUrl = null;

    // Se veio arquivo (imagem, vídeo ou áudio), salva no disco e passa pro Gemini
    if (file && file.data) {
      const ext = path.extname(file.name || '') || (file.type?.includes('image') ? '.png' : file.type?.includes('video') ? '.mp4' : '.mp3');
      const savedName = `upload_${Date.now()}${ext}`;
      fileSavedPath = path.join(UPLOADS_DIR, savedName);
      fs.writeFileSync(fileSavedPath, Buffer.from(file.data, 'base64'));
      mediaUrl = `/uploads/${savedName}`;

      contents.push({
        inlineData: {
          data: file.data,
          mimeType: file.type || 'image/png'
        }
      });
    }

    const textPrompt = `${systemPrompt}
${contextMemo}
Usuário (Marcos): "${message || 'Analise a mídia em anexo'}"

Responda diretamente com a sua persona (amante do Marcos / Corvo Agente Mobile), sem clichês, sem enrolação.`;

    contents.push(textPrompt);

    // 1. Screenshot
    if (message && /(tira|tirar|captura|print).*tela/i.test(message)) {
      const shot = await toolsRegistry.screen_capture.execute();
      if (shot.success && fs.existsSync(shot.path)) {
        const shotBase = path.basename(shot.path);
        return res.json({
          reply: 'Print da tela capturado com sucesso, Marcos. Tá na mão.',
          mediaUrl: `/data/${shotBase}`
        });
      }
    }

    // 2. Comandos Operacionais Diretos (Shell / Terminal / Bateria / GPS / Apps)
    if (message) {
      // Aprendizado ativo com feedbacks do Marcos
      brain.processFeedback(message);

      // Bateria
      if (/\b(bateria|status da bateria|nível de bateria)\b/i.test(message)) {
        const bat = sensors.statusBateria();
        return res.json({
          reply: `Status da bateria, Marcos:\n${bat.output || JSON.stringify(bat, null, 2)}`
        });
      }

      // GPS / Localização
      if (/\b(localiza[çc][aã]o|onde est[aá]|gps|coordenadas)\b/i.test(message)) {
        const loc = sensors.getLocalizacao();
        return res.json({
          reply: `Localização GPS capturada:\n${loc.output || JSON.stringify(loc, null, 2)}`
        });
      }

      // Listar Apps
      if (/\b(listar apps|quais apps|programas instalados)\b/i.test(message)) {
        const apps = godMode.listarApps('third-party');
        return res.json({
          reply: `Aplicativos de terceiros instalados no aparelho:\n${apps.output || apps.error || 'Nenhum'}`
        });
      }

      // Listar Arquivos do Projeto
      if (/\b(lista(r)? (todos )?arquivos|c[oó]digo do projeto|estrutura do projeto)\b/i.test(message)) {
        const filesRes = selfCoding.listarArquivos('');
        return res.json({
          reply: `Arquivos do projeto Corvo Agente Mobile:\n\n${(filesRes.files || []).slice(0, 40).join('\n')}`
        });
      }

      // Arsenal / Ferramentas
      if (/\b(arsenal|quais s[aã]o suas ferramentas|ferramentas ativas)\b/i.test(message)) {
        const toolsList = Object.keys(toolsRegistry).map(k => `• <b>${k}</b>: ${toolsRegistry[k].description}`).join('\n');
        return res.json({
          reply: `Aqui está o meu arsenal ativo pronto para você comandar, Marcos:\n\n${toolsList}`
        });
      }

      // Comandos explícitos de terminal (ex: "executa shell: ls" ou "roda comando: pkg update")
      const shellMatch = message.match(/^(?:executa|executar|roda|rodar|comando|shell)\s*:\s*(.+)$/i);
      if (shellMatch) {
        const cmd = shellMatch[1].trim();
        const execRes = await toolsRegistry.exec_shell.execute({ command: cmd });
        return res.json({
          reply: `Comando executado:\n\`\`\`\n${execRes.output || execRes.error || '[Sem saída]'}\n\`\`\``
        });
      }

      // Varredura de Alvo (Recon Scan)
      const reconMatch = message.match(/^(?:escaneia|escanear|scan|recon|nmap)\s+(.+)$/i);
      if (reconMatch) {
        const target = reconMatch[1].trim();
        const reconRes = await toolsRegistry.recon_scan.execute({ target, quick: true });
        return res.json({
          reply: `Varredura ofensiva concluída contra ${target}:\n\`\`\`\n${reconRes.output || reconRes.error}\n\`\`\``
        });
      }
    }

    const response = await model.generateContent(contents);
    const reply = response.response.text().trim();

    // Registra no banco
    db.logChat('gateway_web', 'Marcos', message || '[Mídia enviada]', reply);

    // Se o usuário pedir áudio ou for ordem de voz
    let audioUrl = null;
    if (message && /(áudio|audio|fala|voz)/i.test(message)) {
      const vRes = await voiceEngine.gerarAudio(reply.slice(0, 350));
      if (vRes.success) {
        audioUrl = `/audio/${path.basename(vRes.filePath)}`;
      }
    }

    res.json({ reply, audioUrl, mediaUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Controle do WhatsApp sob demanda (iniciar/parar pelo painel)
app.post('/whatsapp/toggle', (req, res) => {
  if (whatsappProcess && !whatsappProcess.killed) {
    whatsappProcess.kill();
    whatsappProcess = null;
    return res.json({ running: false, message: 'WhatsApp desconectado.' });
  } else {
    const waScript = path.resolve(__dirname, '../channels/corvo_whatsapp.js');
    whatsappProcess = spawn('node', [waScript], {
      stdio: 'inherit',
      cwd: ROOT_DIR
    });

    whatsappProcess.on('close', () => {
      whatsappProcess = null;
    });

    return res.json({ running: true, message: 'WhatsApp iniciado.' });
  }
});

// Controle do Telegram sob demanda (iniciar/parar pelo painel)
app.post('/telegram/toggle', (req, res) => {
  if (telegramRunning) {
    telegramChannel.stopPolling();
    telegramRunning = false;
    return res.json({ running: false, message: 'Telegram desconectado.' });
  } else {
    telegramChannel.startPolling();
    telegramRunning = true;
    return res.json({ running: true, message: 'Telegram conectado.' });
  }
});

// Rotas estáticas para uploads, áudios e prints
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/audio', express.static(AUDIO_DIR));
app.use('/data', express.static(DATA_DIR));

// ================= API ENDPOINTS EXISTENTES =================

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    platform: 'Corvo AGENTE MOBILE God Mode & OpenClaw Loop Daemon',
    activeModel: activeModelId,
    whatsappAtivo: !!(whatsappProcess && !whatsappProcess.killed),
    telegramAtivo: telegramRunning,
    uptime: process.uptime(),
    skillsCarregadas: loadDynamicSkills().map(s => s.name),
    ferramentasDisponiveis: Object.keys(toolsRegistry)
  });
});

app.post('/subagent/spawn', (req, res) => {
  const { prompt, context } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  spawnSubagent(jobId, prompt, context || {});

  res.json({ success: true, jobId, message: 'Subagente disparado com sucesso em loop autônomo.' });
});

app.get('/subagent/:jobId', async (req, res) => {
  const job = await db.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });
  res.json(job);
});

app.post('/mission/start', (req, res) => {
  const { objective } = req.body;
  if (!objective) return res.status(400).json({ error: 'Objetivo da missão é obrigatório' });

  const missionId = `mission_${Date.now()}`;
  autonomousLoop.runAutonomousMission(missionId, objective);

  res.json({ success: true, missionId, message: 'Missão iniciada em Autonomous Loop contínuo.' });
});

app.post('/voice/generate', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto é obrigatório' });

  const result = await voiceEngine.gerarAudio(text, voiceId);
  res.json(result);
});

app.post('/tools/execute', async (req, res) => {
  const { tool, args } = req.body;
  if (!tool) return res.status(400).json({ error: 'Nome da ferramenta é obrigatório' });
  const result = await autonomousLoop.dispatchTool(tool, args || {});
  res.json(result);
});

app.get('/sensors/gps', (req, res) => { res.json(sensors.getLocalizacao()); });
app.post('/sensors/camera', (req, res) => { res.json(sensors.tirarFoto(req.body.camera || '0')); });
app.post('/sensors/audio', (req, res) => { res.json(sensors.gravarAudio(req.body.duracao || 5)); });
app.get('/sensors/sms', (req, res) => { res.json(sensors.listarSms(req.query.limite || 5)); });
app.get('/sensors/battery', (req, res) => { res.json(sensors.statusBateria()); });

app.get('/code/list', (req, res) => { res.json(selfCoding.listarArquivos()); });
app.post('/code/read', (req, res) => { res.json(selfCoding.lerCodigo(req.body.arquivo)); });
app.post('/code/write', (req, res) => { res.json(selfCoding.escreverCodigo(req.body.arquivo, req.body.conteudo)); });

app.post('/god/shell', (req, res) => { res.json(godMode.executarShell(req.body.comando, req.body.root || false)); });
app.get('/god/apps', (req, res) => { res.json(godMode.listarApps(req.query.tipo || 'all')); });
app.post('/god/app/open', (req, res) => { res.json(godMode.abrirApp(req.body.package)); });
app.get('/god/screenshot', async (req, res) => {
  const r = await toolsRegistry.screen_capture.execute();
  res.json(r);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[CORVO AGENTE MOBILE] Daemon Brain & Autonomous Loop rodando na porta ${PORT}.`);
  if (!GATEWAY_AUTH_TOKEN) {
    console.warn('\n⚠️  [SEGURANÇA] GATEWAY_AUTH_TOKEN não configurado no .env!');
    console.warn('    Qualquer pessoa na sua rede local pode controlar o dispositivo.');
    console.warn('    Adicione GATEWAY_AUTH_TOKEN=seu_token_seguro no .env para proteger os endpoints.\n');
  } else {
    console.log('[SEGURANÇA] Autenticação Bearer Token ativa. Endpoints protegidos.');
  }
});
