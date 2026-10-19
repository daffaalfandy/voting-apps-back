import { Router } from 'express';
import { z } from 'zod';
import { verifyPassword } from '../auth/password.js';
import { signToken } from '../auth/token.js';
import { verifyVoteCode } from '../auth/voteCode.js';
import { toPublicUser } from '../controllers/presenters.js';
import { AuthenticationError, ForbiddenError } from '../errors.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import * as userRepository from '../repositories/users.js';
import * as voteRepository from '../repositories/votes.js';
import { emailSchema } from '../schemas.js';

const voterLoginSchema = z.object({
  email: emailSchema,
  code: z.string({ error: 'Vote code is required' }).min(1, 'Vote code is required'),
});

const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

async function startSession(res, user) {
  if (user.status === 'suspended') {
    throw new ForbiddenError('This account is suspended. Contact the election administrator.');
  }
  res.json({ token: signToken(user.id), user: toPublicUser(user, await voteRepository.findVotedAt(user._id)) });
}

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, code } = voterLoginSchema.parse(req.body);

  const user = await userRepository.findByEmail(email, 'voter');
  const codeOk = await verifyVoteCode(code, user?.voteCodeHash);
  if (!user || !codeOk) {
    throw new AuthenticationError('Invalid email or vote code');
  }
  await startSession(res, user);
});

authRouter.post('/admin/login', async (req, res) => {
  const { email, password } = adminLoginSchema.parse(req.body);

  const user = await userRepository.findByEmail(email, 'admin');
  const passwordOk = await verifyPassword(password, user?.passwordHash);
  if (!user || !passwordOk) {
    throw new AuthenticationError('Invalid email or password');
  }
  await startSession(res, user);
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = currentUser(req);
  res.json({ user: toPublicUser(user, await voteRepository.findVotedAt(user._id)) });
});
