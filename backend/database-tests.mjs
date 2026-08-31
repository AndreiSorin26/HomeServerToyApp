import { MongoClient } from 'mongodb';
import neo4j from 'neo4j-driver';
import pg from 'pg';
import { createClient } from 'redis';

const { Pool } = pg;

export const databaseEnvironmentVariables = [
  ['PostgreSQL', 'DATABASE_URL'],
  ['MongoDB', 'MONGO_URL'],
  ['Redis', 'REDIS_URL'],
  ['pgvector', 'PGVECTOR_URL'],
  ['Neo4j', 'NEO4J_URL'],
];

const testPostgres = async (connectionString) => {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS toy_database_smoke (
        test_name TEXT PRIMARY KEY,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await pool.query(`
      INSERT INTO toy_database_smoke (test_name, checked_at)
      VALUES ('postgres', NOW())
      ON CONFLICT (test_name) DO UPDATE SET checked_at = EXCLUDED.checked_at`);
    const result = await pool.query(
      "SELECT test_name FROM toy_database_smoke WHERE test_name = 'postgres'");
    return `Created, wrote, and read ${result.rowCount} PostgreSQL row.`;
  } finally {
    await pool.end();
  }
};

const testMongo = async (connectionString) => {
  const client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const collection = client.db().collection('toy_database_smoke');
    await collection.updateOne(
      { testName: 'mongo' },
      { $set: { checkedAt: new Date() } },
      { upsert: true });
    const document = await collection.findOne({ testName: 'mongo' });
    return `Created, wrote, and read MongoDB document “${document.testName}”.`;
  } finally {
    await client.close();
  }
};

const testRedis = async (connectionString) => {
  const client = createClient({ url: connectionString, socket: { connectTimeout: 5000 } });
  try {
    await client.connect();
    await client.set('toy:database-smoke', new Date().toISOString());
    const value = await client.get('toy:database-smoke');
    return `Wrote and read Redis key (${value ? 'value present' : 'missing'}).`;
  } finally {
    if (client.isOpen) await client.close();
  }
};

const testPgVector = async (connectionString) => {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS toy_embeddings (
        id TEXT PRIMARY KEY,
        embedding vector(3) NOT NULL
      )`);
    await pool.query(`
      INSERT INTO toy_embeddings (id, embedding)
      VALUES ('red', '[1,0,0]'), ('green', '[0,1,0]'), ('blue', '[0,0,1]')
      ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding`);
    const result = await pool.query(`
      SELECT id, embedding <-> '[0.9,0.1,0]'::vector AS distance
      FROM toy_embeddings
      ORDER BY embedding <-> '[0.9,0.1,0]'::vector
      LIMIT 1`);
    return `Vector similarity returned “${result.rows[0].id}” as the nearest embedding.`;
  } finally {
    await pool.end();
  }
};

const parseNeo4jConnection = (connectionString) => {
  const parsed = new URL(connectionString);
  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  parsed.username = '';
  parsed.password = '';
  return { uri: parsed.toString().replace(/\/$/, ''), username, password };
};

const testNeo4j = async (connectionString) => {
  const { uri, username, password } = parseNeo4jConnection(connectionString);
  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
    connectionTimeout: 5000,
  });
  const session = driver.session({ database: 'neo4j' });
  try {
    await driver.verifyConnectivity();
    await session.executeWrite((transaction) => transaction.run(`
      MERGE (project:ToyProject { name: 'HomeServer' })
      MERGE (document:ToyDocument { name: 'database-smoke' })
      SET document.embedding = [1.0, 0.0, 0.0], document.checkedAt = datetime()
      MERGE (project)-[:USES]->(document)`));
    await session.run(`
      CREATE VECTOR INDEX toy_document_embeddings IF NOT EXISTS
      FOR (document:ToyDocument) ON document.embedding
      OPTIONS { indexConfig: {
        \`vector.dimensions\`: 3,
        \`vector.similarity_function\`: 'cosine'
      } }`);
    const result = await session.run(`
      MATCH (:ToyProject { name: 'HomeServer' })-[:USES]->(document:ToyDocument)
      RETURN document.name AS name,
             vector.similarity.cosine(document.embedding, [0.9, 0.1, 0.0]) AS score`);
    const record = result.records[0];
    return `Graph traversal and vector similarity succeeded for “${record.get('name')}”.`;
  } finally {
    await session.close();
    await driver.close();
  }
};

const runners = {
  DATABASE_URL: testPostgres,
  MONGO_URL: testMongo,
  REDIS_URL: testRedis,
  PGVECTOR_URL: testPgVector,
  NEO4J_URL: testNeo4j,
};

export const runDatabaseTests = async (environment = process.env) => {
  const results = [];
  for (const [database, variable] of databaseEnvironmentVariables) {
    const startedAt = Date.now();
    const connectionString = environment[variable];
    if (!connectionString) {
      results.push({ database, variable, status: 'not-configured', latencyMs: 0 });
      continue;
    }
    try {
      const detail = await runners[variable](connectionString);
      results.push({ database, variable, status: 'passed', latencyMs: Date.now() - startedAt, detail });
    } catch (error) {
      results.push({
        database,
        variable,
        status: 'failed',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    allPassed: results.every(({ status }) => status === 'passed'),
    testedAt: new Date().toISOString(),
    results,
  };
};
