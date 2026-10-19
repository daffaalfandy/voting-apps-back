import { Schema, model } from 'mongoose';

export const USER_ROLES = ['admin', 'voter'];
export const USER_STATUSES = ['active', 'suspended'];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    voteCodeHash: { type: String },
    role: { type: String, enum: USER_ROLES, required: true, default: 'voter' },
    status: { type: String, enum: USER_STATUSES, required: true, default: 'active' },
  },
  { timestamps: true },
);

userSchema.pre('validate', function () {
  if (this.role === 'admin' && !this.passwordHash) {
    this.invalidate('passwordHash', 'Administrators need a password');
  }
  if (this.role === 'voter' && !this.voteCodeHash) {
    this.invalidate('voteCodeHash', 'Voters need a vote code');
  }
});

export const User = model('User', userSchema);
