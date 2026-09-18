import { createMcpHandler, McpServer, requireScopes, type AuthInfo } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { InMemoryIdempotencyStore } from '../idempotency/idempotencyStore.js';
import { audit } from '../observability/audit.js';
import type { TaskService } from '../services/taskService.js';

function text(value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value) }];
}

function caller(authInfo: AuthInfo | undefined): string {
  if (!authInfo?.clientId) throw new Error('authenticated client identity is required');
  return authInfo.clientId;
}

export function createTaskMcpHandler(taskService: TaskService, idempotencyStore: InMemoryIdempotencyStore) {
  return createMcpHandler(() => {
    const server = new McpServer({ name: 'agent-api-gateway-demo', version: '1.0.0' });

    server.registerTool(
      'tasks_list',
      {
        description: 'List tasks visible to the authenticated caller.',
        inputSchema: z.object({}),
        scopeChallenge: requireScopes('tasks:read'),
        annotations: { readOnlyHint: true }
      },
      async () => ({ content: text({ tasks: await taskService.list() }) })
    );

    server.registerTool(
      'tasks_get',
      {
        description: 'Get one task by id.',
        inputSchema: z.object({ id: z.string().uuid() }),
        scopeChallenge: requireScopes('tasks:read'),
        annotations: { readOnlyHint: true }
      },
      async ({ id }) => {
        try {
          return { content: text(await taskService.get(id)) };
        } catch (error) {
          return { isError: true, content: text({ error: error instanceof Error ? error.message : 'unknown error' }) };
        }
      }
    );

    server.registerTool(
      'tasks_create',
      {
        description: 'Create a task. The idempotency key makes retries safe for the same authenticated caller.',
        inputSchema: z.object({
          title: z.string().trim().min(1).max(200),
          idempotencyKey: z.string().min(1).max(128)
        }),
        scopeChallenge: requireScopes('tasks:write')
      },
      async ({ title, idempotencyKey }, ctx) => {
        try {
          const authInfo = ctx.http?.authInfo;
          const fingerprint = InMemoryIdempotencyStore.fingerprint({ title });
          const result = await idempotencyStore.execute(
            caller(authInfo),
            idempotencyKey,
            fingerprint,
            () => taskService.create(title)
          );
          audit({
            action: 'task.create',
            actor: caller(authInfo),
            resourceType: 'task',
            resourceId: result.value.id,
            outcome: 'success',
            details: { transport: 'mcp', idempotencyReplayed: result.replayed }
          });
          return { content: text({ ...result.value, idempotencyReplayed: result.replayed }) };
        } catch (error) {
          return { isError: true, content: text({ error: error instanceof Error ? error.message : 'unknown error' }) };
        }
      }
    );

    server.registerTool(
      'tasks_complete',
      {
        description: 'Complete a task with optional optimistic-lock protection.',
        inputSchema: z.object({
          id: z.string().uuid(),
          expectedVersion: z.number().int().positive().optional()
        }),
        scopeChallenge: requireScopes('tasks:write')
      },
      async ({ id, expectedVersion }, ctx) => {
        try {
          const task = await taskService.complete(id, expectedVersion);
          audit({
            action: 'task.complete',
            actor: caller(ctx.http?.authInfo),
            resourceType: 'task',
            resourceId: task.id,
            outcome: 'success',
            details: { transport: 'mcp', version: task.version }
          });
          return { content: text(task) };
        } catch (error) {
          return { isError: true, content: text({ error: error instanceof Error ? error.message : 'unknown error' }) };
        }
      }
    );

    return server;
  });
}
