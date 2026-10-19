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
    const sofia = await Candidate.create({ name: 'Sofia Rodriguez' });
    const marcus = await Candidate.create({ name: 'Marcus Chen' });
    const jane = await Candidate.create({ name: 'Jane Doe', isWriteIn: true });
    await Candidate.create({ name: 'Evelyn Reed' });
    await voteFor(sofia);
    await voteFor(sofia);
    await voteFor(marcus);
    await voteFor(jane);

    const res = await getResults();

    expect(res.body.totalVotes).toBe(4);
    expect(res.body.candidates).toEqual([
      { id: sofia.id, name: 'Sofia Rodriguez', isWriteIn: false, votes: 2 },
      { id: jane.id, name: 'Jane Doe', isWriteIn: true, votes: 1 },
      { id: marcus.id, name: 'Marcus Chen', isWriteIn: false, votes: 1 },
      { id: expect.any(String), name: 'Evelyn Reed', isWriteIn: false, votes: 0 },
    ]);
  });

  it('counts participation among active voters only', async () => {
    const marcus = await Candidate.create({ name: 'Marcus Chen' });
    await voteFor(marcus);
    await voteFor(marcus, 'suspended');
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
