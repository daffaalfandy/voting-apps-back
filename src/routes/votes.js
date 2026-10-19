import { Router } from 'express';
import { z } from 'zod';
import { ConflictError, LockedError, NotFoundError, isDuplicateKeyError } from '../errors.js';
import { currentUser } from '../middleware/auth.js';
import { Candidate, candidateNameSchema, findOrCreateWriteIn, toPublicCandidate } from '../models/candidate.js';
import { getSettings } from '../models/setting.js';
import { Vote } from '../models/vote.js';

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

  if (!(await getSettings()).locked) {
    throw new LockedError('Voting has not started yet. The election administrator is still preparing the election.');
  }
  if (await Vote.exists({ user: me._id })) {
    throw new ConflictError(ALREADY_VOTED);
  }

  const candidate = body.candidateId ? await Candidate.findById(body.candidateId) : await findOrCreateWriteIn(body.name);
  if (!candidate) {
    throw new NotFoundError('Candidate not found');
  }

  try {
    const vote = await Vote.create({ user: me._id, candidate: candidate._id });
    res.status(201).json({ vote: { candidate: toPublicCandidate(candidate), createdAt: vote.createdAt } });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError(ALREADY_VOTED);
    }
    throw err;
  }
});

votesRouter.get('/me', async (req, res) => {
  const vote = await Vote.findOne({ user: currentUser(req)._id });
  const candidate = vote ? await Candidate.findById(vote.candidate) : null;

  res.json({
    vote: vote && candidate ? { candidate: toPublicCandidate(candidate), createdAt: vote.createdAt } : null,
  });
});
