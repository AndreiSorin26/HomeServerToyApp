import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const port = Number.parseInt(process.env.PORT ?? '8080', 10);
const frontendPath = fileURLToPath(new URL('../frontend/index.html', import.meta.url));

const sendJson = (response, status, value) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/message') {
    sendJson(response, 200, { message: 'Hello from the toy backend.' });
    return;
  }

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const page = await readFile(frontendPath);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(page);
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Toy app listening on port ${port}`);
});

