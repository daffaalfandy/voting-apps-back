import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Candidate, type CandidateDoc } from '../src/models/candidate.js';
import { Vote } from '../src/models/vote.js';
import { app, bearer, createAdmin, createUser } from './helpers.js';

let voterToken: string;
let marcus: CandidateDoc;

beforeEach(async () => {
  voterToken = (await createUser()).token;
  marcus = await Candidate.create({ name: 'Marcus Chen' });
});

const vote = (token: string, body: object) => request(app).post('/api/votes').set(bearer(token)).send(body);

describe('POST /api/votes', () => {
  it('records a vote for an existing candidate', async () => {
    const res = await vote(voterToken, { candidateId: marcus.id });

    expect(res.status).toBe(201);
    expect(res.body.vote).toEqual({
      candidate: { id: marcus.id, name: 'Marcus Chen', isWriteIn: false },
      createdAt: expect.any(String),
    });

    const me = await request(app).get('/api/auth/me').set(bearer(voterToken));
    expect(me.body.user.hasVoted).toBe(true);
  });

  it('adds a new write-in name to the ballot', async () => {
    const res = await vote(voterToken, { name: '  Jane   Doe ' });

    expect(res.status).toBe(201);
    expect(res.body.vote.candidate).toMatchObject({ name: 'Jane Doe', isWriteIn: true });

    const list = await request(app).get('/api/candidates').set(bearer(voterToken));
    expect(list.body.candidates.map((c: { name: string }) => c.name)).toContain('Jane Doe');
  });

  it('counts a write-in that matches an existing name for that candidate', async () => {
    const res = await vote(voterToken, { name: 'marcus  CHEN' });

    expect(res.status).toBe(201);
    expect(res.body.vote.candidate).toEqual({ id: marcus.id, name: 'Marcus Chen', isWriteIn: false });
    expect(await Candidate.countDocuments()).toBe(1);
  });

  it('rejects a second vote from the same voter with 409', async () => {
    await vote(voterToken, { candidateId: marcus.id });

    const res = await vote(voterToken, { name: 'Someone Else' });

    expect(res.status).toBe(409);
    expect(await Vote.countDocuments()).toBe(1);
  });

  it('accepts exactly one of several simultaneous votes from one voter', async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => vote(voterToken, { candidateId: marcus.id })));

    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await Vote.countDocuments()).toBe(1);
  });

  it('creates one candidate when two voters write in the same new name at once', async () => {
    const other = await createUser();

    const [a, b] = await Promise.all([vote(voterToken, { name: 'Jane Doe' }), vote(other.token, { name: 'jane doe' })]);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.vote.candidate.id).toBe(b.body.vote.candidate.id);
    expect(await Candidate.countDocuments({ normalizedName: 'jane doe' })).toBe(1);
  });

  it.each([
    [{}, 'neither field'],
    [{ candidateId: 'x', name: 'Jane Doe' }, 'both fields'],
    [{ name: '<script>' }, 'an invalid write-in name'],
  ])('rejects %j (%s) with 400', async (body) => {
    const res = await vote(voterToken, body);

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown candidate and 400 for a malformed id', async () => {
    const missing = await vote(voterToken, { candidateId: new Types.ObjectId().toString() });
    const malformed = await vote(voterToken, { candidateId: 'abc' });

    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(400);
  });

  it('does not let administrators vote', async () => {
    const { token } = await createAdmin();

    const res = await vote(token, { candidateId: marcus.id });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/votes/me', () => {
  it('is null before voting', async () => {
    const res = await request(app).get('/api/votes/me').set(bearer(voterToken));

    expect(res.status).toBe(200);
    expect(res.body.vote).toBeNull();
  });

  it("returns the voter's own choice after voting", async () => {
    await vote(voterToken, { candidateId: marcus.id });

    const res = await request(app).get('/api/votes/me').set(bearer(voterToken));

    expect(res.body.vote).toEqual({
      candidate: { id: marcus.id, name: 'Marcus Chen', isWriteIn: false },
      createdAt: expect.any(String),
    });
  });
});
