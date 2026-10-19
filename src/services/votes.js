import { ConflictError, DuplicateError, LockedError, NotFoundError } from '../errors.js';
import * as candidateRepository from '../repositories/candidates.js';
import * as settingsRepository from '../repositories/settings.js';
import * as voteRepository from '../repositories/votes.js';

const ALREADY_VOTED = 'You have already voted';

export async function cast(voter, { candidateId, name }) {
  if (!(await settingsRepository.get()).locked) {
    throw new LockedError('Voting has not started yet. The election administrator is still preparing the election.');
  }
  if (await voteRepository.existsForUser(voter._id)) {
    throw new ConflictError(ALREADY_VOTED);
  }

  const candidate = candidateId
    ? await candidateRepository.findById(candidateId)
    : await candidateRepository.findOrCreateWriteIn(name);
  if (!candidate) {
    throw new NotFoundError('Candidate not found');
  }

  try {
    const vote = await voteRepository.create({ user: voter._id, candidate: candidate._id });
    return { candidate, createdAt: vote.createdAt };
  } catch (err) {
    if (err instanceof DuplicateError) {
      throw new ConflictError(ALREADY_VOTED);
    }
    throw err;
  }
}

export async function mine(voter) {
  const vote = await voteRepository.findByUser(voter._id);
  const candidate = vote ? await candidateRepository.findById(vote.candidate) : null;
  return vote && candidate ? { candidate, createdAt: vote.createdAt } : null;
}
