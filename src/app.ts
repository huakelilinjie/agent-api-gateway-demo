import express, { type Express } from 'express';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { errorHandler } from './http/errors.js';
import { createTaskRouter } from './http/routes.js';
import { InMemoryTaskRepository } from './repository/inMemoryTaskRepository.js';
import { verifierFromEnv } from './security/auth.js';
import { TaskService } from './services/taskService.js';

export interface AppDependencies {
  taskService?: TaskService;
  tokenVerifier?: OAuthTokenVerifier;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();
  const taskService = dependencies.taskService ?? new TaskService(new InMemoryTaskRepository());
  const tokenVerifier = dependencies.tokenVerifier ?? verifierFromEnv();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/tasks', createTaskRouter(taskService, tokenVerifier));
  app.use(errorHandler);
  return app;
}
