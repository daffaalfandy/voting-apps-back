import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const USER_ROLES = ['admin', 'voter'] as const;
export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

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

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = model('User', userSchema);

export function toPublicUser(user: UserDoc, votedAt: Date | null) {
  return {
    id: user.id as string,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    hasVoted: votedAt !== null,
    votedAt,
    createdAt: user.createdAt,
  };
}
