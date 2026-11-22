# 🦅 CORVO AGENTE MOBILE v2.0
### *Seu assistente e agente hacker autônomo rodando direto no celular ou PC*

<div align="center">
  <img src="https://raw.githubusercontent.com/mg5860606-ux/Corvo-Agente-Mobile/main/assets/corvo_avatar.jpg" alt="Corvo Agente Mobile" width="220" style="border-radius: 15px;" />
  <br/>
  <b>Inteligência Artificial Gratuita (Google Gemini), Controle pelo Telegram/WhatsApp e Painel Web.</b>
</div>

---

## 🚀 O que é o Corvo Agente?

O **Corvo Agente Mobile** transforma qualquer celular Android com **Termux** (ou computador com Windows/Linux) em um servidor autônomo de inteligência artificial.

Ele não é apenas um chatbot: ele **executa ferramentas reais**, navega em sites, baixa arquivos, roda comandos no terminal, responde no Telegram e WhatsApp, envia áudios e se auto-estende criando ferramentas novas quando necessário.

---

## ⚡ Instalação Super Fácil no Celular (Passo a Passo)

Você não precisa entender de programação para ligar. Siga estas etapas:

### 1️⃣ Baixar o Termux
> ⚠️ **IMPORTANTE:** Nunca instale o Termux da Google Play Store (ele está abandonado).
- Baixe a versão oficial atualizada no [GitHub do Termux](https://github.com/termux/termux-app/releases) (escolha `termux-app_..._arm64-v8a.apk` ou `universal.apk`) ou instale pelo **F-Droid**.

---

### 2️⃣ Pegar a chave grátis da IA (Leva 10 segundos)
O Corvo usa a inteligência do Google Gemini de forma **100% gratuita**:
1. Entre no site oficial do Google: [aistudio.google.com](https://aistudio.google.com/)
2. Clique em **Get API Key** (Criar chave de API).
3. Copie o código da chave gerada.

---

### 3️⃣ Ligar o Agente no Termux

Abra o Termux no seu celular, copie e cole os comandos abaixo (um de cada vez):

```bash
# Atualizar os pacotes do Termux
pkg update && pkg upgrade -y

# Instalar o Git e o Node.js
pkg install git nodejs-lts python -y

# Baixar a pasta do Corvo Agente
git clone https://github.com/mg5860606-ux/Corvo-Agente-Mobile.git
cd Corvo-Agente-Mobile

# Instalar as dependências do projeto
npm install

# Iniciar o sistema!
npm start
```

🎉 **Pronto!**
Na primeira vez que você rodar `npm start`, o terminal vai perguntar a sua chave do Google Studio de forma amigável:
```text
Cole sua chave GEMINI_API_KEY aqui:
```
Basta colar a chave copiada e apertar **Enter**. O sistema salva tudo sozinho e já liga o Gateway e o bot!

---

## 📱 Acessando pelo Navegador do Celular

Assim que ligar, você pode abrir o painel visual no navegador do próprio celular acessando:
👉 **`http://localhost:3333`**

No painel você pode:
- Conversar por texto ou enviar fotos, áudios e vídeos.
- Iniciar e escanear o QR Code do WhatsApp.
- Executar comandos no terminal e ver prints de tela.

---

## 🔓 Como Liberar o Termux para o Agente Controlar o Celular

Para o agente conseguir acessar armazenamento, ler bateria real, GPS, tirar fotos, executar comandos do Android e interagir com o celular, execute estes passos:

### 1️⃣ Liberar Acesso ao Armazenamento (Fotos, Arquivos e Downloads)
No terminal do Termux, execute:
```bash
termux-setup-storage
```
> *(Aparecerá um pop-up na tela do Android: clique em **Permitir**)*

---

### 2️⃣ Instalar o Pacote de Sensores e Ferramentas do Android
```bash
pkg update -y && pkg install termux-api termux-tools -y
```

---

### 3️⃣ Instalar o Aplicativo Termux:API no Android
Para comandos de hardware (bateria, localização, SMS, câmera), instale o app complementar **Termux:API**:
- Baixe no [F-Droid: Termux:API](https://f-droid.org/packages/com.termux.api/) ou nas [Releases do GitHub](https://github.com/termux/termux-api/releases).
- Depois de instalar o app, vá nas configurações do celular:
  - **Configurações** > **Aplicativos** > **Termux:API** > **Permissões**: conceda *Localização*, *Câmera*, *Microfone* e *SMS*.
  - **Bateria**: marque como **"Sem restrições" / "Não otimizar"** (tanto no Termux quanto no Termux:API).

---

### 4️⃣ Manter o Agente Sempre Vivo em Segundo Plano
Para o Android não suspender o bot quando a tela apagar:
```bash
termux-wake-lock
```

---

### 5️⃣ Controle de Toques na Tela e Apps (Root ou Shizuku)
- **Com Celular com Root:**
  Execute `su` no Termux uma vez para autorizar comandos de toque (`input tap`, `input swipe`) e prints de tela nativos.
- **Com Shizuku (Sem Root):**
  Configure o `rish` no Termux para liberar toques automáticos de tela e automações visuais com IA.

---

## 🎮 Comandos Disponíveis no Telegram e WhatsApp

Você pode mandar estes comandos soltos no privado ou em grupos (sem precisar marcar com `@`):
- `/status` — Mostra bateria real, memória RAM livre, uptime e modelo ativo (`gemini-3.5-flash`).
- `/ajuda` — Exibe a lista completa de comandos rápidos e orientações.
- `/logs` — Mostra os últimos registros de operação e diagnósticos do sistema.
- `/atualizar` — Puxa as novidades mais recentes do GitHub e reinicia os serviços na hora.
- `/stop` ou `/parar` — Interrompe imediatamente qualquer missão ou tarefa em andamento.
- `/reset` — Limpa o histórico recente da conversa e inicia uma nova sessão limpa.
- `/restart` — Reinicia os motores do agente.

---

## 🔋 Como não deixar o Android fechar o Termux

Para o agente continuar rodando com a tela do celular apagada:
1. No Termux, puxe a barra de notificações e clique em **Acquire Wakelock** (ou o próprio Corvo ativa automaticamente).
2. Nas configurações do seu celular, vá em **Bateria** > **Termux** e selecione **"Sem restrições" / "Não otimizar uso de bateria"**.

---

## 🛠️ Para Usuários no Computador (Windows / Linux)

1. Tenha o **Node.js (v18+)** e o **Git** instalados.
2. No Prompt de Comando ou PowerShell:
   ```bash
   git clone https://github.com/mg5860606-ux/Corvo-Agente-Mobile.git
   cd Corvo-Agente-Mobile
   npm install
   npm start
   ```
3. Cole a sua chave do Gemini e o painel já estará disponível em `http://localhost:3333`.

---

## 👤 Créditos e Suporte
- Criado por Marcos (**@CORVO291**)
- Comunidade Oficial no Telegram: [@CORVO291](https://t.me/CORVO291)
