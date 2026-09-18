import { createHash } from 'node:crypto';

interface Entry<T> {
  fingerprint: string;
  expiresAt: number;
  promise: Promise<T>;
}

export interface IdempotentResult<T> {
  value: T;
  replayed: boolean;
}

export class IdempotencyConflictError extends Error {
  constructor(readonly key: string) {
    super(`Idempotency key ${key} was already used with a different request`);
  }
}

export class InMemoryIdempotencyStore {
  private readonly entries = new Map<string, Entry<unknown>>();

  constructor(private readonly ttlMs = 5 * 60_000) {}

  static fingerprint(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  async execute<T>(
    subject: string,
    key: string,
    fingerprint: string,
    operation: () => Promise<T>
  ): Promise<IdempotentResult<T>> {
    const compositeKey = `${subject}:${key}`;
    const now = Date.now();
    const existing = this.entries.get(compositeKey) as Entry<T> | undefined;

    if (existing && existing.expiresAt > now) {
      if (existing.fingerprint !== fingerprint) throw new IdempotencyConflictError(key);
      return { value: await existing.promise, replayed: true };
    }
    if (existing) this.entries.delete(compositeKey);

    const promise = operation();
    const entry: Entry<T> = { fingerprint, expiresAt: now + this.ttlMs, promise };
    this.entries.set(compositeKey, entry);

    try {
      return { value: await promise, replayed: false };
    } catch (error) {
      if (this.entries.get(compositeKey) === entry) this.entries.delete(compositeKey);
      throw error;
    }
  }
}
