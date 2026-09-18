# Threat model

This is a compact demo, but the security decisions are explicit.

| Threat | Control in this repository | Production follow-up |
| --- | --- | --- |
| Stolen or missing bearer token | Bearer verification before REST/MCP; tokens are never logged | OIDC/OAuth, short-lived tokens, rotation, revocation |
| Over-privileged agent | Separate `tasks:read` / `tasks:write` scopes and MCP scope challenges | Per-tenant policy and finer action scopes |
| Duplicate agent/tool retries | Caller-scoped idempotency key + request fingerprint | Durable idempotency records in the write transaction |
| Cross-client idempotency collision | Client identity is part of the idempotency key | Tenant/account identity from validated claims |
| Lost update | Optional expected-version optimistic locking | Database compare-and-swap / row version |
| Slow/failing upstream policy service | Abort-based timeout and bounded exponential retry | Circuit breaker, metrics, SLOs, fallback policy |
| DNS rebinding against local MCP endpoint | MCP Express app uses the SDK's localhost host/origin validation defaults | Explicit allowed hosts/origins behind ingress |
| Untraceable agent actions | Request IDs and structured audit records for writes | Central immutable audit sink with retention |
| Oversized request body | MCP Express/Express JSON parsing and narrow schemas; REST payloads are tiny | Explicit edge/body limits at ingress as well |

## Non-goals

The repository is not an authorization server, secrets manager, multi-tenant database, durable queue, or production audit store. Those concerns are represented by boundaries rather than mocked as if they were production-complete.
