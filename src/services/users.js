import { hashPassword } from '../auth/password.js';
import { generateVoteCode, hashVoteCode } from '../auth/voteCode.js';
import { ConflictError, DuplicateError, NotFoundError, ValidationError } from '../errors.js';
import * as userRepository from '../repositories/users.js';
import * as voteRepository from '../repositories/votes.js';

export const VOTER_PASSWORD_MESSAGE = 'Voters sign in with a vote code, not a password';

async function rejectDuplicateEmail(write) {
  try {
    return await write();
  } catch (err) {
    if (err instanceof DuplicateError) {
      throw new ConflictError('A user with this email already exists');
    }
    throw err;
  }
}

async function findUser(id) {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}

export async function list({ search, voted }) {
  let users = await userRepository.list({ search });
  const votedAt = await voteRepository.votedAtByUsers(users.map((u) => u._id));

  if (voted === true) {
    users = users.filter((u) => votedAt.has(u.id));
  } else if (voted === false) {
    users = users.filter((u) => u.role === 'voter' && !votedAt.has(u.id));
  }

  return users.map((user) => ({ user, votedAt: votedAt.get(user.id) ?? null }));
}

export async function create({ name, email, role, password }) {
  const voteCode = role === 'voter' ? generateVoteCode() : undefined;

  const data = {
    name,
    email,
    role,
    passwordHash: password === undefined ? undefined : await hashPassword(password),
    voteCodeHash: voteCode === undefined ? undefined : await hashVoteCode(voteCode),
  };
  const user = await rejectDuplicateEmail(() => userRepository.create(data));

  return { user, voteCode };
}

export async function update(actor, id, changes) {
  const user = await findUser(id);

  if (user.id === actor.id && changes.status !== undefined && changes.status !== user.status) {
    throw new ValidationError('You cannot change your own status');
  }
  if (changes.password !== undefined && user.role !== 'admin') {
    throw new ValidationError(VOTER_PASSWORD_MESSAGE);
  }

  if (changes.name !== undefined) user.name = changes.name;
  if (changes.email !== undefined) user.email = changes.email;
  if (changes.status !== undefined) user.status = changes.status;
  if (changes.password !== undefined) user.passwordHash = await hashPassword(changes.password);
  await rejectDuplicateEmail(() => userRepository.save(user));

  return { user, votedAt: await voteRepository.findVotedAt(user._id) };
}

export async function issueVoteCode(id) {
  const user = await findUser(id);
  if (user.role !== 'voter') {
    throw new ValidationError('Only voters have vote codes; administrators use a password');
  }

  const voteCode = generateVoteCode();
  user.voteCodeHash = await hashVoteCode(voteCode);
  await userRepository.save(user);

  return voteCode;
}

export async function remove(actor, id) {
  if (id === actor.id) {
    throw new ValidationError('You cannot delete your own account');
  }

  const user = await userRepository.deleteById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  await voteRepository.deleteByUser(user._id);
}

export async function resetVote(id) {
  const deleted = await voteRepository.deleteByUser(id);
  if (deleted === 0) {
    throw new NotFoundError('This user has no vote to reset');
  }
}
