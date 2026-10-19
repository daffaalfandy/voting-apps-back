import { Router } from 'express';
import { z } from 'zod';
import { toPublicCandidate } from '../controllers/presenters.js';
import { ConflictError, DuplicateError, LockedError, NotFoundError } from '../errors.js';
import { currentUser } from '../middleware/auth.js';
import { candidateNameSchema } from '../models/candidate.js';
import * as candidateRepository from '../repositories/candidates.js';
import * as settingsRepository from '../repositories/settings.js';
import * as voteRepository from '../repositories/votes.js';

const castSchema = z
  .object({
    candidateId: z.string().min(1).optional(),
    name: candidateNameSchema.optional(),
  })
  .refine((body) => (body.candidateId === undefined) !== (body.name === undefined), {
    message: 'Send either candidateId or a write-in name, not both',
  });

const ALREADY_VOTED = 'You have already voted';

export const votesRouter = Router();

votesRouter.post('/', async (req, res) => {
  const body = castSchema.parse(req.body);
  const me = currentUser(req);

  if (!(await settingsRepository.get()).locked) {
    throw new LockedError('Voting has not started yet. The election administrator is still preparing the election.');
  }
  if (await voteRepository.existsForUser(me._id)) {
    throw new ConflictError(ALREADY_VOTED);
  }

  const candidate = body.candidateId ? await candidateRepository.findById(body.candidateId) : await candidateRepository.findOrCreateWriteIn(body.name);
  if (!candidate) {
    throw new NotFoundError('Candidate not found');
  }

  try {
    const vote = await voteRepository.create({ user: me._id, candidate: candidate._id });
    res.status(201).json({ vote: { candidate: toPublicCandidate(candidate), createdAt: vote.createdAt } });
  } catch (err) {
    if (err instanceof DuplicateError) {
      throw new ConflictError(ALREADY_VOTED);
    }
    throw err;
  }
});

votesRouter.get('/me', async (req, res) => {
  const vote = await voteRepository.findByUser(currentUser(req)._id);
  const candidate = vote ? await candidateRepository.findById(vote.candidate) : null;

  res.json({
    vote: vote && candidate ? { candidate: toPublicCandidate(candidate), createdAt: vote.createdAt } : null,
  });
});
