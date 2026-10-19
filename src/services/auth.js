import { verifyPassword } from '../auth/password.js';
import { signToken, verifyToken } from '../auth/token.js';
import { verifyVoteCode } from '../auth/voteCode.js';
import { AuthenticationError, ForbiddenError } from '../errors.js';
import * as userRepository from '../repositories/users.js';
import * as voteRepository from '../repositories/votes.js';

const INVALID_TOKEN = 'Invalid or expired token';

function assertActive(user) {
  if (user.status === 'suspended') {
    throw new ForbiddenError('This account is suspended. Contact the election administrator.');
  }
}

async function startSession(user) {
  assertActive(user);
  return { token: signToken(user.id), ...(await profile(user)) };
}

export async function authenticate(token) {
  let userId;
  try {
    userId = verifyToken(token);
  } catch {
    throw new AuthenticationError(INVALID_TOKEN);
  }

  const user = userRepository.isValidId(userId) ? await userRepository.findById(userId) : null;
  if (!user) {
    throw new AuthenticationError(INVALID_TOKEN);
  }
  assertActive(user);
  return user;
}

export async function loginVoter({ email, code }) {
  const user = await userRepository.findByEmail(email, 'voter');
  const codeOk = await verifyVoteCode(code, user?.voteCodeHash);
  if (!user || !codeOk) {
    throw new AuthenticationError('Invalid email or vote code');
  }
  return startSession(user);
}

export async function loginAdmin({ email, password }) {
  const user = await userRepository.findByEmail(email, 'admin');
  const passwordOk = await verifyPassword(password, user?.passwordHash);
  if (!user || !passwordOk) {
    throw new AuthenticationError('Invalid email or password');
  }
  return startSession(user);
}

export async function profile(user) {
  return { user, votedAt: await voteRepository.findVotedAt(user._id) };
}
