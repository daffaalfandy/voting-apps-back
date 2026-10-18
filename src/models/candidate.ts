import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { z } from 'zod';
import { isDuplicateKeyError } from '../errors.js';

export const normalizeName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ');

// Letters in any script plus combining marks, spaces and . ' - so "Dr. Zoë O'Brien-Núñez" passes.
export const candidateNameSchema = z
  .string()
  .transform(normalizeName)
  .pipe(
    z
      .string()
      .min(2)
      .max(80)
      .regex(/^[\p{L}\p{M} .'-]+$/u, "Use letters, spaces and . ' - only")
      .regex(/\p{L}/u, 'Include at least one letter'),
  );

const candidateSchema = new Schema(
  {
    name: { type: String, required: true },
    // Lowercased, space-collapsed name; the unique index stops "marcus  CHEN" duplicating "Marcus Chen".
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

/** Returns the candidate whose normalized name matches, creating a write-in candidate if none does. */
export async function findOrCreateWriteIn(name: string): Promise<CandidateDoc> {
  const displayName = normalizeName(name);
  const normalizedName = displayName.toLowerCase();
  const upsert = () =>
    Candidate.findOneAndUpdate(
      { normalizedName },
      { $setOnInsert: { name: displayName, normalizedName, isWriteIn: true } },
      { upsert: true, new: true },
    ).orFail();

  try {
    return await upsert();
  } catch (err) {
    // Two concurrent upserts can both miss and race on the unique index; the retry finds the winner.
    if (isDuplicateKeyError(err)) {
      return upsert();
    }
    throw err;
  }
}

export function toPublicCandidate(candidate: CandidateDoc) {
  return { id: candidate.id as string, name: candidate.name, isWriteIn: candidate.isWriteIn };
}
