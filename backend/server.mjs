import { createServer } from 'node:http';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const port = Number.parseInt(process.env.PORT ?? '8080', 10);
const uploadsPath = process.env.UPLOADS_PATH ?? '/data/uploads';
const frontendPath = fileURLToPath(new URL('../frontend/index.html', import.meta.url));
const maximumUploadBytes = 1024 * 1024;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let databaseReady;
const ensureDatabase = () => databaseReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS toy_users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch((error) => {
    databaseReady = undefined;
    throw error;
  });

const sendJson = (response, status, value) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
};

const readJson = async (request) => {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 16 * 1024) throw new Error('JSON request is too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const safeUploadName = (value) => {
  const name = basename(value ?? '').replace(/[^A-Za-z0-9._-]/g, '_');
  if (!name || name === '.' || name === '..') throw new Error('A valid filename is required');
  return name;
};

const handleRequest = async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/message') {
    sendJson(response, 200, { message: 'Hello from the toy backend.' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/users') {
    await ensureDatabase();
    const result = await pool.query(
      'SELECT id, username, created_at FROM toy_users ORDER BY id DESC LIMIT 50');
    sendJson(response, 200, { users: result.rows });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/users') {
    const { username } = await readJson(request);
    const normalized = typeof username === 'string' ? username.trim() : '';
    if (normalized.length < 1 || normalized.length > 100) {
      sendJson(response, 400, { error: 'Username must contain 1-100 characters' });
      return;
    }
    await ensureDatabase();
    const result = await pool.query(
      'INSERT INTO toy_users (username) VALUES ($1) RETURNING id, username, created_at',
      [normalized]);
    sendJson(response, 201, { user: result.rows[0] });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/files') {
    await mkdir(uploadsPath, { recursive: true });
    const entries = await readdir(uploadsPath, { withFileTypes: true });
    const files = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => ({
      name: entry.name,
      size: (await stat(join(uploadsPath, entry.name))).size,
    })));
    sendJson(response, 200, { files });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/uploads') {
    const contentLength = Number.parseInt(request.headers['content-length'] ?? '0', 10);
    if (!Number.isFinite(contentLength) || contentLength < 1 || contentLength > maximumUploadBytes) {
      sendJson(response, 413, { error: 'Upload must contain 1 byte to 1 MiB' });
      return;
    }
    await mkdir(uploadsPath, { recursive: true });
    const name = safeUploadName(url.searchParams.get('name'));
    await pipeline(request, createWriteStream(join(uploadsPath, name), { flags: 'w' }));
    sendJson(response, 201, { file: { name, size: contentLength } });
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/uploads/')) {
    const name = safeUploadName(decodeURIComponent(url.pathname.slice('/uploads/'.length)));
    const file = await readFile(join(uploadsPath, name));
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    response.end(file);
    return;
  }

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const page = await readFile(frontendPath);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(page);
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
};

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: error.message });
    else response.end();
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Toy app listening on port ${port}`);
});
