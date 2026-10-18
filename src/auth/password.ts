import bcrypt from 'bcryptjs';
import { config } from '../config.js';

const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', config.BCRYPT_ROUNDS);

export const hashPassword = (plain: string) => bcrypt.hash(plain, config.BCRYPT_ROUNDS);

export const verifyPassword = (plain: string, hash: string | null | undefined) => bcrypt.compare(plain, hash ?? DUMMY_HASH);
