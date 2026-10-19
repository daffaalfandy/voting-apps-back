import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DuplicateError, LockedError, NotFoundError } from '../../src/errors.js';
import * as candidateRepository from '../../src/repositories/candidates.js';
import * as settingsRepository from '../../src/repositories/settings.js';
import * as voteRepository from '../../src/repositories/votes.js';
import * as voteService from '../../src/services/votes.js';

vi.mock('../../src/repositories/candidates.js');
vi.mock('../../src/repositories/settings.js');
vi.mock('../../src/repositories/votes.js');

const voter = { _id: 'voter-1', id: 'voter-1', role: 'voter' };
const candidate = { _id: 'candidate-1', id: 'candidate-1', name: 'Mahendra Wijaya', isWriteIn: false };
const createdAt = new Date('2026-10-15T09:42:00Z');

beforeEach(() => {
  vi.resetAllMocks();
  settingsRepository.get.mockResolvedValue({ locked: true });
  voteRepository.existsForUser.mockResolvedValue(false);
  candidateRepository.findById.mockResolvedValue(candidate);
  voteRepository.create.mockResolvedValue({ createdAt });
});

describe('voteService.cast', () => {
  it('records a vote for a listed candidate', async () => {
    const vote = await voteService.cast(voter, { candidateId: candidate.id });

    expect(vote).toEqual({ candidate, createdAt });
    expect(voteRepository.create).toHaveBeenCalledWith({ user: voter._id, candidate: candidate._id });
  });

  it('turns a write-in name into a candidate before voting', async () => {
    const writeIn = { _id: 'candidate-2', id: 'candidate-2', name: 'Joko Susilo', isWriteIn: true };
    candidateRepository.findOrCreateWriteIn.mockResolvedValue(writeIn);

    const vote = await voteService.cast(voter, { name: 'Joko Susilo' });

    expect(candidateRepository.findOrCreateWriteIn).toHaveBeenCalledWith('Joko Susilo');
    expect(vote.candidate).toBe(writeIn);
  });

  it('refuses while the election has not started', async () => {
    settingsRepository.get.mockResolvedValue({ locked: false });

    await expect(voteService.cast(voter, { candidateId: candidate.id })).rejects.toBeInstanceOf(LockedError);
    expect(voteRepository.create).not.toHaveBeenCalled();
  });

  it('refuses a voter who has already voted', async () => {
    voteRepository.existsForUser.mockResolvedValue(true);

    await expect(voteService.cast(voter, { candidateId: candidate.id })).rejects.toMatchObject({
      name: 'ConflictError',
      message: 'You have already voted',
    });
    expect(voteRepository.create).not.toHaveBeenCalled();
  });

  it('reports a vote that lost a race to another request as already voted', async () => {
    voteRepository.create.mockRejectedValue(new DuplicateError());

    await expect(voteService.cast(voter, { candidateId: candidate.id })).rejects.toMatchObject({
      name: 'ConflictError',
      message: 'You have already voted',
    });
  });

  it('rejects an unknown candidate', async () => {
    candidateRepository.findById.mockResolvedValue(null);

    await expect(voteService.cast(voter, { candidateId: 'missing' })).rejects.toBeInstanceOf(NotFoundError);
    expect(voteRepository.create).not.toHaveBeenCalled();
  });
});

describe('voteService.mine', () => {
  it('returns the chosen candidate and when the vote was cast', async () => {
    voteRepository.findByUser.mockResolvedValue({ candidate: candidate._id, createdAt });

    expect(await voteService.mine(voter)).toEqual({ candidate, createdAt });
    expect(candidateRepository.findById).toHaveBeenCalledWith(candidate._id);
  });

  it('returns null before the voter has voted', async () => {
    voteRepository.findByUser.mockResolvedValue(null);

    expect(await voteService.mine(voter)).toBeNull();
  });
});
