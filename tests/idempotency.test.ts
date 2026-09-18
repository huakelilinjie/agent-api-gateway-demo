import { describe, expect, it, vi } from 'vitest';
import { IdempotencyConflictError, InMemoryIdempotencyStore } from '../src/idempotency/idempotencyStore.js';

describe('InMemoryIdempotencyStore', () => {
  it('collapses concurrent duplicates into one operation', async () => {
    const store = new InMemoryIdempotencyStore();
    const operation = vi.fn(async () => ({ id: 'one' }));

    const [first, second] = await Promise.all([
      store.execute('client-a', 'key', 'fingerprint', operation),
      store.execute('client-a', 'key', 'fingerprint', operation)
    ]);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(first.value).toEqual(second.value);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
  });

  it('isolates keys by caller and rejects conflicting payloads', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.execute('client-a', 'key', 'a', async () => 1);
    await expect(store.execute('client-a', 'key', 'b', async () => 2)).rejects.toBeInstanceOf(IdempotencyConflictError);
    await expect(store.execute('client-b', 'key', 'b', async () => 2)).resolves.toMatchObject({ value: 2, replayed: false });
  });
});
