import { ConflictError, DuplicateError, NotFoundError } from '../errors.js';
import * as candidateRepository from '../repositories/candidates.js';
import * as voteRepository from '../repositories/votes.js';

export async function list(viewer) {
  const candidates = await candidateRepository.list();
  if (viewer.role !== 'admin') {
    return candidates.map((candidate) => ({ candidate }));
  }

  const counts = await voteRepository.countByCandidate();
  return candidates.map((candidate) => ({ candidate, voteCount: counts.get(candidate.id) ?? 0 }));
}

export async function create(name) {
  try {
    return await candidateRepository.create(name);
  } catch (err) {
    if (err instanceof DuplicateError) {
      throw new ConflictError('A candidate with this name already exists');
    }
    throw err;
  }
}

export async function remove(id) {
  const candidate = await candidateRepository.findById(id);
  if (!candidate) {
    throw new NotFoundError('Candidate not found');
  }
  if (await voteRepository.existsForCandidate(candidate._id)) {
    throw new ConflictError('This candidate already has votes and cannot be removed');
  }

  await candidateRepository.remove(candidate);
}
