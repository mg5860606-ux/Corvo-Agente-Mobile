const fs = require('fs');

// Vamos ler o .env do dispositivo conectado no ADB pra ver exatamente o que tem lá
const { execSync } = require('child_process');

try {
  const envRaw = execSync('C:\\platform-tools\\adb.exe -s 192.168.1.6:36627 shell "run-as com.termux cat /data/data/com.termux/files/home/Corvo-Agente-Mobile/.env"', { encoding: 'utf8' });
  console.log('ENV RAW LENGHT:', envRaw.length);
  // Mascare chaves
  const lines = envRaw.split('\n').map(l => {
    if (l.startsWith('GEMINI_API_KEY=')) return 'GEMINI_API_KEY=' + l.slice(15, 23) + '...';
    if (l.startsWith('TELEGRAM_BOT_TOKEN=')) return 'TELEGRAM_BOT_TOKEN=' + l.slice(19, 27) + '...';
    return l;
  });
  console.log(lines.join('\n'));
} catch (e) {
  console.error('ERRO ADB:', e.message);
}
