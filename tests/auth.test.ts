import { describe, expect, it } from 'vitest';
import { OAuthError } from '@modelcontextprotocol/server';
import { createStaticTokenVerifier } from '../src/security/auth.js';

describe('static token verifier', () => {
  it('returns a scoped principal for a valid token', async () => {
    const verifier = createStaticTokenVerifier([
      { token: 'secret', clientId: 'client-a', scopes: ['mcp', 'tasks:read'], expiresAt: Math.floor(Date.now() / 1000) + 60 }
    ]);

    const info = await verifier.verifyAccessToken('secret');
    expect(info.clientId).toBe('client-a');
    expect(info.scopes).toContain('tasks:read');
  });

  it('rejects invalid and expired tokens', async () => {
    const verifier = createStaticTokenVerifier([
      { token: 'expired', clientId: 'client-a', scopes: ['mcp'], expiresAt: 1 }
    ]);

    await expect(verifier.verifyAccessToken('missing')).rejects.toBeInstanceOf(OAuthError);
    await expect(verifier.verifyAccessToken('expired')).rejects.toBeInstanceOf(OAuthError);
  });
});
