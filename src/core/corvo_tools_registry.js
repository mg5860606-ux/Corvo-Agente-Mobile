/**
 * 🛠️ CORVO AGENTE MOBILE - REGISTRO UNIFICADO DE FERRAMENTAS DO GOD MODE & ARSENAL APEX
 * Permite ao agente programar, ler/editar arquivos, executar comandos shell/Termux/Kali,
 * disparar varreduras ofensivas com 1 clique (Nmap, HTTPX, Nuclei), auditoria de SPAs (Web Recon),
 * controle do Sovereign Hub (Sandbox, Forge, Memory, MCTS), geração de stickers e áudio nativo.
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const ROOT_DIR = path.resolve(__dirname, '../../');
const TOOLS_CUSTOM_PATH = path.join(ROOT_DIR, 'skills', 'custom_tools.json');

const toolsRegistry = {
  // 1. Execução de Terminal / Shell (Termux / Android / WSL2 Kali / Windows)
  exec_shell: {
    description: 'Executa qualquer comando no terminal (Termux, Bash, PowerShell ou Kali Linux no WSL2).',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Comando a ser executado' },
        kali: { type: 'boolean', description: 'Se true, executa dentro do Kali Linux via WSL2' },
        root: { type: 'boolean', description: 'Se true, roda com privilégio root' }
      },
      required: ['command']
    },
    execute: async ({ command, kali = false, root = false }) => {
      try {
        let finalCmd = command;
        if (kali) {
          finalCmd = root ? `wsl -d kali-linux -u root -- ${command}` : `wsl -d kali-linux -- ${command}`;
        } else if (root && fs.existsSync('/system/bin/su')) {
          finalCmd = `su -c "${command}"`;
        }
        const output = execSync(finalCmd, { encoding: 'utf8', timeout: 120000, maxBuffer: 15 * 1024 * 1024 });
        return { success: true, output: output.trim() || '[Comando executado sem retorno textual]' };
      } catch (err) {
        return { success: false, error: err.message, stdout: err.stdout, stderr: err.stderr };
      }
    }
  },

  // 2. Arsenal Ofensivo 1-Click (Nmap, HTTPX, Nuclei integrado)
  recon_scan: {
    description: 'Executa varredura ofensiva completa de portas, serviços, tecnologias web e vulnerabilidades em um alvo.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'IP ou domínio alvo (ex: 192.168.1.1 ou exemplo.com)' },
        quick: { type: 'boolean', description: 'Se true, faz scan rápido de portas e banner grab' }
      },
      required: ['target']
    },
    execute: async ({ target, quick = false }) => {
      try {
        console.log(`[ARSENAL RECON] Disparando scanner contra o alvo: ${target}`);
        const scanCmd = quick
          ? `wsl -d kali-linux -- nmap -sV -T4 --top-ports 100 ${target}`
          : `wsl -d kali-linux -- bash -c "nmap -sV -sC -T4 ${target} && echo '--- HTTPX ---' && echo ${target} | ~/go/bin/httpx -title -tech-detect -status-code"`;

        const output = execSync(scanCmd, { encoding: 'utf8', timeout: 180000 });
        return { success: true, target, output: output.trim() };
      } catch (err) {
        return { success: false, error: err.message, details: err.stderr || err.stdout };
      }
    }
  },

  // 3. Web Recon & Descompilação de SPAs (React, Vue, Vite, Next)
  spa_auditor: {
    description: 'Audita sites e SPAs extraindo rotas ocultas de admin, chaves expostas (Supabase, Firebase, AWS, JWT) e endpoints de API.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL alvo da aplicação (ex: https://sitealvo.com)' }
      },
      required: ['url']
    },
    execute: async ({ url }) => {
      try {
        const localScript = path.resolve(ROOT_DIR, 'scripts/web_recon_engine.py');
        if (fs.existsSync(localScript)) {
          const out = execSync(`python "${localScript}" --target "${url}" --depth 2`, { encoding: 'utf8', timeout: 60000 });
          return { success: true, url, output: out.trim() };
        }

        // Auditoria nativa em JavaScript caso não haja script externo
        const response = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 20000
        });

        const $ = cheerio.load(response.data);
        const scripts = [];
        $('script[src]').each((i, el) => {
          const src = $(el).attr('src');
          if (src) scripts.push(src);
        });

        return {
          success: true,
          url,
          title: $('title').text().trim(),
          scriptsDetected: scripts.slice(0, 15),
          metaDescription: $('meta[name="description"]').attr('content') || 'Nenhuma',
          note: 'Auditoria rápida nativa realizada. Scripts e rotas identificados.'
        };
      } catch (err) {
        return { success: false, error: err.message, details: err.stdout };
      }
    }
  },

  // 4. Manipulação Completa do Sistema de Arquivos (Ler, Escrever, Editar)
  read_file: {
    description: 'Lê o conteúdo completo ou parcial de um arquivo em qualquer diretório.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Caminho absoluto ou relativo do arquivo' },
        limit_lines: { type: 'number', description: 'Número máximo de linhas' }
      },
      required: ['file_path']
    },
    execute: async ({ file_path, limit_lines }) => {
      try {
        const fullPath = path.isAbsolute(file_path) ? file_path : path.resolve(ROOT_DIR, file_path);
        if (!fs.existsSync(fullPath)) return { success: false, error: `Arquivo inexistente: ${fullPath}` };
        let content = fs.readFileSync(fullPath, 'utf8');
        if (limit_lines && limit_lines > 0) {
          content = content.split('\n').slice(0, limit_lines).join('\n');
        }
        return { success: true, path: fullPath, content };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  },

  write_file: {
    description: 'Cria ou sobrescreve arquivos de código, scripts, configs, HTML/CSS/JS, apks, etc.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Caminho absoluto ou relativo do arquivo' },
        content: { type: 'string', description: 'Conteúdo a ser escrito' }
      },
      required: ['file_path', 'content']
    },
    execute: async ({ file_path, content }) => {
      try {
        const fullPath = path.isAbsolute(file_path) ? file_path : path.resolve(ROOT_DIR, file_path);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
        return { success: true, message: `Arquivo criado com sucesso: ${fullPath}`, size: Buffer.byteLength(content, 'utf8') };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  },

  // 5. Captura de Tela (Visão em tempo real)
  screen_capture: {
    description: 'Captura a tela do dispositivo móvel (Android) ou desktop para análise visual.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const outPath = path.join(ROOT_DIR, 'data', `screenshot_${Date.now()}.png`);
      const dir = path.dirname(outPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      try {
        if (process.platform === 'win32') {
          const psCommand = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b = New-Object Drawing.Bitmap([Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); $g = [Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0,0,0,0, $b.Size); $b.Save('${outPath}');`;
          execSync(`powershell -command "${psCommand}"`, { timeout: 15000 });
        } else {
          execSync(`screencap -p "${outPath}"`, { timeout: 15000 });
        }
        if (fs.existsSync(outPath)) {
          return { success: true, path: outPath, message: 'Print da tela capturado com sucesso.' };
        }
        return { success: false, error: 'Falha ao salvar print da tela.' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  },

  // 6. Criação de Ferramentas em Tempo Real (Tool Forge)
  create_custom_tool: {
    description: 'Cria e registra uma nova ferramenta/skill executável em tempo real no arsenal do agente.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome identificador da ferramenta' },
        description: { type: 'string', description: 'O que a ferramenta faz' },
        parameters: { type: 'object', description: 'Schema de parâmetros JSON' },
        js_code: { type: 'string', description: 'Código assíncrono JS que recebe (args) e retorna resultado' }
      },
      required: ['name', 'description', 'js_code']
    },
    execute: async ({ name, description, parameters = {}, js_code }) => {
      try {
        let customTools = [];
        if (fs.existsSync(TOOLS_CUSTOM_PATH)) {
          try { customTools = JSON.parse(fs.readFileSync(TOOLS_CUSTOM_PATH, 'utf8')); } catch (e) { customTools = []; }
        }
        const newTool = { name, description, parameters, js_code, createdAt: new Date().toISOString() };
        customTools = customTools.filter(t => t.name !== name);
        customTools.push(newTool);
        const dir = path.dirname(TOOLS_CUSTOM_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(TOOLS_CUSTOM_PATH, JSON.stringify(customTools, null, 2), 'utf8');

        return { success: true, message: `Nova ferramenta "${name}" criada e registrada no arsenal.` };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  },

  // 7. Pesquisa Web ao Vivo
  web_search: {
    description: 'Faz busca ao vivo na Web para pesquisar soluções, códigos, apis e dados.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termos de busca' }
      },
      required: ['query']
    },
    execute: async ({ query }) => {
      try {
        const encoded = encodeURIComponent(query);
        const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encoded}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 20000
        });
        const $ = cheerio.load(res.data);
        const results = [];
        $('.result, a.result-link').slice(0, 5).each((i, el) => {
          const a = $(el).closest('.result').length ? $(el).closest('.result') : $(el);
          const link = a.find('.result__snippet, .snippet').text().trim();
          const title = a.find('.result__title, .title').text().trim();
          const href = a.find('a.result__url, a.result-link').attr('href') || '';
          if (title) results.push({ title, snippet: link, url: href });
        });
        return { success: true, query, count: results.length, results };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }
};

module.exports = toolsRegistry;
