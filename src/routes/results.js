import { Router } from 'express';
import { Candidate, toPublicCandidate } from '../models/candidate.js';
import { User } from '../models/user.js';
import { Vote, countVotesByCandidate } from '../models/vote.js';

export const resultsRouter = Router();

resultsRouter.get('/', async (_req, res) => {
  const [candidates, counts, activeVoters] = await Promise.all([
    Candidate.find(),
    countVotesByCandidate(),
    User.find({ role: 'voter', status: 'active' }).select('_id').lean(),
  ]);
  const voted = await Vote.countDocuments({ user: { $in: activeVoters.map((voter) => voter._id) } });

  const standings = candidates
    .map((candidate) => ({ ...toPublicCandidate(candidate), votes: counts.get(candidate.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));

  res.json({
    totalVotes: standings.reduce((sum, row) => sum + row.votes, 0),
    participation: { eligible: activeVoters.length, voted },
    candidates: standings,
  });
});
