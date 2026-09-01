<ai_context>
summary: "Cross-source finding on authority placement in agent memory: Halofy and Switchboard separate identity, writes, retrieval, grants, audit, erasure, and handoff custody; arXiv 2604.16548v2 adds five proposed lifecycle governance predicates; and Mnemo shows why an authenticated tool gate must also bind the principal used inside each operation. These are source-level audit requirements, not proof of deployed end-to-end governance or live exploitation."
triggers: ["Halofy", "Switchboard", "Mnemo", "agent memory governance", "organizational context", "server-owned identity", "scoped retrieval", "signed erasure", "memory ACL", "retrieval driver authority", "agent handoff custody", "caller identity binding"]
last_updated: "2026-09-01"
source_basis: "GitHub repository metadata, primary documentation, recursive trees, tests, package metadata, and public check-run results for Halofy at 3763e64f521df8dc58d00d4632e732e702dd76ef and Switchboard at d2c53b117d554e9919e6f0c2909f04157a2fb49d; full TeX source of arXiv 2604.16548v2; and pinned source inspection of sattyamjjain/mnemo at 376ca28606c5b6287d9c8274482fa791d4dc8703."
</ai_context>

# Agent Memory Governance Is an Authority-Placement Problem

Date: 2026-08-26<br>
Last updated: 2026-09-01<br>
Source: GitHub and arXiv<br>
Repo: https://github.com/halofyai/halofy<br>
Repo: https://github.com/Egoist-Machines/switchboard<br>
Repo: https://github.com/sattyamjjain/mnemo<br>
Paper: https://arxiv.org/abs/2604.16548v2

## Signal

**Halofy** is a new open-source organizational-memory kernel that makes a useful
architectural claim concrete: governing shared agent context is not primarily a
better-retrieval problem. It is an **authority-placement problem** spanning
identity, access, writes, retrieval, audit, and erasure.

At the inspected revision, caller identity is resolved from a credential before
a memory syscall; namespace and actor are not accepted from the syscall request.
Connectors and imports feed the same governed write path as agent conversations.
Retrieval drivers receive an ACL-scoped, read-only view rather than the database,
and every documented syscall outcome—including denial, miss, brownout, and
error—is intended to append an audit row. Corrections create supersedence chains
instead of overwriting prior facts, while deletion is isolated behind a governed
erasure path that emits a signed certificate.

The strongest source signal is not that these controls are claimed to be
complete. Halofy's own threat model names where they stop: an in-process
retrieval driver shares a process trust domain with the kernel, so its
`ScopedView` is an architectural/static-analysis fence rather than a runtime
sandbox; and row-level security is present on only part of the schema, excluding
several older authority-bearing tables. The repository therefore offers both a
candidate governance design and an unusually explicit map of its residual
trust.

A second new repository, **Switchboard**, makes the same authority-placement
principle concrete at a smaller, local-first boundary: memory shared among
OpenCode, Claude Code, and Codex. Its important move is to keep four permissions
distinct. A paired client may propose memory, owner approval determines whether
the proposal becomes memory, an active category grant separately controls
recall, and repository scope only narrows that grant. Approval therefore does
not silently confer read access, and a project match cannot widen a missing
category grant.

Switchboard also treats task handoff as a different authority object from
memory. A handoff is addressed to one exact client or to a profile plus project,
expires, can be claimed once, and erases its snapshot behind a deletion fence
while retaining a content-free receipt. This is a useful refinement to the
authority map: durable shared knowledge and temporary transfer of work custody
should not inherit the same retention or replay semantics.

## Source-grounded details

- GitHub Search query `topic:ai-agents created:>=2026-08-20`, sorted by stars,
  returned the repository with 210 stars and four forks at observation time. It
  was created on 2026-08-22. These counts show early attention, not adoption.
- The architecture document defines Postgres (or embedded PGlite for local use)
  as the authority for memory, embeddings, policy, provenance, tombstones, and
  audit; retrieval sidecars and warm mirrors are explicitly rebuildable caches.
- HTTP and MCP calls resolve a credential into an `Identity`; syscalls take that
  resolved identity rather than caller-supplied actor or namespace fields.
- The namespace rule exposes a caller's exact namespace and `/`-delimited
  ancestors, not siblings or descendants. The threat model says direct reads
  intentionally make a denied foreign identifier indistinguishable from an
  absent identifier to the caller while preserving the distinction in audit.
- All ingestion routes are documented as entering one write pipeline:
  extraction, verification, entity resolution, classification, deterministic
  dedupe, and insert/supersede. The brownout/verbatim lane still passes through
  classification, so degradation is not supposed to bypass protection labels.
- Ordinary corrections close the predecessor's validity interval and insert a
  new row linked by `supersedes`; concurrent closure is guarded and retried
  rather than allowing two writers to silently claim the same predecessor.
- Retrieval extensions receive a per-call `ScopedView` and return references.
  This sharply reduces the intended plugin contract, but the threat model
  explicitly states that an in-process malicious driver is only partially
  controlled because it shares the kernel heap and trust domain.
- The threat model also records partial database defense-in-depth: it reports
  row-level security on 63 of 136 tables, while older core tables including
  `memory_objects`, `audit_log`, `api_keys`, and `sessions` do not have RLS.
  Application predicates therefore remain a critical single fence for those
  tables.
- The repository tree contains focused tests for cross-tenant access, auth,
  audit durability, erasure, and driver behavior. Public checks on the inspected
  commit show the four hermetic-test shards, two driver-conformance lanes,
  typecheck/build, and an end-to-end credential-free story succeeded in one CI
  run. Scout did **not** independently execute the suite.
- Check status is not uniformly green: a later `gitleaks` check on the same
  commit concluded `failure` with one generic exit-code annotation, while an
  earlier gitleaks run succeeded. The public annotation does not identify the
  underlying finding, so this observation cannot establish either a leaked
  secret or a false positive; it is an unresolved repository-health caveat.
- A fresh GitHub Search query, `topic:ai-agents
  created:2026-08-25..2026-08-26`, sorted by stars, returned Switchboard with
  four stars and no forks at observation time. It was created on 2026-08-25;
  these counts indicate only a very early repository signal.
- Switchboard freezes a profile grant's category and project-scope set when the
  grant is created. Later profile changes do not widen that existing grant, and
  project identity is derived from Git repository identity rather than an
  absolute checkout path.
- Runtime operations are documented as offline by default. Local payloads are
  plaintext unless the optional payload codec is used, so filesystem modes and
  operating-system disk encryption remain part of the trust boundary. Optional
  hosted sync sends approved or pending content as separately deletable records
  but keeps recall queries, project paths, repository names, policy settings,
  and handoffs local.
- Exact-client or profile-and-project handoffs have a default 24-hour lifetime.
  A successful claim returns the snapshot once, commits a deletion fence, and
  preserves only content-free lifecycle evidence. The repository's handoff
  tests cover single claim, erasure, exact addressing, project mismatch,
  revocation, expiry, replay convergence, and migration behavior.
- At inspected commit `d2c53b1`, the root package was version 0.2.1 and required
  Node 22. Its two public check runs—tests and publish—both concluded success.
  Scout inspected the workflow and focused test source but did **not** execute
  the suite independently.

## Lifecycle governance qualification

The full source of arXiv `2604.16548v2` turns the authority map into five
proposed Verifiable Memory Governance predicates:

- **Write Authorization:** every committed memory has an authenticated source
  and an explicit write-time authorization result.
- **Provenance Visibility:** every memory retains queryable, lineage-complete
  origin across summarization, merging, and distillation.
- **Principal-Scoped Retrieval:** a query returns only memories whose scope
  includes the requesting principal.
- **Rollbackability:** versioned snapshots and write logs can restore prior
  memory state.
- **Verified Forgetting:** post-deletion probes bound re-exposure from raw logs,
  summaries, indexes, and propagated copies.

The useful architectural claim is dependency, not just coverage. Under the
paper's lineage model, verified forgetting requires rollback, rollback requires
provenance, and provenance must be anchored to an authenticated write origin.
Principal scope is orthogonal to that chain but required for confidentiality.
The proposed metrics—such as traceable-entry fraction, cross-principal leakage,
time to remediation, toxic-entry localization, and post-deletion reappearance—
make the abstractions reviewable.

This evidence is bounded. The paper synthesizes heterogeneous prior studies;
it does not demonstrate an implementation satisfying all five predicates. Its
active limitations call the six phases an organizational scaffold whose
boundaries may blur. The reviewed v2 source labels the review systematic but
does not expose a reproducible search query, screening counts, or inclusion
criteria. The predicates should therefore be used as test hypotheses and audit
questions, not as a completeness theorem or deployment benchmark.

## Implementation qualification — caller identity must reach the operation

Mnemo revision
[`376ca286`](https://github.com/sattyamjjain/mnemo/commit/376ca28606c5b6287d9c8274482fa791d4dc8703)
provides a useful counterexample to checking identity only at dispatch. The
repository is a related implementation discovered through the `2606.04315`
topic; it is not attributable paper code and its claims are not an independent
confirmation of that paper.

The README and tool comments describe four `mnemo.mem_*` operations as an
AutoMEM-inspired agent-controlled flat store. That attribution is too broad:
the paper evaluates query-time `grep`/`read` over raw text and `rg`, `read`,
`dump`, and `index_query` over prebuilt indexes. It does not evaluate agents
authorizing long-term writes, revisions, or deletion. Mnemo's crossover is its
own synthetic test, not a reproduction: the fixed arm stores 12 facts through
three revisions plus 12 incidental details, while the agent-managed arm
manually removes stale versions and omits incidental details. With the test's
BM25/NoopEmbedding fixture, current-fact F1 is 0.500 versus 1.000 and incidental
recall is 1.000 versus 0.000. The result demonstrates the fixture's intended
selectivity tradeoff; it does not validate the paper's benchmarks.

The stronger source-level finding concerns principal binding:

- `call_tool` resolves a verified per-request `CallerContext`, applies its role
  filter, and inserts the context into request extensions.
- Other authority-bearing handlers consume `Extension<CallerContext>`, but
  `mem_write`, `mem_read`, `mem_revise`, and `mem_forget` do not.
- Their public inputs accept `agent_id`; write, read, and revise also accept
  `org_id`. Each handler copies those fields into ordinary engine requests.
- `mem_write` and the write half of `mem_revise` call ordinary `remember`, not
  the capability-authorized path. Ordinary remember derives provenance from a
  capability principal only when a capability is explicitly passed; otherwise
  it falls back to `created_by` and then record `agent_id`.
- Recall and forget use the request's `agent_id` (or the engine default) for
  visibility and permission decisions.

Therefore the verified caller that may invoke the tool is not necessarily the
principal the handler uses for ownership, retrieval scope, deletion checks, or
recorded write provenance. This is an inference from the pinned source, not a
claim that Scout exploited a live deployment. Scout did not execute Mnemo's
external suite or authenticated transport; the repository's existing flat-store
contract test calls engine primitives directly and does not cover these four
handlers under distinct request principals.

## Why it matters

Shared memory expands an agent's authority in two directions at once: it lets a
worker consume organizational context and lets its outputs influence future
workers. A governance layer must therefore bind six distinct questions:

1. **Who is the caller?** Identity should come from a credential authority, not
   request prose or model-generated fields.
2. **What can it see or change?** ACL decisions must occur before retrieval and
   mutation, not after a broad candidate set reaches a plugin or model.
3. **How does knowledge change?** Corrections need provenance and temporal
   supersedence rather than destructive overwrite.
4. **What independently records the outcome?** Denials, misses, degraded paths,
   and errors matter as much as successes for audit reconstruction.
5. **Where does trust actually end?** A typed interface is not a sandbox, and an
   application predicate is not database-enforced tenant isolation.
6. **Is this knowledge or custody?** Durable memory and a one-time task snapshot
   need different addressing, expiry, claim, deletion, and replay rules.
7. **Does authenticated identity reach the operation?** A role gate at dispatch
   does not bind ownership or provenance if the handler later accepts another
   principal from caller-controlled fields.

This turns “memory governance” from a feature checklist into an authority map.
The reusable test is to trace every proposal, approval, read, write, plugin call,
handoff, and deletion to its enforcing principal and then ask what happens if
that component is malicious, stale, unavailable, replayed, or bypassed.

## Reusable guidance

- Resolve actor, role, namespace, and source scope server-side; never let the
  agent assert the identity under which its own request will be authorized.
- Pass that resolved identity into every authority-bearing handler and reject or
  ignore conflicting identity fields; test the handler through the real
  authenticated transport, not only the engine primitive it wraps.
- Apply scope before candidate generation and expose retrieval plugins only the
  minimum read surface needed for one call.
- Route imports, connectors, brownout writes, and interactive writes through the
  same classification, provenance, and audit invariants.
- Preserve corrections as temporal chains; reserve destructive deletion for an
  explicit erasure workflow with separately verifiable evidence.
- Model proposal, approval, recall grant, and project scope as separate checks.
  A positive decision at one layer should not silently widen another.
- Keep temporary handoff custody out of durable recall. Address it narrowly,
  expire it, make the claim atomic and single-use, erase payload content after a
  terminal outcome, and retain only the minimum receipt needed for audit.
- Treat an in-process plugin contract as architecture, not isolation. Use a
  process or capability boundary when the plugin is not fully trusted.
- Pair application ACL predicates with database defense-in-depth on every
  authority-bearing table; inventory exceptions rather than claiming blanket
  tenant isolation.
- Require every derived memory to retain source lineage before promising exact
  rollback or verified deletion; deleting one visible row is not recovery.
- Test governance properties separately: authenticated write admission,
  cross-principal leakage, provenance completeness, rollback fidelity, and
  post-deletion reappearance measure different failure boundaries.
- Read CI at the check level. A successful test workflow and a failed security
  workflow can coexist on the same revision.

## Primary sources

- Repository at inspected revision: https://github.com/halofyai/halofy/commit/3763e64f521df8dc58d00d4632e732e702dd76ef
- README: https://github.com/halofyai/halofy/blob/3763e64f521df8dc58d00d4632e732e702dd76ef/README.md
- Architecture: https://github.com/halofyai/halofy/blob/3763e64f521df8dc58d00d4632e732e702dd76ef/docs/architecture.md
- Threat model: https://github.com/halofyai/halofy/blob/3763e64f521df8dc58d00d4632e732e702dd76ef/docs/security/threat-model.md
- Kernel package metadata: https://github.com/halofyai/halofy/blob/3763e64f521df8dc58d00d4632e732e702dd76ef/kernel/package.json
- Successful CI workflow: https://github.com/halofyai/halofy/actions/runs/32714621258
- Later failed gitleaks check: https://github.com/halofyai/halofy/actions/runs/32925473603/job/98047389134
- Switchboard repository at inspected revision: https://github.com/Egoist-Machines/switchboard/commit/d2c53b117d554e9919e6f0c2909f04157a2fb49d
- Switchboard README: https://github.com/Egoist-Machines/switchboard/blob/d2c53b117d554e9919e6f0c2909f04157a2fb49d/README.md
- Switchboard grants, handoffs, storage, and sync reference: https://github.com/Egoist-Machines/switchboard/blob/d2c53b117d554e9919e6f0c2909f04157a2fb49d/DOCS.md
- Switchboard handoff tests: https://github.com/Egoist-Machines/switchboard/blob/d2c53b117d554e9919e6f0c2909f04157a2fb49d/test/handoff.test.mjs
- Successful Switchboard test run: https://github.com/Egoist-Machines/switchboard/actions/runs/32932761986
- Long-term memory security survey v2: https://arxiv.org/abs/2604.16548v2
- Mnemo repository at inspected revision: https://github.com/sattyamjjain/mnemo/commit/376ca28606c5b6287d9c8274482fa791d4dc8703
- Mnemo agent-managed tool inputs: https://github.com/sattyamjjain/mnemo/blob/376ca28606c5b6287d9c8274482fa791d4dc8703/crates/mnemo-mcp/src/tools/agent_managed.rs
- Mnemo tool handlers and request dispatch: https://github.com/sattyamjjain/mnemo/blob/376ca28606c5b6287d9c8274482fa791d4dc8703/crates/mnemo-mcp/src/server.rs
- Mnemo remember provenance path: https://github.com/sattyamjjain/mnemo/blob/376ca28606c5b6287d9c8274482fa791d4dc8703/crates/mnemo-core/src/query/remember.rs
- Mnemo synthetic crossover test: https://github.com/sattyamjjain/mnemo/blob/376ca28606c5b6287d9c8274482fa791d4dc8703/crates/mnemo-core/tests/agent_managed_crossover.rs
