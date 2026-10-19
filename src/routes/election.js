import { Router } from 'express';
import { LockedError } from '../errors.js';
import { Candidate } from '../models/candidate.js';
import { Vote } from '../models/vote.js';
import * as settingsRepository from '../repositories/settings.js';

export const electionRouter = Router();

electionRouter.post('/reset', async (_req, res) => {
  if ((await settingsRepository.get()).locked) {
    throw new LockedError('The election is running. Unlock the system to close voting before resetting.');
  }

  const votes = await Vote.deleteMany({});
  const writeIns = await Candidate.deleteMany({ isWriteIn: true });

  res.json({ votesRemoved: votes.deletedCount, writeInsRemoved: writeIns.deletedCount });
});
