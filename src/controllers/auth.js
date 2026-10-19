import { z } from 'zod';
import { currentUser } from '../middleware/auth.js';
import { emailSchema } from '../schemas.js';
import * as authService from '../services/auth.js';
import { toPublicUser } from './presenters.js';

const voterLoginSchema = z.object({
  email: emailSchema,
  code: z.string({ error: 'Vote code is required' }).min(1, 'Vote code is required'),
});

const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

function sendSession(res, { token, user, votedAt }) {
  res.json({ token, user: toPublicUser(user, votedAt) });
}

export async function loginVoter(req, res) {
  sendSession(res, await authService.loginVoter(voterLoginSchema.parse(req.body)));
}

export async function loginAdmin(req, res) {
  sendSession(res, await authService.loginAdmin(adminLoginSchema.parse(req.body)));
}

export async function me(req, res) {
  const { user, votedAt } = await authService.profile(currentUser(req));
  res.json({ user: toPublicUser(user, votedAt) });
}
