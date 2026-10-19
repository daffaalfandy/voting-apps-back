import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyPassword } from '../../src/auth/password.js';
import { verifyVoteCode } from '../../src/auth/voteCode.js';
import { DuplicateError, NotFoundError, ValidationError } from '../../src/errors.js';
import * as userRepository from '../../src/repositories/users.js';
import * as voteRepository from '../../src/repositories/votes.js';
import * as userService from '../../src/services/users.js';

vi.mock('../../src/repositories/users.js');
vi.mock('../../src/repositories/votes.js');

const admin = { _id: 'admin-1', id: 'admin-1', role: 'admin', status: 'active' };
const votedAt = new Date('2026-10-15T09:42:00Z');

let siti;
let dimas;

beforeEach(() => {
  vi.resetAllMocks();
  siti = { _id: 'voter-1', id: 'voter-1', name: 'Siti Rahayu', role: 'voter', status: 'active' };
  dimas = { _id: 'voter-2', id: 'voter-2', name: 'Dimas Pratama', role: 'voter', status: 'active' };
  userRepository.list.mockResolvedValue([admin, dimas, siti]);
  userRepository.findById.mockImplementation(async (id) => [admin, dimas, siti].find((u) => u.id === id) ?? null);
  userRepository.create.mockImplementation(async (data) => ({ id: 'new-user', ...data }));
  voteRepository.votedAtByUsers.mockResolvedValue(new Map([[siti.id, votedAt]]));
  voteRepository.findVotedAt.mockResolvedValue(null);
});

describe('userService.list', () => {
  it('pairs every user with when they voted', async () => {
    const rows = await userService.list({ search: 'a' });

    expect(userRepository.list).toHaveBeenCalledWith({ search: 'a' });
    expect(rows).toEqual([
      { user: admin, votedAt: null },
      { user: dimas, votedAt: null },
      { user: siti, votedAt },
    ]);
  });

  it('keeps only users who voted', async () => {
    const rows = await userService.list({ voted: true });

    expect(rows.map((row) => row.user)).toEqual([siti]);
  });

  it('keeps only voters who have not voted, leaving administrators out', async () => {
    const rows = await userService.list({ voted: false });

    expect(rows.map((row) => row.user)).toEqual([dimas]);
  });
});

describe('userService.create', () => {
  it('gives a new voter a vote code and no password', async () => {
    const { user, voteCode } = await userService.create({ name: 'Ayu Wulandari', email: 'ayu@example.com', role: 'voter' });

    expect(voteCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(user.passwordHash).toBeUndefined();
    expect(await verifyVoteCode(voteCode, user.voteCodeHash)).toBe(true);
  });

  it('gives a new administrator a hashed password and no vote code', async () => {
    const { user, voteCode } = await userService.create({
      name: 'Dewi Anggraini',
      email: 'admin2@example.com',
      role: 'admin',
      password: 'secret-pass',
    });

    expect(voteCode).toBeUndefined();
    expect(user.voteCodeHash).toBeUndefined();
    expect(await verifyPassword('secret-pass', user.passwordHash)).toBe(true);
  });

  it('explains an email that is already taken', async () => {
    userRepository.create.mockRejectedValue(new DuplicateError());

    await expect(userService.create({ name: 'Ayu Wulandari', email: 'ayu@example.com', role: 'voter' })).rejects.toMatchObject({
      name: 'ConflictError',
      message: 'A user with this email already exists',
    });
  });
});

describe('userService.update', () => {
  it('applies the changes and saves the user', async () => {
    const { user } = await userService.update(admin, siti.id, { name: 'Siti R.', status: 'suspended' });

    expect(user).toMatchObject({ name: 'Siti R.', status: 'suspended' });
    expect(userRepository.save).toHaveBeenCalledWith(siti);
  });

  it('does not let administrators change their own status', async () => {
    await expect(userService.update(admin, admin.id, { status: 'suspended' })).rejects.toBeInstanceOf(ValidationError);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('does not give voters a password', async () => {
    await expect(userService.update(admin, siti.id, { password: 'secret-pass' })).rejects.toMatchObject({
      name: 'ValidationError',
      message: userService.VOTER_PASSWORD_MESSAGE,
    });
  });

  it('rejects an unknown user', async () => {
    await expect(userService.update(admin, 'missing', { name: 'Gita Purnama' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('userService.issueVoteCode', () => {
  it('replaces the vote code of a voter', async () => {
    const voteCode = await userService.issueVoteCode(siti.id);

    expect(await verifyVoteCode(voteCode, siti.voteCodeHash)).toBe(true);
    expect(userRepository.save).toHaveBeenCalledWith(siti);
  });

  it('refuses administrators, who sign in with a password', async () => {
    await expect(userService.issueVoteCode(admin.id)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('userService.remove', () => {
  it('deletes the user and their vote', async () => {
    userRepository.deleteById.mockResolvedValue(siti);

    await userService.remove(admin, siti.id);

    expect(voteRepository.deleteByUser).toHaveBeenCalledWith(siti._id);
  });

  it('does not let administrators delete themselves', async () => {
    await expect(userService.remove(admin, admin.id)).rejects.toBeInstanceOf(ValidationError);
    expect(userRepository.deleteById).not.toHaveBeenCalled();
  });

  it('rejects an unknown user', async () => {
    userRepository.deleteById.mockResolvedValue(null);

    await expect(userService.remove(admin, 'missing')).rejects.toBeInstanceOf(NotFoundError);
    expect(voteRepository.deleteByUser).not.toHaveBeenCalled();
  });
});

describe('userService.resetVote', () => {
  it('clears the vote', async () => {
    voteRepository.deleteByUser.mockResolvedValue(1);

    await expect(userService.resetVote(siti.id)).resolves.toBeUndefined();
  });

  it('reports a user who has no vote', async () => {
    voteRepository.deleteByUser.mockResolvedValue(0);

    await expect(userService.resetVote(dimas.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
