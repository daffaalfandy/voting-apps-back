import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as candidateRepository from '../../src/repositories/candidates.js';
import * as userRepository from '../../src/repositories/users.js';
import * as voteRepository from '../../src/repositories/votes.js';
import * as resultsService from '../../src/services/results.js';

vi.mock('../../src/repositories/candidates.js');
vi.mock('../../src/repositories/users.js');
vi.mock('../../src/repositories/votes.js');

const endang = { id: 'candidate-1', name: 'Endang Kusumawati' };
const joko = { id: 'candidate-2', name: 'Joko Susilo' };
const mahendra = { id: 'candidate-3', name: 'Mahendra Wijaya' };
const sri = { id: 'candidate-4', name: 'Sri Wahyuni' };

beforeEach(() => {
  vi.resetAllMocks();
  candidateRepository.list.mockResolvedValue([endang, joko, mahendra, sri]);
  voteRepository.countByCandidate.mockResolvedValue(
    new Map([
      [sri.id, 2],
      [mahendra.id, 1],
      [joko.id, 1],
    ]),
  );
  userRepository.findActiveVoterIds.mockResolvedValue(['voter-1', 'voter-2', 'voter-3', 'voter-4', 'voter-5']);
  voteRepository.countByUsers.mockResolvedValue(3);
});

describe('resultsService.get', () => {
  it('ranks candidates by votes, then by name', async () => {
    const { standings } = await resultsService.get();

    expect(standings).toEqual([
      { candidate: sri, votes: 2 },
      { candidate: joko, votes: 1 },
      { candidate: mahendra, votes: 1 },
      { candidate: endang, votes: 0 },
    ]);
  });

  it('adds up the votes and measures turnout among active voters', async () => {
    const { totalVotes, participation } = await resultsService.get();

    expect(totalVotes).toBe(4);
    expect(participation).toEqual({ eligible: 5, voted: 3 });
    expect(voteRepository.countByUsers).toHaveBeenCalledWith(['voter-1', 'voter-2', 'voter-3', 'voter-4', 'voter-5']);
  });
});
