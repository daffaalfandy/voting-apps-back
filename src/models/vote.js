import { Schema, model } from 'mongoose';

const voteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Vote = model('Vote', voteSchema);

export async function findVotedAt(userId) {
  const vote = await Vote.findOne({ user: userId }).select('createdAt').lean();
  return vote?.createdAt ?? null;
}

export async function countVotesByCandidate() {
  const rows = await Vote.aggregate([{ $group: { _id: '$candidate', count: { $sum: 1 } } }]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}
