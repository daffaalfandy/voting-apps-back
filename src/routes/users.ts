import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../auth/password.js';
import { HttpError, isDuplicateKeyError } from '../errors.js';
import { currentUser } from '../middleware/auth.js';
import { requireUnlocked } from '../middleware/lock.js';
import { USER_ROLES, USER_STATUSES, User, toPublicUser, type UserDoc } from '../models/user.js';
import { Vote } from '../models/vote.js';

const name = z.string().trim().min(1).max(100);
const email = z.string().trim().toLowerCase().pipe(z.email());
const password = z.string().min(8).max(128);

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  voted: z.enum(['true', 'false']).optional(),
});

const createSchema = z.object({
  name,
  email,
  password,
  role: z.enum(USER_ROLES).default('voter'),
});

const updateSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    password: password.optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function saveUser(user: UserDoc) {
  try {
    await user.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new HttpError(409, 'A user with this email already exists');
    }
    throw err;
  }
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

  const user = new User({
    name: body.name,
    email: body.email,
    role: body.role,
    passwordHash: await hashPassword(body.password),
  });
  await saveUser(user);

  res.status(201).json({ user: toPublicUser(user, null) });
});

usersRouter.patch('/:id', requireUnlocked, async (req, res) => {
  const updates = updateSchema.parse(req.body);
  const me = currentUser(req);

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const roleChanges = updates.role !== undefined && updates.role !== user.role;
  const statusChanges = updates.status !== undefined && updates.status !== user.status;
  // Prevents an admin from locking themselves out of the console.
  if (user.id === me.id && (roleChanges || statusChanges)) {
    throw new HttpError(400, 'You cannot change your own role or status');
  }
  if (roleChanges && (await Vote.exists({ user: user._id }))) {
    throw new HttpError(409, 'This user has already voted, so their role cannot change');
  }

  if (updates.name !== undefined) user.name = updates.name;
  if (updates.email !== undefined) user.email = updates.email;
  if (updates.role !== undefined) user.role = updates.role;
  if (updates.status !== undefined) user.status = updates.status;
  if (updates.password !== undefined) user.passwordHash = await hashPassword(updates.password);
  await saveUser(user);

  const vote = await Vote.findOne({ user: user._id }).select('createdAt').lean();
  res.json({ user: toPublicUser(user, vote?.createdAt ?? null) });
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
