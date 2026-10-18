import { Router } from 'express';
import { User } from '../models/user.js';
import { Vote } from '../models/vote.js';

export const participationRouter = Router();

participationRouter.get('/', async (_req, res) => {
  const votes = await Vote.find().sort({ createdAt: -1 }).select('user createdAt').lean();
  const users = await User.find({ _id: { $in: votes.map((vote) => vote.user) } });
  const usersById = new Map(users.map((user) => [user.id as string, user]));

  const participants = votes.flatMap((vote) => {
    const user = usersById.get(String(vote.user));
    return user ? [{ id: user.id as string, name: user.name, email: user.email, status: user.status, votedAt: vote.createdAt }] : [];
  });

  res.json({ participants });
});
