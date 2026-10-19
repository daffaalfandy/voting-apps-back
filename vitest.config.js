import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      BCRYPT_ROUNDS: '4',
      MONGO_URL: process.env.MONGO_URL ?? 'mongodb://localhost:27017/voting_test',
    },
    coverage: {
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
    },
  },
});
