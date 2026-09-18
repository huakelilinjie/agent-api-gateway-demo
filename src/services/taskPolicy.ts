import { withRetry, withTimeout } from '../reliability/retry.js';

export interface TaskPolicy {
  check(title: string): Promise<void>;
}

export class AllowAllTaskPolicy implements TaskPolicy {
  async check(_title: string): Promise<void> {}
}

export class TaskPolicyRejectedError extends Error {}

class PolicyHttpError extends Error {
  constructor(readonly status: number) {
    super(`policy service returned HTTP ${status}`);
  }
}

export interface HttpTaskPolicyOptions {
  url: URL;
  timeoutMs: number;
  attempts: number;
  fetchImpl?: typeof fetch;
}

export class HttpTaskPolicy implements TaskPolicy {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpTaskPolicyOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async check(title: string): Promise<void> {
    const response = await withRetry(
      async () => {
        const current = await withTimeout(
          signal =>
            this.fetchImpl(this.options.url, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ title }),
              signal
            }),
          this.options.timeoutMs
        );
        if (!current.ok) throw new PolicyHttpError(current.status);
        return current;
      },
      {
        attempts: this.options.attempts,
        baseDelayMs: 50,
        maxDelayMs: 500,
        shouldRetry: error => !(error instanceof PolicyHttpError) || error.status === 429 || error.status >= 500
      }
    );

    const body = (await response.json()) as { allowed?: boolean; reason?: string };
    if (body.allowed !== true) throw new TaskPolicyRejectedError(body.reason ?? 'task rejected by policy service');
  }
}

export function taskPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): TaskPolicy {
  if (!env.POLICY_SERVICE_URL) return new AllowAllTaskPolicy();
  return new HttpTaskPolicy({
    url: new URL(env.POLICY_SERVICE_URL),
    timeoutMs: Number(env.POLICY_TIMEOUT_MS ?? '1000'),
    attempts: Number(env.POLICY_MAX_ATTEMPTS ?? '3')
  });
}
