/**
 * 🦅 CORVO AGENTE MOBILE - DAEMON CORE & MOTOR DE SUBAGENTES
 * Arquitetura de Gateway central, execução assíncrona em background,
 * persistência de estado, carregamento dinâmico de skills,
 * Cérebro de Memória Episódica, Autonomous Loop e Síntese de Voz Ultra-Realista.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./corvo_db');
const sensors = require('../modules/corvo_sensors');
const selfCoding = require('../modules/corvo_self_coding');
const godMode = require('../modules/corvo_god_mode');
const brain = require('./corvo_brain');
const autonomousLoop = require('./corvo_loop');
const voiceEngine = require('./corvo_voice');
const toolsRegistry = require('./corvo_tools_registry');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3333;
const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SKILLS_DIR = path.join(ROOT_DIR, 'skills');

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
    // Dispara via loop autônomo com persistência real
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

// ================= API ENDPOINTS =================

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    platform: 'Corvo AGENTE MOBILE God Mode & OpenClaw Loop Daemon',
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

// Endpoint para gerar Áudio / Voz Ultra-Realista
app.post('/voice/generate', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto é obrigatório' });

  const result = await voiceEngine.gerarAudio(text, voiceId);
  res.json(result);
});

// Ferramentas Diretas
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
});
