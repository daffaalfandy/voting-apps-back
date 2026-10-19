import { Schema, model } from 'mongoose';

const voteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Vote = model('Vote', voteSchema);
