import mongoose from 'mongoose';
import { DuplicateError, isDuplicateKeyError } from '../errors.js';
import { User } from '../models/user.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function rejectDuplicate(write) {
  try {
    return await write();
  } catch (err) {
    throw isDuplicateKeyError(err) ? new DuplicateError() : err;
  }
}

export const isValidId = (id) => mongoose.isValidObjectId(id);

export const findById = (id) => User.findById(id);

export const findByEmail = (email, role) => User.findOne({ email, role });

export const findByIds = (ids) => User.find({ _id: { $in: ids } });

export function list({ search }) {
  const filter = search ? { $or: [{ name: new RegExp(escapeRegex(search), 'i') }, { email: new RegExp(escapeRegex(search), 'i') }] } : {};
  return User.find(filter).collation({ locale: 'en' }).sort({ name: 1 });
}

export async function findActiveVoterIds() {
  const voters = await User.find({ role: 'voter', status: 'active' }).select('_id').lean();
  return voters.map((voter) => voter._id);
}

export const exists = async () => (await User.exists({})) !== null;

export const create = (data) => rejectDuplicate(() => User.create(data));

export const insertMany = (users) => User.insertMany(users);

export const save = (user) => rejectDuplicate(() => user.save());

export const deleteById = (id) => User.findByIdAndDelete(id);
