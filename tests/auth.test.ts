import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { User } from '../src/models/user.js';
import { app, bearer, createAdmin, createUser } from './helpers.js';

const voterLogin = (body: object) => request(app).post('/api/auth/login').send(body);
const adminLogin = (body: object) => request(app).post('/api/auth/admin/login').send(body);

describe('POST /api/auth/login (voters)', () => {
  it('signs a voter in with email and vote code', async () => {
    const { user, voteCode } = await createUser({ email: 'sarah@example.com' });

    const res = await voterLogin({ email: 'sarah@example.com', code: voteCode });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ id: user.id, role: 'voter', status: 'active', hasVoted: false });
    expect(res.body.user).not.toHaveProperty('voteCodeHash');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('accepts the code in lower case, with spaces or without the dash', async () => {
    const { voteCode } = await createUser({ email: 'david@example.com' });
    const loose = voteCode.toLowerCase().replace('-', ' ');

    const spaced = await voterLogin({ email: '  David@Example.COM ', code: ` ${loose} ` });
    const joined = await voterLogin({ email: 'david@example.com', code: voteCode.replace('-', '') });

    expect(spaced.status).toBe(200);
    expect(joined.status).toBe(200);
  });

  it('gives the same 401 for an unknown email and a wrong code', async () => {
    await createUser({ email: 'elena@example.com' });

    const unknown = await voterLogin({ email: 'ghost@example.com', code: 'ABCD-EFGH' });
    const wrong = await voterLogin({ email: 'elena@example.com', code: 'ABCD-EFGH' });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe('Invalid email or vote code');
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('does not let administrators use the voter sign-in', async () => {
    const { password } = await createAdmin({ email: 'admin@example.com' });

    const res = await voterLogin({ email: 'admin@example.com', code: password });

    expect(res.status).toBe(401);
  });

  it('refuses suspended voters with 403', async () => {
    const { voteCode } = await createUser({ email: 'amara@example.com', status: 'suspended' });

    const res = await voterLogin({ email: 'amara@example.com', code: voteCode });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/suspended/i);
  });

  it('rejects broken JSON with 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Malformed JSON body');
  });

  it('rejects a malformed body with 400', async () => {
    const res = await voterLogin({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(['email', 'code']);
  });
});

describe('POST /api/auth/admin/login', () => {
  it('signs an administrator in with email and password', async () => {
    const { user, password } = await createAdmin({ email: 'admin@example.com' });

    const res = await adminLogin({ email: 'admin@example.com', password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ id: user.id, role: 'admin' });
  });

  it('gives the same 401 for a wrong password and a voter account', async () => {
    await createAdmin({ email: 'admin@example.com' });
    const { voteCode } = await createUser({ email: 'sarah@example.com' });

    const wrong = await adminLogin({ email: 'admin@example.com', password: 'not-it-123' });
    const voter = await adminLogin({ email: 'sarah@example.com', password: voteCode });

    expect(wrong.status).toBe(401);
    expect(voter.status).toBe(401);
    expect(wrong.body.error.message).toBe('Invalid email or password');
    expect(voter.body.error.message).toBe(wrong.body.error.message);
  });

  it('refuses suspended administrators with 403', async () => {
    const { password } = await createAdmin({ email: 'admin2@example.com', status: 'suspended' });

    const res = await adminLogin({ email: 'admin2@example.com', password });

    expect(res.status).toBe(403);
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
