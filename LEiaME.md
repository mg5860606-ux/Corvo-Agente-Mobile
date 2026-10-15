# 🦅 CORVO AGENT MOBILE - INSTRUÇÕES DE INSTALAÇÃO NO TERMUX (ANDROID)

Este pacote contém toda a inteligência autônoma, ferramentas e módulos de conexão para rodar o seu agente de inteligência artificial diretamente no **WhatsApp** via **Termux** no Android.

---

## 🛠️ Passo 1: Instalar Dependências no Termux

Abra o seu Termux no celular e rode os comandos abaixo em sequência:

```bash
# 1. Atualizar pacotes e instalar ambiente base
pkg update && pkg upgrade -y
pkg install nodejs git python build-essential libjpeg-turbo libpng -y

# 2. Conceder permissão de acesso ao armazenamento interno
termux-setup-storage
```

---

## 📂 Passo 2: Posicionar os Arquivos

Baixe ou transfira a pasta `CorvoAgentMobile` para o armazenamento do seu celular (por exemplo, na pasta `storage/shared/CorvoAgentMobile` ou clone diretamente no seu diretório do Termux).

No Termux, navegue até a pasta do projeto:
```bash
cd ~/CorvoAgentMobile
# OU se estiver no armazenamento interno:
cd /data/data/com.termux/files/home/storage/shared/CorvoAgentMobile
```

---

## ⚙️ Passo 3: Configurar as Variáveis de Ambiente

Crie ou edite o arquivo `.env` dentro da pasta do projeto e adicione sua chave da API do Google Gemini e demais configs:

```env
GEMINI_API_KEY=sua_chave_gemini_aqui
DONO=8273924319
```

---

## 📦 Passo 4: Instalar as Bibliotecas do Node.js

Instale todas as dependências (Baileys para o WhatsApp, SDK do Google Gemini, manipuladores de imagem e utilitários):

```bash
npm install
```

---

## ▶️ Passo 5: Iniciar o Agente Autônomo

Para rodar o bot e conectar a sua conta do WhatsApp via QR Code:

```bash
npm start
```

Assim que o QR Code aparecer na tela do terminal do Termux, escaneie com o seu WhatsApp e a IA estará 100% ativa, respondendo e executando comandos de forma autônoma no seu celular!
