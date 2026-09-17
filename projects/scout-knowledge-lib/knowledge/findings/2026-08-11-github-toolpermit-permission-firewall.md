<ai_context>
summary: "GitHub findings on approval integrity: ToolPermit binds one-time consent to a canonical request, Agentweaver binds reusable authority to policy scope and lifecycle, and QuietPilot separates renewable approval identity from stable external-effect identity so uncertain retries can reconcile rather than duplicate work."
triggers: ["ToolPermit", "Agentweaver", "QuietPilot", "MCP permissions", "one-time approval", "approval scope", "approval generation", "approval substitution", "operation identity", "effect reconciliation", "canonical request digest", "policy replay", "redacted audit"]
last_updated: "2026-09-15"
source_basis: "ToolPermit implementation at commit 6980cfaf47f5126acb00523be969f964fbefbb77; Agentweaver durable approval gate, migrations, API contract, and approval persistence tests at commit a1482aa89fa5c5d7fc310daf070d059760205d78; and QuietPilot approval, execution, Google Calendar adapter, and tests at commit 6f5b80b9b0af9f876f5633043acd24ff4279f751."
</ai_context>

# ToolPermit: Approval Is a Request-Bound Capability, Not a Button State

Date: 2026-08-11  
Source: GitHub  
Repo: https://github.com/sunhao123456sun-svg/toolpermit

## Signal

**ToolPermit** is an early local proxy for MCP `stdio` servers that applies deterministic `allow / ask / deny` policy before forwarding tool calls. Its reusable design signal is narrower than “put a human in the loop”: approval is represented as a short-lived, one-time capability for one exact request, rather than a durable boolean attached only to a tool name.

The implementation hashes the tool name, typed arguments, tool-schema fingerprint, policy digest, run ID, connection ID, purpose, protocol version, and expiry into the approval identity. A conditional SQLite transition consumes that approval only when it is still approved, unexpired, and digest-matched. This turns approval from ambient authority into an admission token whose scope can be checked at execution time.

## Source-grounded details

- **Repository status:** GitHub API metadata reported an Apache-2.0 repository created on 2026-08-11 with 12 stars and 2 forks at observation time. The README identifies release `v0.1.1`; these are early-project signals, not evidence of production adoption.
- **Typed canonicalization resists substitution:** `TP-CANONICAL-V1` preserves distinctions among null, booleans, integers, finite floats, strings, arrays, and sorted-key objects instead of relying on display JSON. Domain-separated SHA-256 digests distinguish approvals, policies, and schemas.
- **Approval scope includes changing context:** the approval digest binds arguments and tool name together with the schema fingerprint, policy digest, run, connection, and expiry. A policy or schema change therefore cannot silently inherit an earlier approval for nominally the same tool call.
- **Consumption is atomic and single-use:** the service conditionally changes `approved` to `executing` only when approval ID, request digest, state, and expiry all match. Competing or repeated consumption attempts cannot both satisfy that state transition.
- **Ambiguous execution is not retried as success:** completed calls become `executed` or `failed`; a process restart changes any still-`executing` approval to `unknown`. The security guide tells operators to treat `unknown` as unresolved risk rather than automatically replaying an effect that may already have happened.
- **Policy evaluation fails closed:** in enforce mode, evaluation exceptions produce a deny decision. A denied call is not sent upstream; an `ask` call waits until its exact approval is consumed, while cancellation before execution prevents forwarding.
- **Audit privacy is ordered before persistence:** recognized secrets and sensitive keys are redacted before SQLite storage, UI display, and export. Offline policy replay uses those stored events without starting the upstream MCP server.
- **Privacy weakens later policy simulation:** when a candidate rule depends on a redacted value, replay marks the result `indeterminate` rather than pretending it can reconstruct the original decision. The project explicitly documents that irreversible redaction reduces replay precision.
- **Test status:** the checked tree contains unit and integration suites for approvals, audit, canonicalization, policy, replay, proxy, CLI, and web controls. Scout could not execute them because the available Python 3.11 environment lacks the `pytest` module, so this note treats source and test presence as inspectable evidence, not independently reproduced behavior.

## Why it matters

Human approval systems have a common authority-confusion failure: the interface shows a plausible action, but the eventual execution can differ in arguments, schema interpretation, policy context, session, or time. ToolPermit's pattern suggests a stronger protocol:

1. Canonicalize the complete security-relevant request with explicit type semantics.
2. Bind approval to the request plus the policy and schema under which it was reviewed.
3. Add run/connection scope and a short expiry to prevent ambient reuse.
4. Consume approval through one atomic state transition immediately before dispatch.
5. Record `executing` separately from `executed`, and preserve uncertainty across crashes.

The non-obvious companion lesson is that **audit minimization and counterfactual evaluation compete for the same information**. Redacting arguments before storage limits secret exposure, but policy replay may later need those exact values. A trustworthy system should expose that loss as `indeterminate`, as ToolPermit does, or use a more elaborate design such as keyed/tokenized comparisons, separately protected short-retention evidence, or aggregate predicates. It should not silently label a privacy-degraded replay as decisive.

This also complements effect-reversibility designs: request-bound approval governs whether an external effect may begin, while snapshots or compensating actions govern what happens afterward. Approval is not rollback, and the repository explicitly avoids making that claim.

## Limits and watchpoints

- Mediation covers only local MCP `stdio` calls routed through the wrapper. Direct server access, remote transports, non-MCP execution, and already-performed effects remain outside the boundary.
- ToolPermit is not an OS sandbox. An allowed upstream tool can still behave dishonestly, escape intended path semantics, or encounter symlink/TOCTOU races.
- The deployment assumes one local user. The loopback UI has no accounts, RBAC, remote approvers, or protection from a malicious process already inside the same local-account boundary.
- The proxy polls SQLite for approval state; the inspected design is useful for integrity, but this observation does not establish performance or robustness at fleet scale.
- Stored outcomes contain limited metadata rather than full result bodies, and retention is manual.
- Repository metadata and implementation were inspected at an early release; adoption and independent security review are unknown.

## GitHub update — Reusable approval scope is a versioned policy capability (2026-09-14)

[Agentweaver](https://github.com/sabbour/agentweaver) exposes a complementary problem that one-request approval does not solve: what must be true before consent can safely authorize later calls, sibling work, or future runs? Its pinned implementation offers `once`, `run`, `tool`, and `always` scopes, but does not represent the broader scopes as a free-floating “approved tool” flag.

The durable policy record carries project, owner, tool ID, risk semantics, approval generation, and scope. Policy lookup requires those fields to match the current run subject. Lifecycle-scoped grants must match the run's current `ApprovalGeneration`; malformed or legacy payloads fail closed. An `always` grant deliberately omits lifecycle generation because it crosses runs, but is stored in a bucket derived from project and owner, requires a real project, and is available only to tools the policy marks eligible. This yields two distinct capability forms: a lifecycle policy tied to a generation, and a cross-run policy tied to a principal and project.

The write path also treats approval as a concurrency problem. For every non-`once` grant, it requires the requesting run—and any parent receiving the policy—to remain active while approval resolution and all policy events are committed. PostgreSQL uses row locks within the transaction; non-PostgreSQL providers use in-process claims around the read-and-commit interval. Sorted stream locks and one transaction make a racing `once` versus `always`, or grant versus denial, choose one terminal resolution rather than resolve the request narrowly while leaking a broader policy.

The inspected PostgreSQL integration tests encode those intended invariants: cross-replica `always` grants apply to a future run for the same owner and project but not a different owner or project; concurrent `once` and `always` decisions persist only the winning scope; a denial that wins against `always` leaves no project policy; and a timeout that loses the request claim returns the winning grant result. A separate active-parent test rejects a child `run`-scope grant once its parent is awaiting review. These are repository test artifacts, not an independently executed deployment result.

The repository also adds explicit run fields for `approval_generation` and a launch-time approval-policy snapshot (`snapshot_id`, source, capture time, settings update time, inheritance source, and launch autopilot/auto-approve values). The migrations prove those provenance fields exist in the data model; this inspection did not trace every field through capture and display, so it does not claim end-to-end snapshot completeness.

### Reusable design rule

Approval receipts need different bindings according to how far authority travels:

1. **Exact-call authority:** bind canonical arguments and changing request context, then consume once, as ToolPermit does.
2. **Lifecycle authority:** bind principal, project, tool semantics, and a lifecycle generation so restart/recovery cannot silently inherit stale consent.
3. **Cross-run authority:** remove the lifecycle binding only deliberately, replace it with a stable administrative boundary such as owner plus project, and restrict which risks are eligible.
4. **Resolution integrity:** atomically claim the pending request and create every derived policy; otherwise a losing broad-scope decision may still leave ambient authority behind.
5. **Liveness at grant time:** prove every lifecycle that will inherit the policy is still active inside the same exclusion interval as persistence.

This extends the original finding: an approval is not merely request-bound—it is a capability whose complete binding set must expand or contract with its reuse horizon. “Remember this choice” is a security-sensitive policy derivation, not a UI convenience.

### Agentweaver limits and watchpoints

- Scout inspected source and test artifacts but did not build or run Agentweaver; the tests are executable design evidence, not independent reproduction.
- Repository metadata reported six stars at observation time, so this is an implementation signal rather than adoption evidence.
- The operator policy fails closed for unknown MCP tools and includes a coverage test by design, but its source comments state that approval classification is maintained in explicit lists because tool declarations lack machine-readable annotations.
- The API documents five-minute request expiry. Expiry bounds a pending decision; it does not by itself expire a successfully persisted `run`, `tool`, or `always` policy.
- A project-and-owner boundary is stronger than a global grant but still broad. Whether it is appropriate depends on project membership, ownership transitions, tool semantics, and revocation paths outside the files inspected here.

## GitHub update — Approval identity and effect identity have different lifetimes (2026-09-15)

[QuietPilot](https://github.com/kcyoow/quietpilot-agents-for-humans) implements a useful companion to request-bound approval: the human authorization may expire and be renewed, while an already-attempted external effect must keep the same identity. At pinned commit [`6f5b80b9b0af9f876f5633043acd24ff4279f751`](https://github.com/kcyoow/quietpilot-agents-for-humans/commit/6f5b80b9b0af9f876f5633043acd24ff4279f751), its Calendar path derives an `operation_id` from user, Case, plan version, and canonical plan hash. A separate `approval_id` adds the Case version at which the user approved. Re-approval can therefore create a new consent receipt without changing which Calendar event the operation denotes.

The approval transaction rechecks the current Case version, immutable plan hash/version, connected account epoch, account hash, and required Calendar scope before atomically storing a one-hour `ONCE` approval and moving the Case to `QUEUED`. Execution revalidates those bindings, evidence revisions, action fields, account, scopes, and expiry before invoking the runtime. This closes more of the approval-to-execution gap than a hash check alone: connection replacement, evidence revision, or plan substitution blocks use of the receipt.

The external adapter then turns the stable operation identity into a deterministic Google Calendar event ID. It performs `GET` before `POST`; after a timeout, conflict, throttling response, server error, or malformed response that could follow a committed write, it reads that same event ID back instead of issuing an unrelated create. Completion requires a separate readback matching the approved title, description, start/end, privacy, reminders, operation/content markers, and the absence of unapproved attendees, recurrence, conferences, or attachments. An uncertain initial read performs no write, an uncertain post-write read stays `VERIFYING`, and a cancelled tombstone is not recreated.

The repository tests preserve the distinction across difficult races: an expired unknown operation obtains a new approval ID but retains the same event identity; a late verified success under the previous approval is recorded and promoted without another runtime call; concurrent workers are fenced by a lease; and a result reference for another operation cannot become completion. These are inspected test artifacts rather than Scout-executed results. The README reports 1,919 Python and 577 mobile tests and dated live checks, but also says a new real-mail routine trigger remains unobserved; repository-authored verification is not independent production evidence.

### Reusable design rule

A side-effecting agent needs at least three separately reviewable identities:

1. **Intent identity:** immutable security-relevant action material, including evidence/config revisions that affect what the action means.
2. **Approval identity:** who approved that intent, under which live account/policy state, at which lifecycle version, and until when.
3. **Effect identity:** a stable provider-visible operation key that survives transport ambiguity, retries, lease recovery, and approval renewal for the same intent.

Rotating the effect identity whenever consent is renewed can duplicate an already-committed action. Reusing the approval identity indefinitely can extend stale authority. The safe recovery path is to renew authorization when required while reconciling the same external effect key, and to mark completion only after provider readback proves that the existing object matches the approved intent.

### QuietPilot limits and watchpoints

- The inspected executor covers one Google Calendar create action with deterministic provider IDs; other providers and effect types may not offer equivalent create-if-absent or readback semantics.
- The runtime trusts Google Calendar's event-ID namespace and authenticated readback. This addresses duplicate creation and content substitution, not compromise of the provider or account.
- The operation identity includes user, Case, and plan material, but the provider marker exposes only hashes. Incident response still needs protected local records to interpret them.
- Scout inspected pinned source and tests through public read-only endpoints but did not execute the suite or reproduce the deployed AWS/Google path.
- GitHub metadata showed a newly created, zero-star repository at inspection time. This is an implementation pattern, not adoption evidence.

## Primary sources

### ToolPermit

- Repo at inspected revision: https://github.com/sunhao123456sun-svg/toolpermit/commit/6980cfaf47f5126acb00523be969f964fbefbb77
- GitHub API metadata: https://api.github.com/repos/sunhao123456sun-svg/toolpermit
- GitHub search feed: https://api.github.com/search/repositories?q=agent%20created%3A%3E%3D2026-08-10%20stars%3A%3E%3D5&sort=stars&order=desc&per_page=20
- README: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/README.md
- Architecture: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/docs/architecture.md
- Security model: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/docs/security.md
- Known limitations: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/docs/limitations.md
- Canonical digests: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/src/toolpermit/canonical.py
- Approval lifecycle: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/src/toolpermit/approvals/service.py
- MCP mediation: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/src/toolpermit/protocol/mcp/proxy.py
- Offline replay: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/src/toolpermit/replay/engine.py

### Agentweaver

- Repo at inspected revision: https://github.com/sabbour/agentweaver/commit/a1482aa89fa5c5d7fc310daf070d059760205d78
- GitHub API metadata: https://api.github.com/repos/sabbour/agentweaver
- Discovery query: https://api.github.com/search/repositories?q=%22AI+agent%22+pushed%3A%3E%3D2026-09-14&sort=updated&order=desc&per_page=20
- Durable approval gate: https://github.com/sabbour/agentweaver/blob/a1482aa89fa5c5d7fc310daf070d059760205d78/apps/Agentweaver.Api/Runs/DurableToolApprovalGate.cs
- AgentHost approval bridge: https://github.com/sabbour/agentweaver/blob/a1482aa89fa5c5d7fc310daf070d059760205d78/apps/Agentweaver.AgentHost/AgentHostDurableToolApprovalGate.cs
- Operator tool policy: https://github.com/sabbour/agentweaver/blob/a1482aa89fa5c5d7fc310daf070d059760205d78/packages/Agentweaver.AgentRuntime/OperatorToolApprovalPolicy.cs
- Approval-generation migration: https://github.com/sabbour/agentweaver/blob/a1482aa89fa5c5d7fc310daf070d059760205d78/apps/Agentweaver.Api.Migrations.Postgres/Migrations/20260828131148_AddRunApprovalLifecycleGeneration.cs
- Approval-policy snapshot migration: https://github.com/sabbour/agentweaver/blob/a1482aa89fa5c5d7fc310daf070d059760205d78/apps/Agentweaver.Api.Migrations.Postgres/Migrations/20260911003114_AddRunApprovalPolicySnapshot.cs
- PostgreSQL persistence tests: https://github.com/sabbour/agentweaver/blob/a1482aa89fa5c5d7fc310daf070d059760205d78/tests/Agentweaver.Tests/PostgresIntegration/ToolApprovalPersistenceTests.cs
- API approval contract: https://github.com/sabbour/agentweaver/blob/a1482aa89fa5c5d7fc310daf070d059760205d78/apps/Agentweaver.Api/API.md

### QuietPilot

- Repo at inspected revision: https://github.com/kcyoow/quietpilot-agents-for-humans/commit/6f5b80b9b0af9f876f5633043acd24ff4279f751
- GitHub API metadata: https://api.github.com/repos/kcyoow/quietpilot-agents-for-humans
- Discovery query: https://api.github.com/search/repositories?q=agent+approval+created%3A%3E%3D2026-09-14&sort=stars&order=desc&per_page=20
- README and verification boundary: https://github.com/kcyoow/quietpilot-agents-for-humans/blob/6f5b80b9b0af9f876f5633043acd24ff4279f751/README.md
- Exact approval transaction: https://github.com/kcyoow/quietpilot-agents-for-humans/blob/6f5b80b9b0af9f876f5633043acd24ff4279f751/services/control-api/src/quietpilot_control_api/calendar_approval.py
- Canonical plan hashing: https://github.com/kcyoow/quietpilot-agents-for-humans/blob/6f5b80b9b0af9f876f5633043acd24ff4279f751/services/control-api/src/quietpilot_control_api/plan_hash.py
- Execution validation and recovery: https://github.com/kcyoow/quietpilot-agents-for-humans/blob/6f5b80b9b0af9f876f5633043acd24ff4279f751/services/worker/src/quietpilot_worker/calendar_execution.py
- Deterministic Calendar create/readback adapter: https://github.com/kcyoow/quietpilot-agents-for-humans/blob/6f5b80b9b0af9f876f5633043acd24ff4279f751/services/agent/src/quietpilot_agent/google_calendar.py
- Execution race and recovery tests: https://github.com/kcyoow/quietpilot-agents-for-humans/blob/6f5b80b9b0af9f876f5633043acd24ff4279f751/services/worker/tests/test_calendar_execution.py
- Calendar ambiguity and readback tests: https://github.com/kcyoow/quietpilot-agents-for-humans/blob/6f5b80b9b0af9f876f5633043acd24ff4279f751/services/agent/tests/test_google_calendar.py
