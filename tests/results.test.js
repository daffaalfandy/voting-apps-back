import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Candidate } from '../src/models/candidate.js';
import { Vote } from '../src/models/vote.js';
import { app, bearer, createAdmin, createUser } from './helpers.js';

let adminToken;

beforeEach(async () => {
  adminToken = (await createAdmin()).token;
});

async function voteFor(candidate, status = 'active') {
  const { user } = await createUser({ status });
  await Vote.create({ user: user._id, candidate: candidate._id });
}

const getResults = () => request(app).get('/api/results').set(bearer(adminToken));

describe('GET /api/results', () => {
  it('reports zeros before anyone votes', async () => {
    const res = await getResults();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalVotes: 0, participation: { eligible: 0, voted: 0 }, candidates: [] });
  });

  it('ranks candidates by votes, then name, and includes those with none', async () => {
    const sri = await Candidate.create({ name: 'Sri Wahyuni' });
    const mahendra = await Candidate.create({ name: 'Mahendra Wijaya' });
    const joko = await Candidate.create({ name: 'Joko Susilo', isWriteIn: true });
    await Candidate.create({ name: 'Endang Kusumawati' });
    await voteFor(sri);
    await voteFor(sri);
    await voteFor(mahendra);
    await voteFor(joko);

    const res = await getResults();

    expect(res.body.totalVotes).toBe(4);
    expect(res.body.candidates).toEqual([
      { id: sri.id, name: 'Sri Wahyuni', isWriteIn: false, votes: 2 },
      { id: joko.id, name: 'Joko Susilo', isWriteIn: true, votes: 1 },
      { id: mahendra.id, name: 'Mahendra Wijaya', isWriteIn: false, votes: 1 },
      { id: expect.any(String), name: 'Endang Kusumawati', isWriteIn: false, votes: 0 },
    ]);
  });

  it('counts participation among active voters only', async () => {
    const mahendra = await Candidate.create({ name: 'Mahendra Wijaya' });
    await voteFor(mahendra);
    await voteFor(mahendra, 'suspended');
    await createUser();
    await createUser({ status: 'suspended' });

    const res = await getResults();

    expect(res.body.totalVotes).toBe(2);
    expect(res.body.participation).toEqual({ eligible: 2, voted: 1 });
  });

  it('is admin only', async () => {
    const { token } = await createUser();

    const res = await request(app).get('/api/results').set(bearer(token));

    expect(res.status).toBe(403);
  });
});
