import { Router } from 'express';
import { LockedError } from '../errors.js';
import * as candidateRepository from '../repositories/candidates.js';
import * as settingsRepository from '../repositories/settings.js';
import * as voteRepository from '../repositories/votes.js';

export const electionRouter = Router();

electionRouter.post('/reset', async (_req, res) => {
  if ((await settingsRepository.get()).locked) {
    throw new LockedError('The election is running. Unlock the system to close voting before resetting.');
  }

  const votesRemoved = await voteRepository.deleteAll();
  const writeInsRemoved = await candidateRepository.deleteWriteIns();

  res.json({ votesRemoved, writeInsRemoved });
});
