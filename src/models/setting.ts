import { Schema, model } from 'mongoose';

const SYSTEM_KEY = 'system';

const settingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  locked: { type: Boolean, required: true, default: false },
});

export const Setting = model('Setting', settingSchema);

export interface SystemSettings {
  locked: boolean;
}

export async function getSettings(): Promise<SystemSettings> {
  const doc = await Setting.findOne({ key: SYSTEM_KEY }).lean();
  return { locked: doc?.locked ?? false };
}

export async function updateSettings(changes: SystemSettings): Promise<SystemSettings> {
  const doc = await Setting.findOneAndUpdate({ key: SYSTEM_KEY }, { $set: changes }, { upsert: true, new: true }).lean();
  return { locked: doc!.locked };
}
