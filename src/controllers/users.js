import { z } from 'zod';
import { currentUser } from '../middleware/auth.js';
import { USER_ROLES, USER_STATUSES } from '../models/user.js';
import { emailSchema, nameSchema, passwordSchema } from '../schemas.js';
import * as userService from '../services/users.js';
import { toPublicUser } from './presenters.js';

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  voted: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
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
      ctx.addIssue({ code: 'custom', path: ['password'], message: userService.VOTER_PASSWORD_MESSAGE });
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

export async function list(req, res) {
  const rows = await userService.list(listQuerySchema.parse(req.query));
  res.json({ users: rows.map(({ user, votedAt }) => toPublicUser(user, votedAt)) });
}

export async function create(req, res) {
  const { user, voteCode } = await userService.create(createSchema.parse(req.body));
  res.status(201).json({ user: toPublicUser(user, null), ...(voteCode && { voteCode }) });
}

export async function update(req, res) {
  const changes = updateSchema.parse(req.body);
  const { user, votedAt } = await userService.update(currentUser(req), req.params.id, changes);
  res.json({ user: toPublicUser(user, votedAt) });
}

export async function issueVoteCode(req, res) {
  res.json({ voteCode: await userService.issueVoteCode(req.params.id) });
}

export async function remove(req, res) {
  await userService.remove(currentUser(req), req.params.id);
  res.status(204).end();
}

export async function resetVote(req, res) {
  await userService.resetVote(req.params.id);
  res.status(204).end();
}
