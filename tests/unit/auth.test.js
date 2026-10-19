import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../src/auth/password.js';
import { signToken, verifyToken } from '../../src/auth/token.js';
import { hashVoteCode } from '../../src/auth/voteCode.js';
import { AuthenticationError, ForbiddenError } from '../../src/errors.js';
import * as userRepository from '../../src/repositories/users.js';
import * as voteRepository from '../../src/repositories/votes.js';
import * as authService from '../../src/services/auth.js';

vi.mock('../../src/repositories/users.js');
vi.mock('../../src/repositories/votes.js');

const VOTE_CODE = 'STRH-4826';
const PASSWORD = 'admin12345';

let siti;
let admin;

beforeEach(async () => {
  vi.resetAllMocks();
  siti = { _id: 'voter-1', id: 'voter-1', role: 'voter', status: 'active', voteCodeHash: await hashVoteCode(VOTE_CODE) };
  admin = { _id: 'admin-1', id: 'admin-1', role: 'admin', status: 'active', passwordHash: await hashPassword(PASSWORD) };
  voteRepository.findVotedAt.mockResolvedValue(null);
});

describe('authService.loginVoter', () => {
  it('starts a session for the right vote code', async () => {
    userRepository.findByEmail.mockResolvedValue(siti);

    const session = await authService.loginVoter({ email: 'siti@example.com', code: VOTE_CODE });

    expect(userRepository.findByEmail).toHaveBeenCalledWith('siti@example.com', 'voter');
    expect(verifyToken(session.token)).toBe(siti.id);
    expect(session).toMatchObject({ user: siti, votedAt: null });
  });

  it('gives the same answer for an unknown email and a wrong code', async () => {
    userRepository.findByEmail.mockResolvedValueOnce(null).mockResolvedValueOnce(siti);

    const unknown = authService.loginVoter({ email: 'ghost@example.com', code: VOTE_CODE });
    const wrong = authService.loginVoter({ email: 'siti@example.com', code: 'ABCD-EFGH' });

    await expect(unknown).rejects.toMatchObject({ name: 'AuthenticationError', message: 'Invalid email or vote code' });
    await expect(wrong).rejects.toMatchObject({ name: 'AuthenticationError', message: 'Invalid email or vote code' });
  });

  it('turns away a suspended voter', async () => {
    userRepository.findByEmail.mockResolvedValue({ ...siti, status: 'suspended' });

    await expect(authService.loginVoter({ email: 'siti@example.com', code: VOTE_CODE })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('authService.loginAdmin', () => {
  it('starts a session for the right password', async () => {
    userRepository.findByEmail.mockResolvedValue(admin);

    const session = await authService.loginAdmin({ email: 'admin@example.com', password: PASSWORD });

    expect(userRepository.findByEmail).toHaveBeenCalledWith('admin@example.com', 'admin');
    expect(verifyToken(session.token)).toBe(admin.id);
  });

  it('rejects a wrong password', async () => {
    userRepository.findByEmail.mockResolvedValue(admin);

    await expect(authService.loginAdmin({ email: 'admin@example.com', password: 'not-it-123' })).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });
});

describe('authService.authenticate', () => {
  beforeEach(() => {
    userRepository.isValidId.mockReturnValue(true);
  });

  it('returns the user the token belongs to', async () => {
    userRepository.findById.mockResolvedValue(siti);

    expect(await authService.authenticate(signToken(siti.id))).toBe(siti);
    expect(userRepository.findById).toHaveBeenCalledWith(siti.id);
  });

  it('rejects a token it did not sign', async () => {
    await expect(authService.authenticate('not-a-token')).rejects.toBeInstanceOf(AuthenticationError);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects the token of a deleted user', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(authService.authenticate(signToken(siti.id))).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('shuts out a suspended user straight away', async () => {
    userRepository.findById.mockResolvedValue({ ...siti, status: 'suspended' });

    await expect(authService.authenticate(signToken(siti.id))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
