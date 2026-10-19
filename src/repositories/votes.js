import { DuplicateError, isDuplicateKeyError } from '../errors.js';
import { Vote } from '../models/vote.js';

export const existsForUser = async (userId) => (await Vote.exists({ user: userId })) !== null;

export const existsForCandidate = async (candidateId) => (await Vote.exists({ candidate: candidateId })) !== null;

export const findByUser = (userId) => Vote.findOne({ user: userId });

export async function findVotedAt(userId) {
  const vote = await Vote.findOne({ user: userId }).select('createdAt').lean();
  return vote?.createdAt ?? null;
}

export async function votedAtByUsers(userIds) {
  const votes = await Vote.find({ user: { $in: userIds } }).select('user createdAt').lean();
  return new Map(votes.map((vote) => [String(vote.user), vote.createdAt]));
}

export const listRecent = () => Vote.find().sort({ createdAt: -1 }).select('user createdAt').lean();

export const countByUsers = (userIds) => Vote.countDocuments({ user: { $in: userIds } });

export async function countByCandidate() {
  const rows = await Vote.aggregate([{ $group: { _id: '$candidate', count: { $sum: 1 } } }]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function create(vote) {
  try {
    return await Vote.create(vote);
  } catch (err) {
    throw isDuplicateKeyError(err) ? new DuplicateError() : err;
  }
}

export const insertMany = (votes) => Vote.insertMany(votes);

export async function deleteByUser(userId) {
  const { deletedCount } = await Vote.deleteMany({ user: userId });
  return deletedCount;
}

export async function deleteAll() {
  const { deletedCount } = await Vote.deleteMany({});
  return deletedCount;
}
