import { createMcpHandler, McpServer, type AuthInfo } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { InMemoryIdempotencyStore } from '../idempotency/idempotencyStore.js';
import { audit } from '../observability/audit.js';
import { hasScope, type Scope } from '../security/auth.js';
import type { TaskService } from '../services/taskService.js';

function text(value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value) }];
}

function caller(authInfo: AuthInfo | undefined): string {
  if (!authInfo?.clientId) throw new Error('authenticated client identity is required');
  return authInfo.clientId;
}

function denied(scope: Scope) {
  return { isError: true as const, content: text({ error: 'insufficient_scope', requiredScope: scope }) };
}

export function createTaskMcpHandler(taskService: TaskService, idempotencyStore: InMemoryIdempotencyStore) {
  return createMcpHandler(() => {
    const server = new McpServer({ name: 'agent-api-gateway-demo', version: '1.0.0' });

    server.registerTool(
      'tasks_list',
      {
        description: 'List tasks visible to the authenticated caller.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true }
      },
      async (_args, ctx) => {
        if (!hasScope(ctx.http?.authInfo, 'tasks:read')) return denied('tasks:read');
        return { content: text({ tasks: await taskService.list() }) };
      }
    );

    server.registerTool(
      'tasks_get',
      {
        description: 'Get one task by id.',
        inputSchema: z.object({ id: z.string().uuid() }),
        annotations: { readOnlyHint: true }
      },
      async ({ id }, ctx) => {
        if (!hasScope(ctx.http?.authInfo, 'tasks:read')) return denied('tasks:read');
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
        })
      },
      async ({ title, idempotencyKey }, ctx) => {
        if (!hasScope(ctx.http?.authInfo, 'tasks:write')) return denied('tasks:write');
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
        })
      },
      async ({ id, expectedVersion }, ctx) => {
        if (!hasScope(ctx.http?.authInfo, 'tasks:write')) return denied('tasks:write');
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
