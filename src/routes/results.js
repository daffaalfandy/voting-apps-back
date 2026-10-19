import { Router } from 'express';
import { toPublicCandidate } from '../models/candidate.js';
import * as candidateRepository from '../repositories/candidates.js';
import * as userRepository from '../repositories/users.js';
import * as voteRepository from '../repositories/votes.js';

export const resultsRouter = Router();

resultsRouter.get('/', async (_req, res) => {
  const [candidates, counts, activeVoterIds] = await Promise.all([
    candidateRepository.list(),
    voteRepository.countByCandidate(),
    userRepository.findActiveVoterIds(),
  ]);
  const voted = await voteRepository.countByUsers(activeVoterIds);

  const standings = candidates
    .map((candidate) => ({ ...toPublicCandidate(candidate), votes: counts.get(candidate.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));

  res.json({
    totalVotes: standings.reduce((sum, row) => sum + row.votes, 0),
    participation: { eligible: activeVoterIds.length, voted },
    candidates: standings,
  });
});
