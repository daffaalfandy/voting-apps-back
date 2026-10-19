import { Schema, model } from 'mongoose';

const settingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  locked: { type: Boolean, required: true, default: false },
});

export const Setting = model('Setting', settingSchema);
