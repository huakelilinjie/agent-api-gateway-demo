import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../src/reliability/retry.js';

describe('withRetry', () => {
  it('retries transient failures with a bounded attempt count', async () => {
    const operation = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue('ok');
    const sleep = vi.fn(async () => {});

    await expect(
      withRetry(operation, { attempts: 3, baseDelayMs: 10, maxDelayMs: 50, sleep })
    ).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it('does not retry permanent failures', async () => {
    const error = new Error('permanent');
    const operation = vi.fn(async () => { throw error; });

    await expect(
      withRetry(operation, {
        attempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 50,
        shouldRetry: () => false,
        sleep: async () => {}
      })
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
