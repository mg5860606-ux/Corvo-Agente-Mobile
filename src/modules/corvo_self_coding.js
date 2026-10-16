/**
 * 🧬 CORVO AGENTE MOBILE - AUTO-MODIFICAÇÃO DE CÓDIGO (SELF-CODING PRO)
 * Permite ao agente inspecionar, escrever, refatorar e atualizar qualquer código
 * do seu próprio repositório ou de novos projetos com validação de sintaxe (node --check)
 * e backup automático antes da alteração.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '../../');
const BACKUP_DIR = path.join(ROOT_DIR, 'data', 'code_backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const selfCoding = {
  /**
   * Lê o código de qualquer arquivo do projeto
   */
  lerCodigo(caminhoRelativo) {
    try {
      const targetPath = path.isAbsolute(caminhoRelativo) ? caminhoRelativo : path.resolve(ROOT_DIR, caminhoRelativo);
      if (!fs.existsSync(targetPath)) return { success: false, error: 'Arquivo não encontrado.' };
      const content = fs.readFileSync(targetPath, 'utf8');
      return { success: true, path: targetPath, content };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Reescreve ou atualiza código com backup prévio e teste de sintaxe
   */
  escreverCodigo(caminhoRelativo, novoConteudo) {
    try {
      const targetPath = path.isAbsolute(caminhoRelativo) ? caminhoRelativo : path.resolve(ROOT_DIR, caminhoRelativo);
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // Se o arquivo já existia, faz backup de segurança antes
      let backupFile = null;
      if (fs.existsSync(targetPath)) {
        const timestamp = Date.now();
        const baseName = path.basename(targetPath);
        backupFile = path.join(BACKUP_DIR, `${baseName}.${timestamp}.bak`);
        fs.copyFileSync(targetPath, backupFile);
      }

      // Escreve em arquivo temporário para validar sintaxe se for JS
      if (targetPath.endsWith('.js')) {
        const tempTestFile = path.join(BACKUP_DIR, `temp_check_${Date.now()}.js`);
        fs.writeFileSync(tempTestFile, novoConteudo, 'utf8');
        try {
          execSync(`node --check "${tempTestFile}"`, { timeout: 10000 });
          fs.unlinkSync(tempTestFile);
        } catch (syntaxErr) {
          if (fs.existsSync(tempTestFile)) fs.unlinkSync(tempTestFile);
          return {
            success: false,
            error: `Erro de sintaxe detectado no código gerado: ${syntaxErr.message}`,
            details: syntaxErr.stderr ? syntaxErr.stderr.toString() : ''
          };
        }
      }

      // Aplica a gravação definitiva
      fs.writeFileSync(targetPath, novoConteudo, 'utf8');
      return {
        success: true,
        message: `Código atualizado e validado com sucesso em: ${targetPath}`,
        backup: backupFile
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Lista todos os arquivos de código e configuração do projeto
   */
  listarArquivos(subDir = '') {
    try {
      const baseDir = path.resolve(ROOT_DIR, subDir);
      function scan(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach((file) => {
          if (file === 'node_modules' || file === '.git') return;
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat && stat.isDirectory()) {
            results = results.concat(scan(fullPath));
          } else {
            results.push(path.relative(ROOT_DIR, fullPath));
          }
        });
        return results;
      }
      return { success: true, files: scan(baseDir) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
};

module.exports = selfCoding;
