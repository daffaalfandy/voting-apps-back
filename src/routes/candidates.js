import { Router } from 'express';
import { z } from 'zod';
import { toPublicCandidate } from '../controllers/presenters.js';
import { ConflictError, DuplicateError, NotFoundError } from '../errors.js';
import { currentUser, requireRole } from '../middleware/auth.js';
import { requireUnlocked } from '../middleware/lock.js';
import { candidateNameSchema } from '../models/candidate.js';
import * as candidateRepository from '../repositories/candidates.js';
import * as voteRepository from '../repositories/votes.js';

const createSchema = z.object({ name: candidateNameSchema });

export const candidatesRouter = Router();

candidatesRouter.get('/', async (req, res) => {
  const candidates = await candidateRepository.list();

  if (currentUser(req).role !== 'admin') {
    res.json({ candidates: candidates.map(toPublicCandidate) });
    return;
  }

  const counts = await voteRepository.countByCandidate();
  res.json({
    candidates: candidates.map((c) => ({ ...toPublicCandidate(c), voteCount: counts.get(c.id) ?? 0 })),
  });
});

candidatesRouter.post('/', requireRole('admin'), requireUnlocked, async (req, res) => {
  const { name } = createSchema.parse(req.body);

  try {
    const candidate = await candidateRepository.create(name);
    res.status(201).json({ candidate: toPublicCandidate(candidate) });
  } catch (err) {
    if (err instanceof DuplicateError) {
      throw new ConflictError('A candidate with this name already exists');
    }
    throw err;
  }
});

candidatesRouter.delete('/:id', requireRole('admin'), requireUnlocked, async (req, res) => {
  const candidate = await candidateRepository.findById(req.params.id);
  if (!candidate) {
    throw new NotFoundError('Candidate not found');
  }
  if (await voteRepository.existsForCandidate(candidate._id)) {
    throw new ConflictError('This candidate already has votes and cannot be removed');
  }

  await candidateRepository.remove(candidate);
  res.status(204).end();
});
