# CivicVote API

REST API for a small voting app. Administrators manage users and candidates and watch the count; voters sign in and cast one vote, either for a name already on the ballot or for a name they type in.

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

3. Open http://localhost:3000. The API is also exposed at http://localhost:4000/api.

On first start the database is seeded with these accounts:

| Role | Email | Password | State |
|---|---|---|---|
| Administrator | `admin@example.com` | `admin12345` | |
| Voter | `sarah@example.com` | `voter12345` | Not voted |
| Voter | `david@example.com` | `voter12345` | Not voted |
| Voter | `elena@example.com` | `voter12345` | Voted for Dr. Evelyn Reed |
| Voter | `amara@example.com` | `voter12345` | Voted for Marcus Chen |

The ballot starts with Dr. Evelyn Reed, Marcus Chen and Sofia Rodriguez. Seeding only runs on an empty database. To start over:

```bash
docker compose down -v   # removes the database volume
docker compose up --build
```

## Run the tests

```bash
docker compose run --rm test                          # 93 tests
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

All routes are under `/api`. Send the token from `/auth/login` as `Authorization: Bearer <token>`. Errors look like `{ "error": { "message": "...", "details": [{ "path": "email", "message": "..." }] } }`.

| Method and path | Who | What it does |
|---|---|---|
| `POST /auth/login` | anyone | `{ email, password }` → `{ token, user }`. 401 for wrong credentials, 403 if suspended. |
| `GET /auth/me` | signed in | The current user, including `hasVoted`. |
| `GET /candidates` | signed in | Names on the ballot. Administrators also get `voteCount`. |
| `POST /candidates` | admin | `{ name }`. 409 if the name already exists (case and spacing ignored). |
| `DELETE /candidates/:id` | admin | 409 if the candidate has votes. |
| `POST /votes` | voter | `{ candidateId }` or `{ name }` for a write-in. 409 if already voted. |
| `GET /votes/me` | voter | The voter's own vote, or `null`. |
| `GET /results` | admin | Total votes, turnout and every candidate's count, highest first. |
| `GET /users?search=&voted=` | admin | Users with voting status. `search` matches name or email; `voted` is `true` or `false`. |
| `POST /users` | admin | `{ name, email, password, role? }`. |
| `PATCH /users/:id` | admin | Any of `name`, `email`, `password`, `role`, `status`. |
| `DELETE /users/:id` | admin | Deletes the user and their vote. |
| `DELETE /users/:id/vote` | admin | Clears a vote so that voter can vote again. |
| `GET /settings`, `PUT /settings` | admin | Read or set `{ locked }`. |
| `GET /health` | anyone | Liveness check. |

## How it behaves

- **One vote per voter.** `votes.user` has a unique index, so the database rejects a second vote even when two requests arrive at the same moment. A test fires five at once and expects exactly one to succeed.
- **Write-ins join the ballot.** A typed name is trimmed, its spaces collapsed and compared case-insensitively with existing names. `"marcus  CHEN"` counts for Marcus Chen; a new name becomes a candidate that later voters can pick.
- **Administrators do not vote.** Turnout counts active voters only. Administrators cannot change their own role or status, or delete themselves, so the console always keeps an owner.
- **System lock.** While locked, users and candidates cannot be added, edited or removed (423 Locked). Voting continues, so the roster can be frozen during an election without stopping it.
- **Suspended accounts** cannot sign in, and their existing tokens stop working on the next request, because every request reloads the user. Their vote, if any, still counts.
- **Who voted for whom.** A vote stores the voter so it can be reset or removed with the account. No endpoint shows another person's choice; administrators see totals only.
- **Passwords** are hashed with bcrypt. Login takes the same time whether or not the email exists.

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
