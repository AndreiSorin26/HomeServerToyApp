import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidUsername, normalizeUsername, safeUploadName } from './validation.mjs';

test('normalizes and validates usernames', () => {
  assert.equal(normalizeUsername('  Alice  '), 'Alice');
  assert.equal(normalizeUsername(null), '');
  assert.equal(isValidUsername('Alice'), true);
  assert.equal(isValidUsername(''), false);
  assert.equal(isValidUsername('x'.repeat(101)), false);
});

test('reduces upload names to a safe basename', () => {
  assert.equal(safeUploadName('../../report 2026.txt'), 'report_2026.txt');
  assert.equal(safeUploadName('avatar.png'), 'avatar.png');
  assert.throws(() => safeUploadName('..'), /valid filename/);
});
