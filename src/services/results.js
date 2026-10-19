import * as candidateRepository from '../repositories/candidates.js';
import * as userRepository from '../repositories/users.js';
import * as voteRepository from '../repositories/votes.js';

export async function get() {
  const [candidates, counts, activeVoterIds] = await Promise.all([
    candidateRepository.list(),
    voteRepository.countByCandidate(),
    userRepository.findActiveVoterIds(),
  ]);
  const voted = await voteRepository.countByUsers(activeVoterIds);

  const standings = candidates
    .map((candidate) => ({ candidate, votes: counts.get(candidate.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes || a.candidate.name.localeCompare(b.candidate.name));

  return {
    totalVotes: standings.reduce((sum, row) => sum + row.votes, 0),
    participation: { eligible: activeVoterIds.length, voted },
    standings,
  };
}
