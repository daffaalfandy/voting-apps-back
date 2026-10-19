import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LockedError } from '../../src/errors.js';
import * as candidateRepository from '../../src/repositories/candidates.js';
import * as settingsRepository from '../../src/repositories/settings.js';
import * as voteRepository from '../../src/repositories/votes.js';
import * as electionService from '../../src/services/election.js';

vi.mock('../../src/repositories/candidates.js');
vi.mock('../../src/repositories/settings.js');
vi.mock('../../src/repositories/votes.js');

beforeEach(() => {
  vi.resetAllMocks();
  voteRepository.deleteAll.mockResolvedValue(3);
  candidateRepository.deleteWriteIns.mockResolvedValue(1);
});

describe('electionService.reset', () => {
  it('deletes every vote and write-in name while the system is unlocked', async () => {
    settingsRepository.get.mockResolvedValue({ locked: false });

    expect(await electionService.reset()).toEqual({ votesRemoved: 3, writeInsRemoved: 1 });
  });

  it('refuses while the election is running', async () => {
    settingsRepository.get.mockResolvedValue({ locked: true });

    await expect(electionService.reset()).rejects.toBeInstanceOf(LockedError);
    expect(voteRepository.deleteAll).not.toHaveBeenCalled();
    expect(candidateRepository.deleteWriteIns).not.toHaveBeenCalled();
  });
});
