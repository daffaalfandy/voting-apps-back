import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, DuplicateError, NotFoundError } from '../../src/errors.js';
import * as candidateRepository from '../../src/repositories/candidates.js';
import * as voteRepository from '../../src/repositories/votes.js';
import * as candidateService from '../../src/services/candidates.js';

vi.mock('../../src/repositories/candidates.js');
vi.mock('../../src/repositories/votes.js');

const mahendra = { _id: 'candidate-1', id: 'candidate-1', name: 'Mahendra Wijaya', isWriteIn: false };
const sri = { _id: 'candidate-2', id: 'candidate-2', name: 'Sri Wahyuni', isWriteIn: false };

beforeEach(() => {
  vi.resetAllMocks();
  candidateRepository.list.mockResolvedValue([mahendra, sri]);
  voteRepository.countByCandidate.mockResolvedValue(new Map([[mahendra.id, 3]]));
});

describe('candidateService.list', () => {
  it('gives voters the names without counting votes', async () => {
    const rows = await candidateService.list({ role: 'voter' });

    expect(rows).toEqual([{ candidate: mahendra }, { candidate: sri }]);
    expect(voteRepository.countByCandidate).not.toHaveBeenCalled();
  });

  it('gives admins the vote count of each candidate, zero when none', async () => {
    const rows = await candidateService.list({ role: 'admin' });

    expect(rows).toEqual([
      { candidate: mahendra, voteCount: 3 },
      { candidate: sri, voteCount: 0 },
    ]);
  });
});

describe('candidateService.create', () => {
  it('adds the candidate', async () => {
    candidateRepository.create.mockResolvedValue(sri);

    expect(await candidateService.create('Sri Wahyuni')).toBe(sri);
  });

  it('explains a name that is already on the ballot', async () => {
    candidateRepository.create.mockRejectedValue(new DuplicateError());

    await expect(candidateService.create('Sri Wahyuni')).rejects.toMatchObject({
      name: 'ConflictError',
      message: 'A candidate with this name already exists',
    });
  });
});

describe('candidateService.remove', () => {
  it('removes a candidate without votes', async () => {
    candidateRepository.findById.mockResolvedValue(sri);
    voteRepository.existsForCandidate.mockResolvedValue(false);

    await candidateService.remove(sri.id);

    expect(candidateRepository.remove).toHaveBeenCalledWith(sri);
  });

  it('keeps a candidate that already has votes', async () => {
    candidateRepository.findById.mockResolvedValue(mahendra);
    voteRepository.existsForCandidate.mockResolvedValue(true);

    await expect(candidateService.remove(mahendra.id)).rejects.toBeInstanceOf(ConflictError);
    expect(candidateRepository.remove).not.toHaveBeenCalled();
  });

  it('rejects an unknown candidate', async () => {
    candidateRepository.findById.mockResolvedValue(null);

    await expect(candidateService.remove('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
