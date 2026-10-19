import { Router } from 'express';
import * as userRepository from '../repositories/users.js';
import * as voteRepository from '../repositories/votes.js';

export const participationRouter = Router();

participationRouter.get('/', async (_req, res) => {
  const votes = await voteRepository.listRecent();
  const users = await userRepository.findByIds(votes.map((vote) => vote.user));
  const usersById = new Map(users.map((user) => [user.id, user]));

  const participants = votes.flatMap((vote) => {
    const user = usersById.get(String(vote.user));
    return user ? [{ id: user.id, name: user.name, email: user.email, status: user.status, votedAt: vote.createdAt }] : [];
  });

  res.json({ participants });
});
