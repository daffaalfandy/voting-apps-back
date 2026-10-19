import { z } from 'zod';
import { currentUser } from '../middleware/auth.js';
import { candidateNameSchema } from '../schemas.js';
import * as candidateService from '../services/candidates.js';
import { toPublicCandidate } from './presenters.js';

const createSchema = z.object({ name: candidateNameSchema });

export async function list(req, res) {
  const rows = await candidateService.list(currentUser(req));
  res.json({
    candidates: rows.map(({ candidate, voteCount }) =>
      voteCount === undefined ? toPublicCandidate(candidate) : { ...toPublicCandidate(candidate), voteCount },
    ),
  });
}

export async function create(req, res) {
  const { name } = createSchema.parse(req.body);
  res.status(201).json({ candidate: toPublicCandidate(await candidateService.create(name)) });
}

export async function remove(req, res) {
  await candidateService.remove(req.params.id);
  res.status(204).end();
}
