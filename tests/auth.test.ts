import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { User } from '../src/models/user.js';
import { app, bearer, createUser } from './helpers.js';

describe('POST /api/auth/login', () => {
  it('returns a token and the user without the password hash', async () => {
    const { user, password } = await createUser({ email: 'sarah@example.com' });

    const res = await request(app).post('/api/auth/login').send({ email: 'sarah@example.com', password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: 'sarah@example.com',
      role: 'voter',
      status: 'active',
      hasVoted: false,
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('matches the email case-insensitively', async () => {
    const { password } = await createUser({ email: 'david@example.com' });

    const res = await request(app).post('/api/auth/login').send({ email: '  David@Example.COM ', password });

    expect(res.status).toBe(200);
  });

  it('gives the same 401 for an unknown email and a wrong password', async () => {
    await createUser({ email: 'elena@example.com' });

    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'password123' });
    const wrong = await request(app).post('/api/auth/login').send({ email: 'elena@example.com', password: 'not-it-123' });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('refuses suspended accounts with 403', async () => {
    const { password } = await createUser({ email: 'amara@example.com', status: 'suspended' });

    const res = await request(app).post('/api/auth/login').send({ email: 'amara@example.com', password });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/suspended/i);
  });

  it('rejects a malformed body with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toBeInstanceOf(Array);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the signed-in user', async () => {
    const { user, token } = await createUser();

    const res = await request(app).get('/api/auth/me').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, hasVoted: false, votedAt: null });
  });

  it('requires a token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('rejects a token signed with another secret', async () => {
    const { user } = await createUser();
    const forged = jwt.sign({ sub: user.id }, 'other-secret');

    const res = await request(app).get('/api/auth/me').set(bearer(forged));

    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const { user } = await createUser();
    const expired = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, { expiresIn: -10 });

    const res = await request(app).get('/api/auth/me').set(bearer(expired));

    expect(res.status).toBe(401);
  });

  it('rejects the token once the user is deleted', async () => {
    const { user, token } = await createUser();
    await User.deleteOne({ _id: user._id });

    const res = await request(app).get('/api/auth/me').set(bearer(token));

    expect(res.status).toBe(401);
  });

  it('rejects the token once the user is suspended', async () => {
    const { user, token } = await createUser();
    await User.updateOne({ _id: user._id }, { status: 'suspended' });

    const res = await request(app).get('/api/auth/me').set(bearer(token));

    expect(res.status).toBe(403);
  });
});
