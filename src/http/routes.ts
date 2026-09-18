import { Router } from 'express';
import * as z from 'zod/v4';
import type { TaskService } from '../services/taskService.js';

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200)
});

const completeTaskSchema = z.object({
  expectedVersion: z.number().int().positive().optional()
});

export function createTaskRouter(taskService: TaskService): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.json({ tasks: await taskService.list() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const input = createTaskSchema.parse(req.body);
      const task = await taskService.create(input.title);
      res.status(201).location(`/api/tasks/${task.id}`).json(task);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      res.json(await taskService.get(req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/complete', async (req, res, next) => {
    try {
      const input = completeTaskSchema.parse(req.body ?? {});
      res.json(await taskService.complete(req.params.id, input.expectedVersion));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
