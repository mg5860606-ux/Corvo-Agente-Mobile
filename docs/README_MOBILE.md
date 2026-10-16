# 🦅 GUIA DE INSTALAÇÃO DEFINITIVA - CORVO OPENCLAW MOBILE

Parabéns, Marcos! O **Corvo CORVO AGENTE MOBILE Mobile** está totalmente estruturado com arquitetura de Gateway, Subagentes em background, Skills dinâmicas, Banco de Dados SQLite local e Inicialização Automática no Boot do Android.

---

## 📦 O que foi estruturado na pasta `C:\CorvoAgentMobile`:
1. **`corvo_gateway.js`**: Core do Daemon HTTP (API central estilo CORVO AGENTE MOBILE).
2. **`corvo_db.js`**: Banco de dados SQLite (`corvo_mobile.db`) persistindo histórico de chat, estado de subagentes e memória local.
3. **`skills/`**: Diretório modular de habilidades (`SKILL.md`) injetadas dinamicamente na IA.
4. **`start-corvo.sh`**: Script para inicialização automática no boot do sistema Android.
5. **`package.json`**: Dependências configuradas (`sqlite3`, `@google/generative-ai`, `express`, etc.).

---

## 🚀 Passo a Passo para Subir no Celular (Termux):

1. **Copie a pasta `CorvoAgentMobile` inteira para o armazenamento interno do seu celular** (ex: `/sdcard/CorvoAgentMobile`).

2. **No Termux do seu celular, configure o ambiente:**
   ```bash
   pkg update && pkg upgrade -y
   pkg install nodejs git python sqlite -y
   termux-setup-storage
   ```

3. **Mova os arquivos para o diretório home do Termux e instale as dependências:**
   ```bash
   cp -r /sdcard/CorvoAgentMobile ~/CorvoAgentMobile
   cd ~/CorvoAgentMobile
   npm install
   ```

4. **Configure o arquivo `.env`:**
   Crie um arquivo `.env` na pasta do projeto com a sua chave:
   ```env
   GEMINI_API_KEY=sua_chave_aqui
   PORT=3333
   ```

5. **Configurar o Boot Automático (Opcional - Termux:Boot):**
   Para o agente iniciar sozinho assim que o celular ligar:
   - Instale o app **Termux:Boot** na Play Store / F-Droid.
   - Crie a pasta de boot no Termux e copie o script:
     ```bash
     mkdir -p ~/.termux/boot
     cp ~/CorvoAgentMobile/start-corvo.sh ~/.termux/boot/start-corvo.sh
     chmod +x ~/.termux/boot/start-corvo.sh
     ```

6. **Rodar o Daemon Manualmente:**
   ```bash
   node corvo_gateway.js
   ```

Pronto! Agora o seu agente mobile possui persistência robusta em SQLite, motor de subagentes em background e capacidade total de controle do sistema Android. Manda a braba se precisar ajustar mais alguma engrenagem!
