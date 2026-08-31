import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseEnvironmentVariables, runDatabaseTests } from './database-tests.mjs';

test('declares every supported database integration', () => {
  assert.deepEqual(databaseEnvironmentVariables.map(([name]) => name), [
    'PostgreSQL', 'MongoDB', 'Redis', 'pgvector', 'Neo4j',
  ]);
});

test('reports missing connections without attempting network access', async () => {
  const result = await runDatabaseTests({});
  assert.equal(result.allPassed, false);
  assert.equal(result.results.length, 5);
  assert.ok(result.results.every(({ status }) => status === 'not-configured'));
});
