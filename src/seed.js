import { hashPassword } from './auth/password.js';
import { hashVoteCode } from './auth/voteCode.js';
import * as candidateRepository from './repositories/candidates.js';
import * as settingsRepository from './repositories/settings.js';
import * as userRepository from './repositories/users.js';
import * as voteRepository from './repositories/votes.js';

export const DEMO_VOTERS = [
  { name: 'Siti Rahayu', email: 'siti@example.com', code: 'STRH-4826' },
  { name: 'Dimas Pratama', email: 'dimas@example.com', code: 'DMPR-7395' },
  { name: 'Eka Purnamasari', email: 'eka@example.com', code: 'EKPS-5942' },
  { name: 'Ayu Wulandari', email: 'ayu@example.com', code: 'AYWD-2683' },
];

const DEMO_CANDIDATES = ['Dr. Endang Kusumawati', 'Mahendra Wijaya', 'Sri Wahyuni'];

const DEMO_VOTES = [
  { voter: 'eka@example.com', candidate: 'Dr. Endang Kusumawati' },
  { voter: 'ayu@example.com', candidate: 'Mahendra Wijaya' },
];

export async function seedDatabase({ admin, demo }) {
  if (await userRepository.exists()) {
    return false;
  }

  await userRepository.create({ name: admin.name, email: admin.email, role: 'admin', passwordHash: await hashPassword(admin.password) });
  if (!demo) {
    return true;
  }

  const voters = await userRepository.insertMany(
    await Promise.all(
      DEMO_VOTERS.map(async ({ name, email, code }) => ({ name, email, role: 'voter', voteCodeHash: await hashVoteCode(code) })),
    ),
  );
  const candidates = await candidateRepository.createMany(DEMO_CANDIDATES);

  await voteRepository.insertMany(
    DEMO_VOTES.map(({ voter, candidate }) => ({
      user: voters.find((v) => v.email === voter)._id,
      candidate: candidates.find((c) => c.name === candidate)._id,
    })),
  );
  await settingsRepository.update({ locked: true });
  return true;
}
