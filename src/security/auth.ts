import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { AuthInfo, OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';

export type Scope = 'mcp' | 'tasks:read' | 'tasks:write';

export interface TokenPrincipal {
  token: string;
  clientId: string;
  scopes: Scope[];
  expiresAt: number;
}

function digest(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export function createStaticTokenVerifier(principals: TokenPrincipal[]): OAuthTokenVerifier {
  const indexed = principals.map(principal => ({
    principal,
    digest: digest(principal.token)
  }));

  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const candidate = digest(token);
      const match = indexed.find(entry => timingSafeEqual(entry.digest, candidate));
      if (!match || match.principal.expiresAt <= Math.floor(Date.now() / 1000)) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid or expired bearer token');
      }
      return {
        token,
        clientId: match.principal.clientId,
        scopes: [...match.principal.scopes],
        expiresAt: match.principal.expiresAt
      };
    }
  };
}

export function verifierFromEnv(env: NodeJS.ProcessEnv = process.env): OAuthTokenVerifier {
  const expiresAt = Math.floor(Date.now() / 1000) + Number(env.DEMO_TOKEN_TTL_SECONDS ?? '86400');
  const principals: TokenPrincipal[] = [];

  if (env.DEMO_READ_TOKEN) {
    principals.push({
      token: env.DEMO_READ_TOKEN,
      clientId: 'demo-reader',
      scopes: ['mcp', 'tasks:read'],
      expiresAt
    });
  }
  if (env.DEMO_WRITE_TOKEN) {
    principals.push({
      token: env.DEMO_WRITE_TOKEN,
      clientId: 'demo-writer',
      scopes: ['mcp', 'tasks:read', 'tasks:write'],
      expiresAt
    });
  }
  return createStaticTokenVerifier(principals);
}

export function requireRestScope(verifier: OAuthTokenVerifier, scope: Scope): RequestHandler {
  return async (req, res, next) => {
    const header = req.header('authorization');
    const match = header?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    try {
      const auth = await verifier.verifyAccessToken(match[1]);
      if (!auth.scopes.includes(scope)) {
        res.status(403).json({ error: 'insufficient_scope', requiredScope: scope });
        return;
      }
      res.locals.auth = auth;
      next();
    } catch {
      res.status(401).json({ error: 'invalid_token' });
    }
  };
}
