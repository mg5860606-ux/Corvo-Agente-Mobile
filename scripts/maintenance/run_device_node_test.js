const { execSync } = require('child_process');

// Vamos testar no celular o que acontece quando o node executa axios.post para o Pollinations
const testJs = `
const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('https://text.pollinations.ai/openai/chat/completions', {
      model: 'openai',
      messages: [
        { role: 'system', content: 'Você é a Índia, assistente inteligente.' },
        { role: 'user', content: 'Tudo bem com você?' }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 10000
    });
    console.log('POLL_POST_SUCCESS:', JSON.stringify(res.data));
  } catch (err) {
    console.error('POLL_POST_ERR:', err.message, err.response ? err.response.status : '');
  }
}
test();
`;

try {
  // Salvar no celular via adb e executar com node no Termux
  const base64 = Buffer.from(testJs).toString('base64');
  execSync(`C:\\platform-tools\\adb.exe -s 192.168.1.6:36627 shell "run-as com.termux sh -c \\"echo ${base64} | base64 -d > /data/data/com.termux/files/home/test_poll.js && node /data/data/com.termux/files/home/test_poll.js\\""`, { encoding: 'utf8' });
  const output = execSync('C:\\platform-tools\\adb.exe -s 192.168.1.6:36627 shell "run-as com.termux cat /data/data/com.termux/files/home/test_poll.js"', { encoding: 'utf8' });
  console.log('OUTPUT TEST:', output);
} catch (e) {
  console.error('ERROR:', e.message, e.stdout, e.stderr);
}
