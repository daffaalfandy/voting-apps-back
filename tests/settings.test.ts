import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Candidate, type CandidateDoc } from '../src/models/candidate.js';
import { Vote } from '../src/models/vote.js';
import { app, bearer, createAdmin, createUser } from './helpers.js';

let adminToken: string;
let voter: Awaited<ReturnType<typeof createUser>>;
let candidate: CandidateDoc;

beforeEach(async () => {
  adminToken = (await createAdmin()).token;
  voter = await createUser();
  candidate = await Candidate.create({ name: 'Marcus Chen' });
});

const setLocked = (locked: boolean) => request(app).put('/api/settings').set(bearer(adminToken)).send({ locked });

describe('GET/PUT /api/settings', () => {
  it('starts unlocked', async () => {
    const res = await request(app).get('/api/settings').set(bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.settings).toEqual({ locked: false });
  });

  it('persists the lock state', async () => {
    const put = await setLocked(true);
    const get = await request(app).get('/api/settings').set(bearer(adminToken));

    expect(put.status).toBe(200);
    expect(put.body.settings).toEqual({ locked: true });
    expect(get.body.settings).toEqual({ locked: true });
  });

  it('rejects a non-boolean lock value', async () => {
    const res = await request(app).put('/api/settings').set(bearer(adminToken)).send({ locked: 'yes' });

    expect(res.status).toBe(400);
  });

  it('lets voters read the lock state but only admins change it', async () => {
    const get = await request(app).get('/api/settings').set(bearer(voter.token));
    const put = await request(app).put('/api/settings').set(bearer(voter.token)).send({ locked: true });

    expect(get.status).toBe(200);
    expect(get.body.settings).toEqual({ locked: false });
    expect(put.status).toBe(403);
  });

  it('requires sign-in to read the lock state', async () => {
    const res = await request(app).get('/api/settings');

    expect(res.status).toBe(401);
  });
});

describe('while the system is unlocked (preparing the election)', () => {
  it('refuses votes, including write-ins, with 423', async () => {
    const other = await createUser();

    const byId = await request(app).post('/api/votes').set(bearer(voter.token)).send({ candidateId: candidate.id });
    const writeIn = await request(app).post('/api/votes').set(bearer(other.token)).send({ name: 'Jane Doe' });

    expect(byId.status).toBe(423);
    expect(byId.body.error.message).toMatch(/voting has not started/i);
    expect(writeIn.status).toBe(423);
    expect(await Vote.countDocuments()).toBe(0);
    expect(await Candidate.countDocuments({ name: 'Jane Doe' })).toBe(0);
  });
});

describe('while the system is locked', () => {
  beforeEach(async () => {
    await setLocked(true);
  });

  const guarded = [
    { label: 'create user', send: () => request(app).post('/api/users').send({ name: 'New Voter', email: 'new@example.com', password: 'secret-pass' }) },
    { label: 'update user', send: () => request(app).patch(`/api/users/${voter.user.id}`).send({ name: 'Renamed' }) },
    { label: 'delete user', send: () => request(app).delete(`/api/users/${voter.user.id}`) },
    { label: 'reset vote', send: () => request(app).delete(`/api/users/${voter.user.id}/vote`) },
    { label: 'issue vote code', send: () => request(app).post(`/api/users/${voter.user.id}/vote-code`) },
    { label: 'create candidate', send: () => request(app).post('/api/candidates').send({ name: 'Sofia Rodriguez' }) },
    { label: 'delete candidate', send: () => request(app).delete(`/api/candidates/${candidate.id}`) },
  ];

  it.each(guarded)('blocks "$label" with 423', async ({ send }) => {
    const res = await send().set(bearer(adminToken));

    expect(res.status).toBe(423);
    expect(res.body.error.message).toMatch(/locked/i);
  });

  it('still lets admins read users and candidates', async () => {
    const users = await request(app).get('/api/users').set(bearer(adminToken));
    const candidates = await request(app).get('/api/candidates').set(bearer(adminToken));

    expect(users.status).toBe(200);
    expect(candidates.status).toBe(200);
  });

  it('accepts votes, including write-ins, because the election is running', async () => {
    const other = await createUser();

    const byId = await request(app).post('/api/votes').set(bearer(voter.token)).send({ candidateId: candidate.id });
    const writeIn = await request(app).post('/api/votes').set(bearer(other.token)).send({ name: 'Jane Doe' });

    expect(byId.status).toBe(201);
    expect(writeIn.status).toBe(201);
  });

  it('allows changes again after unlocking', async () => {
    await setLocked(false);
    await Vote.create({ user: voter.user._id, candidate: new Types.ObjectId() });

    const res = await request(app).delete(`/api/users/${voter.user.id}/vote`).set(bearer(adminToken));

    expect(res.status).toBe(204);
  });
});
