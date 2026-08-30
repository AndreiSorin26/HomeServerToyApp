import { basename } from 'node:path';

export const normalizeUsername = (value) => typeof value === 'string' ? value.trim() : '';

export const isValidUsername = (value) => value.length >= 1 && value.length <= 100;

export const safeUploadName = (value) => {
  const name = basename(value ?? '').replace(/[^A-Za-z0-9._-]/g, '_');
  if (!name || name === '.' || name === '..') throw new Error('A valid filename is required');
  return name;
};
