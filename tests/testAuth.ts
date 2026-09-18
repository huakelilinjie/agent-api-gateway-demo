import { createStaticTokenVerifier } from '../src/security/auth.js';

const expiresAt = Math.floor(Date.now() / 1000) + 3600;

export const testTokenVerifier = createStaticTokenVerifier([
  { token: 'reader-token', clientId: 'reader', scopes: ['mcp', 'tasks:read'], expiresAt },
  { token: 'writer-token', clientId: 'writer', scopes: ['mcp', 'tasks:read', 'tasks:write'], expiresAt }
]);
