import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';

export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();
const requestIdPattern = /^[A-Za-z0-9._-]{1,64}$/;

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && requestIdPattern.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', requestId);
  storage.run({ requestId }, next);
};

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
