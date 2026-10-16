/**
 * 📋 CORVO - INVENTÁRIO DE COMANDOS DOS 2 BOTS
 * A IA usa esta lista para ENTENDER e EXPLICAR todos os comandos
 * do bot (tanto no privado/DM quanto no grupo).
 * Alimentada dinamicamente pelos comandos de grupo + lista da DM.
 */

const { getGroupCommands } = require('../grupo');

const DM_COMMANDS = [
  { cmd: '/start', area: 'DM', desc: 'Iniciar o bot e aceitar termos de uso.' },
  { cmd: '/menu', area: 'DM/grupo', desc: 'Menu principal. No DM mostra os botões; no grupo lista os comandos.' },
  { cmd: '/ping', area: 'DM', desc: 'Verifica a latência do bot.' },
  { cmd: '/status', area: 'DM', desc: 'Status do bot e estatísticas globais.' },
  { cmd: '/dono', area: 'DM', desc: 'Informações do dono.' },
  { cmd: '/alugar', area: 'DM', desc: 'Informações para alugar/alugar o bot.' },
  { cmd: '/help', area: 'DM/grupo', desc: 'Ajuda e comandos.' },
  { cmd: '/channel', area: 'DM', desc: 'Canal do bot.' },
  { cmd: 'Conectar WhatsApp', area: 'DM', desc: 'Conecta número do WhatsApp (painel).' },
  { cmd: 'Flood NGL', area: 'DM', desc: 'Flood de mensagens no NGL.' },
  { cmd: 'Flood Sendit', area: 'DM', desc: 'Flood de mensagens no Sendit.' },
  { cmd: 'Rajar Grupos', area: 'DM', desc: 'Modo rajada (spam) em grupos de WhatsApp.' },
  { cmd: 'Rajar por ID', area: 'DM', desc: 'Rajada em grupo específico por ID.' },
  { cmd: 'Rajar 1/2/3/4', area: 'DM', desc: 'Tipos de rajada (Payment, status, mídia).' },
  { cmd: 'Nukar Grupo', area: 'DM', desc: 'Nukar/derrubar grupo de WhatsApp.' },
  { cmd: 'Info Grupo', area: 'DM', desc: 'Informações de um grupo de WhatsApp.' },
  { cmd: 'Listar Grupos', area: 'DM', desc: 'Lista os grupos conectados.' },
  { cmd: 'Health Check', area: 'DM', desc: 'Verifica saúde da conexão WhatsApp.' },
  { cmd: 'Saldo Bancário', area: 'DM', desc: 'Consulta o saldo bancário.' },
  { cmd: 'Solicitar Saque', area: 'DM', desc: 'Solicita saque do saldo.' },
  { cmd: 'Gerenciar VIPs', area: 'DM', desc: 'Painel de gerenciamento de usuários VIP.' },
  { cmd: 'Painel Admin', area: 'DM', desc: 'Painel de administração do bot.' },
  { cmd: 'Lista de Usuários', area: 'DM', desc: 'Lista usuários do bot.' },
  { cmd: 'Banir Usuário', area: 'DM', desc: 'Bane usuário do bot.' },
  { cmd: 'Broadcast Global', area: 'DM', desc: 'Envia mensagem para todos os usuários.' },
  { cmd: 'Comunicado VIP', area: 'DM', desc: 'Envia mensagem para os VIPs.' },
  { cmd: 'Configurar Rajar', area: 'DM', desc: 'Configurar texto, quantidade e delay da rajada.' },
  { cmd: 'Consultas (CPF/Nome/Telefone/Placa/SIPNI/SISREG/etc)', area: 'DM', desc: 'Consultas de dados (requer token).' },
  { cmd: 'Criar Rastreio', area: 'DM', desc: 'Cria rastreamento/tracker.' },
  { cmd: 'Puxar Perfil', area: 'DM', desc: 'Puxa perfil de uma pessoa.' },
  { cmd: 'Consultar IP/CEP/CNPJ', area: 'DM', desc: 'Consultas de IP, CEP e CNPJ.' },
  { cmd: 'Scraper de Grupos', area: 'DM', desc: 'Raspagem de grupos de WhatsApp.' },
  { cmd: 'Espelho', area: 'DM', desc: 'Suporte espelhado entre admin e usuários.' },
  { cmd: 'Planos VIP', area: 'DM', desc: 'Mostra os planos VIP.' },
];

/** Lista de comandos do grupo (do loader) com descrição */
function getGroupList() {
  const cmds = getGroupCommands().filter(c => c.command);
    return cmds.map(c => ({
    cmd: '/' + c.command,
    area: 'grupo',
    // description: c.description || '', // Descrição removida conforme solicitado
  }));
}

/** Lista combinada (DM + grupo) para a IA */
function getFullList() {
  return [...DM_COMMANDS, ...getGroupList()];
}

/** Texto formatado com todos os comandos p/ injetar no prompt da IA */
function formatCommandList() {
  const groups = getGroupList();
  const dm = DM_COMMANDS.map(c => `• \`${c.cmd}\` — ${c.desc}`).join('\n');
  // Comandos do grupo sem descrição (conforme solicitado)
  const grp = groups.map(c => `• \`${c.cmd}\``).join('\n');
  return `
=== COMANDOS DO BOT NO PRIVADO (DM) ===
${dm}

=== COMANDOS DO BOT NO GRUPO ===
${grp}
`;
}

module.exports = { DM_COMMANDS, getGroupList, getFullList, formatCommandList };