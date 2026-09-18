import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { testTokenVerifier } from './testAuth.js';

const writer = { Authorization: 'Bearer writer-token' };
const reader = { Authorization: 'Bearer reader-token' };

describe('task REST API', () => {
  it('creates, reads and lists tasks with scoped credentials', async () => {
    const app = createApp({ tokenVerifier: testTokenVerifier });
    const created = await request(app).post('/api/tasks').set(writer).send({ title: 'Add scoped MCP tool' }).expect(201);

    await request(app).get(`/api/tasks/${created.body.id}`).set(reader).expect(200, created.body);
    const listed = await request(app).get('/api/tasks').set(reader).expect(200);
    expect(listed.body.tasks).toHaveLength(1);
  });

  it('rejects missing credentials', async () => {
    const app = createApp({ tokenVerifier: testTokenVerifier });
    await request(app).get('/api/tasks').expect(401, { error: 'invalid_token' });
  });

  it('enforces write scope', async () => {
    const app = createApp({ tokenVerifier: testTokenVerifier });
    const response = await request(app).post('/api/tasks').set(reader).send({ title: 'nope' }).expect(403);
    expect(response.body.requiredScope).toBe('tasks:write');
  });

  it('rejects invalid input with a stable error shape', async () => {
    const app = createApp({ tokenVerifier: testTokenVerifier });
    const response = await request(app).post('/api/tasks').set(writer).send({ title: '   ' }).expect(400);
    expect(response.body.error).toBe('invalid_request');
  });

  it('returns 409 for optimistic-lock conflicts', async () => {
    const app = createApp({ tokenVerifier: testTokenVerifier });
    const created = await request(app).post('/api/tasks').set(writer).send({ title: 'Version me' }).expect(201);

    await request(app).post(`/api/tasks/${created.body.id}/complete`).set(writer).send({ expectedVersion: 1 }).expect(200);
    const conflict = await request(app)
      .post(`/api/tasks/${created.body.id}/complete`)
      .set(writer)
      .send({ expectedVersion: 1 })
      .expect(409);

    expect(conflict.body.error).toBe('version_conflict');
  });
});
