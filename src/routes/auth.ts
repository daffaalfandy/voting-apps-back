import { Router } from 'express';
import { z } from 'zod';
import { verifyPassword } from '../auth/password.js';
import { signToken } from '../auth/token.js';
import { HttpError } from '../errors.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { User, toPublicUser } from '../models/user.js';
import { findVotedAt } from '../models/vote.js';

const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address')),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email });
  const passwordOk = await verifyPassword(password, user?.passwordHash);
  if (!user || !passwordOk) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (user.status === 'suspended') {
    throw new HttpError(403, 'This account is suspended. Contact the election administrator.');
  }

  res.json({ token: signToken(user.id), user: toPublicUser(user, await findVotedAt(user._id)) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = currentUser(req);
  res.json({ user: toPublicUser(user, await findVotedAt(user._id)) });
});
