import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { z } from 'zod';

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

export function toPublicCandidate(candidate: CandidateDoc) {
  return { id: candidate.id as string, name: candidate.name, isWriteIn: candidate.isWriteIn };
}
