import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('task REST API', () => {
  it('creates, reads and lists tasks', async () => {
    const app = createApp();
    const created = await request(app).post('/api/tasks').send({ title: 'Add scoped MCP tool' }).expect(201);

    await request(app).get(`/api/tasks/${created.body.id}`).expect(200, created.body);
    const listed = await request(app).get('/api/tasks').expect(200);
    expect(listed.body.tasks).toHaveLength(1);
  });

  it('rejects invalid input with a stable error shape', async () => {
    const app = createApp();
    const response = await request(app).post('/api/tasks').send({ title: '   ' }).expect(400);

    expect(response.body.error).toBe('invalid_request');
  });

  it('returns 409 for optimistic-lock conflicts', async () => {
    const app = createApp();
    const created = await request(app).post('/api/tasks').send({ title: 'Version me' }).expect(201);

    await request(app).post(`/api/tasks/${created.body.id}/complete`).send({ expectedVersion: 1 }).expect(200);
    const conflict = await request(app)
      .post(`/api/tasks/${created.body.id}/complete`)
      .send({ expectedVersion: 1 })
      .expect(409);

    expect(conflict.body.error).toBe('version_conflict');
  });
});
