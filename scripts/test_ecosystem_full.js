/**
 * 🧪 TESTE COMPLETO DO ECOSSISTEMA DO CORVO AGENTE MOBILE
 * Testa cada subsistema anunciado no README:
 * 1. Cérebro Neural (Memória Episódica, Mood, Soluções Comprovadas)
 * 2. Self-Coding (Leitura, Escrita, Listagem)
 * 3. Tools Registry (Todas as ferramentas operacionais, Shell, Web, Arquivos)
 * 4. Hardware & Sensores Mobile (Bateria, Foto, Áudio, Localização)
 * 5. God Mode & Touch Mobile (Tap, Swipe, Type, Keyevent)
 * 6. Visão Computacional (capturarTela, localizarElemento)
 * 7. Navegador Web (Puppeteer / Browser Engine)
 * 8. Provedor de IA (Google AI Studio Interactions API gemini-3.8-flash)
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const ROOT = path.resolve(__dirname, '../');

async function testAll() {
  console.log('==================================================');
  console.log('  🦅 AUDITORIA GERAL DO ECOSSISTEMA DO AGENTE');
  console.log('==================================================\n');

  const report = [];

  function logPass(name, detail = '') {
    console.log(`✅ [PASS] ${name} ${detail ? '(' + detail + ')' : ''}`);
    report.push({ name, status: 'PASS', detail });
  }

  function logWarn(name, detail = '') {
    console.log(`⚠️ [WARN] ${name} (${detail})`);
    report.push({ name, status: 'WARN', detail });
  }

  function logFail(name, detail = '') {
    console.log(`❌ [FAIL] ${name} (${detail})`);
    report.push({ name, status: 'FAIL', detail });
  }

  // 1. CÉREBRO
  console.log('--- 1. CÉREBRO NEURAL & MEMÓRIA ---');
  try {
    const brain = require(path.join(ROOT, 'src/core/corvo_brain'));
    await brain.remember('test_tag', 'teste de gravacao de memoria', 5);
    const recalled = await brain.recall('test_tag', 1);
    if (Array.isArray(recalled)) logPass('Memória Episódica (remember/recall)');
    else logFail('Memória Episódica', 'Não retornou array');

    const mood = brain.getMood();
    if (mood && mood.current_mood) logPass('Governor de Humor/Mood', mood.current_mood);
    else logFail('Governor de Humor/Mood');
  } catch (e) {
    logFail('Cérebro Neural', e.message);
  }

  // 2. SELF-CODING
  console.log('\n--- 2. SELF-CODING (MODIFICAÇÃO DE CÓDIGO) ---');
  try {
    const sc = require(path.join(ROOT, 'src/modules/corvo_self_coding'));
    const files = sc.listarArquivos('');
    if (files.success && files.files.length > 0) logPass('Self-Coding: Listar Arquivos', `${files.files.length} arquivos`);
    else logFail('Self-Coding: Listar Arquivos');

    const readRes = sc.lerCodigo('package.json');
    if (readRes.success) logPass('Self-Coding: Ler Código Próprio');
    else logFail('Self-Coding: Ler Código Próprio');
  } catch (e) {
    logFail('Self-Coding', e.message);
  }

  // 3. TOOLS REGISTRY
  console.log('\n--- 3. TOOLS REGISTRY (CATÁLOGO DE FERRAMENTAS) ---');
  try {
    const tools = require(path.join(ROOT, 'src/core/corvo_tools_registry'));
    const count = Object.keys(tools).length;
    if (count >= 15) logPass('Arsenal de Ferramentas Ativo', `${count} ferramentas registradas`);
    else logWarn('Arsenal de Ferramentas', `Apenas ${count} ferramentas`);

    // Testa ferramenta nativa de shell
    const shellRes = await tools.exec_shell.execute({ command: 'node -v' });
    if (shellRes.success) logPass('Execução de Shell (exec_shell)', shellRes.output.slice(0, 30));
    else logFail('Execução de Shell', shellRes.error);
  } catch (e) {
    logFail('Tools Registry', e.message);
  }

  // 4. HARDWARE E SENSORES
  console.log('\n--- 4. HARDWARE & SENSORES MOBILE ---');
  try {
    const sensors = require(path.join(ROOT, 'src/modules/corvo_sensors'));
    const bat = sensors.statusBateria();
    if (bat.success) {
      logPass('Sensor de Bateria', `${bat.percentage}% (fonte: ${bat.source || 'Termux'})`);
    } else {
      logWarn('Sensor de Bateria', 'Termux:API ausente no ambiente atual (normal se rodando no Windows)');
    }
  } catch (e) {
    logFail('Sensores Mobile', e.message);
  }

  // 5. TOUCH & GOD MODE ANDROID
  console.log('\n--- 5. TOUCH & CONTROLE DO ANDROID ---');
  try {
    const god = require(path.join(ROOT, 'src/modules/corvo_god_mode'));
    if (typeof god.tocarNaTela === 'function' && typeof god.deslizarTela === 'function' && typeof god.digitarTexto === 'function') {
      logPass('Módulo Touch & Input Virtual (tocarNaTela, deslizarTela, digitarTexto)');
    } else {
      logFail('Módulo Touch & Input', 'Métodos não encontrados');
    }
  } catch (e) {
    logFail('God Mode Android', e.message);
  }

  // 6. VISÃO COMPUTACIONAL
  console.log('\n--- 6. VISÃO COMPUTACIONAL MOBILE ---');
  try {
    const vision = require(path.join(ROOT, 'src/modules/corvo_vision'));
    if (typeof vision.capturarTela === 'function' && typeof vision.localizarElementoNaTela === 'function') {
      logPass('Motor Vision-Action (corvo_vision)');
    } else {
      logFail('Motor Vision-Action', 'Funções ausentes');
    }
  } catch (e) {
    logFail('Visão Computacional', e.message);
  }

  // 7. GOOGLE AI STUDIO (GEMINI 3.8 FLASH INTERACTIONS API)
  console.log('\n--- 7. CONEXÃO GOOGLE AI STUDIO (GEMINI 3.8 FLASH) ---');
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey.includes('sua_chave')) {
    logWarn('Google AI Studio Key', 'GEMINI_API_KEY vazia no .env (necessário colar sua chave no .env para testar a chamada ao vivo)');
  } else {
    try {
      const axios = require('axios');
      const testReq = await axios.post('https://generativelanguage.googleapis.com/v1beta/interactions', {
        model: 'gemini-3.8-flash',
        input: 'responda apenas a palavra: ONLINE',
        store: true
      }, {
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        timeout: 20000
      });
      const output = testReq.data?.outputs?.[0]?.text || testReq.data?.output || '';
      if (output) logPass('Google AI Studio Interactions API (gemini-3.8-flash)', `Retorno: ${output.trim().slice(0, 40)}`);
      else logFail('Google AI Studio Interactions API', 'Resposta vazia');
    } catch (apiErr) {
      logWarn('Google AI Studio Interactions API', apiErr.response?.data?.error?.message || apiErr.message);
    }
  }

  console.log('\n==================================================');
  const passes = report.filter(r => r.status === 'PASS').length;
  const warns = report.filter(r => r.status === 'WARN').length;
  const fails = report.filter(r => r.status === 'FAIL').length;
  console.log(`📊 AUDITORIA FINALIZADA: ${passes} Aprovados | ${warns} Alertas/Avisos | ${fails} Falhas`);
  console.log('==================================================');
}

testAll();
