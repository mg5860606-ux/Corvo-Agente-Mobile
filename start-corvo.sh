#!/data/data/com.termux/files/usr/bin/bash
# 🦅 CORVO AGENTE MOBILE - AUTO START SCRIPT (TERMUX:BOOT)
# Coloque este arquivo em ~/.termux/boot/start-corvo.sh para rodar no boot do Android

cd /data/data/com.termux/files/home/CorvoAgentMobile || cd ~/CorvoAgentMobile

# Garante que o ambiente node está acessível
export PATH=$PATH:/data/data/com.termux/files/usr/bin

# Inicia o Gateway Daemon em background registrando logs
nohup node corvo_gateway.js > gateway.log 2>&1 &

echo "[CORVO] Daemon iniciado automaticamente no boot do Android."
