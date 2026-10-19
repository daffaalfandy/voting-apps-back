import { Router } from 'express';
import { z } from 'zod';
import { ConflictError, NotFoundError, isDuplicateKeyError } from '../errors.js';
import { currentUser, requireRole } from '../middleware/auth.js';
import { requireUnlocked } from '../middleware/lock.js';
import { Candidate, candidateNameSchema, toPublicCandidate } from '../models/candidate.js';
import { Vote, countVotesByCandidate } from '../models/vote.js';

const createSchema = z.object({ name: candidateNameSchema });

export const candidatesRouter = Router();

candidatesRouter.get('/', async (req, res) => {
  const candidates = await Candidate.find().collation({ locale: 'en' }).sort({ name: 1 });

  if (currentUser(req).role !== 'admin') {
    res.json({ candidates: candidates.map(toPublicCandidate) });
    return;
  }

  const counts = await countVotesByCandidate();
  res.json({
    candidates: candidates.map((c) => ({ ...toPublicCandidate(c), voteCount: counts.get(c.id) ?? 0 })),
  });
});

candidatesRouter.post('/', requireRole('admin'), requireUnlocked, async (req, res) => {
  const { name } = createSchema.parse(req.body);

  try {
    const candidate = await Candidate.create({ name });
    res.status(201).json({ candidate: toPublicCandidate(candidate) });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError('A candidate with this name already exists');
    }
    throw err;
  }
});

candidatesRouter.delete('/:id', requireRole('admin'), requireUnlocked, async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) {
    throw new NotFoundError('Candidate not found');
  }
  if (await Vote.exists({ candidate: candidate._id })) {
    throw new ConflictError('This candidate already has votes and cannot be removed');
  }

  await candidate.deleteOne();
  res.status(204).end();
});
