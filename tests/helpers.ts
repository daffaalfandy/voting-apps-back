import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth/password.js';
import { signToken } from '../src/auth/token.js';
import { generateVoteCode, hashVoteCode } from '../src/auth/voteCode.js';
import { User, type UserStatus } from '../src/models/user.js';

export const app = createApp();

interface UserInput {
  name?: string;
  email?: string;
  status?: UserStatus;
}

let sequence = 0;

function identity(input: UserInput) {
  sequence += 1;
  return {
    name: input.name ?? `User ${sequence}`,
    email: input.email ?? `user${sequence}@example.com`,
    status: input.status ?? 'active',
  };
}

export async function createUser(input: UserInput = {}) {
  const voteCode = generateVoteCode();
  const user = await User.create({ ...identity(input), role: 'voter', voteCodeHash: await hashVoteCode(voteCode) });
  return { user, voteCode, token: signToken(user.id) };
}

export async function createAdmin(input: UserInput & { password?: string } = {}) {
  const password = input.password ?? 'password123';
  const user = await User.create({ ...identity(input), role: 'admin', passwordHash: await hashPassword(password) });
  return { user, password, token: signToken(user.id) };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
