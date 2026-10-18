import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth/password.js';
import { signToken } from '../src/auth/token.js';
import { User, type UserRole, type UserStatus } from '../src/models/user.js';

export const app = createApp();

interface UserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
}

let sequence = 0;

export async function createUser(input: UserInput = {}) {
  sequence += 1;
  const password = input.password ?? 'password123';
  const user = await User.create({
    name: input.name ?? `User ${sequence}`,
    email: input.email ?? `user${sequence}@example.com`,
    passwordHash: await hashPassword(password),
    role: input.role ?? 'voter',
    status: input.status ?? 'active',
  });
  return { user, password, token: signToken(user.id) };
}

export const createAdmin = (input: UserInput = {}) => createUser({ ...input, role: 'admin' });

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
