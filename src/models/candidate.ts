import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { z } from 'zod';
import { isDuplicateKeyError } from '../errors.js';

export const normalizeName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ');

export const candidateNameSchema = z
  .string({ error: 'Name is required' })
  .transform(normalizeName)
  .pipe(
    z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be at most 80 characters')
      .regex(/^[\p{L}\p{M} .'-]+$/u, "Use letters, spaces and . ' - only")
      .regex(/\p{L}/u, 'Include at least one letter'),
  );

const candidateSchema = new Schema(
  {
    name: { type: String, required: true },
    normalizedName: { type: String, required: true, unique: true },
    isWriteIn: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

candidateSchema.pre('validate', function () {
  if (typeof this.name === 'string') {
    this.name = normalizeName(this.name);
    this.normalizedName = this.name.toLowerCase();
  }
});

export type CandidateDoc = HydratedDocument<InferSchemaType<typeof candidateSchema>>;

export const Candidate = model('Candidate', candidateSchema);

export async function findOrCreateWriteIn(name: string): Promise<CandidateDoc> {
  const displayName = normalizeName(name);
  const normalizedName = displayName.toLowerCase();
  const upsert = () =>
    Candidate.findOneAndUpdate(
      { normalizedName },
      { $setOnInsert: { name: displayName, normalizedName, isWriteIn: true } },
      { upsert: true, returnDocument: 'after' },
    ).orFail();

  try {
    return await upsert();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return upsert();
    }
    throw err;
  }
}

export function toPublicCandidate(candidate: CandidateDoc) {
  return { id: candidate.id as string, name: candidate.name, isWriteIn: candidate.isWriteIn };
}
