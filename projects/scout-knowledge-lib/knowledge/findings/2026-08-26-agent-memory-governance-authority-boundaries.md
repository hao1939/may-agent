<ai_context>
summary: "Cross-source finding on authority placement in agent memory: Halofy and Switchboard separate identity, writes, retrieval, grants, audit, erasure, and handoff custody; arXiv 2604.16548v2 adds five lifecycle predicates; and pinned Mnemo duplex plus live-HTTP reproductions prove why authenticated principal and organization scope must reach every request operation, including general forgetting by ID or criteria. Isolated fixes and real-binary transport regressions pass package, formatting, and lint validation, but are not deployed proof."
triggers: ["Halofy", "Switchboard", "Mnemo", "agent memory governance", "organizational context", "organization scope binding", "server-owned identity", "scoped retrieval", "signed erasure", "memory ACL", "retrieval driver authority", "agent handoff custody", "caller identity binding"]
last_updated: "2026-09-01"
source_basis: "GitHub repository metadata, primary documentation, recursive trees, tests, package metadata, and public check-run results for Halofy at 3763e64f521df8dc58d00d4632e732e702dd76ef and Switchboard at d2c53b117d554e9919e6f0c2909f04157a2fb49d; full TeX source of arXiv 2604.16548v2; and pinned source plus goal-owned MCP duplex and live-HTTP tests of sattyamjjain/mnemo through public revision 2994abf185da50d43e5fa4b3f826812bd09c2f20, with preserved local repairs c82e711e8a2bb386001e98c3437da44c32b62428, b0e0873c69658cc74ca7b607553b6978e3d4781f, a2f42a3f00f8bfc7b25fa7868fa9c8edfc162004, and 4217163bacba3d85ef34c2ef0a0c33f6faf4cae9, transport regression fbb7000fdb75ae5fc799820570ec4cbd81e21a74, and organization-scoped general-forget repair fcb022acf583b6146eb9dc866ced999b48f5dcf8."
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
recorded write provenance. The source observation nominated an executable
transport test; it did not itself prove runtime behavior.

### Executable reproduction and bounded repair

Scout cloned the public repository into a goal-owned isolated worktree and
checked out exact revision
`376ca28606c5b6287d9c8274482fa791d4dc8703`. The public API still resolved
`main` to that revision at `2026-09-01T11:07:14Z`; a complete repository issue
search for the four wrapper names or `CallerContext` returned zero results with
`incomplete_results=false`. This is exact code provenance and issue-search
evidence, not proof that no private or differently worded fix exists.

In Docker image `rust:1.89-bookworm` (observed image digest
`sha256:948f9b08a66e7fe01b03a98ef1c7568292e07ec2e4fe90d88c07bb14563c84ff`),
the repository's stable toolchain resolved to Rust 1.98.0. Before any candidate
change, `mcp_test` passed 11/11 and `per_request_identity` passed 14/14. A new
goal-owned test then used a valid capability for principal `alice` through the
real MCP duplex service:

- `mnemo.mem_write` accepted `agent_id: "bob"`; storage owner and write
  provenance principal became Bob, while capability ID remained absent.
- `mnemo.mem_read` let Alice retrieve a separately preseeded Bob-owned
  `agent-managed` record.
- `mnemo.mem_revise` retired that record and wrote a Bob-owned revision whose
  provenance principal was Bob with no capability ID.
- `mnemo.mem_forget` let Alice forget that revision.

The strengthened four-wrapper test passed, so the cross-principal behavior is
now local executable evidence at the pinned source. It is still not evidence of
a reachable deployed service, an HTTP configuration, or exploitation of user
data.

The smallest isolated fix is local commit
`c82e711e8a2bb386001e98c3437da44c32b62428`. It adds
`Extension<CallerContext>` to all four wrappers, treats optional `agent_id` as
an assertion that must match the authenticated caller, and passes that caller
to every engine request. Its regression proves all four conflicting Alice→Bob
calls are rejected, Bob's independent record remains active, and an authorized
Alice write is owned and provenanced as Alice. `cargo fmt --check`, the focused
11- and 14-test suites, and the complete 89-test `mnemo-mcp` package passed.

The principal candidate remains local and unreviewed upstream; it has not been
pushed, deployed, or live-HTTP validated. Its remaining organization boundary
was exercised in Cycle 10 rather than assumed resolved.

### Cycle 10 organization-scope reproduction and repair

Cycle 10 first confirmed upstream `main` still resolved to
`376ca28606c5b6287d9c8274482fa791d4dc8703` at
`2026-09-01T12:20:18Z`. An unauthenticated, complete GitHub issue search for
both exact terms `org_id` and `CallerContext` returned zero at
`2026-09-01T12:20:33Z`. This is a bounded public-search result, not proof that
no private or differently worded repair exists.

A second real MCP duplex fixture issued a valid `alice` capability whose signed
scope was `role:writer org:alpha`, then supplied `org_id: beta`. Against the
principal-only candidate, `mnemo.mem_write` returned success rather than an
authorization error. The directly observed failure was therefore at the
operation boundary: authenticated principal `alice`, signed authority
`org:alpha`, agent-managed target `org_id: beta`, accepted by the write wrapper.

Local commit `b0e0873c69658cc74ca7b607553b6978e3d4781f` is the bounded repair. It
preserves non-role tokens from the verified capability in `CallerContext`,
accepts an explicit organization only when a matching signed `org:<id>` token
exists, derives the organization when exactly one is authorized, and preserves
legacy request-selected behavior only for the boot-derived single-principal
stdio path. Write and read reject a conflicting organization before reaching
the engine. Revise and forget additionally compare the addressed record's
organization before mutation, closing the identifier-only path.

The strengthened fixture now proves five denials: cross-organization write,
read, explicit revise, revise-by-ID with omitted organization, and forget-by-ID.
The Beta record remains unchanged, while an organization-omitting valid Alpha
write is stored as `org_id: alpha`. Both principal and organization regressions
pass through the real MCP wrappers. `cargo fmt --all -- --check`, Clippy for all
`mnemo-mcp` tests with warnings denied, and the complete 90-test package pass.
This remains isolated local-code evidence, not upstream review, a deployed
HTTP result, or proof that every non-agent-managed Mnemo tool binds
organization scope. The next code-level revisit is the broader remember,
recall, and experience-memory surface.

### Cycle 11 general and experience-memory reproduction and repair

The seed-first reconciliation again completed before this audit. Source review
then found that `mnemo.remember` did not accept the request's verified
`CallerContext`, `mnemo.recall` used it only for a post-read lease, and the two
experience-plan handlers independently accepted caller-supplied `agent_id` and
`org_id`. General remember also allowed `created_by` to determine write
provenance when no engine capability object was passed. The engine consequently
fell back to its boot agent or the request's fields even though the MCP
dispatcher had already authenticated a different principal and organization.

A new real-duplex regression issued `alice` a valid capability scoped to
`role:writer org:alpha`. Before the repair, general remember accepted
`org_id: beta` and experience remember accepted `agent_id: bob`; both returned
`is_error: false`. These are directly observed wrapper behaviors on local
candidate base `b0e0873c69658cc74ca7b607553b6978e3d4781f`, not claims about a
deployed service.

Local commit `a2f42a3f00f8bfc7b25fa7868fa9c8edfc162004` extends the existing
binding helpers to general remember/recall and experience remember/recall. It
derives the engine agent and a sole signed organization, rejects conflicting
top-level and nested domain organization inputs, binds authenticated
`created_by` provenance to the verified caller, and rejects a conflicting plan
owner or reader. Unauthenticated boot-derived stdio calls retain their former
request-selected organization and `created_by` behavior.

During the check, public `main` advanced to
`2994abf185da50d43e5fa4b3f826812bd09c2f20`. Its standalone audit-export
change touches no MCP wrapper file. The goal branch merged that revision without
rewriting the three repair commits; current candidate
`0d7a19d6d09ff7ea17f4cde4dcf2c3aa93c26848` passes both new real-MCP
regressions, the two earlier principal/organization regressions, all 92
`mnemo-mcp` tests, `cargo fmt --all -- --check`, and Clippy with warnings
denied. This remains isolated, unreviewed, and undeployed evidence. It does not
prove authenticated HTTP behavior or that organization scope reaches every
other organization-bearing Mnemo tool.

### Cycle 12 live Streamable HTTP validation

The next seed reconciliation completed before transport work and found the same
130 stable cards, complete metadata fingerprint, and empty exact added,
changed, absent, and unavailable arrays. With no higher-value seed change, the
recorded HTTP trigger fired.

The executable boundary is `crates/mnemo-cli/src/http_transport.rs`: the
`http-transport` feature mounts `/mcp` on loopback, requires a capability key,
and relies on rmcp to inject each network request's HTTP parts for the existing
caller resolver. The earlier tests injected equivalent request parts or used an
in-memory duplex service; neither proved that the installed binary preserved
the `Authorization` carrier across a real network session.

Goal-owned test commit `fbb7000fdb75ae5fc799820570ec4cbd81e21a74`, whose
production parent is merged repair candidate
`0d7a19d6d09ff7ea17f4cde4dcf2c3aa93c26848`, closes that evidence gap without
changing production behavior. It boots the real HTTP-enabled binary on an
ephemeral loopback port, initializes one MCP session, writes a Bob-owned record
with Bob's signed capability, then sends Alice's signed capability on each of
the four agent-managed calls in that same session. Write, read, revise, and
forget all return the exact Alice-versus-Bob authorization error; a final Bob
exact recall returns the original record. Thus identity is observed per HTTP
request rather than inherited from boot state or the session.

The focused transport test passes, as do `cargo fmt --all -- --check`, Clippy
for the HTTP-enabled CLI test target with warnings denied, and all 76
`mnemo-mcp-server` tests with `http-transport` enabled. The earlier 92-test
`mnemo-mcp` package result still covers the unchanged production repair. This
is loopback real-binary evidence, not an upstream-reviewed commit, pushed
branch, deployed service, TLS boundary, or hostile-network evaluation. The next
code question is whether any remaining organization-bearing MCP wrapper still
accepts scope independently of verified caller context.

### Cycle 13 general-forget caller reproduction and repair

Cycle 13 first reproduced the same 130-card XHS snapshot and empty exact deltas.
Only then did source review trace every explicit MCP `org_id` input to the
existing `bind_org_id` helper. That audit did not prove the wider tenant
boundary closed: general `mnemo.forget` accepts memory IDs or criteria without
an organization field, did not consume `CallerContext`, and constructed an
engine request without `agent_id`. The engine therefore authorized the
destructive operation as its boot principal.

The strengthened goal-owned fixture seeded one boot-owned record and one
Alice-owned record, then called general forget with a valid signed Alice
capability. Before repair, the boot-owned ID appeared in `forgotten` rather than
returning a permission denial. This directly reproduces cross-principal
deletion on local merged base
`0d7a19d6d09ff7ea17f4cde4dcf2c3aa93c26848`; it does not establish a public
deployment or exposed service.

Commit `4217163bacba3d85ef34c2ef0a0c33f6faf4cae9` adds the verified caller to
the handler and sets that principal on the engine `ForgetRequest`. The focused
fixture now denies Alice's attempt against the boot record and allows deletion
of Alice's own record. The real installed-binary fixture adds a boot-principal
write, an Alice general-forget denial, and a boot-principal readback of the
unchanged record over one loopback Streamable HTTP session.
`cargo fmt --all -- --check`, strict Clippy for all targets of `mnemo-mcp` and
the HTTP-enabled server, all 93 `mnemo-mcp` tests, and all 80 HTTP-enabled
server tests pass.

Public `main` still resolved to
`2994abf185da50d43e5fa4b3f826812bd09c2f20` at
`2026-09-01T13:58:09Z`. An exact unauthenticated GitHub issue search for
`"mnemo.forget" CallerContext` returned zero results with
`incomplete_results=false`. That is bounded public provenance, not evidence
about private or differently worded work. The candidate remains local,
unreviewed, and undeployed. The next audit question is organization derivation
for destructive requests that expose no `org_id`: coverage of explicit inputs
does not prove that an addressed record or criteria search is tenant-bound.

### Cycle 14 organization-scoped general-forget reproduction and repair

The next cycle began with the required live seed reconciliation, which again
found the exact 130-card ID and metadata fingerprints and empty added, changed,
absent, and unavailable arrays. Only afterward did the queued tenant question
become the selected GitHub/local-code deep dive.

The prior Alice→Bob evidence remains a separate, preserved result: on pinned
public revision `2994abf185da50d43e5fa4b3f826812bd09c2f20` plus the goal-owned
repair ancestry, a real loopback test switches Bob→Alice within one MCP session,
rejects Alice's write/read/revise/forget attempts against Bob's record, and
confirms Bob can still recall it. Cycle 14 instead held principal identity
constant to test tenant isolation. On local base
`4217163bacba3d85ef34c2ef0a0c33f6faf4cae9`, a capability for signed `alice`
with `role:writer org:alpha` could soft-delete an Alice-owned `org:beta` memory.
The explicit Beta ID appeared in `forgotten`. Source review separately showed
that criteria discovery filtered by principal but not organization; the pre-fix
fixture stopped at its earlier explicit-ID assertion, so no completed criteria
outcome is claimed. This is bounded local evidence, not a public-service or
deployment claim.

Commit `fcb022acf583b6146eb9dc866ced999b48f5dcf8` keeps the public
`ForgetRequest` compatible and adds a scoped engine entry point. The MCP handler
derives the sole signed organization from verified caller context. Criteria
candidate generation filters by both caller and organization; explicit IDs are
checked against the organization before the existing principal permission
check. The repaired fixture deletes the Alpha criteria target, retains the Beta
target, and returns an ordinary `permission denied` for the explicit Beta ID.

`cargo fmt --all -- --check` passes. Strict Clippy passes with warnings denied
for all core/MCP targets and all HTTP-enabled server targets. Full validation
passes 295 core tests, 93 MCP tests, and 85 HTTP-enabled server tests. The host
had no free filesystem blocks when Git first tried to stage the already tested
patch; deleting only the goal-owned disposable 58 GiB Rust target cache restored
54 GiB and the same reviewed diff committed. The cache can be rebuilt and no
repository source was removed. The candidate remains local, unreviewed, and
undeployed; organizationless bulk/destructive paths beyond this handler remain
an explicit next-audit question.

## Why it matters

Shared memory expands an agent's authority in two directions at once: it lets a
worker consume organizational context and lets its outputs influence future
workers. A governance layer must therefore bind eight distinct questions:

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
8. **Does tenant scope follow the same path?** Authenticating a principal is
   incomplete when a handler can still choose another organization, namespace,
   or domain independently.

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
- Current Mnemo public revision used for Cycle 14 provenance: https://github.com/sattyamjjain/mnemo/commit/2994abf185da50d43e5fa4b3f826812bd09c2f20
- Current public general-forget handler: https://github.com/sattyamjjain/mnemo/blob/2994abf185da50d43e5fa4b3f826812bd09c2f20/crates/mnemo-mcp/src/server.rs
- Current public forget engine path: https://github.com/sattyamjjain/mnemo/blob/2994abf185da50d43e5fa4b3f826812bd09c2f20/crates/mnemo-core/src/query/forget.rs
