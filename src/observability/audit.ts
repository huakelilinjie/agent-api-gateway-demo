import { currentRequestId } from './requestContext.js';

export interface AuditEvent {
  action: string;
  actor?: string;
  resourceType?: string;
  resourceId?: string;
  outcome: 'success' | 'denied' | 'failure';
  details?: Record<string, unknown>;
}

export function audit(event: AuditEvent): void {
  const record = {
    timestamp: new Date().toISOString(),
    requestId: currentRequestId(),
    ...event
  };
  console.log(JSON.stringify(record));
}
