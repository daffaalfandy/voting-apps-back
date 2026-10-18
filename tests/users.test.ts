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

const VOTE_CODE = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
const voterLogin = (email: string, code: string) => request(app).post('/api/auth/login').send({ email, code });
const adminLogin = (email: string, password: string) => request(app).post('/api/auth/admin/login').send({ email, password });

describe('POST /api/users', () => {
  it('creates a voter and returns a vote code they can sign in with', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(bearer(admin.token))
      .send({ name: 'Amara Okafor', email: 'Amara@Example.com' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Amara Okafor', email: 'amara@example.com', role: 'voter', status: 'active' });
    expect(res.body.voteCode).toMatch(VOTE_CODE);
    expect((await voterLogin('amara@example.com', res.body.voteCode)).status).toBe(200);
  });

  it('creates an administrator with a password and no vote code', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(bearer(admin.token))
      .send({ name: 'Second Admin', email: 'admin2@example.com', role: 'admin', password: 'secret-pass' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('admin');
    expect(res.body).not.toHaveProperty('voteCode');
    expect((await adminLogin('admin2@example.com', 'secret-pass')).status).toBe(200);
  });

  it('requires a password for administrators and refuses one for voters', async () => {
    const adminWithout = await request(app)
      .post('/api/users')
      .set(bearer(admin.token))
      .send({ name: 'No Password', email: 'a@example.com', role: 'admin' });
    const voterWith = await request(app)
      .post('/api/users')
      .set(bearer(admin.token))
      .send({ name: 'Has Password', email: 'b@example.com', password: 'secret-pass' });

    expect(adminWithout.status).toBe(400);
    expect(adminWithout.body.error.details).toEqual([{ path: 'password', message: 'Administrators need a password' }]);
    expect(voterWith.status).toBe(400);
    expect(voterWith.body.error.details).toEqual([{ path: 'password', message: 'Voters sign in with a vote code, not a password' }]);
  });

  it('rejects a duplicate email regardless of case with 409', async () => {
    await createUser({ email: 'taken@example.com' });

    const res = await request(app).post('/api/users').set(bearer(admin.token)).send({ name: 'Copy', email: 'TAKEN@example.com' });

    expect(res.status).toBe(409);
  });

  it.each([
    { field: 'name', body: { email: 'a@example.com' } },
    { field: 'email', body: { name: 'No Email', email: 'nope' } },
    { field: 'role', body: { name: 'Role', email: 'c@example.com', role: 'root' } },
  ])('rejects a bad $field with 400', async ({ field, body }) => {
    const res = await request(app).post('/api/users').set(bearer(admin.token)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(field);
  });

  it('explains validation failures in plain language', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(bearer(admin.token))
      .send({ email: 'nope', role: 'admin', password: 'short' });

    expect(res.body.error.details).toEqual([
      { path: 'name', message: 'Name is required' },
      { path: 'email', message: 'Enter a valid email address' },
      { path: 'password', message: 'Password must be at least 8 characters' },
    ]);
  });
});

describe('PATCH /api/users/:id', () => {
  it('updates name, email and status', async () => {
    const { user } = await createUser();

    const res = await request(app)
      .patch(`/api/users/${user.id}`)
      .set(bearer(admin.token))
      .send({ name: 'Renamed', email: 'renamed@example.com', status: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Renamed', email: 'renamed@example.com', role: 'voter', status: 'suspended' });
  });

  it("resets an administrator's password", async () => {
    const other = await createAdmin({ email: 'reset@example.com' });

    await request(app).patch(`/api/users/${other.user.id}`).set(bearer(admin.token)).send({ password: 'brand-new-pass' });

    expect((await adminLogin('reset@example.com', other.password)).status).toBe(401);
    expect((await adminLogin('reset@example.com', 'brand-new-pass')).status).toBe(200);
  });

  it('refuses a password for a voter', async () => {
    const { user } = await createUser();

    const res = await request(app).patch(`/api/users/${user.id}`).set(bearer(admin.token)).send({ password: 'brand-new-pass' });

    expect(res.status).toBe(400);
  });

  it('does not change roles', async () => {
    const { user } = await createUser();

    const res = await request(app).patch(`/api/users/${user.id}`).set(bearer(admin.token)).send({ role: 'admin' });

    expect(res.status).toBe(400);
    expect((await User.findById(user._id))!.role).toBe('voter');
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

  it('stops admins from suspending themselves', async () => {
    const res = await request(app).patch(`/api/users/${admin.user.id}`).set(bearer(admin.token)).send({ status: 'suspended' });

    expect(res.status).toBe(400);
  });

  it('lets admins rename themselves', async () => {
    const res = await request(app).patch(`/api/users/${admin.user.id}`).set(bearer(admin.token)).send({ name: 'Arthur V.' });

    expect(res.status).toBe(200);
  });

  it('returns 404 for an unknown user and 400 for a malformed id', async () => {
    const missing = await request(app).patch(`/api/users/${new Types.ObjectId()}`).set(bearer(admin.token)).send({ name: 'X Y' });
    const malformed = await request(app).patch('/api/users/not-an-id').set(bearer(admin.token)).send({ name: 'X Y' });

    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(400);
  });
});

describe('POST /api/users/:id/vote-code', () => {
  it('issues a new code and retires the old one', async () => {
    const { user, voteCode } = await createUser({ email: 'lost@example.com' });

    const res = await request(app).post(`/api/users/${user.id}/vote-code`).set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.voteCode).toMatch(VOTE_CODE);
    expect((await voterLogin('lost@example.com', voteCode)).status).toBe(401);
    expect((await voterLogin('lost@example.com', res.body.voteCode)).status).toBe(200);
  });

  it('refuses administrators, who use passwords', async () => {
    const res = await request(app).post(`/api/users/${admin.user.id}/vote-code`).set(bearer(admin.token));

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown user', async () => {
    const res = await request(app).post(`/api/users/${new Types.ObjectId()}/vote-code`).set(bearer(admin.token));

    expect(res.status).toBe(404);
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
