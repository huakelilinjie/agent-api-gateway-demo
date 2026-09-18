# AI-assisted engineering review notes

This repository is intentionally suitable for AI-assisted implementation, but AI output is treated as untrusted draft code until reviewed against invariants and failure modes.

## Concrete review finding

The first implementation of `HttpTaskPolicy` wrapped only the network `fetch()` call in the retry helper. HTTP status validation happened *after* the retry boundary. That meant connection failures retried, but a `503 Service Unavailable` returned immediately even though the design required retries for `429` and `5xx` responses.

The fix moved HTTP status classification inside the retry operation and added regression tests proving that `503 -> 200` retries while `400` fails without retrying.

This is the kind of error that can look reasonable in generated code: the project has a retry helper and the HTTP client calls it, but the semantic retry boundary is wrong. Review therefore focuses on behavior and invariants, not the presence of expected abstractions.

## Review checklist used here

- authorization is enforced before business operations;
- read and write capabilities use distinct scopes;
- idempotency is scoped by caller and detects payload mismatch;
- concurrent duplicate requests share the same in-flight operation;
- optimistic locking rejects stale updates;
- transient HTTP failures are classified inside the retry boundary;
- timeouts abort the underlying fetch;
- logs carry correlation IDs but never bearer tokens;
- MCP tools reuse domain services instead of duplicating backend logic.
