import express, { type Express } from 'express';
import { errorHandler } from './http/errors.js';
import { createTaskRouter } from './http/routes.js';
import { InMemoryTaskRepository } from './repository/inMemoryTaskRepository.js';
import { TaskService } from './services/taskService.js';

export interface AppDependencies {
  taskService?: TaskService;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();
  const taskService = dependencies.taskService ?? new TaskService(new InMemoryTaskRepository());

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/tasks', createTaskRouter(taskService));
  app.use(errorHandler);
  return app;
}
