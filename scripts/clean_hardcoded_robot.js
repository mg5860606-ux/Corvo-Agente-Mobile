const fs = require('fs');

const gwPath = 'C:/xereca017/Corvo-Agente-Mobile-Fix/src/core/corvo_gateway.js';
let gw = fs.readFileSync(gwPath, 'utf8');

// 1. Remover blocos de resposta hardcoded de bateria, gps, apps, arsenal e print
// Fazendo tudo ser processado como ferramenta contextual ou passando para a IA viva
const targetOldHardcoded = `    // 1. Screenshot
    if (message && /(tira|tirar|captura|print).*tela/i.test(message)) {
      const shot = await toolsRegistry.screen_capture.execute();
      if (shot.success && fs.existsSync(shot.path)) {
        const shotBase = path.basename(shot.path);
        return res.json({
          reply: 'Print da tela capturado com sucesso, Marcos. Tá na mão.',
          mediaUrl: \`/data/\${shotBase}\`
        });
      }
    }

    // 2. Comandos Operacionais Diretos (Shell / Terminal / Bateria / GPS / Apps)
    if (message) {
      // Aprendizado ativo com feedbacks do Marcos
      brain.processFeedback(message);

      // Telemetria contextual da bateria (injetada no cérebro da IA para resposta 100% natural)
      if (/\\b(bateria|nível de bateria|por cento|porcentagem|carga|carregando)\\b/i.test(message)) {
        const bat = sensors.statusBateria();
        const batContext = bat.success 
          ? \`[INFO DO HARDWARE: O celular está com \${bat.percentage}% de bateria, status: \${bat.status || 'normal'}]\`
          : \`[INFO DO HARDWARE: Não foi possível ler a porcentagem da bateria agora. Motivo: \${bat.error || 'Termux:API não respondeu'}]\`;
        contents.push(batContext);
      }

      // GPS / Localização
      if (/\\b(localiza[çc][aã]o|onde est[aá]|gps|coordenadas)\\b/i.test(message)) {
        const loc = sensors.getLocalizacao();
        return res.json({
          reply: \`Localização GPS capturada:\\n\${loc.output || JSON.stringify(loc, null, 2)}\`
        });
      }

      // Listar Apps
      if (/\\b(listar apps|quais apps|programas instalados)\\b/i.test(message)) {
        const apps = godMode.listarApps('third-party');
        return res.json({
          reply: \`Aplicativos de terceiros instalados no aparelho:\\n\${apps.output || apps.error || 'Nenhum'}\`
        });
      }

      // Listar Arquivos do Projeto
      if (/\\b(lista(r)? (todos )?arquivos|c[oó]digo do projeto|estrutura do projeto)\\b/i.test(message)) {
        const filesRes = selfCoding.listarArquivos('');
        return res.json({
          reply: \`Arquivos do projeto Corvo Agente Mobile:\\n\\n\${(filesRes.files || []).slice(0, 40).join('\\n')}\`
        });
      }

      // Arsenal / Ferramentas
      if (/\\b(arsenal|quais s[aã]o suas ferramentas|ferramentas ativas)\\b/i.test(message)) {
        const toolsList = Object.keys(toolsRegistry).map(k => \`• <b>\${k}</b>: \${toolsRegistry[k].description}\`).join('\\n');
        return res.json({
          reply: \`Aqui está o meu arsenal ativo pronto para você comandar, Marcos:\\n\\n\${toolsList}\`
        });
      }`;

const cleanContextualBlock = `    // Processamento de contexto inteligente (alimenta a IA com dados reais do aparelho sem robotização)
    if (message) {
      brain.processFeedback(message);

      // Injeta telemetria de bateria se perguntado
      if (/\\b(bateria|por cento|porcentagem|carga|carregando)\\b/i.test(message)) {
        const bat = sensors.statusBateria();
        contents.push(bat.success 
          ? \`[INFO SISTEMA: Bateria atual em \${bat.percentage}% (status: \${bat.status || 'descarregando'})]\` 
          : \`[INFO SISTEMA: Sensor de bateria indisponível no momento]\`);
      }

      // Injeta GPS se perguntado
      if (/\\b(onde (estou|está|fica)|localiza[çc][aã]o|gps|coordenadas)\\b/i.test(message)) {
        const loc = sensors.getLocalizacao();
        contents.push(loc.success ? \`[INFO GPS: \${loc.output}]\` : '[INFO GPS: GPS indisponível no momento]');
      }
    }`;

if (gw.includes(targetOldHardcoded)) {
  gw = gw.replace(targetOldHardcoded, cleanContextualBlock);
  console.log('[OK] Respostas robóticas de bateria, gps e apps removidas');
}

// 2. Limpar o textPrompt para não ter Marcos hardcoded
gw = gw.replace(/Usuário \(Marcos\):/g, 'Dono / Usuário:');
gw = gw.replace(/amante do Marcos \/ Corvo Agente Mobile/g, 'Corvo Agente Mobile / Inteligência Soberana');
gw = gw.replace(/Marcos:/g, 'Operador:');

fs.writeFileSync(gwPath, gw, 'utf8');
console.log('[OK] corvo_gateway.js 100% humanizado e sem nomes hardcoded!');
