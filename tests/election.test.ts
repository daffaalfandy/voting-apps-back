import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Candidate } from '../src/models/candidate.js';
import { User } from '../src/models/user.js';
import { Vote } from '../src/models/vote.js';
import { app, bearer, createAdmin, createUser } from './helpers.js';

let adminToken: string;

beforeEach(async () => {
  adminToken = (await createAdmin()).token;
});

const setLocked = (locked: boolean) => request(app).put('/api/settings').set(bearer(adminToken)).send({ locked });
const reset = (token = adminToken) => request(app).post('/api/election/reset').set(bearer(token));

async function runElection() {
  const marcus = await Candidate.create({ name: 'Marcus Chen' });
  const sarah = await createUser();
  const david = await createUser();
  await request(app).post('/api/votes').set(bearer(sarah.token)).send({ candidateId: marcus.id });
  await request(app).post('/api/votes').set(bearer(david.token)).send({ name: 'Jane Doe' });
  return { marcus, sarah, david };
}

describe('POST /api/election/reset', () => {
  it('removes every vote and write-in name, and keeps users and listed candidates', async () => {
    const { marcus } = await runElection();
    await setLocked(true);

    const res = await reset();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ votesRemoved: 2, writeInsRemoved: 1 });
    expect(await Vote.countDocuments()).toBe(0);
    expect(await Candidate.find().distinct('name')).toEqual([marcus.name]);
    expect(await User.countDocuments({ role: 'voter' })).toBe(2);
  });

  it('lets voters vote again once the system is unlocked', async () => {
    const { marcus, sarah } = await runElection();
    await setLocked(true);
    await reset();
    await setLocked(false);

    const vote = await request(app).post('/api/votes').set(bearer(sarah.token)).send({ candidateId: marcus.id });

    expect(vote.status).toBe(201);
  });

  it('leaves the results empty', async () => {
    await runElection();
    await setLocked(true);
    await reset();

    const results = await request(app).get('/api/results').set(bearer(adminToken));
    const participation = await request(app).get('/api/participation').set(bearer(adminToken));

    expect(results.body.totalVotes).toBe(0);
    expect(results.body.participation.voted).toBe(0);
    expect(participation.body.participants).toEqual([]);
  });

  it('refuses to run while voting is open, with 409', async () => {
    await runElection();

    const res = await reset();

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/lock/i);
    expect(await Vote.countDocuments()).toBe(2);
  });

  it('is admin only', async () => {
    const { token } = await createUser();
    await setLocked(true);

    const res = await reset(token);

    expect(res.status).toBe(403);
  });
});
