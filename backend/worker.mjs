import { createServer } from 'node:http';

const port = Number.parseInt(process.env.PORT ?? '8081', 10);

createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ status: 'ok', service: 'worker', release: 'v2' }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'Not found' }));
}).listen(port, '0.0.0.0', () => {
  console.log(`Toy worker release v2 listening on port ${port}`);
});
