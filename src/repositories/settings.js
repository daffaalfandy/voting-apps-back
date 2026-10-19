import { Setting } from '../models/setting.js';

const SYSTEM_KEY = 'system';

export async function get() {
  const doc = await Setting.findOne({ key: SYSTEM_KEY }).lean();
  return { locked: doc?.locked ?? false };
}

export async function update(changes) {
  const doc = await Setting.findOneAndUpdate({ key: SYSTEM_KEY }, { $set: changes }, { upsert: true, returnDocument: 'after' }).lean();
  return { locked: doc.locked };
}
