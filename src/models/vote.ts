import { Schema, model, type Types } from 'mongoose';

const voteSchema = new Schema(
  {
    // Unique per user: the database, not application code, enforces one vote each.
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Vote = model('Vote', voteSchema);

export async function findVotedAt(userId: Types.ObjectId | string): Promise<Date | null> {
  const vote = await Vote.findOne({ user: userId }).select('createdAt').lean();
  return vote?.createdAt ?? null;
}
