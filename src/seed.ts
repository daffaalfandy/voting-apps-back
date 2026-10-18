import { hashPassword } from './auth/password.js';
import { Candidate } from './models/candidate.js';
import { User } from './models/user.js';
import { Vote } from './models/vote.js';

export const DEMO_VOTER_PASSWORD = 'voter12345';

const DEMO_VOTERS = [
  { name: 'Sarah Jenkins', email: 'sarah@example.com' },
  { name: 'David Kim', email: 'david@example.com' },
  { name: 'Elena Rostova', email: 'elena@example.com' },
  { name: 'Amara Okafor', email: 'amara@example.com' },
];

const DEMO_CANDIDATES = ['Dr. Evelyn Reed', 'Marcus Chen', 'Sofia Rodriguez'];

const DEMO_VOTES = [
  { voter: 'elena@example.com', candidate: 'Dr. Evelyn Reed' },
  { voter: 'amara@example.com', candidate: 'Marcus Chen' },
];

interface SeedOptions {
  admin: { name: string; email: string; password: string };
  demo: boolean;
}

/** Seeds only an empty database, so restarts never duplicate or overwrite data. Returns whether it seeded. */
export async function seedDatabase({ admin, demo }: SeedOptions): Promise<boolean> {
  if (await User.exists({})) {
    return false;
  }

  await User.create({ name: admin.name, email: admin.email, role: 'admin', passwordHash: await hashPassword(admin.password) });
  if (!demo) {
    return true;
  }

  const voterHash = await hashPassword(DEMO_VOTER_PASSWORD);
  const voters = await User.insertMany(DEMO_VOTERS.map((v) => ({ ...v, role: 'voter', passwordHash: voterHash })));
  const candidates = await Candidate.create(DEMO_CANDIDATES.map((name) => ({ name })));

  await Vote.insertMany(
    DEMO_VOTES.map(({ voter, candidate }) => ({
      user: voters.find((v) => v.email === voter)!._id,
      candidate: candidates.find((c) => c.name === candidate)!._id,
    })),
  );
  return true;
}
