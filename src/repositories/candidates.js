import { DuplicateError, isDuplicateKeyError } from '../errors.js';
import { Candidate, normalizeName } from '../models/candidate.js';

export const list = () => Candidate.find().collation({ locale: 'en' }).sort({ name: 1 });

export const findById = (id) => Candidate.findById(id);

export async function create(name) {
  try {
    return await Candidate.create({ name });
  } catch (err) {
    throw isDuplicateKeyError(err) ? new DuplicateError() : err;
  }
}

export const createMany = (names) => Candidate.create(names.map((name) => ({ name })));

export async function findOrCreateWriteIn(name) {
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

export async function remove(candidate) {
  await candidate.deleteOne();
}

export async function deleteWriteIns() {
  const { deletedCount } = await Candidate.deleteMany({ isWriteIn: true });
  return deletedCount;
}
