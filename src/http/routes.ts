import { Router } from 'express';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { InMemoryIdempotencyStore } from '../idempotency/idempotencyStore.js';
import { audit } from '../observability/audit.js';
import { requireRestScope } from '../security/auth.js';
import type { TaskService } from '../services/taskService.js';

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200)
});

const completeTaskSchema = z.object({
  expectedVersion: z.number().int().positive().optional()
});

function pathParam(value: string | string[] | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`missing path parameter: ${name}`);
  }
  return value;
}

export function createTaskRouter(
  taskService: TaskService,
  verifier: OAuthTokenVerifier,
  idempotencyStore: InMemoryIdempotencyStore
): Router {
  const router = Router();

  router.get('/', requireRestScope(verifier, 'tasks:read'), async (_req, res, next) => {
    try {
      res.json({ tasks: await taskService.list() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', requireRestScope(verifier, 'tasks:write'), async (req, res, next) => {
    try {
      const input = createTaskSchema.parse(req.body);
      const key = req.header('idempotency-key');
      if (!key || key.length > 128) {
        res.status(400).json({ error: 'invalid_idempotency_key' });
        return;
      }

      const subject = String(res.locals.auth.clientId);
      const fingerprint = InMemoryIdempotencyStore.fingerprint(input);
      const result = await idempotencyStore.execute(subject, key, fingerprint, () => taskService.create(input.title));

      audit({
        action: 'task.create',
        actor: subject,
        resourceType: 'task',
        resourceId: result.value.id,
        outcome: 'success',
        details: { transport: 'rest', idempotencyReplayed: result.replayed }
      });

      res
        .status(result.replayed ? 200 : 201)
        .set('Idempotency-Replayed', String(result.replayed))
        .location(`/api/tasks/${result.value.id}`)
        .json(result.value);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', requireRestScope(verifier, 'tasks:read'), async (req, res, next) => {
    try {
      res.json(await taskService.get(pathParam(req.params.id, 'id')));
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/complete', requireRestScope(verifier, 'tasks:write'), async (req, res, next) => {
    try {
      const input = completeTaskSchema.parse(req.body ?? {});
      const task = await taskService.complete(pathParam(req.params.id, 'id'), input.expectedVersion);
      audit({
        action: 'task.complete',
        actor: String(res.locals.auth.clientId),
        resourceType: 'task',
        resourceId: task.id,
        outcome: 'success',
        details: { transport: 'rest', version: task.version }
      });
      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
