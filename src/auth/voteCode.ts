import { randomInt } from 'node:crypto';
import { hashPassword, verifyPassword } from './password.js';

// No 0/O or 1/I/L: codes get read aloud and typed by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Eight random characters shown as XXXX-XXXX. */
export function generateVoteCode(): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]!);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

/** "abcd efgh" and "ABCDEFGH" both become "ABCDEFGH", so voters can type the code loosely. */
export const normalizeVoteCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const hashVoteCode = (code: string) => hashPassword(normalizeVoteCode(code));

export const verifyVoteCode = (code: string, hash: string | undefined) => verifyPassword(normalizeVoteCode(code), hash);
