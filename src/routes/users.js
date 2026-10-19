import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../auth/password.js';
import { generateVoteCode, hashVoteCode } from '../auth/voteCode.js';
import { HttpError, isDuplicateKeyError } from '../errors.js';
import { currentUser } from '../middleware/auth.js';
import { requireUnlocked } from '../middleware/lock.js';
import { USER_ROLES, USER_STATUSES, User, toPublicUser } from '../models/user.js';
import { Vote } from '../models/vote.js';
import { emailSchema, nameSchema, passwordSchema } from '../schemas.js';

const VOTER_PASSWORD_MESSAGE = 'Voters sign in with a vote code, not a password';

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  voted: z.enum(['true', 'false']).optional(),
});

const createSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    role: z.enum(USER_ROLES, 'Role must be admin or voter').default('voter'),
    password: passwordSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.role === 'admin' && body.password === undefined) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Administrators need a password' });
    }
    if (body.role === 'voter' && body.password !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: VOTER_PASSWORD_MESSAGE });
    }
  });

const updateSchema = z
  .strictObject({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    status: z.enum(USER_STATUSES, 'Status must be active or suspended').optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function saveUser(user) {
  try {
    await user.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new HttpError(409, 'A user with this email already exists');
    }
    throw err;
  }
}

async function findUser(id) {
  const user = await User.findById(id);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  return user;
}

export const usersRouter = Router();

usersRouter.get('/', async (req, res) => {
  const { search, voted } = listQuerySchema.parse(req.query);

  const filter = search ? { $or: [{ name: new RegExp(escapeRegex(search), 'i') }, { email: new RegExp(escapeRegex(search), 'i') }] } : {};
  let users = await User.find(filter).collation({ locale: 'en' }).sort({ name: 1 });

  const votes = await Vote.find({ user: { $in: users.map((u) => u._id) } }).select('user createdAt').lean();
  const votedAt = new Map(votes.map((vote) => [String(vote.user), vote.createdAt]));

  if (voted === 'true') {
    users = users.filter((u) => votedAt.has(u.id));
  } else if (voted === 'false') {
    users = users.filter((u) => u.role === 'voter' && !votedAt.has(u.id));
  }

  res.json({ users: users.map((u) => toPublicUser(u, votedAt.get(u.id) ?? null)) });
});

usersRouter.post('/', requireUnlocked, async (req, res) => {
  const body = createSchema.parse(req.body);
  const voteCode = body.role === 'voter' ? generateVoteCode() : undefined;

  const user = new User({
    name: body.name,
    email: body.email,
    role: body.role,
    passwordHash: body.password === undefined ? undefined : await hashPassword(body.password),
    voteCodeHash: voteCode === undefined ? undefined : await hashVoteCode(voteCode),
  });
  await saveUser(user);

  res.status(201).json({ user: toPublicUser(user, null), ...(voteCode && { voteCode }) });
});

usersRouter.patch('/:id', requireUnlocked, async (req, res) => {
  const updates = updateSchema.parse(req.body);
  const user = await findUser(req.params.id);

  if (user.id === currentUser(req).id && updates.status !== undefined && updates.status !== user.status) {
    throw new HttpError(400, 'You cannot change your own status');
  }
  if (updates.password !== undefined && user.role !== 'admin') {
    throw new HttpError(400, VOTER_PASSWORD_MESSAGE);
  }

  if (updates.name !== undefined) user.name = updates.name;
  if (updates.email !== undefined) user.email = updates.email;
  if (updates.status !== undefined) user.status = updates.status;
  if (updates.password !== undefined) user.passwordHash = await hashPassword(updates.password);
  await saveUser(user);

  const vote = await Vote.findOne({ user: user._id }).select('createdAt').lean();
  res.json({ user: toPublicUser(user, vote?.createdAt ?? null) });
});

usersRouter.post('/:id/vote-code', requireUnlocked, async (req, res) => {
  const user = await findUser(req.params.id);
  if (user.role !== 'voter') {
    throw new HttpError(400, 'Only voters have vote codes; administrators use a password');
  }

  const voteCode = generateVoteCode();
  user.voteCodeHash = await hashVoteCode(voteCode);
  await user.save();

  res.json({ voteCode });
});

usersRouter.delete('/:id', requireUnlocked, async (req, res) => {
  if (req.params.id === currentUser(req).id) {
    throw new HttpError(400, 'You cannot delete your own account');
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  await Vote.deleteMany({ user: user._id });

  res.status(204).end();
});

usersRouter.delete('/:id/vote', requireUnlocked, async (req, res) => {
  const { deletedCount } = await Vote.deleteOne({ user: req.params.id });
  if (deletedCount === 0) {
    throw new HttpError(404, 'This user has no vote to reset');
  }

  res.status(204).end();
});
