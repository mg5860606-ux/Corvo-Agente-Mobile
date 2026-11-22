const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Vamos ler os arquivos que executam o teste ou testar se o curl funciona no Termux
  const res = execSync('C:\\platform-tools\\adb.exe -s 192.168.1.6:36627 shell "run-as com.termux /data/data/com.termux/files/usr/bin/curl -s https://text.pollinations.ai/diga_ok"', { encoding: 'utf8' });
  console.log('CURL POLLINATIONS RESPONSE:', res.slice(0, 200));
} catch (e) {
  console.error('CURL ERROR:', e.message);
}
