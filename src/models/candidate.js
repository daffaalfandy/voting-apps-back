import { Schema, model } from 'mongoose';

export const normalizeName = (name) => name.normalize('NFKC').trim().replace(/\s+/g, ' ');

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
