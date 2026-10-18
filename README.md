<div align="center">

  <img src="https://raw.githubusercontent.com/mg5860606-ux/Corvo-Agente-Mobile/main/assets/corvo_avatar.jpg" alt="Corvo Agente Mobile Emblem" width="240" style="border-radius: 20px; box-shadow: 0 10px 40px rgba(0, 229, 255, 0.35); border: 1px solid rgba(0, 229, 255, 0.4);" />

  # 🦅 CORVO AGENTE MOBILE v2.0
  ### *Autonomous Neural AI Ecosystem, Re-Act Loop & Mobile Sovereign Hub*

  <p align="center">
    <img src="https://img.shields.io/badge/PLATFORM-ANDROID%20%7C%20TERMUX%20%7C%20WINDOWS-00e5ff?style=for-the-badge&logo=android&logoColor=white" />
    <img src="https://img.shields.io/badge/AI%20CORE-ISA%20CLOUD%20%7C%20GEMINI-ff007f?style=for-the-badge&logo=openai&logoColor=white" />
    <img src="https://img.shields.io/badge/INTELLIGENCE-AUTONOMOUS%20LOOP%20APEX-7928ca?style=for-the-badge" />
    <img src="https://img.shields.io/badge/BROWSER-PUPPETEER%20HEADLESS-00f59b?style=for-the-badge&logo=puppeteer&logoColor=white" />
    <a href="https://t.me/CORVO291"><img src="https://img.shields.io/badge/COMMUNITY-@CORVO291-2ca5e0?style=for-the-badge&logo=telegram&logoColor=white" /></a>
  </p>

  <p align="center">
    <b>Sistema autônomo de inteligência artificial de última geração projetado para execução contínua no Android/Termux e Desktop, com cérebro neural episódico, loop autônomo Re-Act com ferramentas reais, navegador headless, síntese de voz, canais integrados (Telegram & WhatsApp) e painel web soberano.</b>
  </p>

  ---
</div>

<br/>

## 🌟 Visão Geral

O **Corvo Agente Mobile v2.0** opera como um agente neural autônomo com consciência de hardware e ambiente. Diferente de bots comuns de comando/resposta, o Corvo opera em ciclos iterativos (**Autonomous Loop Re-Act**): ele planeja a solução, aciona ferramentas reais (terminal, arquivos, navegador web, automação, visão, scanner de rede), analisa o retorno e só encerra a missão quando comprovar o resultado com sucesso.

---

## ⚡ Arquitetura Atual

```mermaid
graph TD
    User[📱 Usuário: Telegram / WhatsApp / Painel Web] --> Gateway[🚪 Corvo Gateway Express :3333]
    Gateway --> Loop[🔄 Autonomous Loop APEX - Re-Act]
    Gateway --> Brain[🧠 Cérebro Episódico & Memória Neural JSON]
    
    Loop --> LLM{⚡ Provedores de IA}
    LLM -->|Primário: OpenAI SDK| ISA[ISA Cloud / OmniRoute / Llama]
    LLM -->|Fallback Nativo| Gemini[Google Gemini 2.5/Flash]
    
    Loop --> Tools[🛠️ Registro Unificado de Ferramentas]
    Tools --> Browser[🌐 Navegador Autônomo Puppeteer]
    Tools --> Shell[💻 Terminal Shell / Termux / WSL2 Kali]
    Tools --> Files[📁 Sistema de Arquivos Leitura & Escrita]
    Tools --> Forge[🧬 Tool Forge Criação Dinâmica de Ferramentas]
    Tools --> Web[🔎 Pesquisa Web & Auditoria SPA]
    Tools --> Media[🎙️ Síntese de Voz ElevenLabs & Visão]
```

<br/>

### 🧩 Componentes Centrais

| Componente | Arquivo | Responsabilidade |
| :--- | :--- | :--- |
| **🔄 Autonomous Loop** | [`src/core/corvo_loop.js`](file:///c:/Corvo-Agente-Mobile/src/core/corvo_loop.js) | Motor Re-Act recursivo de resolução de problemas e execução autônoma de missões com telemetria em tempo real. |
| **🧠 Cérebro Episódico & Mobile Governor** | [`src/core/corvo_brain.js`](file:///c:/Corvo-Agente-Mobile/src/core/corvo_brain.js) | Memória episódica com busca semântica, histórico de missões, telemetria de hardware (RAM/bateria), auto Wake-Lock no Android e contexto contínuo de grupos. |
| **🛠️ Arsenal de Ferramentas** | [`src/core/corvo_tools_registry.js`](file:///c:/Corvo-Agente-Mobile/src/core/corvo_tools_registry.js) | Execução de shell/Termux/Kali, navegador, leitura/escrita de arquivos, prints e criação dinâmica de novas ferramentas (`create_custom_tool`). |
| **🌐 Navegador Autônomo** | [`src/modules/corvo_browser.js`](file:///c:/Corvo-Agente-Mobile/src/modules/corvo_browser.js) | Automação web real com Puppeteer (navegação, cliques, digitação, prints de tela e downloads). |
| **🚪 Gateway & Painel Web** | [`src/core/corvo_gateway.js`](file:///c:/Corvo-Agente-Mobile/src/core/corvo_gateway.js) | Servidor HTTP com UI completa, suporte a upload de fotos/áudio/vídeo, seletor de modelos de IA em tempo real e controle dos canais. |
| **✈️ Canal Telegram** | [`src/channels/corvo_telegram.js`](file:///c:/Corvo-Agente-Mobile/src/channels/corvo_telegram.js) | Bot completo via polling com suporte a áudio/voz, comandos `/stop`, `/reset`, `/status`, respostas em grupos com menção e execução autônoma de missões. |
| **💬 Canal WhatsApp** | [`src/channels/corvo_whatsapp.js`](file:///c:/Corvo-Agente-Mobile/src/channels/corvo_whatsapp.js) | Conexão multi-device via Baileys com suporte a QR Code / Pairing Code, fila offline resiliente e persistência na pasta `data/`. |
| **🎙️ Engine de Voz** | [`src/core/corvo_voice.js`](file:///c:/Corvo-Agente-Mobile/src/core/corvo_voice.js) | Síntese de voz com ElevenLabs e geração de áudios para Telegram e WhatsApp. |
| **🗄️ Persistência Mobile** | [`src/core/corvo_db.js`](file:///c:/Corvo-Agente-Mobile/src/core/corvo_db.js) | Gerenciador de fila e estado persistente 100% JavaScript (sem travas de compilação C++ no Android). |
| **🚀 Master Runner** | [`start-master.js`](file:///c:/Corvo-Agente-Mobile/start-master.js) | Inicializador simples dos serviços essenciais (Gateway + Telegram). |

---

## 🛠️ Arsenal de Ferramentas Disponíveis ao Agente

O Corvo conta com ferramentas reais prontas para uso no Autonomous Loop:

1. **`browser_navigate` / `browser_click` / `browser_type` / `browser_screenshot` / `browser_download` / `browser_eval`**: Navegação web autônoma completa em sites reais usando Puppeteer.
2. **`exec_shell`**: Execução de comandos no terminal (Termux, Bash, PowerShell e Kali Linux via WSL2).
3. **`read_file` / `write_file`**: Leitura, inspeção e criação/modificação de código e arquivos.
4. **`web_search`**: Busca de informações ao vivo na internet via DuckDuckGo.
5. **`recon_scan`**: Varreduras de portas e serviços de rede (Nmap e HTTPX).
6. **`spa_auditor`**: Reconhecimento e auditoria de aplicações web e rotas.
7. **`screen_capture`**: Captura de tela do dispositivo para análise multimodal.
8. **`create_custom_tool` (Tool Forge)**: Capacidade de criar, compilar e registrar novas funções em JavaScript em tempo real durante a execução caso precise de uma ferramenta inexistente.

---

## 📲 Comandos Disponíveis no Telegram

O bot do Telegram responde diretamente a comandos de controle:

- `/status` ou `/info` — Exibe relatório completo de saúde do sistema: modelo de IA ativo, nível de bateria, status de carregamento, memória RAM livre, uptime e estado do navegador.
- `/stop`, `/parar` ou `/cancelar` — Cancela imediatamente todas as missões em execução no loop autônomo e encerra tarefas pendentes do navegador.
- `/reset` ou `/clear` — Limpa a memória recente da conversa/grupo, reiniciando o contexto do zero.
- `/restart` ou `/reiniciar` — Reinicia os serviços do Corvo Agente (restrito ao Dono).
- **Missões em Linguagem Natural** — Mensagens iniciadas por verbos de ação como `crie`, `faça`, `navegue`, `baixe`, `audite`, `pesquise` ou `execute` disparam automaticamente o **Autonomous Loop**.

---

## ⚙️ Pré-requisitos & Configuração (`.env`)

Crie o arquivo `.env` na raiz do projeto baseado no `.env.example`:

```bash
cp .env.example .env
```

Edite as configurações desejadas:

```env
# Provedor de IA Principal (Compatível com OpenAI API / ISA Cloud / OmniRoute)
OPENAI_BASE_URL=http://127.0.0.1:20129/v1
OPENAI_API_KEY=sua_chave_aqui
PRIMARY_MODEL=isacloud/gemini-3.8-flash-high

# Provedor Fallback (Google Gemini)
GEMINI_API_KEY=sua_chave_gemini_aqui

# Gateway HTTP e Painel Web
PORT=3333
GATEWAY_AUTH_TOKEN=seu_token_opcional_de_protecao

# Telegram (Opcional)
TELEGRAM_BOT_TOKEN=seu_token_do_botfather
MARCOS_TELEGRAM_ID=8273924319

# Síntese de Voz (Opcional)
ELEVENLABS_API_KEY=sua_chave_elevenlabs
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL

# Caminho Personalizado do Chrome/Chromium (Opcional)
CHROME_PATH=
```

---

## 🚀 Como Executar

### 1. Iniciar Tudo de Uma Vez
Inicia o Gateway na porta configurada e o bot do Telegram:
```bash
npm start
# ou: node start-master.js
```

### 2. Iniciar Serviços Individualmente
```bash
# Gateway HTTP & Painel Web (http://localhost:3333)
npm run gateway

# Bot do Telegram
npm run telegram

# Bot do WhatsApp (Baileys)
npm run whatsapp

# Rodar a bateria de testes de validação
npm test
```

---

## 📱 Execução no Android (Termux)

### ⚠️ Qual versão do Termux utilizar?

> [!CAUTION]
> **NUNCA utilize a versão do Termux da Google Play Store!**  
> A versão da Play Store foi abandonada e descontinuada devido a restrições do Google Android, resultando em repositórios quebrados (`404 Not Found`), erros de SSL e impossibilidade de atualizar pacotes ou acessar a API de hardware.

**Instale sempre uma das versões oficiais mantidas:**
1. **GitHub Oficial (Recomendado):** Baixe o APK mais recente na página de releases: [Termux Releases no GitHub](https://github.com/termux/termux-app/releases) (escolha a arquitetura do seu celular, normalmente `termux-app_..._arm64-v8a.apk` ou `universal.apk`).
2. **F-Droid:** Baixe através da loja aberta [F-Droid - Termux](https://f-droid.org/packages/com.termux/).

*(Opcional para telemetria de bateria/hardware)*: Instale também o APK do **Termux:API** disponível no [GitHub Releases do Termux:API](https://github.com/termux/termux-api/releases) ou no F-Droid.

---

### 🚀 Passo a Passo de Instalação no Termux

Abra o Termux instalado e execute os comandos:

```bash
# 1. Atualizar os repositórios oficiais e pacotes
pkg update && pkg upgrade -y

# 2. Instalar Git, Node.js LTS, Python e Termux API
pkg install -y git nodejs-lts python termux-api

# 3. Conceder permissão de armazenamento do celular
termux-setup-storage

# 4. Clonar o repositório do Corvo Agente Mobile
git clone https://github.com/mg5860606-ux/Corvo-Agente-Mobile.git
cd Corvo-Agente-Mobile

# 5. Instalar as dependências do ecossistema
npm install

# 6. Configurar o arquivo .env
cp .env.example .env
nano .env  # (ou use 'cat <<EOF > .env' com suas chaves)

# 7. Iniciar o sistema completo
npm start
```

> 🔒 **Blindagem contra Doze Mode:** O Corvo ativa o `termux-wake-lock` automaticamente ao iniciar, mantendo o agente e os bots do Telegram/WhatsApp rodando mesmo com a tela do celular apagada ou bloqueada.

---

## 👤 Autor

Desenvolvido por **Marcos (@CORVO291)**  
Canal Telegram Oficial: [@CORVO291](https://t.me/CORVO291)
