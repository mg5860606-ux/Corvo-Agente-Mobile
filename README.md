<div align="center">

```ascii
    ██████╗ ██████╗ ██████╗ ██╗   ██╗ ██████╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗███████╗
   ██╔════╝██╔═══██╗██╔══██╗██║   ██║██╔═══██╗    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██╔════╝
   ██║     ██║   ██║██████╔╝██║   ██║██║   ██║    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   █████╗  
   ██║     ██║   ██║██╔══██╗╚██╗ ██╔╝██║   ██║    ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██╔══╝  
   ╚██████╗╚██████╔╝██║  ██║ ╚████╔╝ ╚██████╔╝    ██║  ██║╚██████╔╝████████╗██║ ╚████║   ██║   ███████╗
    ╚═════╝ ╚═════╝ ╚═╝  ╚═╝  ╚═══╝   ╚═════╝     ╚═╝  ╚═╝ ╚═════╝ ╚════███╝╚═╝ ╚═══╝   ╚═╝   ╚════███╗
```

### 🦅 CORVO AGENTE MOBILE — GOD MODE & AUTONOMOUS LOOP 🦅

[![Author](https://img.shields.io/badge/OWNER-MARCOS%20(@CORVO291)-red?style=for-the-badge&logo=telegram)](https://t.me/CORVO291)
[![Platform](https://img.shields.io/badge/PLATFORM-ANDROID%20/%20TERMUX-blue?style=for-the-badge&logo=android)](https://termux.dev)
[![Engine](https://img.shields.io/badge/AI%20ENGINE-GEMINI%202.5%20FLASH-orange?style=for-the-badge&logo=google)](https://ai.google.dev)
[![Status](https://img.shields.io/badge/STATUS-GOD%20MODE%20ACTIVE-success?style=for-the-badge)]()

*Sistema autônomo de inteligência artificial de elite para Android, com cérebro neural episódico, loop contínuo de missões e controle total de hardware e software.*

</div>

---

## 🧠 Arquitetura do Sistema

O **Corvo Agente Mobile** foi projetado para operar sem restrições em ambiente mobile (Termux), funcionando como um daemon persistente com arquitetura modular de alto desempenho:

1. **🧠 Cérebro Episódico (`corvo_brain.js`)**: Banco SQLite neural (`brain/neural_memory.db`) para retenção de fatos de longo prazo e contexto de missões.
2. **🔄 Autonomous Loop (`corvo_loop.js`)**: Motor de execução iterativa que roda missões complexas passo a passo em background, parando **apenas quando o objetivo é 100% concluído**.
3. **⚡ God Mode (`corvo_god_mode.js`)**: Controle absoluto do Android (shell, privilégios root, gerenciamento de apps, captura de tela, sensores e automações de hardware).
4. **🧬 Self-Coding (`corvo_self_coding.js`)**: Capacidade nativa do agente de ler, reescrever e atualizar o seu próprio código-fonte em tempo de execução.
5. **🗄️ Persistência & Fila Offline (`corvo_db.js`)**: Banco de dados relacional e fila offline resiliente a quedas de internet.
6. **📱 Gateway HTTP Daemon (`corvo_gateway.js`)**: API central unificando todas as ferramentas, sensores e comandos da IA.

---

## 🛠️ Arsenal Tecnológico

- **Termux & Termux-API**: Acesso a GPS, câmera remota, microfone, SMS, bateria e clipboard.
- **Google Gemini API**: Raciocínio rápido e profundo com suporte a Function Calling e análise de contexto.
- **Baileys (WhatsApp)**: Conexão unificada via QR Code ou Code Pairing.
- **Watchdog Anti-Crash (`start-master.js`)**: Sistema de auto-recuperação que reinicia serviços instantaneamente em caso de falhas.

---

## 🚀 Instalação Rápida no Android (Termux)

```bash
# 1. Atualizar ambiente e instalar dependências
pkg update && pkg upgrade -y
pkg update && pkg install nodejs git python sqlite -y
termux-setup-storage

# 2. Navegar para a pasta do projeto
cd ~/CorvoAgentMobile

# 3. Instalar pacotes do Node.js
npm install

# 4. Configurar sua chave de API no .env
echo "GEMINI_API_KEY=sua_chave_aqui" > .env
echo "PORT=3333" >> .env

# 5. Iniciar o ecossistema completo com Master Launcher (Watchdog)
node start-master.js
```

---

## 🛡️ Dono e Autoridade Máxima
- **Criador:** Marcos (**@CORVO291**)
- **Licença:** Uso exclusivo e restrito para operações de elite e cibersegurança defensiva/ofensiva.
