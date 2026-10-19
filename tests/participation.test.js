import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Vote } from '../src/models/vote.js';
import { app, bearer, createAdmin, createUser } from './helpers.js';

let adminToken;

beforeEach(async () => {
  adminToken = (await createAdmin()).token;
});

const getParticipation = () => request(app).get('/api/participation').set(bearer(adminToken));

describe('GET /api/participation', () => {
  it('is empty before anyone votes', async () => {
    await createUser();

    const res = await getParticipation();

    expect(res.status).toBe(200);
    expect(res.body.participants).toEqual([]);
  });

  it('lists voters who voted, newest first, without their choice', async () => {
    const eka = await createUser({ name: 'Eka Purnamasari', email: 'eka@example.com' });
    const ayu = await createUser({ name: 'Ayu Wulandari', email: 'ayu@example.com', status: 'suspended' });
    await createUser({ name: 'Dimas Pratama' });
    await Vote.create({ user: eka.user._id, candidate: new Types.ObjectId(), createdAt: new Date('2026-10-15T09:42:00Z') });
    await Vote.create({ user: ayu.user._id, candidate: new Types.ObjectId(), createdAt: new Date('2026-10-15T11:20:00Z') });

    const res = await getParticipation();

    expect(res.body.participants).toEqual([
      { id: ayu.user.id, name: 'Ayu Wulandari', email: 'ayu@example.com', status: 'suspended', votedAt: '2026-10-15T11:20:00.000Z' },
      { id: eka.user.id, name: 'Eka Purnamasari', email: 'eka@example.com', status: 'active', votedAt: '2026-10-15T09:42:00.000Z' },
    ]);
  });

  it('is admin only', async () => {
    const { token } = await createUser();

    const res = await request(app).get('/api/participation').set(bearer(token));

    expect(res.status).toBe(403);
  });
});
