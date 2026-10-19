import { hashPassword } from './auth/password.js';
import { hashVoteCode } from './auth/voteCode.js';
import { Candidate } from './models/candidate.js';
import { updateSettings } from './models/setting.js';
import { User } from './models/user.js';
import { Vote } from './models/vote.js';

export const DEMO_VOTERS = [
  { name: 'Sarah Jenkins', email: 'sarah@example.com', code: 'SRJN-4826' },
  { name: 'David Kim', email: 'david@example.com', code: 'DVKM-7395' },
  { name: 'Elena Rostova', email: 'elena@example.com', code: 'ERST-5942' },
  { name: 'Amara Okafor', email: 'amara@example.com', code: 'AMRA-2683' },
];

const DEMO_CANDIDATES = ['Dr. Evelyn Reed', 'Marcus Chen', 'Sofia Rodriguez'];

const DEMO_VOTES = [
  { voter: 'elena@example.com', candidate: 'Dr. Evelyn Reed' },
  { voter: 'amara@example.com', candidate: 'Marcus Chen' },
];

export async function seedDatabase({ admin, demo }) {
  if (await User.exists({})) {
    return false;
  }

  await User.create({ name: admin.name, email: admin.email, role: 'admin', passwordHash: await hashPassword(admin.password) });
  if (!demo) {
    return true;
  }

  const voters = await User.insertMany(
    await Promise.all(
      DEMO_VOTERS.map(async ({ name, email, code }) => ({ name, email, role: 'voter', voteCodeHash: await hashVoteCode(code) })),
    ),
  );
  const candidates = await Candidate.create(DEMO_CANDIDATES.map((name) => ({ name })));

  await Vote.insertMany(
    DEMO_VOTES.map(({ voter, candidate }) => ({
      user: voters.find((v) => v.email === voter)._id,
      candidate: candidates.find((c) => c.name === candidate)._id,
    })),
  );
  await updateSettings({ locked: true });
  return true;
}
