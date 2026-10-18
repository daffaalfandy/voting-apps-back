import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Candidate } from '../src/models/candidate.js';
import { getSettings } from '../src/models/setting.js';
import { User } from '../src/models/user.js';
import { Vote } from '../src/models/vote.js';
import { DEMO_VOTERS, seedDatabase } from '../src/seed.js';
import { app, createUser } from './helpers.js';

const admin = { name: 'Arthur Vance', email: 'admin@example.com', password: 'admin12345' };

describe('seedDatabase', () => {
  it('creates the administrator on an empty database', async () => {
    const seeded = await seedDatabase({ admin, demo: false });

    expect(seeded).toBe(true);
    expect(await User.countDocuments()).toBe(1);
    const login = await request(app).post('/api/auth/admin/login').send({ email: admin.email, password: admin.password });
    expect(login.body.user.role).toBe('admin');
  });

  it('adds demo voters, candidates and votes when asked', async () => {
    await seedDatabase({ admin, demo: true });

    expect(await User.countDocuments({ role: 'voter' })).toBe(4);
    expect(await Candidate.countDocuments()).toBe(3);
    expect(await Vote.countDocuments()).toBe(2);
    const [sarah] = DEMO_VOTERS;
    const login = await request(app).post('/api/auth/login').send({ email: sarah!.email, code: sarah!.code });
    expect(login.status).toBe(200);
  });

  it('leaves a database that already has users alone', async () => {
    await createUser();

    const seeded = await seedDatabase({ admin, demo: true });

    expect(seeded).toBe(false);
    expect(await User.countDocuments()).toBe(1);
    expect(await Candidate.countDocuments()).toBe(0);
  });

  it('is safe to run twice', async () => {
    await seedDatabase({ admin, demo: true });
    await seedDatabase({ admin, demo: true });

    expect(await User.countDocuments()).toBe(5);
    expect(await Vote.countDocuments()).toBe(2);
  });
});

describe('seeded election state', () => {
  it('starts the demo election running, since it already holds votes', async () => {
    await seedDatabase({ admin, demo: true });

    expect(await getSettings()).toEqual({ locked: true });
  });

  it('leaves a fresh install unlocked for preparation', async () => {
    await seedDatabase({ admin, demo: false });

    expect(await getSettings()).toEqual({ locked: false });
  });
});
