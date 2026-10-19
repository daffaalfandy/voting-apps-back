import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as userRepository from '../../src/repositories/users.js';
import * as voteRepository from '../../src/repositories/votes.js';
import * as participationService from '../../src/services/participation.js';

vi.mock('../../src/repositories/users.js');
vi.mock('../../src/repositories/votes.js');

const ayu = { id: 'voter-1', name: 'Ayu Wulandari' };
const eka = { id: 'voter-2', name: 'Eka Purnamasari' };
const later = new Date('2026-10-15T11:20:00Z');
const earlier = new Date('2026-10-15T09:42:00Z');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('participationService.list', () => {
  it('lists voters newest first and skips votes of deleted users', async () => {
    voteRepository.listRecent.mockResolvedValue([
      { user: ayu.id, createdAt: later },
      { user: 'deleted-user', createdAt: later },
      { user: eka.id, createdAt: earlier },
    ]);
    userRepository.findByIds.mockResolvedValue([eka, ayu]);

    expect(await participationService.list()).toEqual([
      { user: ayu, votedAt: later },
      { user: eka, votedAt: earlier },
    ]);
    expect(userRepository.findByIds).toHaveBeenCalledWith([ayu.id, 'deleted-user', eka.id]);
  });
});
