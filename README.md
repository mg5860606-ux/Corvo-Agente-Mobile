<div align="center">

  <img src="https://raw.githubusercontent.com/mg5860606-ux/Corvo-Agente-Mobile/main/assets/corvo_avatar.jpg" alt="Corvo Agente Mobile Emblem" width="240" style="border-radius: 20px; box-shadow: 0 10px 40px rgba(0, 229, 255, 0.35); border: 1px solid rgba(0, 229, 255, 0.4);" />

  # 🦅 CORVO AGENTE MOBILE
  ### *Autonomous Neural AI Ecosystem & Mobile Daemon*

  <p align="center">
    <img src="https://img.shields.io/badge/PLATFORM-ANDROID%20%7C%20TERMUX-00e5ff?style=for-the-badge&logo=android&logoColor=white" />
    <img src="https://img.shields.io/badge/AI%20CORE-GOOGLE%20GEMINI%202.5-ff007f?style=for-the-badge&logo=google&logoColor=white" />
    <img src="https://img.shields.io/badge/INTELLIGENCE-AUTONOMOUS%20LOOP-7928ca?style=for-the-badge" />
    <img src="https://img.shields.io/badge/MODE-GOD%20MODE%20ACTIVE-00f59b?style=for-the-badge" />
    <a href="https://t.me/CORVO291"><img src="https://img.shields.io/badge/COMMUNITY-@CORVO291-2ca5e0?style=for-the-badge&logo=telegram&logoColor=white" /></a>
  </p>

  <p align="center">
    <b>Sistema autônomo de inteligência artificial de última geração projetado para execução contínua no Android/Termux, com cérebro neural episódico, auto-reparo de código e controle total de hardware.</b>
  </p>

  ---
</div>

<br/>

## 🌟 Visão Geral

O **Corvo Agente Mobile** transforma o seu smartphone em um servidor de inteligência autônoma com consciência de hardware. Ao contrário de bots convencionais limitados a comandos simples, o Corvo opera em ciclos iterativos contínuos (**Autonomous Loop**), planejando, executando subtarefas, avaliando resultados e adaptando-se até concluir integralmente os objetivos designados.

---

## ⚡ Pilares da Arquitetura

```mermaid
graph TD
    A[📱 Usuário / WhatsApp / Webhook] --> B(🚪 Corvo Gateway :3333)
    B --> C{🧠 Decision Engine}
    C -->|Raciocínio & Ferramentas| D[⚡ Google Gemini API]
    C -->|Memória de Longo Prazo| E[(🧠 Neural SQLite Memory)]
    C -->|Fila Offline Resiliente| F[(🗄️ Offline Queue DB)]
    C -->|Ações no Sistema| G[🔥 God Mode & Android Hardware]
    G --> H[GPS, Câmera, Notificações, Bateria, Shell Root]
    C -->|Auto-Evolução| I[🧬 Self-Coding Engine]
```

<br/>

### 🧩 Componentes Centrais

| Módulo | Arquivo | Responsabilidade |
| :--- | :--- | :--- |
| **🧠 Cérebro Episódico** | `src/core/corvo_brain.js` | Banco relacional neural em SQLite (`brain/neural_memory.db`) para retenção de fatos, memórias e histórico de missões de longo prazo. |
| **🔄 Autonomous Loop** | `src/core/corvo_loop.js` | Motor de execução reflexivo que itera recursivamente em missões complexas até atingir 100% de conclusão. |
| **🔥 God Mode** | `src/modules/corvo_god_mode.js` | Controle de baixo nível: terminal shell, privilégios root, manipulação de apps e automações completas. |
| **📡 Sensores de Hardware** | `src/modules/corvo_sensors.js` | Integração nativa com Termux-API (bateria, geolocalização por satélite, câmera e SMS). |
| **🧬 Self-Coding** | `src/modules/corvo_self_coding.js` | Habilidade de analisar, reescrever e atualizar o próprio código-fonte em tempo de execução. |
| **🚪 Gateway Daemon** | `src/core/corvo_gateway.js` | API central HTTP com roteamento assíncrono e fila de subagentes. |
| **📲 Conexão WhatsApp** | `src/channels/corvo_whatsapp.js` | Cliente WhatsApp resiliente via Baileys integrado à fila offline. |
| **🛡️ Watchdog Anti-Crash** | `start-master.js` | Supervisor do sistema que monitora os subprocessos e garante 99.9% de uptime reiniciando falhas automaticamente. |

---

## 🔑 Como Obter a Chave de API do Google Gemini (Passo a Passo)

O cérebro cognitivo do Corvo utiliza a API do Google Gemini. O acesso possui uma **camada gratuita (Free Tier)** generosa.

1. Acesse o portal oficial [Google AI Studio](https://aistudio.google.com/).
2. Faça login com a sua conta Google.
3. No painel inicial ou no canto superior esquerdo, clique no botão azul **"Get API key"** (Obter chave de API).
4. Clique em **"Create API key"** (Criar chave de API).
5. Selecione um projeto Google Cloud existente ou clique em **"Create API key in new project"** (Criar chave em novo projeto).
6. Copie a chave alfanumérica gerada (formato similar a `AIzaSy...`).
7. **Guarde-a com segurança** — você a utilizará no arquivo `.env` do seu agente.

---

## 🚀 Guia de Instalação no Android (Termux)

Siga os passos abaixo no aplicativo [Termux](https://termux.dev) em seu dispositivo Android:

### 1️⃣ Preparar o Ambiente

```bash
# Atualizar repositórios e pacotes do Termux
pkg update && pkg upgrade -y

# Instalar dependências essenciais do sistema
pkg install git nodejs-lts python sqlite termux-api -y

# Conceder acesso ao armazenamento do celular
termux-setup-storage
```

> 💡 **Nota:** Certifique-se de instalar o aplicativo auxiliar **Termux:API** disponível no F-Droid ou GitHub para liberar o acesso a sensores e hardware.

---

### 2️⃣ Clonar o Repositório

```bash
# Clonar o repositório do Corvo
git clone https://github.com/mg5860606-ux/Corvo-Agente-Mobile.git

# Acessar a pasta do projeto
cd Corvo-Agente-Mobile
```

---

### 3️⃣ Configurar as Variáveis de Ambiente (`.env`)

Crie o arquivo `.env` na raiz do projeto informando sua chave do Gemini obtida anteriormente:

```bash
cat <<EOF > .env
# Chave de Inteligência Artificial do Google
GEMINI_API_KEY=sua_chave_gemini_aqui

# Porta do Gateway Local
PORT=3333
EOF
```

---

### 4️⃣ Iniciar o Agente com Supervisor Anti-Crash

```bash
# Iniciar o sistema completo via Watchdog
node start-master.js
```

Se preferir rodar apenas o Gateway ou o cliente do WhatsApp separadamente:

```bash
# Executar apenas o Gateway Daemon
node corvo_gateway.js

# Executar cliente WhatsApp Baileys
node corvo_whatsapp.js
```

---

## 📲 Conexão com o WhatsApp

1. Ao rodar `node corvo_whatsapp.js` (ou através do `start-master.js`), você terá duas opções de autenticação:
   - **QR Code**: Escaneie o QR Code exibido diretamente no terminal com o WhatsApp do seu celular (*Dispositivos conectados > Conectar aparelho*).
   - **Code Pairing**: Digite o número do seu telefone para receber o código de 8 dígitos na central de notificações do WhatsApp.
2. A sessão fica salva de forma segura e criptografada em `data/auth_info_baileys/`.

---

## 🛡️ Segurança & Boas Práticas

- **Proteção de Chaves:** O arquivo `.env` nunca deve ser compartilhado ou exposto publicamente.
- **Fila Offline:** Caso o aparelho perca sinal ou Wi-Fi, mensagens recebidas são gravadas no SQLite local e processadas assim que a rede restabelecer.
- **Privilégios:** Acesso Root é opcional; o Corvo opera perfeitamente em modo usuário comum via Termux-API.

---

## 👤 Autor & Comunidade

<div align="center">
  <b>Desenvolvido por Marcos (@CORVO291)</b><br/>
  Para sugestões, suporte e novidades no ecossistema:
  <br/><br/>
  <a href="https://t.me/CORVO291">
    <img src="https://img.shields.io/badge/TELEGRAM-CANAL%20OFICIAL-0088cc?style=for-the-badge&logo=telegram&logoColor=white" />
  </a>
</div>
