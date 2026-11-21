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

## ✈️ Usando pelo Telegram

1. Fale com o `@BotFather` no Telegram e crie um bot (ele vai te dar um token).
2. Abra o arquivo `.env` e cole o token em `TELEGRAM_BOT_TOKEN=`.
3. Comandos úteis no Telegram:
   - `/status` — Mostra bateria, memória RAM e saúde do sistema.
   - `/stop` — Para qualquer tarefa ou comando em execução.
   - `/reset` — Limpa a conversa recente e começa do zero.
   - **Ordens em linguagem natural:** ex: *"crie um script de backup"*, *"navegue no site X e tire print"*, *"escaneie a porta 80 do IP Y"*.

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
