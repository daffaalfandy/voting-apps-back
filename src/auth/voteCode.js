import { randomInt } from 'node:crypto';
import { hashPassword, verifyPassword } from './password.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateVoteCode() {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

export const normalizeVoteCode = (code) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const hashVoteCode = (code) => hashPassword(normalizeVoteCode(code));

export const verifyVoteCode = (code, hash) => verifyPassword(normalizeVoteCode(code), hash);
