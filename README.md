# Voting Application API

REST API for a small voting application. Administrators manage users and candidates and watch the count; voters sign in with their email and vote code and cast one vote, either for a name already on the ballot or for a name they type in.

Built with Express 5, MongoDB (Mongoose), TypeScript and JWT. Tests use Vitest and Supertest against a real MongoDB.

The web client lives in a separate repository, [`voting-apps-front`](../voting-apps-front). The `docker-compose.yml` in this repository runs both.

## Run it

The only requirement is Docker with Compose v2. Node and MongoDB run inside containers.

1. Clone both repositories next to each other:

   ```
   some-folder/
   ├── voting-apps-back/
   └── voting-apps-front/
   ```

   If the frontend lives somewhere else, set `FRONTEND_PATH` (see [Configuration](#configuration)).

2. From `voting-apps-back`, start everything:

   ```bash
   docker compose up --build
   ```

3. Open http://localhost:3000 to vote, or http://localhost:3000/admin/login to run the election. The API is also exposed at http://localhost:4000/api.

On first start the database is seeded with these accounts:

| Role | Email | Signs in with | State |
|---|---|---|---|
| Administrator | `admin@example.com` | password `admin12345` | |
| Voter | `sarah@example.com` | vote code `SRJN-4826` | Not voted |
| Voter | `david@example.com` | vote code `DVKM-7395` | Not voted |
| Voter | `elena@example.com` | vote code `ERST-5942` | Voted for Dr. Evelyn Reed |
| Voter | `amara@example.com` | vote code `AMRA-2683` | Voted for Marcus Chen |

The ballot starts with Dr. Evelyn Reed, Marcus Chen and Sofia Rodriguez. Seeding only runs on an empty database. To start over:

```bash
docker compose down -v   # removes the database volume
docker compose up --build
```

## Run the tests

```bash
docker compose run --rm test                          # 111 tests
docker compose run --rm test npm run test:coverage    # with a coverage report
```

The `test` service uses its own `voting_test` database, so it never touches the app's data. `src` and `tests` are mounted into the container, so edits are picked up without a rebuild.

The suite was written test first: the git history shows each failing test file committed before the code that makes it pass.

## Configuration

Set these in a `.env` file next to `docker-compose.yml` (copy `.env.example`). All have working defaults for local use.

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | `dev-only-secret-change-me` | Signs tokens. **Set a long random value anywhere outside your own machine.** |
| `JWT_EXPIRES_IN` | `8h` | Token lifetime. |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `Arthur Vance` / `admin@example.com` / `admin12345` | First administrator, created on an empty database. |
| `SEED_DEMO` | `true` | Also seed the demo voters, candidates and votes. |
| `WEB_PORT` / `API_PORT` | `3000` / `4000` | Host ports. |
| `FRONTEND_PATH` | `../voting-apps-front` | Where the frontend repository is. |

## API

All routes are under `/api`. Send the token from either sign-in route as `Authorization: Bearer <token>`. Errors look like `{ "error": { "message": "...", "details": [{ "path": "email", "message": "..." }] } }`.

| Method and path | Who | What it does |
|---|---|---|
| `POST /auth/login` | voters | `{ email, code }` → `{ token, user }`. The code is case-insensitive and the dash is optional. 401 for wrong credentials, 403 if suspended. |
| `POST /auth/admin/login` | administrators | `{ email, password }` → `{ token, user }`. Same errors. |
| `GET /auth/me` | signed in | The current user, including `hasVoted`. |
| `GET /candidates` | signed in | Names on the ballot. Administrators also get `voteCount`. |
| `POST /candidates` | admin | `{ name }`. 409 if the name already exists (case and spacing ignored). |
| `DELETE /candidates/:id` | admin | 409 if the candidate has votes. |
| `POST /votes` | voter | `{ candidateId }` or `{ name }` for a write-in. 409 if already voted. 423 while the system is locked. |
| `GET /votes/me` | voter | The voter's own vote, or `null`. |
| `GET /results` | admin | Total votes, turnout and every candidate's count, highest first. |
| `GET /participation` | admin | Voters who have voted and when, newest first. Never includes their choice. |
| `GET /users?search=&voted=` | admin | Users with voting status. `search` matches name or email; `voted` is `true` or `false`. |
| `POST /users` | admin | Voter: `{ name, email }` → `{ user, voteCode }`. Administrator: `{ name, email, role: "admin", password }`. |
| `PATCH /users/:id` | admin | Any of `name`, `email`, `status`, and `password` for administrators. Roles cannot change. |
| `POST /users/:id/vote-code` | admin | Issues a new vote code for a voter → `{ voteCode }`. The old code stops working. |
| `DELETE /users/:id` | admin | Deletes the user and their vote. |
| `DELETE /users/:id/vote` | admin | Clears a vote so that voter can vote again. |
| `GET /settings` | signed in | `{ locked }`. Voters use it to show that voting is closed. |
| `PUT /settings` | admin | `{ locked }`. Locking closes voting and freezes users and candidates. |
| `POST /election/reset` | admin | Deletes all votes and write-in names → `{ votesRemoved, writeInsRemoved }`. 409 unless the system is locked. |
| `GET /health` | anyone | Liveness check. |

## How it behaves

- **One vote per voter.** `votes.user` has a unique index, so the database rejects a second vote even when two requests arrive at the same moment. A test fires five at once and expects exactly one to succeed.
- **Write-ins join the ballot.** A typed name is trimmed, its spaces collapsed and compared case-insensitively with existing names. `"marcus  CHEN"` counts for Marcus Chen; a new name becomes a candidate that later voters can pick.
- **Vote codes instead of voter passwords.** Creating a voter generates an 8-character code such as `K7QM-4XPR`, using letters and digits that cannot be confused (no 0/O or 1/I/L). The API returns it once; only a bcrypt hash is stored. If a voter loses it, an administrator issues a new one.
- **Separate sign-in for administrators.** Administrators use a password on `/auth/admin/login`; voter credentials never work there, and the other way round. A role is fixed when the account is created.
- **Administrators do not vote.** Turnout counts active voters only. Administrators cannot suspend or delete themselves, so the console always keeps an owner.
- **System lock.** While locked, voting is closed and users and candidates cannot be added, edited or removed; those requests get 423 Locked. Voters can read the lock state, so the ballot can tell them voting is closed.
- **Election reset.** An administrator can start over: every vote and every write-in name is deleted, while voters, their vote codes and the names added by administrators stay. It only runs while the system is locked (409 otherwise), so no vote can arrive halfway through.
- **Suspended accounts** cannot sign in, and their existing tokens stop working on the next request, because every request reloads the user. Their vote, if any, still counts.
- **Who voted for whom.** A vote stores the voter so it can be reset or removed with the account. No endpoint shows another person's choice: administrators see totals, and the participation list says only who voted and when.
- **Passwords and vote codes** are hashed with bcrypt. Sign-in takes the same time whether or not the email exists.

## Layout

```
src/
  app.ts            Express app (no listen), used by tests and the server
  server.ts         connects to MongoDB, seeds, listens
  config.ts         environment variables, validated with zod
  seed.ts           first-run data
  auth/             password hashing, JWT helpers
  middleware/       auth and role guards, lock guard, error handler
  models/           user, candidate, vote, setting
  routes/           one file per resource
tests/              one file per resource, plus shared helpers and setup
```

## Without Docker

With Node 22.12+ and a MongoDB you run yourself:

```bash
npm install
JWT_SECRET=dev SEED_DEMO=true npm run dev          # http://localhost:4000
MONGO_URL=mongodb://localhost:27017/voting_test npm test
```
