const fs = require('fs');

// 1. TELEGRAM: FORÇAR GIT RESET / CHECKOUT ANTES DO PULL
const tgPath = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/channels/corvo_telegram.js';
let tg = fs.readFileSync(tgPath, 'utf8');

const oldGitPullTg = `                const repoDir = path.resolve(__dirname, '../../');
                const gitRes = execSync('git pull origin main', { cwd: repoDir, encoding: 'utf8', timeout: 35000 });`;

const newGitPullTg = `                const repoDir = path.resolve(__dirname, '../../');
                // Descarta alteracoes locais em arquivos autogerados como package-lock.json para nunca dar conflito
                try { execSync('git checkout -- package-lock.json 2>/dev/null || true', { cwd: repoDir, timeout: 5000 }); } catch (e) {}
                const gitRes = execSync('git fetch origin main && git reset --hard origin/main', { cwd: repoDir, encoding: 'utf8', timeout: 35000 });`;

tg = tg.replace(oldGitPullTg, newGitPullTg);
fs.writeFileSync(tgPath, tg, 'utf8');

// 2. WHATSAPP: FAZER O MESMO
const waPath = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/channels/corvo_whatsapp.js';
let wa = fs.readFileSync(waPath, 'utf8');

const oldGitPullWa = `        const repoDir = path.resolve(__dirname, '../../');
        const gitRes = execSync('git pull origin main', { cwd: repoDir, encoding: 'utf8', timeout: 35000 });`;

const newGitPullWa = `        const repoDir = path.resolve(__dirname, '../../');
        try { execSync('git checkout -- package-lock.json 2>/dev/null || true', { cwd: repoDir, timeout: 5000 }); } catch (e) {}
        const gitRes = execSync('git fetch origin main && git reset --hard origin/main', { cwd: repoDir, encoding: 'utf8', timeout: 35000 });`;

wa = wa.replace(oldGitPullWa, newGitPullWa);
fs.writeFileSync(waPath, wa, 'utf8');

console.log('[OK] Comando /atualizar blindado com git fetch && git reset --hard origin/main!');
