# AI-assisted engineering review notes

This repository is intentionally suitable for AI-assisted implementation, but AI output is treated as untrusted draft code until reviewed against invariants, released SDK behavior and failure modes.

## Review finding 1: retry boundary looked correct but was semantically wrong

The first implementation of `HttpTaskPolicy` wrapped only the network `fetch()` call in the retry helper. HTTP status validation happened *after* the retry boundary. That meant connection failures retried, but a `503 Service Unavailable` returned immediately even though the design required retries for `429` and `5xx` responses.

The fix moved HTTP status classification inside the retry operation and added regression tests proving that `503 -> 200` retries while `400` fails without retrying.

## Review finding 2: documentation can be ahead of the released SDK surface

An initial MCP implementation used the upstream repository's newer `scopeChallenge` / `requireScopes` API. CI against the released npm package caught that those symbols were not yet in the installed public type surface. The implementation was revised to keep endpoint authentication at the transport boundary and enforce task scopes explicitly inside tool handlers, with the authorization rule expressed in application-owned code rather than relying on an unreleased helper.

This is a useful AI-review failure mode: generated code can be consistent with current documentation or source `main` while still being incompatible with the exact package version a project installs.

## Review checklist used here

- authorization is enforced before business operations;
- read and write capabilities use distinct scopes;
- idempotency is scoped by caller and detects payload mismatch;
- concurrent duplicate requests share the same in-flight operation;
- optimistic locking rejects stale updates;
- transient HTTP failures are classified inside the retry boundary;
- timeouts abort the underlying fetch;
- logs carry correlation IDs but never bearer tokens;
- MCP tools reuse domain services instead of duplicating backend logic;
- CI validates the actual released dependency surface.
