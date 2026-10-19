import * as resultsService from '../services/results.js';
import { toPublicCandidate } from './presenters.js';

export async function show(_req, res) {
  const { totalVotes, participation, standings } = await resultsService.get();
  res.json({
    totalVotes,
    participation,
    candidates: standings.map(({ candidate, votes }) => ({ ...toPublicCandidate(candidate), votes })),
  });
}
