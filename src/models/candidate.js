import { Schema, model } from 'mongoose';
import { z } from 'zod';

export const normalizeName = (name) => name.normalize('NFKC').trim().replace(/\s+/g, ' ');

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

export const Candidate = model('Candidate', candidateSchema);

export function toPublicCandidate(candidate) {
  return { id: candidate.id, name: candidate.name, isWriteIn: candidate.isWriteIn };
}
