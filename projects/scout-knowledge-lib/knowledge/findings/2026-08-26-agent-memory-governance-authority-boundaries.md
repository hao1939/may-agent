<ai_context>
summary: "Cross-source finding on authority placement in agent memory: Halofy and Switchboard separate identity, writes, retrieval, grants, audit, erasure, and handoff custody; arXiv 2604.16548v2 adds five lifecycle predicates; and pinned Mnemo duplex plus live-HTTP reproductions prove why authenticated principal and organization scope must reach every request operation, including resource discovery, exact reads, provenance, trajectory and integrity diagnostics, and forgetting by ID, criteria, principal, or session. REST/gRPC trajectory filters are separately documented as operator narrowing, not tenant authorization. Isolated fixes and real-binary transport regressions pass package, formatting, migration, and lint validation, but are not deployed proof."
triggers: ["Halofy", "Switchboard", "Mnemo", "agent memory governance", "organizational context", "organization scope binding", "server-owned identity", "scoped retrieval", "memory resource authorization", "signed erasure", "memory ACL", "retrieval driver authority", "agent handoff custody", "caller identity binding"]
last_updated: "2026-09-02"
source_basis: "GitHub repository metadata, primary documentation, recursive trees, tests, package metadata, and public check-run results for Halofy at 3763e64f521df8dc58d00d4632e732e702dd76ef and Switchboard at d2c53b117d554e9919e6f0c2909f04157a2fb49d; full TeX source of arXiv 2604.16548v2; and pinned source plus goal-owned MCP duplex and live-HTTP tests of sattyamjjain/mnemo through public revision 2994abf185da50d43e5fa4b3f826812bd09c2f20, with preserved local repairs c82e711e8a2bb386001e98c3437da44c32b62428, b0e0873c69658cc74ca7b607553b6978e3d4781f, a2f42a3f00f8bfc7b25fa7868fa9c8edfc162004, 4217163bacba3d85ef34c2ef0a0c33f6faf4cae9, fcb022acf583b6146eb9dc866ced999b48f5dcf8, provenance-forget repair 42d5894755fc7bae4601cb7726d4bded50e8f9d4, provenance-read repair f90ce821d0d33d50f4e6c0a819ef8dd6eebaa02c, integrity-audit repair 60c3edb91b262a7281526b40659d8e5f3f8262e1, memory-resource repair ea7f8ea88a5104d79072e3b4a606e80cfdb20d65, checkpoint-organization repair d1fa97c6aa21002edbbc3227273a6cd37a3286cc, chronology/live-migration regression 4e0061b2dd99b8fcf8afe63920ce4eb2cc9edca7, event-organization repair a6649e56abd8da17bec5b9c339707eb02e04ddbb, REST/gRPC trajectory-filter repair 24d27c375318b30f70ebc5521f75f9641e2b60b2, plus transport regression fbb7000fdb75ae5fc799820570ec4cbd81e21a74."
</ai_context>

# Agent Memory Governance Is an Authority-Placement Problem

Date: 2026-08-26<br>
Last updated: 2026-09-02<br>
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

### Bulk provenance selection must not become deletion authority

Cycle 16 began from the separately persisted live XHS reconciliation at
`2026-09-01T14:58:51.323Z–14:59:22.740Z`: the 129-ID and metadata fingerprints
exactly matched Cycle 15; added, changed, and removed arrays were empty; prior
card `6a4b745f…5691` remained unavailable; and SkillRise remained readable.
Only then did the unchanged 15/15 memory-governance cluster select the queued
bulk-path audit.

At public Mnemo revision
`2994abf185da50d43e5fa4b3f826812bd09c2f20` plus local repair ancestry through
`fcb022acf583b6146eb9dc866ced999b48f5dcf8`,
`mnemo.forget_by_provenance` accepted a principal or session selector without
consuming `CallerContext`. The core selector gathered matching memory IDs and
built a `ForgetRequest` with `agent_id: None`; deletion therefore ran under the
configured boot principal rather than the authenticated request principal.

Two real MCP duplex fixtures made the boundary executable. A capability for
signed `alice` with `role:writer org:alpha` selected boot-owned Alpha records.
Before repair, the principal selector returned
`01a05d88-e769-7a20-98d5-bfdb63b27b82` in `forgotten`; the session selector
returned `01a05d88-e7a4-7f71-99a8-d873033baeaf`. These generated fixture IDs
are exact outputs from that run, not persistent production identifiers. Both
records were soft-deleted. This does not contradict the preserved Alice→Bob
four-wrapper denial: the vulnerable path specifically inherited boot authority
and therefore succeeded against boot-owned targets.

Repair `42d5894755fc7bae4601cb7726d4bded50e8f9d4` leaves the legacy core/stdio
entry points compatible but adds authenticated variants for both selectors.
The MCP handler now receives verified caller context, derives the sole signed
organization, and passes both actor and organization through candidate
selection to the existing per-ID authorization checks. After repair, each
fixture returns `forgotten: []`, an exact `permission denied` error for its
selected ID, and the boot-owned record remains intact. The provenance selector
identifies remediation candidates; it no longer grants authority over them.

Formatting passes. Strict Clippy with warnings denied passes for all core/MCP
targets and all HTTP-enabled server targets. Full validation passes 295 core,
95 MCP, and 85 HTTP-enabled server tests; the latter retains the real HTTP
Alice→Bob four-wrapper regression. Validation used a goal-owned Rust 1.98
container and caches because host Cargo was unavailable. The 54 GiB target
cache consumed the remaining filesystem blocks, so only that goal-owned,
rebuildable target directory was deleted after successful validation; source
and download/toolchain caches remain. This candidate is local, unreviewed, and
undeployed. Read-side provenance selection and other bulk paths remain outside
the completed audit.

### Provenance audit data needs the same caller and tenant scope

Cycle 17 reconciled XHS before reopening the code question. Two clean-reload
passes at `2026-09-01T15:54:29.734Z–15:59:50.186Z` reproduced the complete
historical 130-card ID and title/author fingerprints: newly collected,
metadata-changed, absent, and removed arrays are all `[]`. The card absent in
Cycles 15–16 is collection-visible again rather than newly added. Collection
cards remain readable without a login wall, but signed detail reads for that
card, SkillRise, and one current representative card all resolved `/404`; the
other 127 details remain untested.

Only after that reconciliation did the rubric select the queued
GitHub/local-code read audit. At local ancestry
`42d5894755fc7bae4601cb7726d4bded50e8f9d4` over public Mnemo revision
`2994abf185da50d43e5fa4b3f826812bd09c2f20`, `mnemo.provenance` accepted
memory, principal, or session selectors but did not consume the verified
`CallerContext`. A valid `alice` capability scoped to `org:alpha` therefore
received audit rows selected independently of both authorities.

The pre-fix duplex run generated boot memory
`01a05dbb-c925-7590-9b87-80d5b36b4ce5`, Alice/Alpha memory
`01a05dbb-c94b-7390-88aa-64c50ad85bc0`, and Alice/Beta memory
`01a05dbb-c975-7d71-a13a-1b4eefd84d9a` in one shared session. The exact
observed results were:

- the foreign memory selector returned the boot row, including provenance ID
  `01a05dbb-c935-7cd2-8605-6718b2f85ea5`, principal, session, time, and hashes;
- the foreign-principal selector returned that same boot row;
- the shared-session selector returned all three memory IDs; and
- the caller's own-principal selector returned both Alpha and Beta rows,
  exposing the same principal's other organization.

These are generated fixture identifiers, not production records. They prove a
local authenticated read boundary, not a deployed exposure.

Repair `f90ce821d0d33d50f4e6c0a819ef8dd6eebaa02c` gives the read handler the
verified caller. Signed requests may query only their own principal; exact
foreign or other-organization memory IDs return `null`; principal mismatch is
rejected; and principal/session lists retain only rows whose live memory record
establishes the caller's sole signed organization. Legacy operator-only stdio
keeps its historical audit-wide view. An organization-scoped caller does not
receive provenance for a hard-deleted row because no surviving memory record
can prove its tenant; this is a deliberate fail-closed limit rather than a
claim that tenant metadata survives deletion.

Formatting and strict Clippy with warnings denied pass. The full MCP package
passes 96 tests, including the new five-query fixture, and the HTTP-enabled
server passes all 85 tests, preserving the prior same-session Bob→Alice
transport regression. The repair is local, unreviewed, and undeployed. arXiv
`2608.30177v1` remains the 15/15 stage-wise anchor; Reddit remains useful
community framing but cannot adjudicate this code path. The next code
exploration, after another seed-first reconciliation, is read-scope parity for
provenance verification/export surfaces, beginning with MCP verification and
the REST provenance endpoints.

### Integrity and trajectory diagnostics must bind the verified principal

Cycle 18 first committed its live XHS comparison as
`dfe2915695f5b9a259eb5f931d3ca672783c77a3`. The authenticated collection pass
at `2026-09-01T16:29:48.924Z–16:31:47.649Z` reproduced all 130 IDs and complete
metadata with added, changed, absent, and removed arrays `[]`. SkillRise detail
recovered; `6a4b745f…5691` remained collection-visible but detail-unavailable.
Only then did the recorded verification trigger select GitHub/local code.

At exact local pre-fix ancestry
`f90ce821d0d33d50f4e6c0a819ef8dd6eebaa02c`, `mnemo.verify` did not consume
`CallerContext`; `mnemo.trajectory_audit` received it but accepted an explicit
foreign `agent_id`. A valid Alice capability scoped to `org:alpha` therefore
selected a deliberately tampered Bob/Alpha thread. The exact verification
response disclosed `valid: false`, `total_records: 1`, `verified_records: 0`,
broken record `01a05ddd-bf9b-7922-8986-39cc67a5d0ce`, and
`content hash mismatch at record 01a05ddd-bf9b-7922-8986-39cc67a5d0ce`. The trajectory response
disclosed `scope_label: agent=bob,thread=cycle-18-bob-thread`, `event_count: 1`,
and Bob's active-bank timeline. These are generated local fixture observations,
not a deployed exposure.

Repair `60c3edb91b262a7281526b40659d8e5f3f8262e1` passes verified caller context
to verification and applies the existing principal binder to both tools.
Authenticated foreign selectors now return the exact Alice-versus-Bob identity
error; omitted or matching selectors verify Alice's own thread. Legacy
operator-only stdio retains its broader selector. Formatting, strict Clippy
with warnings denied for MCP and HTTP-enabled server targets, all 97 MCP tests,
and all 85 HTTP-enabled server tests pass on the repair commit.

REST has no equivalent request principal to bind. Its router either requires
one shared `MNEMO_AUTH_TOKEN` across every non-health endpoint or runs open
with a warning; provenance and verification handlers then accept body/path
selectors. That is an exact operator-wide authority boundary, not proof of
agent-scoped authorization and not safely repairable by copying MCP semantics.
REST parity requires a credential design that resolves a principal and any
organization scope before handler dispatch.

### Resource discovery and exact reads must bind the verified caller

Cycle 20 committed its unchanged live XHS comparison first as
`c684563835a5f2b59e793c6651a624d6bcda3fea`. Two authenticated collection
passes at `2026-09-01T17:46:35.052Z–17:48:11.364Z` reproduced the prior
130-card ID and metadata fingerprints, with added, changed, and removed arrays
`[]`; two historical cards remain window-unavailable and the durable union is
132. Only after that ordering did the queued bulk/export-read question select
GitHub/local code.

Public Mnemo `main` was still
`2994abf185da50d43e5fa4b3f826812bd09c2f20` when refreshed at
`2026-09-01T17:50:08.408Z`. At exact local pre-fix base
`60c3edb91b262a7281526b40659d8e5f3f8262e1`, `resources/list` resolved the
verified principal but omitted its signed organization, and `resources/read`
ignored request context entirely. A real duplex fixture gave Alice
`role:reader org:alpha` and seeded Bob/Alpha, Alice/Alpha, and Alice/Beta. The
list exposed Alice/Beta URI
`mem://01a05e1b-458a-7283-8c8f-0ca13ffd2867`; exact reads returned that
record's `alice-beta-resource-cross-org` content and Bob/Alpha UUID
`01a05e1b-4533-7a11-b568-c79c7067564f` with
`bob-alpha-resource-secret`. These are generated fixture identifiers and
literal marker content, not production data.

Repair `ea7f8ea88a5104d79072e3b4a606e80cfdb20d65` narrows resource listing by
principal and signed organization and applies the same visibility rule to
exact reads. Denied exact UUIDs use resource-not-found so authorization does
not confirm foreign-record existence. The caller's Alice/Alpha record remains
readable, and a separate fixture preserves capability-less stdio's historical
operator exact-read behavior. The code is local, unreviewed upstream, and
undeployed.

This extends rather than duplicates earlier evidence. Cycle 16's separate
bulk-forget reproduction still has exact outputs
`01a05d88-e769-7a20-98d5-bfdb63b27b82` and
`01a05d88-e7a4-7f71-99a8-d873033baeaf`; the original Alice→Bob
write/read/revise/forget HTTP denial remains preserved. Reviewed arXiv
`2608.30177v1` still anchors the 15/15 stage-aware cluster, while Reddit remains
RSS-readable/JSON-403 and low-value for adjudicating this code path.

### Checkpoint creation and replay must bind the verified principal

Cycle 21 persisted its seed boundary before this audit as Scout commit
`5524d52c956fb890b73ba7ae7f59611961c31c6b`. Chrome PID 2136's network
namespace remained reachable, but the effective XHS session was a guest: the
current-user API returned HTTP 200 with `guest: true`, the saved collection
redirected to public/home notes, and zero cards materialized. Added and changed
sets are unknown, proven removals are `[]`, and all 132 durable seeds are
temporarily unavailable rather than removed. That access regression did not
erase the last comparable memory-governance seed cluster.

After that reconciliation, source review established that resource
subscriptions and templates are not implemented. The next actual bulk-read
surface was `mnemo.replay`. At exact local pre-fix base
`ea7f8ea88a5104d79072e3b4a606e80cfdb20d65`, a real duplex fixture issued
Alice a valid `role:reader org:alpha` capability. It then replayed Bob-owned
checkpoint `01a05e4c-9ca0-7463-87fa-9cea4e96fda0`, returning state marker
`bob-checkpoint-state` and referenced Bob memory
`01a05e4c-9c56-7571-a5ed-728d258014eb` with marker
`bob-checkpoint-memory-secret`. These UUIDs and markers are generated local
fixture evidence, not production records.

Repair `f75797dd8be91f00b05576bf06ce5995a918c83f` makes verified checkpoint
creation use the caller principal, makes foreign exact checkpoints look absent,
filters checkpoint memory and event material to the checkpoint owner, and
filters time-travel replay to the authenticated principal. The regression
proves Alice cannot exact-replay Bob, Alice's time-travel response contains
zero Bob memories or events, Bob still replays his checkpoint, and an
Alice-created checkpoint is stored as Alice-owned. Capability-less stdio keeps
its historical operator replay behavior.

This is principal evidence, not organization parity. The checkpoint model has
no organization owner, so a signed organization cannot yet narrow replay.
Branch and merge have separate checkpoint selectors and have not been audited
or changed in this checkpoint. The original same-session Alice→Bob
write/read/revise/forget HTTP denial remains preserved, as do Cycle 16's exact
bulk-forget outputs `01a05d88-e769-7a20-98d5-bfdb63b27b82` and
`01a05d88-e7a4-7f71-99a8-d873033baeaf`; none is counted as a second replay
reproduction.

### Branch and merge must not transfer another principal's checkpoint state

Cycle 22 persisted the guest/unaddressable seed state first as Scout commit
`2e86ce63fa8b1295f4363116e366d3f74ec02bab`. The live browser remained guest,
no current or history collection target survived, added and changed sets were
unknown, proven removals were `[]`, and all 132 durable seeds remained
temporarily unavailable. Only after that record did the queued state-transfer
audit select GitHub/local code.

At exact local pre-fix base
`f75797dd8be91f00b05576bf06ce5995a918c83f`, the MCP branch and merge handlers
did not consume `CallerContext`. A valid Alice/Alpha capability could therefore
branch Bob's checkpoint state and memory reference into generated checkpoint
`01a05e65-fe4b-74b1-b2c4-dba4bb770305`, then full-merge Bob's `main` branch
into generated checkpoint `01a05e65-fe75-78d0-8f10-1b4e87407a7f`. The literal
fixture state was `bob-branch-state` and its referenced memory marker was
`bob-branch-memory-secret`. These are local test records, not production data.

Repair `716a1a57753d40f5afe91e0f5f0f5a2d129c0489` passes the verified caller
principal into both operations. Core branch rejects a foreign exact checkpoint
or mismatched thread, merge rejects foreign source and target checkpoints, and
both paths retain only memory references owned by the caller before writing a
new checkpoint. Alice receives not-found results without Bob's markers; Bob
can branch and merge his own state; capability-less stdio keeps its historical
operator behavior.

This extends the same authority pattern without inflating evidence count. The
branch and merge results are two operations in one reproduced checkpoint-state
boundary, not independent confirmation of the paper or the earlier replay
defect. Checkpoints still lack an organization owner, so signed tenant scope
cannot constrain state transfer. Public Mnemo remains pinned at
`2994abf185da50d43e5fa4b3f826812bd09c2f20`; the repair is local, unreviewed,
and undeployed. Reviewed `2608.30177v1` remains the controlled 15/15 stage-wise
anchor, and Reddit remains deferred at its RSS-readable/JSON-403 boundary.

### Principal-bound checkpoints still have no tenant owner

Cycle 23 committed the direct-WSL seed boundary first as Scout commit
`0f663d8a4c9a233534975552b241d8ce1ba82f22`. The browser exposed public feed
and post content but no collection address or authenticated nickname. Added and
changed seeds remained unknown, proven removals were `[]`, and all 132 durable
seeds remained unavailable rather than removed. Only after that record did the
rubric retain the memory-governance cluster and select the queued checkpoint
organization audit.

At exact local repair
`716a1a57753d40f5afe91e0f5f0f5a2d129c0489`, verified capabilities carry
organization scopes and ordinary memory handlers can call `bind_org_id`.
Checkpoint, branch, merge, and replay inputs contain no `org_id`, however, and
their MCP handlers never invoke that binder. Core `CheckpointRequest`,
`ReplayRequest`, `BranchRequest`, and `MergeRequest` also omit it. The
`Checkpoint` model, DuckDB row, storage trait, and `(thread_id, branch_name)`
latest-checkpoint lookup have no organization owner or key.

The data path preserves the same gap. Checkpoint creation selects active
memories with `MemoryFilter.agent_id` and leaves `MemoryFilter.org_id` unset.
Exact replay keeps referenced memories whose `agent_id` matches the checkpoint;
time travel filters memories and events by agent and thread, not organization.
Branch and merge now sanitize principal ownership correctly, but they cannot
enforce an organization that is not represented. Because checkpoint creation
accepts caller-supplied free-form metadata, treating a metadata `org_id` as
authority would let the caller assert the boundary it is meant to constrain.

This is direct code-path evidence of an absent ownership dimension, not a new
runtime cross-organization reproduction and not evidence that the principal
repair regressed. A safe tenant design must derive or bind the verified
organization, persist it as an authoritative checkpoint field, include it in
parent and branch lookup, and scope memory/event capture, replay, time travel,
branch, merge, serialization, indexes, and migrations together. A metadata-only
patch would preserve an ambiguous end state, so no such patch was made. Public
Mnemo `main` remained
`2994abf185da50d43e5fa4b3f826812bd09c2f20` at
`2026-09-01T19:33:07.724Z–19:33:08.510Z`; the organization analysis is local,
unreviewed, and undeployed.

### Checkpoint organization scope must survive storage and replay

Cycle 24 committed the next XHS observation first as Scout commit
`ee615be1d780b53374eb65beea8cb7626983d5d9`. Direct WSL Chrome remained
readable as Linux user `hao`, and its 29-card public Explore window reproduced
Cycle 23's ID and metadata fingerprints. It still exposed no collection address
or authenticated nickname, and the current-user endpoint returned HTTP 406,
`success:false`, code `-1`. Added and changed collected seeds remain unknown,
proven removals are `[]`, and all 132 durable seeds remain unavailable rather
than removed. Public-feed equality was not promoted to collection evidence.

Only after that seed record did the same-principal tenant fixture run on exact
local base `716a1a57753d40f5afe91e0f5f0f5a2d129c0489`. Alice had one Alpha memory
and one Beta memory under the same thread. Her valid `role:reader org:alpha`
capability created checkpoint `01a05e84-94ad-75e2-a66d-fbb673688689`; exact
replay returned both authorized Alpha memory
`01a05e84-9436-7950-985c-12802e469f23` and unauthorized Beta memory
`01a05e84-9463-7ae2-8b6a-56085b96695f`. These UUIDs are generated fixture
records, not production data. The two memory IDs are one reproduced defect, not
two confirmations.

Repair `d1fa97c6aa21002edbbc3227273a6cd37a3286cc` adds authoritative optional
`org_id` to checkpoint, replay, branch, and merge MCP inputs and core requests,
then uses the existing capability binder so a caller cannot assert an
unauthorized tenant. The checkpoint model persists that owner through DuckDB
and PostgreSQL inserts and reads. Fresh DuckDB tables include the column;
existing tables receive an idempotent version-7 column migration before the
organization index is created; PostgreSQL creates or adds the nullable column
and index. Compatibility callers that have no per-request capability retain
their historical unscoped operator behavior.

Selection and replay now use both principal and organization. Checkpoint memory
capture filters both fields; exact replay rejects a mismatched thread,
principal, or organization as not found; latest selection scans past a newer
foreign-scope checkpoint; time travel filters memories and events; and branch,
full merge, and cherry-pick validate checkpoint ownership and discard foreign
memory references before persisting a derived checkpoint. Organization-scoped
event replay intentionally fails closed: only trusted core events carrying the
same `org_id` are returned. Older and currently unstamped memory events are
omitted because their tenant cannot be proven; this is a recorded completeness
limit, not a claim that all audit-event producers now carry tenant scope.

The original Alice→Bob write/read/revise/forget result remains preserved at
public source `376ca28606c5b6287d9c8274482fa791d4dc8703`, principal repair
`c82e711e8a2bb386001e98c3437da44c32b62428`, and live-HTTP regression
`fbb7000fdb75ae5fc799820570ec4cbd81e21a74`; this checkpoint does not recast it
as tenant evidence. Cycle 16's separate bulk-forget outputs also remain exactly
`01a05d88-e769-7a20-98d5-bfdb63b27b82` and
`01a05d88-e7a4-7f71-99a8-d873033baeaf`. Public Mnemo `main` remained
`2994abf185da50d43e5fa4b3f826812bd09c2f20` at
`2026-09-01T20:19:30.416Z–20:19:31.295Z`; the repair is local, unreviewed,
undeployed, and not a live PostgreSQL migration claim.

### Scoped chronology and legacy migration are now fixture-proven

Cycle 25 persisted the unavailable live-seed boundary first as Scout commit
`84c48a671ca27b307c65cfef12e95d05bdff26a2`. The saved XHS collection
target redirected to login, three current-user reads returned HTTP 406/code
`-1`, and all 132 durable seeds remained unavailable; no addition, change,
or removal was inferred from the separately readable public Explore/detail
surface.

Only afterward did follow-up commit
`4e0061b2dd99b8fcf8afe63920ce4eb2cc9edca7` validate repair
`d1fa97c6aa21002edbbc3227273a6cd37a3286cc`. Its mixed-organization MCP
fixture creates Alpha-first, Beta-newer, and Alpha-newest checkpoints for the
same principal and thread. Alpha latest replay skips the intervening Beta row,
Beta latest replay sees its own row, and Alpha-newest names Alpha-first—not
Beta—as its parent. This directly tests chronology and parent selection rather
than inferring them from query predicates.

The gated live PostgreSQL fixture creates a unique schema with a legacy
`checkpoints` table lacking `org_id`, inserts one legacy row, and initializes
the current backend. Migration adds a nullable organization column and its
index, preserves the legacy row with unknown organization, round-trips a new
Alpha-scoped checkpoint, and succeeds a second time. The fixture drops only
its unique schema afterward. This is live database migration evidence for the
test schema, not production migration or deployment proof.

Formatting and strict all-target Clippy pass for core, MCP, the HTTP-enabled
server, and PostgreSQL. Full suites pass 296 core tests with one intentional
network test ignored, 104 MCP tests, 83 HTTP-enabled server tests, and nine
PostgreSQL tests. An initial parallel run filled goal-owned cache storage and
`lld` exited with `SIGBUS`; after removing only disposable goal-owned
caches, the isolated single-job targets passed without installs or source
changes. Public Mnemo `main` remained
`2994abf185da50d43e5fa4b3f826812bd09c2f20` over HTTP 200 at
`2026-09-01T20:45:33.321Z–20:45:34.083Z`. The repair and regression remain
local, unreviewed upstream, and undeployed.

### Trajectory audit now uses schema-backed tenant ownership

Cycle 26 preserved seed-first ordering in Scout commit
`c834ae83e8eeadf6a2c8ea748f4671e3eaefd90a`: the saved Chrome profile was
followed by login, current-user returned HTTP 500 without identity, and all 132
durable collected seeds remained unavailable. No addition, change, or removal
was inferred from the separate public Explore and `/404` observations.

Only then did the selected Alice/Alpha versus Alice/Beta trajectory fixture run
on exact local Mnemo base `4e0061b2dd99b8fcf8afe63920ce4eb2cc9edca7`.
The two exact memory outputs were
`01a05f77-e5bc-7992-9ec0-6edb82548a4e` (Alpha) and
`01a05f77-e5e7-7101-9d66-d420aa44fa98` (Beta). Alice's valid Alpha
capability received both events: `event_count=2` and peak active size 2. The
two UUIDs are records in one local counterexample, not two confirmations.

Repair `a6649e56abd8da17bec5b9c339707eb02e04ddbb` adds nullable,
schema-backed organization ownership to `AgentEvent`, a DuckDB version-8
migration, an additive PostgreSQL migration and `(agent_id, org_id)` index,
and mandatory exact-scope queries in both backends. Checkpoint, replay, as-of
replay, and MCP trajectory audit now query by authoritative organization;
producers stamp the organization they already know. Legacy null-owned events
remain readable through compatibility paths but fail closed for scoped replay
and audit. The strengthened fixture returns one Alpha event with peak active
size 1, and a request explicitly naming Beta is rejected by capability scope.

Focused trajectory, mixed-organization chronology, and live PostgreSQL legacy-
migration regressions pass. Full current-revision suites pass 298 core tests
with one intentional network test ignored, 105 MCP tests, 85 HTTP-enabled
server tests, and nine PostgreSQL tests. Formatting, whitespace checks, and
strict all-target Clippy pass for core, MCP, the HTTP-enabled server, and
PostgreSQL. The first PostgreSQL lint invocation stopped before project code
because it selected a crate cache unreadable by `uid=1000(hao)`; the existing
goal-owned cache completed the same lint in 5m11s. This is local migration and
behavior evidence only: it has not been reviewed upstream, deployed, or run
against production data.

### REST and gRPC expose an operator filter, not tenant identity

Cycle 27 separated the MCP capability model from Mnemo's other transports.
REST and gRPC can require one deployment-wide bearer token, but that token
admits the request without identifying a principal or organization. Treating
their caller-selected organization as authenticated tenant scope would
therefore claim authority the credential does not carry.

The mixed-organization fixture ran on exact local base
`a6649e56abd8da17bec5b9c339707eb02e04ddbb`. With one Alpha and one Beta event
for the same agent, the historical unfiltered REST response reported two. An
explicit Alpha request also reported two because the schema had no organization
field and the handler used the unscoped listing; the regression failed at
`rest_test.rs:541`. These are two views of one local counterexample, not
independent confirmations.

Commit `24d27c375318b30f70ebc5521f75f9641e2b60b2` adds an optional `org_id`
operator filter to both REST and gRPC. Omitting it still returns two, preserving
aggregate compatibility; requesting Alpha returns one on each transport. The
same deployment token can still request any organization, so the change
provides query narrowing, not tenant authorization. Focused REST and gRPC
regressions pass, as do strict all-target Clippy, 298 core tests with one
intentional network test ignored, 105 MCP tests, 17 REST tests, two gRPC tests
with two documentation examples intentionally ignored, and 85 HTTP-enabled
server tests. Formatting and whitespace checks pass. The result remains local,
unreviewed upstream, and undeployed.

### Residual null-owned events are not one authorization defect

Cycle 28 traced the remaining null-owned producers on exact local Mnemo
`24d27c375318b30f70ebc5521f75f9641e2b60b2` instead of assuming every missing
organization stamp represented the same bug. The reflection entrypoints are
public core-library methods that accept an engine and agent identifier. They
have no transport credential, caller context, or organization parameter, and
the inspected tree contains no non-test callsite. Although the module comment
says periodic cadence is driven from the CLI, exact Rust callsite search finds
only the methods themselves and core integration tests. This does not exclude
external embedders, but it does mean the repository does not prove a live CLI,
REST, gRPC, or MCP reflection surface.

Reflection is agent-wide by its current contract. Its initial `MemoryFilter`
sets `agent_id` but no organization; its cadence helper reads the agent-wide
event list; date-rewrite and completion events explicitly store `org_id: None`.
The separate dream-report ingestion path does preserve the source record's
organization. A direct engine caller already possesses the storage engine, so
these observations establish aggregate behavior and an audit-completeness
limit, not a credential bypass. Three focused reflection integration tests pass
on the inspected revision.

OpenTelemetry ingestion has a different boundary. `/v1/ingest/otlp` is a real
REST route behind the same optional deployment-wide bearer gate as other REST
operations. It derives `agent_id` from `agent.id` or `service.name` resource
attributes (or the engine default) and stores `org_id: None`. The token does not
identify a tenant and the payload has no documented organization authority, so
inventing a tenant stamp would be less accurate than preserving unknown
ownership. Organization-filtered trajectory audits intentionally omit these
null-owned events. The result is incomplete tenant-scoped observability, not
evidence that one tenant can claim another's event.

This distinction prevents three source facts—a null field, an agent-wide core
API, and an operator-wide ingestion route—from being inflated into three
security confirmations. The next bounded question is whether agent-wide hash
chains that interleave scoped and null-owned events can support a future
organization-scoped integrity check, or whether integrity is explicitly an
aggregate-only contract.

## Why it matters

Shared memory expands an agent's authority in two directions at once: it lets a
worker consume organizational context and lets its outputs influence future
workers. A governance layer must therefore bind nine distinct questions:

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
9. **Who may read the audit trail?** Provenance is itself identity, session,
   timing, and content-hash metadata; an audit selector must not bypass the
   principal and tenant scope applied to ordinary recall.

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
