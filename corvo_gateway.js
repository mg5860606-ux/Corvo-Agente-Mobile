/**
 * 🦅 CORVO AGENTE MOBILE - DAEMON CORE & MOTOR DE SUBAGENTES
 * Arquitetura de Gateway central, execução assíncrona em background,
 * persistência de estado, carregamento dinâmico de skills,
 * Cérebro de Memória Episódica (corvo_brain.js) e Autonomous Loop (corvo_loop.js).
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./corvo_db');
const sensors = require('./corvo_sensors');
const selfCoding = require('./corvo_self_coding');
const godMode = require('./corvo_god_mode');
const brain = require('./corvo_brain');
const autonomousLoop = require('./corvo_loop');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3333;
const DATA_DIR = path.resolve(__dirname, 'data');
const SKILLS_DIR = path.resolve(__dirname, 'skills');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const activeJobs = new Map();

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
    if (!genAI) throw new Error('GEMINI_API_KEY não configurada no .env');
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const skills = loadDynamicSkills();
    const skillsContext = skills.map(s => `--- SKILL: ${s.name} ---\n${s.content}`).join('\n\n');
    const arquivosProjeto = selfCoding.listarArquivos();

    const fullPrompt = `Você é o Corvo Subagente Autônomo God Mode com Cérebro Episódico.
Contexto do sistema: Android / Termux / CORVO AGENTE MOBILE Mobile com privilégios absolutos.
Arquivos do projeto disponíveis para edição: ${JSON.stringify(arquivosProjeto.files || [])}
Skills disponíveis:\n${skillsContext}

Tarefa solicitada:
${prompt}

Dados de contexto:
${JSON.stringify(contextData, null, 2)}

Execute a tarefa com precisão absoluta utilizando o God Mode, memória episódica e autorrecuperação. Retorne o resultado final.`;

    const response = await model.generateContent(fullPrompt);
    const text = response.response.text();

    await db.saveJob(jobId, 'completed', prompt, text);
    activeJobs.set(jobId, { id: jobId, status: 'completed', prompt, result: text });
    brain.remember('subagent_success', `Job ${jobId} concluído com sucesso.`);
  } catch (error) {
    await db.saveJob(jobId, 'failed', prompt, null, error.message);
    activeJobs.set(jobId, { id: jobId, status: 'failed', prompt, error: error.message });
    brain.remember('subagent_error', `Job ${jobId} falhou: ${error.message}`);
  }
}

// ================= API ENDPOINTS (GATEWAY MINI-OPENCLAW) =================

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    platform: 'Corvo AGENTE MOBILE God Mode & Autonomous Loop Daemon',
    uptime: process.uptime(),
    skillsCarregadas: loadDynamicSkills().map(s => s.name)
  });
});

app.post('/subagent/spawn', (req, res) => {
  const { prompt, context } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  spawnSubagent(jobId, prompt, context || {});

  res.json({ success: true, jobId, message: 'Subagente disparado com sucesso.' });
});

app.get('/subagent/:jobId', async (req, res) => {
  const job = await db.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });
  res.json(job);
});

// ================= ENDPOINTS DE AUTONOMOUS LOOP =================

app.post('/mission/start', (req, res) => {
  const { objective } = req.body;
  if (!objective) return res.status(400).json({ error: 'Objetivo da missão é obrigatório' });

  const missionId = `mission_${Date.now()}`;
  // Roda em background sem bloquear o HTTP
  autonomousLoop.runAutonomousMission(missionId, objective);

  res.json({ success: true, missionId, message: 'Missão iniciada em Autonomous Loop contínuo. Só vai parar ao concluir.' });
});

// ================= ENDPOINTS DE SENSORES (TERMUX-API) =================

app.get('/sensors/gps', (req, res) => { res.json(sensors.getLocalizacao()); });
app.post('/sensors/camera', (req, res) => { res.json(sensors.tirarFoto(req.body.camera || '0')); });
app.post('/sensors/audio', (req, res) => { res.json(sensors.gravarAudio(req.body.duracao || 5)); });
app.get('/sensors/sms', (req, res) => { res.json(sensors.listarSms(req.query.limite || 5)); });
app.get('/sensors/battery', (req, res) => { res.json(sensors.statusBateria()); });

// ================= ENDPOINTS DE SELF-CODING =================

app.get('/code/list', (req, res) => { res.json(selfCoding.listarArquivos()); });
app.post('/code/read', (req, res) => { res.json(selfCoding.lerCodigo(req.body.arquivo)); });
app.post('/code/write', (req, res) => { res.json(selfCoding.escreverCodigo(req.body.arquivo, req.body.conteudo)); });

// ================= ENDPOINTS DE GOD MODE =================

app.post('/god/shell', (req, res) => { res.json(godMode.executarShell(req.body.comando, req.body.root || false)); });
app.get('/god/apps', (req, res) => { res.json(godMode.listarApps(req.query.tipo || 'all')); });
app.post('/god/app/open', (req, res) => { res.json(godMode.abrirApp(req.body.package)); });
app.get('/god/screenshot', (req, res) => { res.json(godMode.tirarPrint()); });
app.post('/god/volume', (req, res) => { res.json(godMode.ajustarVolume(req.body.stream || '3', req.body.volume || '10')); });
app.post('/god/wifi', (req, res) => { res.json(godMode.controlarWifi(req.body.estado)); });
app.post('/god/call', (req, res) => { res.json(godMode.fazerLigacao(req.body.numero)); });
app.post('/god/sms/send', (req, res) => { res.json(godMode.enviarSms(req.body.numero, req.body.mensagem)); });
app.post('/god/clipboard/set', (req, res) => { res.json(godMode.copiarClipboard(req.body.texto || '')); });
app.get('/god/clipboard/get', (req, res) => { res.json(godMode.lerClipboard()); });
app.post('/god/vibrate', (req, res) => { res.json(godMode.vibrar(req.body.ms || 500)); });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[CORVO AGENTE MOBILE] Daemon Brain & Autonomous Loop rodando na porta ${PORT}.`);
});
