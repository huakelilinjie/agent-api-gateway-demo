import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { OptimisticLockError } from '../repository/inMemoryTaskRepository.js';
import { TaskNotFoundError, TaskValidationError } from '../services/taskService.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'invalid_request',
      details: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
    });
    return;
  }
  if (error instanceof TaskValidationError) {
    res.status(400).json({ error: 'invalid_request', message: error.message });
    return;
  }
  if (error instanceof TaskNotFoundError) {
    res.status(404).json({ error: 'task_not_found', taskId: error.taskId });
    return;
  }
  if (error instanceof OptimisticLockError) {
    res.status(409).json({
      error: 'version_conflict',
      taskId: error.taskId,
      expectedVersion: error.expectedVersion,
      actualVersion: error.actualVersion
    });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'internal_error' });
};
