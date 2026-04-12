// Запуск: node proxy.js
// Проксує запити з http://localhost:3000 → https://1csync.mailcn.com.ua:9443

const https = require('https');
const http = require('http');

const PORT = 3000;
const TARGET = '1csync.mailcn.com.ua';
const TARGET_PORT = 9443;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const options = {
    hostname: TARGET,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: TARGET },
    rejectUnauthorized: false,
  };

  const proxy = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', (e) => {
    res.writeHead(502);
    res.end(e.message);
  });

  req.pipe(proxy);
}).listen(PORT, () => console.log(`Proxy: http://localhost:${PORT} → https://${TARGET}:${TARGET_PORT}`));
