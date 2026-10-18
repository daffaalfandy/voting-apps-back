import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Candidate } from '../src/models/candidate.js';
import { User } from '../src/models/user.js';
import { Vote } from '../src/models/vote.js';
import { app, bearer, createAdmin, createUser } from './helpers.js';

let admin: Awaited<ReturnType<typeof createAdmin>>;

beforeEach(async () => {
  admin = await createAdmin({ name: 'Arthur Vance', email: 'admin@example.com' });
});

const castVote = (userId: Types.ObjectId) => Vote.create({ user: userId, candidate: new Types.ObjectId() });

describe('admin-only access', () => {
  it('refuses voters with 403', async () => {
    const { token } = await createUser();

    const res = await request(app).get('/api/users').set(bearer(token));

    expect(res.status).toBe(403);
  });

  it('refuses anonymous requests with 401', async () => {
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/users', () => {
  it('lists users sorted by name with their voting status', async () => {
    const { user: sarah } = await createUser({ name: 'Sarah Jenkins' });
    await createUser({ name: 'David Kim' });
    await castVote(sarah._id);

    const res = await request(app).get('/api/users').set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.users.map((u: { name: string }) => u.name)).toEqual(['Arthur Vance', 'David Kim', 'Sarah Jenkins']);
    const sarahRow = res.body.users.find((u: { name: string }) => u.name === 'Sarah Jenkins');
    expect(sarahRow.hasVoted).toBe(true);
    expect(sarahRow.votedAt).toBeTypeOf('string');
    expect(sarahRow).not.toHaveProperty('passwordHash');
  });

  it('searches name and email case-insensitively', async () => {
    await createUser({ name: 'Sarah Jenkins', email: 'sarah@example.com' });
    await createUser({ name: 'David Kim', email: 'dkim@example.com' });

    const byName = await request(app).get('/api/users?search=JENK').set(bearer(admin.token));
    const byEmail = await request(app).get('/api/users?search=dkim@').set(bearer(admin.token));

    expect(byName.body.users.map((u: { name: string }) => u.name)).toEqual(['Sarah Jenkins']);
    expect(byEmail.body.users.map((u: { name: string }) => u.name)).toEqual(['David Kim']);
  });

  it('treats search input literally, not as a regex', async () => {
    await createUser({ name: 'Axb Person', email: 'axb@example.com' });

    const res = await request(app).get('/api/users?search=a.b').set(bearer(admin.token));

    expect(res.body.users).toEqual([]);
  });

  it('filters voters by whether they have voted', async () => {
    const { user: sarah } = await createUser({ name: 'Sarah Jenkins' });
    await createUser({ name: 'David Kim' });
    await castVote(sarah._id);

    const voted = await request(app).get('/api/users?voted=true').set(bearer(admin.token));
    const notVoted = await request(app).get('/api/users?voted=false').set(bearer(admin.token));

    expect(voted.body.users.map((u: { name: string }) => u.name)).toEqual(['Sarah Jenkins']);
    // Admins cannot vote, so they never count as "not voted".
    expect(notVoted.body.users.map((u: { name: string }) => u.name)).toEqual(['David Kim']);
  });

  it('rejects an unknown voted filter value', async () => {
    const res = await request(app).get('/api/users?voted=maybe').set(bearer(admin.token));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/users', () => {
  it('creates a voter who can then sign in', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(bearer(admin.token))
      .send({ name: 'Amara Okafor', email: 'Amara@Example.com', password: 'secret-pass' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Amara Okafor', email: 'amara@example.com', role: 'voter', status: 'active' });

    const login = await request(app).post('/api/auth/login').send({ email: 'amara@example.com', password: 'secret-pass' });
    expect(login.status).toBe(200);
  });

  it('creates an administrator when asked', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(bearer(admin.token))
      .send({ name: 'Second Admin', email: 'admin2@example.com', password: 'secret-pass', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('admin');
  });

  it('rejects a duplicate email regardless of case with 409', async () => {
    await createUser({ email: 'taken@example.com' });

    const res = await request(app)
      .post('/api/users')
      .set(bearer(admin.token))
      .send({ name: 'Copy', email: 'TAKEN@example.com', password: 'secret-pass' });

    expect(res.status).toBe(409);
  });

  it.each([
    [{ email: 'a@example.com', password: 'secret-pass' }, 'name'],
    [{ name: 'No Email', email: 'nope', password: 'secret-pass' }, 'email'],
    [{ name: 'Short', email: 'b@example.com', password: 'short' }, 'password'],
    [{ name: 'Role', email: 'c@example.com', password: 'secret-pass', role: 'root' }, 'role'],
  ])('rejects invalid input %j with 400', async (body, field) => {
    const res = await request(app).post('/api/users').set(bearer(admin.token)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(field);
  });
});

describe('PATCH /api/users/:id', () => {
  it('updates name, email, role and status', async () => {
    const { user } = await createUser();

    const res = await request(app)
      .patch(`/api/users/${user.id}`)
      .set(bearer(admin.token))
      .send({ name: 'Renamed', email: 'renamed@example.com', role: 'admin', status: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Renamed', email: 'renamed@example.com', role: 'admin', status: 'suspended' });
  });

  it('resets the password', async () => {
    const { user, password } = await createUser({ email: 'reset@example.com' });

    await request(app).patch(`/api/users/${user.id}`).set(bearer(admin.token)).send({ password: 'brand-new-pass' });

    const oldLogin = await request(app).post('/api/auth/login').send({ email: 'reset@example.com', password });
    const newLogin = await request(app).post('/api/auth/login').send({ email: 'reset@example.com', password: 'brand-new-pass' });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it('rejects an email already used by someone else with 409', async () => {
    await createUser({ email: 'taken@example.com' });
    const { user } = await createUser();

    const res = await request(app).patch(`/api/users/${user.id}`).set(bearer(admin.token)).send({ email: 'taken@example.com' });

    expect(res.status).toBe(409);
  });

  it('rejects an empty update with 400', async () => {
    const { user } = await createUser();

    const res = await request(app).patch(`/api/users/${user.id}`).set(bearer(admin.token)).send({});

    expect(res.status).toBe(400);
  });

  it('stops admins from changing their own role or status', async () => {
    const role = await request(app).patch(`/api/users/${admin.user.id}`).set(bearer(admin.token)).send({ role: 'voter' });
    const status = await request(app).patch(`/api/users/${admin.user.id}`).set(bearer(admin.token)).send({ status: 'suspended' });

    expect(role.status).toBe(400);
    expect(status.status).toBe(400);
  });

  it('lets admins rename themselves', async () => {
    const res = await request(app).patch(`/api/users/${admin.user.id}`).set(bearer(admin.token)).send({ name: 'Arthur V.' });

    expect(res.status).toBe(200);
  });

  it('blocks a role change once the user has voted', async () => {
    const { user } = await createUser();
    await castVote(user._id);

    const res = await request(app).patch(`/api/users/${user.id}`).set(bearer(admin.token)).send({ role: 'admin' });

    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown user and 400 for a malformed id', async () => {
    const missing = await request(app).patch(`/api/users/${new Types.ObjectId()}`).set(bearer(admin.token)).send({ name: 'X Y' });
    const malformed = await request(app).patch('/api/users/not-an-id').set(bearer(admin.token)).send({ name: 'X Y' });

    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(400);
  });
});

describe('DELETE /api/users/:id', () => {
  it('deletes the user and the vote they cast', async () => {
    const { user } = await createUser();
    await castVote(user._id);

    const res = await request(app).delete(`/api/users/${user.id}`).set(bearer(admin.token));

    expect(res.status).toBe(204);
    expect(await User.exists({ _id: user._id })).toBeNull();
    expect(await Vote.countDocuments({ user: user._id })).toBe(0);
  });

  it('stops admins from deleting themselves', async () => {
    const res = await request(app).delete(`/api/users/${admin.user.id}`).set(bearer(admin.token));

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown user', async () => {
    const res = await request(app).delete(`/api/users/${new Types.ObjectId()}`).set(bearer(admin.token));

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/users/:id/vote', () => {
  it('clears the vote so the voter can vote again', async () => {
    const voter = await createUser();
    const candidate = await Candidate.create({ name: 'Marcus Chen' });
    await castVote(voter.user._id);

    const res = await request(app).delete(`/api/users/${voter.user.id}/vote`).set(bearer(admin.token));

    expect(res.status).toBe(204);
    expect(await Vote.countDocuments({ user: voter.user._id })).toBe(0);
    const revote = await request(app).post('/api/votes').set(bearer(voter.token)).send({ candidateId: candidate.id });
    expect(revote.status).toBe(201);
  });

  it('returns 404 when the user has not voted', async () => {
    const { user } = await createUser();

    const res = await request(app).delete(`/api/users/${user.id}/vote`).set(bearer(admin.token));

    expect(res.status).toBe(404);
  });
});
