import type { Express } from 'express';
import { createMcpExpressApp, requireBearerAuth } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { errorHandler } from './http/errors.js';
import { createTaskRouter } from './http/routes.js';
import { InMemoryIdempotencyStore } from './idempotency/idempotencyStore.js';
import { createTaskMcpHandler } from './mcp/taskMcpServer.js';
import { requestContextMiddleware } from './observability/requestContext.js';
import { InMemoryTaskRepository } from './repository/inMemoryTaskRepository.js';
import { verifierFromEnv } from './security/auth.js';
import { TaskService } from './services/taskService.js';
import { taskPolicyFromEnv, type TaskPolicy } from './services/taskPolicy.js';

export interface AppDependencies {
  taskService?: TaskService;
  taskPolicy?: TaskPolicy;
  tokenVerifier?: OAuthTokenVerifier;
  idempotencyStore?: InMemoryIdempotencyStore;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = createMcpExpressApp();
  const taskService =
    dependencies.taskService ?? new TaskService(new InMemoryTaskRepository(), dependencies.taskPolicy ?? taskPolicyFromEnv());
  const tokenVerifier = dependencies.tokenVerifier ?? verifierFromEnv();
  const idempotencyStore = dependencies.idempotencyStore ?? new InMemoryIdempotencyStore();

  app.disable('x-powered-by');
  app.use(requestContextMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/tasks', createTaskRouter(taskService, tokenVerifier, idempotencyStore));

  const mcpHandler = createTaskMcpHandler(taskService, idempotencyStore);
  const mcpNodeHandler = toNodeHandler(mcpHandler);
  const mcpAuth = requireBearerAuth({ verifier: tokenVerifier, requiredScopes: ['mcp'] });
  app.all('/mcp', mcpAuth, (req, res) => void mcpNodeHandler(req, res, req.body));

  app.use(errorHandler);
  return app;
}
