/**
 * 🌐 CORVO AGENTE MOBILE - NAVEGADOR AUTÔNOMO APEX (OPENCLAW BROWSER ENGINE)
 * Automação web profissional e furtiva: navega em sites, visualiza o DOM,
 * clica em botões, preenche formulários, resolve campos de busca/login,
 * extrai dados, baixa arquivos e captura prints da página em tempo real.
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'browser_shots');

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function getExecutablePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/data/data/com.termux/files/usr/bin/chromium'
  ];
  return candidates.find(c => c && fs.existsSync(c)) || null;
}

class CorvoBrowser {
  constructor() {
    this.browser = null;
    this.page = null;
    this.idleTimer = null;
  }

  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    // Fecha após 5 minutos de inatividade para economizar memória
    this.idleTimer = setTimeout(() => this.close(), 300000);
  }

  async init() {
    this.resetIdleTimer();
    if (this.browser && this.page && !this.page.isClosed()) {
      return { browser: this.browser, page: this.page };
    }

    const execPath = getExecutablePath();
    if (!execPath) {
      throw new Error('Nenhum navegador executável encontrado no sistema (Chrome, Edge ou Chromium). Configure CHROME_PATH no .env.');
    }

    this.browser = await puppeteer.launch({
      executablePath: execPath,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,800',
        '--lang=pt-BR,pt,en-US,en'
      ],
      defaultViewport: { width: 1280, height: 800 }
    });

    const pages = await this.browser.pages();
    this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

    // User-Agent furtivo e moderno
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    // Configuração de pasta de download automático
    const client = await this.page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOADS_DIR
    });

    return { browser: this.browser, page: this.page };
  }

  /**
   * Navega para uma URL e retorna diagnóstico estruturado da página
   */
  async navigate(url, options = {}) {
    try {
      let targetUrl = url.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }

      const { page } = await this.init();
      const waitUntil = options.waitUntil || 'domcontentloaded';

      const response = await page.goto(targetUrl, {
        waitUntil,
        timeout: options.timeout || 35000
      });

      // Aguarda um pequeno delay para carregar renderizações dinâmicas
      await new Promise(r => setTimeout(r, 1500));

      const title = await page.title();
      const currentUrl = page.url();
      const status = response ? response.status() : 200;

      // Extrai elementos interativos da tela (botões, inputs, links)
      const elements = await this.extractInteractiveElements(page);

      // Captura print automático para conferência visual
      const shotFile = `nav_${Date.now()}.png`;
      const shotPath = path.join(SCREENSHOTS_DIR, shotFile);
      await page.screenshot({ path: shotPath, fullPage: false });

      return {
        success: true,
        title,
        url: currentUrl,
        status,
        screenshot: shotPath,
        interactiveElements: elements,
        message: `Navegou com sucesso para: ${currentUrl} (${title})`
      };
    } catch (err) {
      return { success: false, error: `Falha ao navegar para "${url}": ${err.message}` };
    }
  }

  /**
   * Clica em um elemento (por seletor CSS, texto do botão ou link)
   */
  async click(target, options = {}) {
    try {
      const { page } = await this.init();

      let clicked = false;
      // 1. Tenta por seletor direto
      try {
        await page.waitForSelector(target, { timeout: 3000, visible: true });
        await page.click(target);
        clicked = true;
      } catch (e) {
        // 2. Se falhar por seletor, tenta buscar por texto visível (botões ou links)
        clicked = await page.evaluate((txt) => {
          const norm = txt.toLowerCase().trim();
          const elements = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], span, div'));
          for (const el of elements) {
            const val = (el.innerText || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
            if (val === norm || val.includes(norm)) {
              el.scrollIntoView({ behavior: 'instant', block: 'center' });
              el.click();
              return true;
            }
          }
          return false;
        }, target);
      }

      if (!clicked) {
        return { success: false, error: `Elemento "${target}" não encontrado para clique na página.` };
      }

      // Aguarda possíveis navegações ou chamadas ajax
      await new Promise(r => setTimeout(r, 1500));

      const title = await page.title();
      const currentUrl = page.url();

      const shotFile = `click_${Date.now()}.png`;
      const shotPath = path.join(SCREENSHOTS_DIR, shotFile);
      await page.screenshot({ path: shotPath, fullPage: false });

      return {
        success: true,
        message: `Clicou com sucesso em "${target}".`,
        title,
        url: currentUrl,
        screenshot: shotPath
      };
    } catch (err) {
      return { success: false, error: `Erro ao clicar em "${target}": ${err.message}` };
    }
  }

  /**
   * Digita texto em um campo de entrada (input, textarea)
   */
  async type(selector, text, options = {}) {
    try {
      const { page } = await this.init();

      let targetSelector = selector;

      // Se não for um seletor clássico, tenta encontrar por placeholder, name ou id
      const found = await page.evaluate((sel) => {
        if (document.querySelector(sel)) return sel;
        const inputByName = document.querySelector(`input[name="${sel}"], textarea[name="${sel}"]`);
        if (inputByName) return `input[name="${sel}"], textarea[name="${sel}"]`;
        const inputByPlaceholder = document.querySelector(`input[placeholder*="${sel}" i], textarea[placeholder*="${sel}" i]`);
        if (inputByPlaceholder) return `input[placeholder*="${sel}" i], textarea[placeholder*="${sel}" i]`;
        const inputById = document.querySelector(`#${sel}`);
        if (inputById) return `#${sel}`;
        return null;
      }, selector);

      if (found) targetSelector = found;

      await page.waitForSelector(targetSelector, { timeout: 5000, visible: true });

      if (options.clear !== false) {
        await page.click(targetSelector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
      }

      await page.type(targetSelector, String(text), { delay: options.delay || 40 });

      if (options.pressEnter) {
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 1500));
      }

      return {
        success: true,
        message: `Digitou texto com sucesso no campo "${selector}".`,
        typedText: text,
        url: page.url()
      };
    } catch (err) {
      return { success: false, error: `Erro ao digitar no campo "${selector}": ${err.message}` };
    }
  }

  /**
   * Captura screenshot da página inteira ou viewport
   */
  async screenshot(options = {}) {
    try {
      const { page } = await this.init();
      const fileName = options.filename || `shot_${Date.now()}.png`;
      const outPath = path.join(SCREENSHOTS_DIR, fileName);

      await page.screenshot({
        path: outPath,
        fullPage: Boolean(options.fullPage)
      });

      const buffer = fs.readFileSync(outPath);

      return {
        success: true,
        path: outPath,
        base64: buffer.toString('base64'),
        url: page.url(),
        title: await page.title()
      };
    } catch (err) {
      return { success: false, error: `Erro ao capturar print do navegador: ${err.message}` };
    }
  }

  /**
   * Executa JavaScript dentro da página web
   */
  async evaluate(code) {
    try {
      const { page } = await this.init();
      const result = await page.evaluate((rawCode) => {
        try {
          return window.eval(rawCode);
        } catch (e) {
          return { error: e.message };
        }
      }, code);

      return { success: true, result };
    } catch (err) {
      return { success: false, error: `Erro na execução JS: ${err.message}` };
    }
  }

  /**
   * Baixa um arquivo direto da URL ou aciona o download
   */
  async download(fileUrl, options = {}) {
    try {
      const axios = require('axios');
      const fileName = options.filename || path.basename(fileUrl.split('?')[0]) || `download_${Date.now()}`;
      const savePath = path.join(DOWNLOADS_DIR, fileName);

      const res = await axios({
        url: fileUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        timeout: options.timeout || 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      fs.writeFileSync(savePath, Buffer.from(res.data));
      const sizeBytes = fs.statSync(savePath).size;

      return {
        success: true,
        fileName,
        path: savePath,
        sizeBytes,
        message: `Arquivo baixado com sucesso: ${savePath} (${Math.round(sizeBytes / 1024)} KB)`
      };
    } catch (err) {
      return { success: false, error: `Falha ao baixar arquivo: ${err.message}` };
    }
  }

  /**
   * Extrai elementos clicáveis e campos de entrada da página atual
   */
  async extractInteractiveElements(page) {
    try {
      return await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, textarea, select')).slice(0, 20).map(el => ({
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          name: el.name || '',
          id: el.id || '',
          placeholder: el.placeholder || '',
          value: el.value || ''
        }));

        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"], [role="button"]')).slice(0, 25).map(el => ({
          text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 50),
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          href: el.getAttribute('href') || ''
        })).filter(b => b.text.length > 0 || b.id.length > 0);

        return { inputs, buttons };
      });
    } catch (e) {
      return { inputs: [], buttons: [] };
    }
  }

  /**
   * Fecha a sessão do navegador
   */
  async close() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {}
      this.browser = null;
      this.page = null;
    }
    return { success: true, message: 'Navegador fechado.' };
  }
}

const corvoBrowser = new CorvoBrowser();
module.exports = corvoBrowser;
