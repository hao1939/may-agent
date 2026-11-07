<ai_context>
summary: "Nanocode shows two related authority boundaries: grant identity must survive durable file exchange, and runtime identity must remain attached to remote processes and reconnects. Its current SDK also separates portable contracts, orchestration, provider backends, and native host effects."
triggers: ["agent file transfer", "capability grant", "durable inputs", "agent artifacts", "grant-scoped storage", "turn ownership", "Nanocodex", "Nanocode", "executor identity", "unknown outcome", "Connect"]
last_updated: "2026-11-07"
source_basis: "Original grant-scoped file evidence was inspected at a6e91abe4004f6b98b369d93d9d929114d59b441. The 2026-11-07 update used a current GitHub repository search, same-repository redirect check, non-truncated tree, crate overview, remote-runner contract, authority source, and durable-session example at 0a98b23a1ccb175aed1bca06ee0a0ed7dbb225a7. Tests and implementations were not executed."
</ai_context>

# Agent File Exchange Needs Grant Identity After Execution Starts

**Date:** 2026-09-25  
**Disposition:** New knowledge  
**Repo:** https://github.com/gakonst/nanocodex  
**Pinned commit:** https://github.com/gakonst/nanocodex/commit/a6e91abe4004f6b98b369d93d9d929114d59b441

## Observation

A current GitHub topic search surfaced Nanocodex while commit
`a6e91abe4004f6b98b369d93d9d929114d59b441` was adding “durable grant-scoped
Connect inputs and artifacts.” The repository tree at that revision contained
4,265 entries and was not truncated. The commit reports 597 additions and 19
deletions across nine files.

The change treats files as a continuation of authorization rather than generic
session storage:

- an app may upload only to an exact
  `/inputs/{generation UUID}/{filename}` route under an active Connect grant
  with sandbox execution, write, and tool capabilities;
- the server accepts exactly canonical base64 bytes plus a lowercase SHA-256,
  verifies the digest, derives the destination path itself, and reserves quota
  before writing;
- the same name and bytes form an idempotent retry, while the same name with
  different bytes returns a conflict;
- output capture uses a grant-specific directory and retains the turn's grant
  owner before publication;
- artifact listing requires a turn ID, and metadata and content reads must
  match that retained owner and the `agent.output.final` capability; and
- expired or revoked grants, alternate agents, noncanonical paths, extra query
  parameters, and unsupported methods are rejected before storage is reached.

The implementation also preserves artifact bytes as opaque content. It passes
through a small allowlist of download headers, including digest ETags and content
length, rather than applying protocol-message rewriting to JSON or event-stream
artifacts. That distinction prevents a proxy transform from silently changing
the bytes that a receipt is supposed to identify.

## Why the design is useful

A common capability model authorizes the call that starts an agent and then
lets inputs, workspace paths, and outputs inherit ambient session authority.
This commit demonstrates a stricter lifecycle:

1. **admission identity** — a live signed grant names the app and agent;
2. **input identity** — server-derived paths include the grant, while digest,
   size, and immutable name make retries checkable;
3. **execution identity** — accepted turns retain their grant owner;
4. **publication identity** — only the grant-owned output directory is captured;
5. **retrieval identity** — list and content routes re-check the same owner and
   output capability.

The non-obvious part is the retained turn owner. If authorization is checked
only when a turn begins, later artifact publication or archival can lose the
principal that justified the work. Persisting that relationship allows the
read path to answer “which grant owns this artifact?” after the live execution
context is gone.

Quota reservations are part of the security boundary too. The implementation
counts incomplete reservations and allows the original bytes to retry after an
interrupted write. This avoids choosing between two bad recovery modes: freeing
failed reservations so they can be abused to evade quotas, or making transient
failures permanently unrecoverable.

## Boundary the change does not provide

The changed documentation explicitly says that `/brain` remains shared across
an agent's conversations and authorization cohorts. Grant-scoped transfer paths
therefore do **not** imply grant-scoped execution memory. Another approval cannot
adopt an existing approval's named mount, but native workspace isolation does
not split the shared brain.

That caveat should be carried into architecture claims: scoped ingress and
egress reduce cross-grant file disclosure, but they are not tenant isolation.
A system that needs hostile-principal separation still needs separate execution
state or a stronger mediation layer around every shared-brain access.

## Update — renamed Nanocode SDK separates runtime identity from logical mounts (2026-11-07)

The repository now resolves as `gakonst/nanocode` (the old `gakonst/nanocodex` API route redirects to the same repository ID). At pinned revision `0a98b23a1ccb175aed1bca06ee0a0ed7dbb225a7`, its current crate map makes a broader boundary explicit: portable contracts and state machines live in `core/`; backend-generic agents, subagents, durable sessions, and tool selection live in `runtime/`; provider protocol and prompt implementations live in separate backend trees; and native shells, browsers, sandboxes, stores, telemetry, and remote runners live in `integrations/`. The project says a dependency-boundary script enforces these directions. Scout inspected that statement and the tree, but did not run the script or compile the workspace.

The remote-runner contract adds a useful continuity rule. A model-visible mount name is only a logical route: process handles retain both the runner namespace and executor runtime identity. Reopening a durable agent session can poll an earlier remote process only while that same runner remains alive; a restarted runner fences the old handle. If a connection drops after dispatch, reconnection may recover calls from the same executor journal, but an executor restart produces an **unknown-outcome** error rather than replaying the call. Explicit disconnect revokes that executor identity, and replacement stays unavailable until a runner reconnects.

This sharpens the original grant-scoping lesson: durable session identity, logical workspace identity, and effect-executor identity are different coordinates. A session receipt should not make a remote effect safely replayable unless the runtime can prove which executor accepted it and whether that executor's journal survived. The same source also exposes limits: it documents architecture and recovery semantics, not production correctness; Scout did not run Nanocode, compile it, execute its examples or tests, attach a runner, or induce a disconnect. The repository has no root README at this revision, and its crate overview says there is no packaged WASM SDK or stable wasm-bindgen ABI.

- **Current repository:** https://github.com/gakonst/nanocode
- **Inspected revision:** https://github.com/gakonst/nanocode/commit/0a98b23a1ccb175aed1bca06ee0a0ed7dbb225a7
- **Sources:** [crate boundaries](https://github.com/gakonst/nanocode/blob/0a98b23a1ccb175aed1bca06ee0a0ed7dbb225a7/crates/README.md), [remote workspace runtime](https://github.com/gakonst/nanocode/blob/0a98b23a1ccb175aed1bca06ee0a0ed7dbb225a7/crates/backends/codex/WORKSPACE_RUNTIME.md), [root-only subagent authority](https://github.com/gakonst/nanocode/blob/0a98b23a1ccb175aed1bca06ee0a0ed7dbb225a7/crates/runtime/subagents/src/authority.rs), and [durable-session example](https://github.com/gakonst/nanocode/blob/0a98b23a1ccb175aed1bca06ee0a0ed7dbb225a7/crates/nanocode/examples/durable_session.rs)

## Practical implication

Durable agent runtimes should make file receipts first-class authorization
records. At minimum, a receipt should bind principal/grant, agent, generation or
turn, server-derived path, digest, size, publication state, and retry semantics.
The same binding must be checked on upload, capture, archival, and download;
checking it only at invocation leaves a post-execution authority gap.

This complements the broader library's runtime-integrity theme: receipts are
not only evidence that an effect happened. They can also preserve **whose
authority made the effect admissible** after the original request is no longer
live.

## Evidence boundary

Scout inspected the public Search API response, repository metadata, a complete
Git tree, and the pinned commit response and diff. The added tests cover forged
headers, stale grants, path traversal, immutable conflicts, interrupted writes,
quota accounting, cross-grant reads, and exact-byte downloads. Scout did not
clone the repository or execute those tests, so this finding describes the
checked-in design and test intent, not independently verified runtime behavior.
The search response reported `incomplete_results=false`.

## Pinned sources

- Repository: https://github.com/gakonst/nanocodex
- Commit: https://github.com/gakonst/nanocodex/commit/a6e91abe4004f6b98b369d93d9d929114d59b441
- Runtime documentation: https://github.com/gakonst/nanocodex/blob/a6e91abe4004f6b98b369d93d9d929114d59b441/js/managed/README.md
- Input implementation: https://github.com/gakonst/nanocodex/blob/a6e91abe4004f6b98b369d93d9d929114d59b441/js/managed/src/connect-inputs.ts
- Artifact ownership implementation: https://github.com/gakonst/nanocodex/blob/a6e91abe4004f6b98b369d93d9d929114d59b441/js/managed/src/session-operations.ts
- Runtime boundary tests: https://github.com/gakonst/nanocodex/blob/a6e91abe4004f6b98b369d93d9d929114d59b441/js/managed/test/connect-durable-files.test.ts
- Public API boundary tests: https://github.com/gakonst/nanocodex/blob/a6e91abe4004f6b98b369d93d9d929114d59b441/js/connect-api/test/managedFiles.test.mjs
