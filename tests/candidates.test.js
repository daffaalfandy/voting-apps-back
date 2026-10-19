import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Candidate } from '../src/models/candidate.js';
import { Vote } from '../src/models/vote.js';
import { app, bearer, createAdmin, createUser } from './helpers.js';

let adminToken;
let voterToken;

beforeEach(async () => {
  adminToken = (await createAdmin()).token;
  voterToken = (await createUser()).token;
});

describe('GET /api/candidates', () => {
  it('gives voters names only, sorted, without tallies', async () => {
    await Candidate.create({ name: 'Sri Wahyuni' });
    await Candidate.create({ name: 'Mahendra Wijaya', isWriteIn: true });

    const res = await request(app).get('/api/candidates').set(bearer(voterToken));

    expect(res.status).toBe(200);
    expect(res.body.candidates).toEqual([
      { id: expect.any(String), name: 'Mahendra Wijaya', isWriteIn: true },
      { id: expect.any(String), name: 'Sri Wahyuni', isWriteIn: false },
    ]);
  });

  it('gives admins the vote count of each candidate', async () => {
    const mahendra = await Candidate.create({ name: 'Mahendra Wijaya' });
    await Candidate.create({ name: 'Sri Wahyuni' });
    await Vote.create({ user: new Types.ObjectId(), candidate: mahendra._id });

    const res = await request(app).get('/api/candidates').set(bearer(adminToken));

    expect(res.body.candidates).toEqual([
      expect.objectContaining({ name: 'Mahendra Wijaya', voteCount: 1 }),
      expect.objectContaining({ name: 'Sri Wahyuni', voteCount: 0 }),
    ]);
  });

  it('requires sign-in', async () => {
    const res = await request(app).get('/api/candidates');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/candidates', () => {
  it('adds a candidate to the ballot', async () => {
    const res = await request(app).post('/api/candidates').set(bearer(adminToken)).send({ name: '  Dr. Endang   Kusumawati ' });

    expect(res.status).toBe(201);
    expect(res.body.candidate).toMatchObject({ name: 'Dr. Endang Kusumawati', isWriteIn: false });
  });

  it('rejects a name that differs only in case or spacing with 409', async () => {
    await Candidate.create({ name: 'Mahendra Wijaya' });

    const res = await request(app).post('/api/candidates').set(bearer(adminToken)).send({ name: 'mahendra   WIJAYA' });

    expect(res.status).toBe(409);
  });

  it.each(['', 'A', 'x'.repeat(81), 'Budi; DROP TABLE', '1234'])('rejects the name %j with 400', async (name) => {
    const res = await request(app).post('/api/candidates').set(bearer(adminToken)).send({ name });

    expect(res.status).toBe(400);
  });

  it('accepts accented letters, apostrophes and hyphens', async () => {
    const res = await request(app).post('/api/candidates').set(bearer(adminToken)).send({ name: "Kadék Nur'aini Siregar-Lubis" });

    expect(res.status).toBe(201);
  });

  it('is admin only', async () => {
    const res = await request(app).post('/api/candidates').set(bearer(voterToken)).send({ name: 'Mahendra Wijaya' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/candidates/:id', () => {
  it('removes a candidate with no votes', async () => {
    const candidate = await Candidate.create({ name: 'Mahendra Wijaya' });

    const res = await request(app).delete(`/api/candidates/${candidate.id}`).set(bearer(adminToken));

    expect(res.status).toBe(204);
    expect(await Candidate.exists({ _id: candidate._id })).toBeNull();
  });

  it('keeps a candidate who has votes, with 409', async () => {
    const candidate = await Candidate.create({ name: 'Mahendra Wijaya' });
    await Vote.create({ user: new Types.ObjectId(), candidate: candidate._id });

    const res = await request(app).delete(`/api/candidates/${candidate.id}`).set(bearer(adminToken));

    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown candidate', async () => {
    const res = await request(app).delete(`/api/candidates/${new Types.ObjectId()}`).set(bearer(adminToken));

    expect(res.status).toBe(404);
  });

  it('is admin only', async () => {
    const candidate = await Candidate.create({ name: 'Mahendra Wijaya' });

    const res = await request(app).delete(`/api/candidates/${candidate.id}`).set(bearer(voterToken));

    expect(res.status).toBe(403);
  });
});

describe('candidate name messages', () => {
  it('explains a rejected name in plain language', async () => {
    const res = await request(app).post('/api/candidates').set(bearer(adminToken)).send({ name: 'A' });

    expect(res.body.error.details[0].message).toBe('Name must be at least 2 characters');
  });
});
