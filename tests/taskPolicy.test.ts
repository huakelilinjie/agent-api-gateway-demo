import { describe, expect, it, vi } from 'vitest';
import { HttpTaskPolicy } from '../src/services/taskPolicy.js';

describe('HttpTaskPolicy', () => {
  it('retries transient HTTP failures before accepting a policy decision', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'busy' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ allowed: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));

    const policy = new HttpTaskPolicy({
      url: new URL('https://policy.example.test/check'),
      timeoutMs: 100,
      attempts: 2,
      fetchImpl
    });

    await expect(policy.check('safe task')).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent client errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'bad request' }), { status: 400 }));

    const policy = new HttpTaskPolicy({
      url: new URL('https://policy.example.test/check'),
      timeoutMs: 100,
      attempts: 3,
      fetchImpl
    });

    await expect(policy.check('bad task')).rejects.toThrow('HTTP 400');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
