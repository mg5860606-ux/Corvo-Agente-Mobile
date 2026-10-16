/**
 * 🧬 CORVO OPENCLAW MOBILE - AUTO-MODIFICAÇÃO DE CÓDIGO (SELF-CODING)
 * Permite ao agente ler, reescrever e atualizar o seu próprio código-fonte
 * em tempo de execução através do Gateway e subagentes.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname);

const selfCoding = {
  /** Lê o conteúdo de qualquer arquivo do projeto */
  lerCodigo(caminhoRelativo) {
    try {
      const targetPath = path.resolve(ROOT_DIR, caminhoRelativo);
      if (!fs.existsSync(targetPath)) return { success: false, error: 'Arquivo não encontrado.' };
      const content = fs.readFileSync(targetPath, 'utf8');
      return { success: true, content };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /** Reescreve ou atualiza o código de um arquivo do projeto */
  escreverCodigo(caminhoRelativo, novoConteudo) {
    try {
      const targetPath = path.resolve(ROOT_DIR, caminhoRelativo);
      // Segurança básica: impede sair da pasta do projeto
      if (!targetPath.startsWith(ROOT_DIR)) {
        return { success: false, error: 'Permissão negada: acesso fora do diretório do agente.' };
      }
      fs.writeFileSync(targetPath, novoConteudo, 'utf8');
      return { success: true, message: `Código atualizado com sucesso em ${caminhoRelativo}. Reinicie o daemon para aplicar as mudanças.` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /** Lista todos os arquivos de código da IA */
  listarArquivos() {
    try {
      const files = fs.readdirSync(ROOT_DIR).filter(f => f.endsWith('.js') || f.endsWith('.md'));
      return { success: true, files };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
};

module.exports = selfCoding;
