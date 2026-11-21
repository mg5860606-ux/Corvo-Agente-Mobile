#!/data/data/com.termux/files/usr/bin/bash
# 🦅 CORVO AGENTE MOBILE - AUTO START SCRIPT (TERMUX:BOOT)
# Coloque este arquivo em ~/.termux/boot/start-corvo.sh para rodar no boot do Android

cd /data/data/com.termux/files/home/Corvo-Agente-Mobile || cd ~/Corvo-Agente-Mobile || cd ~/CorvoAgentMobile

# Garante que o ambiente node e binarios do Termux estao no PATH
export PATH=$PATH:/data/data/com.termux/files/usr/bin

# Mantem o wake-lock ativo para o Android nao suspender o processo no Doze Mode
termux-wake-lock 2>/dev/null

# Inicia o ecossistema mestre em background com logs
nohup node start-master.js > daemon.log 2>&1 &

echo "[CORVO] Daemon iniciado automaticamente no boot do Android."
