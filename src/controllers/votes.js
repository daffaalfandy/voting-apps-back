import { z } from 'zod';
import { currentUser } from '../middleware/auth.js';
import { candidateNameSchema } from '../schemas.js';
import * as voteService from '../services/votes.js';
import { toPublicVote } from './presenters.js';

const castSchema = z
  .object({
    candidateId: z.string().min(1).optional(),
    name: candidateNameSchema.optional(),
  })
  .refine((body) => (body.candidateId === undefined) !== (body.name === undefined), {
    message: 'Send either candidateId or a write-in name, not both',
  });

export async function cast(req, res) {
  const input = castSchema.parse(req.body);
  const vote = await voteService.cast(currentUser(req), input);
  res.status(201).json({ vote: toPublicVote(vote) });
}

export async function mine(req, res) {
  const vote = await voteService.mine(currentUser(req));
  res.json({ vote: vote && toPublicVote(vote) });
}
