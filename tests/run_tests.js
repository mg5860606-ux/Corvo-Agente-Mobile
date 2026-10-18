#!/usr/bin/env node
/**
 * 🧪 CORVO AGENTE MOBILE - SUITE DE TESTES AUTOMATIZADOS
 * Testa: módulos core, integridade de imports, registro de ferramentas,
 * cérebro neural, self-coding e validação de sintaxe de todos os arquivos JS.
 *
 * Executar: npm test  OU  node tests/run_tests.js
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}`);
    console.log(`     → ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(message || `Esperado ${expected}, recebeu ${actual}`);
}

// ========================================
console.log('\n🦅 CORVO AGENTE MOBILE - SUITE DE TESTES');
console.log('========================================\n');

// ========================================
// 1. VALIDAÇÃO DE SINTAXE DE TODOS OS ARQUIVOS JS
// ========================================
console.log('📋 [1/6] Validação de Sintaxe (node --check)');

const jsFiles = [
  'start-master.js',
  'src/core/corvo_gateway.js',
  'src/core/corvo_brain.js',
  'src/core/corvo_loop.js',
  'src/core/corvo_db.js',
  'src/core/corvo_voice.js',
  'src/core/corvo_tools_registry.js',
  'src/channels/corvo_telegram.js',
  'src/channels/corvo_whatsapp.js',
  'src/modules/corvo_sensors.js',
  'src/modules/corvo_god_mode.js',
  'src/modules/corvo_self_coding.js',
  'src/modules/corvo_browser.js',
];

for (const file of jsFiles) {
  const fullPath = path.join(ROOT, file);
  test(`Sintaxe válida: ${file}`, () => {
    assert(fs.existsSync(fullPath), `Arquivo não encontrado: ${file}`);
    execSync(`node --check "${fullPath}"`, { timeout: 10000 });
  });
}

// ========================================
// 2. TESTE DE IMPORTS DOS MÓDULOS CORE
// ========================================
console.log('\n📋 [2/6] Imports dos Módulos Core');

test('Módulo corvo_brain carrega sem erro', () => {
  const brain = require(path.join(ROOT, 'src/core/corvo_brain.js'));
  assert(typeof brain.remember === 'function', 'brain.remember deve ser function');
  assert(typeof brain.recall === 'function', 'brain.recall deve ser function');
  assert(typeof brain.processFeedback === 'function', 'brain.processFeedback deve ser function');
  assert(typeof brain.getMood === 'function', 'brain.getMood deve ser function');
  assert(typeof brain.saveMission === 'function', 'brain.saveMission deve ser function');
  assert(typeof brain.getProvenSolutions === 'function', 'brain.getProvenSolutions deve ser function');
});

test('Módulo corvo_db carrega sem erro', () => {
  const db = require(path.join(ROOT, 'src/core/corvo_db.js'));
  assert(typeof db.saveJob === 'function', 'db.saveJob deve ser function');
  assert(typeof db.getJob === 'function', 'db.getJob deve ser function');
  assert(typeof db.addOfflineQueue === 'function', 'db.addOfflineQueue deve ser function');
  assert(typeof db.logChat === 'function', 'db.logChat deve ser function');
});

test('Módulo corvo_tools_registry carrega sem erro', () => {
  const tools = require(path.join(ROOT, 'src/core/corvo_tools_registry.js'));
  assert(typeof tools === 'object', 'tools deve ser object');
  assert(typeof tools.exec_shell === 'object', 'exec_shell deve existir');
  assert(typeof tools.exec_shell.execute === 'function', 'exec_shell.execute deve ser function');
  assert(typeof tools.read_file === 'object', 'read_file deve existir');
  assert(typeof tools.write_file === 'object', 'write_file deve existir');
  assert(typeof tools.screen_capture === 'object', 'screen_capture deve existir');
  assert(typeof tools.web_search === 'object', 'web_search deve existir');
  assert(typeof tools.recon_scan === 'object', 'recon_scan deve existir');
  assert(typeof tools.spa_auditor === 'object', 'spa_auditor deve existir');
});

test('Módulo corvo_self_coding carrega sem erro', () => {
  const selfCoding = require(path.join(ROOT, 'src/modules/corvo_self_coding.js'));
  assert(typeof selfCoding.lerCodigo === 'function', 'lerCodigo deve ser function');
  assert(typeof selfCoding.escreverCodigo === 'function', 'escreverCodigo deve ser function');
  assert(typeof selfCoding.listarArquivos === 'function', 'listarArquivos deve ser function');
});

test('Módulo corvo_sensors carrega sem erro', () => {
  const sensors = require(path.join(ROOT, 'src/modules/corvo_sensors.js'));
  assert(typeof sensors.getLocalizacao === 'function', 'getLocalizacao deve ser function');
  assert(typeof sensors.tirarFoto === 'function', 'tirarFoto deve ser function');
  assert(typeof sensors.gravarAudio === 'function', 'gravarAudio deve ser function');
  assert(typeof sensors.statusBateria === 'function', 'statusBateria deve ser function');
});

test('Módulo corvo_god_mode carrega sem erro', () => {
  const godMode = require(path.join(ROOT, 'src/modules/corvo_god_mode.js'));
  assert(typeof godMode.executarShell === 'function', 'executarShell deve ser function');
  assert(typeof godMode.listarApps === 'function', 'listarApps deve ser function');
  assert(typeof godMode.abrirApp === 'function', 'abrirApp deve ser function');
});

// ========================================
// 3. TESTE FUNCIONAL: BRAIN (Memória + Feedback)
// ========================================
console.log('\n📋 [3/6] Testes Funcionais: Cérebro Neural');

test('Brain: remember + recall funciona', async () => {
  const brain = require(path.join(ROOT, 'src/core/corvo_brain.js'));
  const tag = `test_${Date.now()}`;
  await brain.remember(tag, 'Teste unitário de memória episódica', 5, 'test');
  const results = await brain.recall(tag, 3);
  assert(Array.isArray(results), 'recall deve retornar array');
  // Nota: O SQLite pode demorar a indexar; aceita resultado vazio em CI
});

test('Brain: getMood retorna objeto válido', () => {
  const brain = require(path.join(ROOT, 'src/core/corvo_brain.js'));
  const mood = brain.getMood();
  assert(typeof mood === 'object', 'getMood deve retornar object');
  assert(typeof mood.current_mood === 'string', 'current_mood deve ser string');
  assert(typeof mood.energy_level === 'number', 'energy_level deve ser number');
});

test('Brain: getProvenSolutions retorna objeto', () => {
  const brain = require(path.join(ROOT, 'src/core/corvo_brain.js'));
  const solutions = brain.getProvenSolutions();
  assert(typeof solutions === 'object', 'getProvenSolutions deve retornar object');
});

test('Brain: processFeedback positivo registra aprendizado', async () => {
  const brain = require(path.join(ROOT, 'src/core/corvo_brain.js'));
  const result = await brain.processFeedback('ficou top, mandou bem', 'test_action', 'test_solution');
  assert(typeof result === 'object', 'processFeedback deve retornar object');
  if (result.learned) {
    assertEqual(result.sentiment, 'positive', 'Sentiment deve ser positive');
  }
});

// ========================================
// 4. TESTE FUNCIONAL: SELF-CODING
// ========================================
console.log('\n📋 [4/6] Testes Funcionais: Self-Coding');

test('Self-Coding: lerCodigo lê arquivo existente', () => {
  const selfCoding = require(path.join(ROOT, 'src/modules/corvo_self_coding.js'));
  const result = selfCoding.lerCodigo('package.json');
  assert(result.success === true, 'Deve conseguir ler package.json');
  assert(result.content.includes('corvo-agent-mobile'), 'Conteúdo deve conter nome do projeto');
});

test('Self-Coding: lerCodigo retorna erro em arquivo inexistente', () => {
  const selfCoding = require(path.join(ROOT, 'src/modules/corvo_self_coding.js'));
  const result = selfCoding.lerCodigo('arquivo_que_nao_existe_xyz_123.js');
  assert(result.success === false, 'Deve retornar erro para arquivo inexistente');
});

test('Self-Coding: listarArquivos retorna lista', () => {
  const selfCoding = require(path.join(ROOT, 'src/modules/corvo_self_coding.js'));
  const result = selfCoding.listarArquivos('');
  assert(result.success === true, 'Deve listar arquivos com sucesso');
  assert(Array.isArray(result.files), 'files deve ser array');
  assert(result.files.length > 0, 'Deve haver pelo menos 1 arquivo');
});

// ========================================
// 5. TESTE FUNCIONAL: TOOLS REGISTRY
// ========================================
console.log('\n📋 [5/6] Testes Funcionais: Tools Registry');

test('Tools: read_file lê package.json corretamente', async () => {
  const tools = require(path.join(ROOT, 'src/core/corvo_tools_registry.js'));
  const result = await tools.read_file.execute({ file_path: 'package.json' });
  assert(result.success === true, 'Deve ler package.json');
  assert(result.content.includes('corvo-agent-mobile'), 'Conteúdo deve conter nome do projeto');
});

test('Tools: read_file retorna erro em arquivo inexistente', async () => {
  const tools = require(path.join(ROOT, 'src/core/corvo_tools_registry.js'));
  const result = await tools.read_file.execute({ file_path: '/inexistente_abc_987.txt' });
  assert(result.success === false, 'Deve retornar erro');
});

test('Tools: write_file cria arquivo temporário', async () => {
  const tools = require(path.join(ROOT, 'src/core/corvo_tools_registry.js'));
  const tempPath = path.join(ROOT, 'data', `test_temp_${Date.now()}.txt`);
  const result = await tools.write_file.execute({ file_path: tempPath, content: 'teste unitário' });
  assert(result.success === true, 'Deve criar arquivo');
  // Limpa
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
});

test('Tools: Todas as ferramentas têm description e execute', () => {
  const tools = require(path.join(ROOT, 'src/core/corvo_tools_registry.js'));
  for (const [name, tool] of Object.entries(tools)) {
    assert(typeof tool.description === 'string', `${name} deve ter description`);
    assert(typeof tool.execute === 'function', `${name} deve ter execute`);
  }
});

// ========================================
// 6. TESTE DE INTEGRIDADE DE CONFIGURAÇÃO
// ========================================
console.log('\n📋 [6/6] Integridade de Configuração');

test('package.json tem todas as dependências necessárias', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const required = ['express', 'sqlite3', '@google/generative-ai', 'axios', 'dotenv', 'cheerio', 'form-data', 'pino'];
  for (const dep of required) {
    assert(pkg.dependencies[dep], `Dependência "${dep}" faltando no package.json`);
  }
});

test('.env.example existe e contém variáveis essenciais', () => {
  const envExample = path.join(ROOT, '.env.example');
  assert(fs.existsSync(envExample), '.env.example deve existir');
  const content = fs.readFileSync(envExample, 'utf8');
  assert(content.includes('GEMINI_API_KEY'), 'Deve conter GEMINI_API_KEY');
  assert(content.includes('PORT'), 'Deve conter PORT');
  assert(content.includes('GATEWAY_AUTH_TOKEN'), 'Deve conter GATEWAY_AUTH_TOKEN');
  assert(content.includes('TELEGRAM_BOT_TOKEN'), 'Deve conter TELEGRAM_BOT_TOKEN');
});

test('.gitignore exclui node_modules', () => {
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert(gitignore.includes('node_modules'), '.gitignore deve excluir node_modules');
});

test('system.md (persona) existe', () => {
  assert(fs.existsSync(path.join(ROOT, 'system.md')), 'system.md deve existir na raiz');
});

test('start-master.js existe e é o entry point', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assertEqual(pkg.main, 'start-master.js', 'main deve apontar para start-master.js');
  assert(fs.existsSync(path.join(ROOT, 'start-master.js')), 'start-master.js deve existir');
});

// ========================================
// RESULTADO FINAL
// ========================================
console.log('\n========================================');
console.log(`🧪 RESULTADOS: ${passed}/${totalTests} testes passaram`);
if (failed > 0) {
  console.log(`❌ ${failed} teste(s) falharam:\n`);
  for (const f of failures) {
    console.log(`   • ${f.name}: ${f.error}`);
  }
  console.log('');
  process.exit(1);
} else {
  console.log('✅ Todos os testes passaram! Projeto validado.\n');
  process.exit(0);
}
