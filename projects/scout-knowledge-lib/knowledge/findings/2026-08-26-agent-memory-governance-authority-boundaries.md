<ai_context>
summary: "Cross-source finding on authority placement in agent memory: Halofy and Switchboard separate identity, writes, retrieval, grants, audit, erasure, and handoff custody; arXiv 2604.16548v2 adds five lifecycle predicates; arXiv 2608.25553v3 shows reachable provenance still fails when scarce verification is allocated elsewhere; arXiv 2609.08258v1 shows that retained revocation metadata is not retrieval-time validity and that derived write-back can launder revoked authority into a current record; and arXiv 2609.10263v1 separates retained history from query-conditioned answer-time use. MutMem-V2 supplies a portable externally anchored evidence contract, while pinned Mnemo reproductions prove why authenticated principal, organization scope, selector conjunction, verification completeness, and mandatory chain links must reach every request operation. Slowave adds a concrete feedback boundary: complete assessment coverage and retrieval-target binding do not establish that client-authored labels deserve to alter shared memory. Isolated fixes and project-authored artifact verification pass, but are not deployed or independently replicated proof."
triggers: ["Halofy", "Switchboard", "Mnemo", "RD-Forget", "agent memory governance", "organizational context", "organization scope binding", "server-owned identity", "scoped retrieval", "memory resource authorization", "signed erasure", "memory ACL", "retrieval driver authority", "agent handoff custody", "caller identity binding", "retrieval-time validity", "query-conditioned memory", "soft revocation", "authority laundering", "Slowave", "feedback coverage", "feedback admission"]
last_updated: "2026-09-14"
source_basis: "GitHub repository metadata, primary documentation, recursive trees, tests, package metadata, and public check-run results for Halofy at 3763e64f521df8dc58d00d4632e732e702dd76ef and Switchboard at d2c53b117d554e9919e6f0c2909f04157a2fb49d; full source of arXiv 2604.16548v2, 2608.25553v3, 2609.01235v1, and the arXiv HTML papers for 2609.08258v1 and 2609.10263v1, including checksum-verified Zenodo record 22147784 and its byte-identical recomputation/full audit; exact MutMem-V2 tags v1.0.0 at fcda26d1e05c729185c09dd11446db2f79c14a0d and arXiv-matching v1.0.4 at abbcae39564e9f4aa57cf8aa9b824dd1b8ad6c0c, offline verifiers, and commit-scoped public checks; and pinned source plus goal-owned MCP duplex and live-HTTP tests of sattyamjjain/mnemo through public revision 2994abf185da50d43e5fa4b3f826812bd09c2f20, with preserved local repairs c82e711e8a2bb386001e98c3437da44c32b62428, b0e0873c69658cc74ca7b607553b6978e3d4781f, a2f42a3f00f8bfc7b25fa7868fa9c8edfc162004, 4217163bacba3d85ef34c2ef0a0c33f6faf4cae9, fcb022acf583b6146eb9dc866ced999b48f5dcf8, provenance-forget repair 42d5894755fc7bae4601cb7726d4bded50e8f9d4, provenance-read repair f90ce821d0d33d50f4e6c0a819ef8dd6eebaa02c, integrity-audit repair 60c3edb91b262a7281526b40659d8e5f3f8262e1, memory-resource repair ea7f8ea88a5104d79072e3b4a606e80cfdb20d65, checkpoint-organization repair d1fa97c6aa21002edbbc3227273a6cd37a3286cc, chronology/live-migration regression 4e0061b2dd99b8fcf8afe63920ce4eb2cc9edca7, event-organization repair a6649e56abd8da17bec5b9c339707eb02e04ddbb, REST/gRPC trajectory-filter repair 24d27c375318b30f70ebc5521f75f9641e2b60b2, aggregate-event-integrity fixture 52001f0e01144726aa9be11b8f0f153c40857e78, agent-thread integrity repair 5bf23661edc50ff341c7328c05629b8929cabd48, event-completeness repair 222060b4f6ca7a4de3d0990fc3a30fbac100ba06, memory-completeness repair 90a5790fbd986ee189726537e30b9e39abbf9672, live-HTTP regression fbb7000fdb75ae5fc799820570ec4cbd81e21a74, wrapper-completeness regression 9e4a1fee3486ac95b1755a5586cbc119ee9f5fa0, and missing-link repair d7b8190efa2f4ca8513890622b475b6e7e6bbb5a; plus Slowave documentation, feedback implementation, and project-authored tests at 8d538b370c37243a39e19e52e4a5fdb35c9527b5."
</ai_context>

# Agent Memory Governance Is an Authority-Placement Problem

Date: 2026-08-26<br>
Last updated: 2026-09-14<br>
Source: GitHub and arXiv<br>
Repo: https://github.com/halofyai/halofy<br>
Repo: https://github.com/Egoist-Machines/switchboard<br>
Repo: https://github.com/sattyamjjain/mnemo<br>
Repo: https://github.com/slowave-ai/slowave<br>
Paper: https://arxiv.org/abs/2604.16548v2
Paper: https://arxiv.org/abs/2608.25553v3
Paper: https://arxiv.org/abs/2609.08258v1
Paper: https://arxiv.org/abs/2609.10263v1

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

### Organization filtering is a projection, not a second hash chain

Cycle 29 answered that bounded question on exact local Mnemo lineage
`24d27c375318b30f70ebc5521f75f9641e2b60b2`. Event builders obtain the latest
event content hash without an organization selector. Each new `prev_hash`
therefore commits to the immediately preceding event for the selected agent or
thread even when its `org_id` is different or null. `verify_event_integrity`
accepts only agent and optional thread, while `list_events_for_org` is used for
trajectory analysis rather than chain verification. The compliance module
already states that trajectory findings are not a record-level integrity
check. No public REST, gRPC, or MCP operation promises organization-scoped
event-chain verification.

The strengthened DuckDB fixture stores three chronological events in one
thread: Alpha write, null-owned reflection completion, Alpha write. The
complete chain verifies all three records. Filtering it to Alpha leaves two
records, but the second Alpha event still links through the omitted null-owned
event; verification stops after one record with `event chain hash mismatch` at
the second Alpha event. That failure is not tampering. It proves that an
organization-filtered projection cannot be treated as an independent chain.

Local test-only commit `52001f0e01144726aa9be11b8f0f153c40857e78`
records this aggregate contract in the core API comment and regression without
adding an organization selector or changing storage. The focused fixture,
Rust formatting, strict all-target core Clippy, 299 core tests with one
intentional network test ignored, and two doctests pass. The first validation
attempt failed before compilation because `cargo` was absent from the shell
`PATH`; a direct existing Rust 1.98 toolchain resolved that convenience gap.
The first offline registry was root-readable only and failed on
`fnv-1.0.7/lib.rs` permission denied; the existing readable goal-owned cache
completed the same offline build without an install or source workaround.

The supported conclusion is deliberately narrow: full-chain verification and
organization-filtered trajectory analysis can coexist, but the latter does not
inherit the former's integrity proof. A real organization-verifiable design
would need a separate per-organization chain, inclusion proofs anchored in the
aggregate chain, or disclosure of the omitted links. Simply adding `org_id` to
the verifier would turn healthy interleaving into false integrity violations.
There is no deployed or upstream-reviewed evidence for the local test-only
clarification.

### Agent and thread are a conjunctive integrity scope

Cycle 30 tested the independent selector question on exact base
`52001f0e01144726aa9be11b8f0f153c40857e78`. The fixture wrote one Alice event
and one Bob event under the same thread. Pre-fix Alice/thread and Bob/thread
calls returned the same invalid two-record result: each verified one record and
then failed at Bob event `01a06095-9b27-7740-86d1-e492279db9ea` with `event
chain hash mismatch`. The identical outputs were not evidence that either
agent's chain was corrupt. Source trace showed that `verify_event_integrity`
resolved its `agent_id`, but discarded it whenever `thread_id` was present and
loaded every event in the thread.

Local repair `5bf23661edc50ff341c7328c05629b8929cabd48` adds one chronological
`(agent_id, thread_id)` storage query to both DuckDB and PostgreSQL and uses it
for thread-scoped verification. The strengthened DuckDB regression now returns
valid one-of-one results for both Alice and Bob. The existing isolated-schema
PostgreSQL migration fixture inserts both principals under the shared thread
and retrieves only the selected event for each pair. This preserves the Cycle
29 aggregate organization contract: organizations can interleave inside one
agent chain, while distinct agents retain distinct chains even when they share
a thread label.

Formatting, strict all-target Clippy for both changed packages, the focused
regression, the full core suite (299 passing with one intentional network test
ignored), two core doctests, the full PostgreSQL package, and the live
goal-owned PostgreSQL fixture pass. The live database used an existing
goal-owned pgvector container and isolated schema; its credential was not
published. The candidate remains local, unreviewed upstream, and undeployed.

### A bounded verifier must disclose an incomplete chain

Cycle 31 tested the fixed 10,000-event query bound on exact local base
`5bf23661edc50ff341c7328c05629b8929cabd48`. A controlled DuckDB transaction
stored one valid 10,001-event chain for `limit-agent` and `limit-thread`.
Before repair, both `verify_event_integrity(agent, None)` and
`verify_event_integrity(agent, Some(thread))` returned the same successful
result: `valid: true`, `total_records: 10000`, `verified_records: 10000`, no
first broken record, and no error. The agent-wide path had silently omitted the
oldest record; the thread path had silently omitted the newest. Neither result
proved the integrity of the stored whole chain.

Local repair `222060b4f6ca7a4de3d0990fc3a30fbac100ba06` fetches one sentinel record
beyond the supported bound in both paths. When that record exists, it returns
`valid: false`, 10,001 observed records, zero verified records, no fabricated
break UUID, and the explicit error `event chain exceeds verification limit of
10000 records; complete chain was not verified`. Chains within the bound keep
the existing verifier and result schema. The repair does not make tail
truncation intrinsically detectable; it prevents an implementation-owned query
cap from being misreported as whole-chain success.

Rust formatting and whitespace checks pass. Strict all-target core Clippy with
warnings denied passes. The full core package passes 299 tests with one
intentional network test ignored plus two doctests, including the 10,001-row
regression across both selector forms. The PostgreSQL package compiles and its
available tests pass; live-gated cases lacked their URL wiring and no storage or
schema code changed. This remains local executable evidence, not upstream
review, deployment, or proof for chains beyond the reported bound.

The same completeness rule applies to stored memories. On exact local base
`222060b4f6ca7a4de3d0990fc3a30fbac100ba06`, a controlled DuckDB
transaction stored one valid 10,001-memory chain. Agent-wide and agent/thread
verification both returned `valid: true`, 10,000 total, 10,000 verified, no
first break, and no error, silently omitting the newest record. Local repair
`90a5790fbd986ee189726537e30b9e39abbf9672` fetches a 10,001st sentinel
and returns the same explicit fail-closed shape with `memory chain` in the
error. It changes no schema or request type and does not make intrinsic tail
truncation detectable.

Formatting and whitespace checks pass. Strict all-target Clippy passes for
core and PostgreSQL. The full core package passes 300 tests with one intentional
network test ignored plus two doctests. The PostgreSQL package passes its five
local tests; four live-gated tests lacked `MNEMO_TEST_POSTGRES_URL`, and no
schema or backend code changed. This remains local executable evidence, not
upstream review or deployment.

Cycle 33 then exercised that exact incomplete memory result at every public
wrapper instead of inferring propagation from call graphs. Goal-owned commit
`9e4a1fee3486ac95b1755a5586cbc119ee9f5fa0`, based directly on
`90a5790fbd986ee189726537e30b9e39abbf9672`, adds one real DuckDB-backed
10,001-memory fixture to each transport. Before any production-code change:

- REST returned HTTP 200 with
  `{"error_message":"memory chain exceeds verification limit of 10000 records; complete chain was not verified","first_broken_at":null,"status":"integrity_violation","total_records":10001,"valid":false,"verified_records":0}`.
- gRPC decoded to `VerifyResponse { valid: false, total_records: 10001,
  verified_records: 0, first_broken_at: None, error_message: Some("memory chain
  exceeds verification limit of 10000 records; complete chain was not
  verified") }`. Its exact protobuf bytes were
  `10914e2a596d656d6f727920636861696e206578636565647320766572696669636174696f6e206c696d6974206f66203130303030207265636f7264733b20636f6d706c65746520636861696e20776173206e6f74207665726966696564`;
  proto3 omits the default-valued false, zero, and absent fields while clients
  decode those values from the schema.
- MCP returned the same six JSON fields and values as REST through a real
  signed-capability duplex `tools/call` path.

All three wrappers therefore preserve the repaired fail-closed result; no
production handler change was justified. Strict focused Clippy passes for the
REST test, gRPC library/tests, and MCP test. The complete REST package passes
18 tests, gRPC passes three tests with two intentionally ignored documentation
examples, MCP passes 106 tests, and core again passes 300 tests with its one
intentional network ignore plus two doctests. The host initially lacked
`protoc`; an isolated, checksum-recorded Ubuntu `libprotoc 3.21.12` tool resolved
that convenience boundary without installing a system package or changing
source. This remains local regression evidence, not upstream review or
deployment.

### Missing non-first links must not disable verification

Cycle 34 tested the distinct deletion-of-link question on exact local base
`9e4a1fee3486ac95b1755a5586cbc119ee9f5fa0`. One controlled two-record
memory chain and one separate single-principal two-event chain retained valid
content hashes but set the second record's `prev_hash` to null. Before repair,
both core verifiers returned the exact same successful JSON:
`{"valid":true,"total_records":2,"verified_records":2,"first_broken_at":null,"error_message":null}`.
The result was fail-open: removing the field that carries the link also removed
the check that could reject its absence. This fixture does not repeat Cycle 29's
valid mixed-organization/null-owned record chain; here the missing value is the
chain link itself.

Local repair `d7b8190efa2f4ca8513890622b475b6e7e6bbb5a` makes a missing
non-first memory or event link an integrity violation. Each repaired result
reports two total records, one verified record, the second record as
`first_broken_at`, and an explicit `chain hash missing` or `event chain hash
missing` error. Existing mismatch behavior and the first-record convention are
unchanged. The bundled offline verifier was already strict; its
`--mnemo-compat` switch and documentation now say explicitly that they reproduce
legacy Mnemo behavior through v0.5.28 rather than current behavior.

Rust formatting and whitespace checks pass. Strict all-target core and CLI
Clippy pass with warnings denied. The full core package passes 302 tests with
one intentional network test ignored plus two doctests; both focused repaired
tests pass, and the standalone CLI verifier passes both of its tests. The
candidate changes no schema, storage query, or public response type. It remains
local, unreviewed upstream, undeployed, and is not evidence that historical
stored data contains a missing link.

### Portable verification needs external anchors and complete membership

Cycle 35's bounded newest-first arXiv search surfaced
[`2609.01235v1`](https://arxiv.org/abs/2609.01235v1), MutMem-V2, above the
retained MemGauge anchor. The full TeX archive was observed at SHA-256
`8dd18e6b35777eb0dc645c6bb12f93964dc41a5850684b1a98f5a41ae6490638`.
Its distinct contribution is a portable evidence contract rather than another
memory engine: exact canonical bytes, external trust anchors, actor and
Housekeeper identity epochs and revocation, effective authorization, complete
`13+5r` recall-object membership, deterministic order, per-result provenance,
and a signed terminal receipt. This directly complements the Mnemo findings:
checking a hash only when a field happens to be present is weaker than making
membership and failure reasons part of the versioned protocol.

The manuscript names public release tag `v1.0.0`, annotated tag object
`2f7264dc…e1f`, and commit
`fcda26d1e05c729185c09dd11446db2f79c14a0d`. In a fresh goal-owned clone, its
advertised verifier first stopped before verification because dependencies
were absent and eager import required `pg`. After the locked dependency step,
the offline verifier passed under supported Node 20.19.5 without database,
keychain, provider, or network access: 39 recall and 15 mutation structural
vectors, 72/72 exact Node/Python terminals, 42/42 conformance cases, 44
rate/Wilson rows, 28 McNemar/Holm rows, 17 claim rows, and 10 attempt rows.

Cycle 36 resolved an important provenance distinction. All six submitted arXiv
files—the manuscript and five generated tables—are byte-identical to annotated
`v1.0.4` object `cf8a6608…768`, peeled commit
`abbcae39564e9f4aa57cf8aa9b824dd1b8ad6c0c`; the three changed manuscript
assets do not match `v1.0.0`. The two Git histories have no merge base because
each public release is rebuilt as a one-commit orphan. Across the trees,
`v1.0.4` changes 21 files. Its manuscript binds the public identity back to
`v1.0.0` and corrects historical PoisonedRAG reporting from attacked ASR 3/100
to baseline-aware induced ASR 1/98, while the portable verifier entrypoint and
its evidence corpus remain byte-identical.

The exact arXiv-matching `abbcae3…6c0c` tree passes the same offline verifier
under Node 20.19.5. Its ten public checks are all successful, including source
gates on Node 20, 24, and 26, secret scan, and Fresh Genesis with signed
live-fire proof. Those checks do validate the submitted source tree; they do
not make the distinct `v1.0.0` tree green or establish independent empirical
replication. The exact `v1.0.0` commit's only public check still failed at “Run
source release gates,” later steps were skipped, and unauthenticated log
download still requires repository administration.

Both offline runs support project-released artifact self-consistency, not an
outside reproduction. Both verifier implementations and the corpus ship from
the same project; current V2 utility was not rerun, historical private rows are
unavailable, the canary covers explicit markers only, and one macOS
installation remains the qualified install surface. The arXiv-to-`v1.0.4`
byte match narrows source provenance but does not erase the explicit
manuscript-to-`v1.0.0` release-binding distinction.

Cycle 37 closes the queued release-asset/source-manifest question. GitHub's
`v1.0.4` release exposes a 3,009,287-byte package, a CycloneDX software bill of
materials (SBOM), and `SHA256SUMS`; all three downloaded files match GitHub's
published SHA-256 digests, and the checksum file verifies both payloads. At
exact source commit `abbcae3…6c0c`, `npm pack --dry-run` reproduces the
downloaded package exactly at SHA-1, SHA-512 integrity, size, and 995-file
inventory. The package embeds the exact source-tree manifest blob
`96e98593…5d5e8`, whose self-hash is `433fdf58…9fa58` and whose 1,000-file root
is `8a41e778…9e5f`; an exact Git-archive snapshot passes that manifest's file,
private-path, and disclosure verifier.

The package contains 994 of those source files plus the self-excluded manifest.
It intentionally omits six repository/build-control files: three `.github`
files, `.gitignore`, `.npmignore`, and `package-lock.json`. Therefore the
embedded 1,000-file source manifest cannot be rechecked from the package alone;
it describes the tagged source tree. The stronger cross-surface binding comes
from exact package reproduction and GitHub's keyless CycloneDX attestation.
That attestation verifies for package SHA-256 `eaad3069…88787`, names
`abbcae3…6c0c` and `refs/tags/v1.0.4` as signer/source identity, and carries a
CycloneDX 1.5 predicate exactly equal to the published 160-component,
161-dependency SBOM.

The default SLSA-provenance predicate lookup returns “no matching predicate”;
the verifiable public predicate is CycloneDX. Two local source-verifier
failures were environmental rather than source mismatches: the earlier
offline run left ignored Python bytecode, and a clean multi-tag clone exposed
two orphan roots to a single-root repository assertion. The exact archive
snapshot, which removes both local contaminants without altering source,
passes. These results strengthen release identity and dependency provenance,
not empirical replication, package-only source completeness, or deployment
proof.

Cycle 38 tests the remaining package-only portability boundary. The exact
release tarball ships `package.json`, the verifier, both Node/Python
conformance implementations, and the full public evidence corpus. A fresh
goal-owned extraction mounted read-only in a network-disabled Node 26
container fails before verification with `ERR_MODULE_NOT_FOUND` for `pg`:
the package does not contain its runtime dependencies. Supplying the exact
lockfile-installed `node_modules` from the tagged source as a separate
read-only mount, then running the package under its supported Node 20.19.5,
host Python, a read-only filesystem, and an unshared network namespace makes
the complete verifier pass. It reports 39 recall and 15 mutation structural
vectors, 72/72 Node/Python terminals, 42/42 read-only production-corpus
parity cases, 44 rate/Wilson rows, 28 McNemar/Holm rows, 17 claim rows, and 10
attempt rows, with no database, keychain, private key, provider, or network
access. The exact 995-file extraction fingerprint is unchanged before and
after at `60e3f66c…4806`.

This establishes source-checkout independence **after** dependency
provisioning, not a self-contained package. The tarball omits
`package-lock.json`, while its `package.json` uses semver ranges, so it cannot
reconstruct the exact dependency tree from package bytes alone. The published
CycloneDX SBOM records the release builder's precise 160-component closure,
but npm does not consume it as a lockfile. Package bytes, dependency closure,
and tagged source identity are therefore separately verifiable surfaces.

### Invalidation contracts separate server freshness from model compliance

The Cycle 39 newest-first arXiv pass selected
[`2609.00243v1`](https://arxiv.org/abs/2609.00243v1), _Invalidation Contracts
for Cross-Episode Agent Memory_, after seed-first commit `903ed521…9e4ccb1`.
It studies a narrower lifecycle boundary than MemGauge or MutMem: an API
recovery suggestion can be valid when cached and become stale when a server
table or derivation rule changes. The proposed wire contract attaches
cacheability, table/version dependencies, structured row diffs, and a rules
fingerprint so the client can evict or restamp memory without first replaying a
known-bad request.

The primary source reports 250 arm-level runs over 9,432 episodes, seven
models, three serving paths, and two synthetic domains. Row-level invalidation
raises first-try compliance by 0–66.7 percentage points and has 1.00 eviction
precision under the paper's row oracle; table-level invalidation has 0.25–0.31
precision on six models and destroys unaffected co-located entries. Four of
seven models retain 29–33% token savings against no memory, while one loses
1.1 points against naive memory. A separate rule-drift comparison finds that a
response-wide rules stamp plus cached dependency vectors matches lazy
disposition, detects one episode earlier, and changes tokens by only
−0.11% to +0.20% across three models.

The public evidence layer is unusually inspectable. The exact v1 PDF has
SHA-256 `676741d3…c100f9cd`. The MIT-licensed client/evidence repository was
observed at
[`4c0dabd64b36035d6fc18eb66be99d4b7779c641`](https://github.com/beining1008/cross-episode-memory-client/commit/4c0dabd64b36035d6fc18eb66be99d4b7779c641),
and its runbook pins server refs `977ac97` for the main grids and `567b6a0` for
rules. The server repository was observed at
[`567b6a0e01b49de6b353eb32a3e2f6774052225e`](https://github.com/arquicanedo/self-reflective-apis/commit/567b6a0e01b49de6b353eb32a3e2f6774052225e);
its README says redistribution/production licensing remains pending.

Read-only local recomputation over the archived evidence confirms 250 primary
table rows, 9,432 episodes, 9,273 successes, 159 failures, 238 JSON artifacts,
and exact requested/served model identity in every artifact. The per-cell TSVs
reproduce the paper's compliance, eviction-precision, retry, and token rows.
The archive also contains six specialized A2DR/A2DRC rule-detection arms in
Table 8 outside the 250-row primary Table 1, plus one manually named A0 file
that corresponds to the primary extraction under a different timestamp. This
is an explicit corpus partition, not independent replication of model calls.

Cycle 40 tests how much of that evidence layer is actually regenerable. With
their input roots redirected in memory to the published archive, both
checked-in standard-library analyzers exit 0 without writes. The grid/rule
analyzer emits 111 lines (SHA-256 `0926fde0…65fd387`) and includes A2D, A2DC,
A2DO, A2DR, and A2DRC rule rows; the recipe analyzer emits 13 lines (SHA-256
`c64ea48d‧5b92e2`) with the published per-arm counts. This independently
recomputes summary metrics from JSON artifacts. It does **not** reproduce the
canonical TSV bytes: no checked-in Python, shell, or documentation reference
generates `T1_runs.tsv` through `T8_rules.tsv`. Those eight tables are static
published extracts, and the selection/normalization step that maps 256 archived
arm bodies to 250 primary rows plus six specialized rule-policy rows is not
supplied as an executable manifest. The correct provenance claim is therefore
summary-recomputable, not end-to-end table-build reproducible.

The authority limit is decisive. Both APIs and their drift schedules are
authored for the study; prompts, task families, production transfer, and
independent replication remain untested. The server is assumed honest.
Version stamps can therefore pin stale memory or force repeated derivation,
and precise table/graph metadata discloses internal schema. Most importantly,
the levels that improve compliance tell the planner to merge server parameters
verbatim: the paper correctly notes that compliance and credulity become the
same measurement, making suggestions a parameter-injection channel. Signed
stamps, bump-rate bounds, and a threat model are proposed but not implemented.

The result scores 14/15 (`3+2+3+3+3`): direct durable-seed relevance, strong
but project-authored cross-source evidence, high operational impact, a
resolvable stale-memory gap, and highest freshness. It complements rather than
supersedes MemGauge's controlled stage-wise utility/risk result. The durable
rule is to bind cached recovery memory to externally observed dependency
versions **and** separately authorize suggestion content; freshness metadata
cannot confer mutation authority.

MutMem-V2 scores 14/15 (`3+3+3+2+3`): direct seed-cluster relevance, strong
cross-source connection, high uncertainty reduction, narrower single-project
generality, and highest freshness. It is retained as complementary protocol
evidence but does not displace `2608.30177v1`'s 15/15 controlled stage-wise
utility/risk evidence. Neither source validates Mnemo's implementation or any
deployed service.

## Verification allocation qualification

Full-source and artifact review of arXiv `2608.25553v3` adds another authority
boundary: a provenance link can be immutable and reachable while the agent
still acts on stale memory because it spends a scarce verification budget on
other records. In the paper's controlled six-memory store with two available
reads, native agents inspect the stated constraint's path in 20.1% and 23.1%
of primary and fresh-wording episodes. Once that constraint is superseded,
native stale-consistent decisions occur in 77.3%, 74.7%, and 74.7% of primary,
replication, and original held-out episodes.

The same-budget forced-critical intervention improves the current-consistent
decision by 74.0, 72.7, and 61.3 points in those runs. A corrected held-out
run reports +73.3, an interleaved replication +80.7, and a ten-model,
nine-organization extension +62.0. These are source-reported results whose
locked episode files and generated tables Scout independently re-audited; they
are not independent model-call replications. The intervention uses
experimenter knowledge, delivers the record unsolicited, and is explicitly a
diagnostic rather than a deployable scheduler.

The budget sweep locates the effect more narrowly. Native selection of the
critical path is 5.3%, 17.0%, 41.7%, and 88.7% at budgets one through four;
the forced-critical decision gain shrinks from +76.7 at two slots to +10.7 at
four. In a second three-constraint store, a target-blind rule—prefer inherited
memories that state a limit or prohibition on a candidate direction—moves
two-slot target selection by +89.7 points and current-consistent decisions by
+89.3. Dates alone do not materially redirect allocation.

Cycle 42's independent enumeration of all 600 raw P1 episodes makes the rule's
precision boundary explicit. In the withdrawn world at one slot, it chose the
stale target in 66/150 episodes and a current onboarding constraint in 84/150;
the agrees-world split was nearly identical at 65/150 versus 85/150. At two
slots, it achieved 150/150 stale-target recall in the withdrawn world, but the
other 150/300 verification slots all went to the current constraint. Across
both worlds, the archive's published counts are 131 target versus 169 current
decoy selections at one slot, and target-plus-current pairs in 296/300
two-slot episodes. Thus the rule prioritizes decision-relevant constraints but
does not detect staleness: high recall is bought with current-record work, and
one-slot stale precision is only 44% in the world where stale state exists.

Cycle 43's descriptive cross-tab of the same 600 raw episodes shows what the
rule is tracking. At one slot, agents intending `activation_messaging` chose
the target path in 87/97 episodes (89.7%), while agents intending
`simplify_onboarding` chose it in only 44/203 (21.7%) and instead chose the
current onboarding constraint in 159/203. At two slots, the target was listed
first in 106/122 activation-intent episodes (86.9%) but 47/177
onboarding-intent episodes (26.6%); nearly every episode still selected both
paths. These are descriptive nested episode counts, not independent-sample
inference or causal mediation. They show strong coupling between verification
order and the agent's current decision framing, while neither selection nor
order reveals whether the chosen provenance is stale.

Cycle 44 audits why that correlation cannot answer the next causal question.
Across all 300 `agrees`/`withdraws` pairs, the turn-1 prompt and memory block
are byte-identical; supersession is hidden until a selected archive path is
returned. All 600 episodes also share one current-situation text fingerprint
(`7d4a5d81…eba0b8`). Intended action is a model response rather than an
assigned factor, and the pricing, activation, and onboarding pressures never
vary independently. The existing archive can therefore describe
decision-context coupling, but cannot estimate whether trustworthy visible
freshness overrides an assigned plan or a tempting alternative. A defensible
follow-up must factorially vary those three inputs at allocation time,
counterbalance which constraint is superseded and record order, and analyze
selection before downstream decisions. Scout's
[preregistration-ready design](../../reports/research/verification-allocation-factorial-design-2026-09-02.md)
specifies that boundary and its no-call gates. Its offline
[factor-isolation verifier](../../../scout-knowledge-lib.app/scripts/verification-allocation-factorial.ts)
now checks all 64 cells in a synthetic toy schedule at exact commit
`957390080c9a77dc2adc88ed91d66c7f5ba86d50`; the fixture-only attestation and
empty results remain design tooling, not an authenticated manifest or model
run.

Cycle 67 makes the primary descriptive contrast executable at exact local
commit `e8ce4879dfe649377051801927aa145df514640f`. On the unchanged 64-episode
synthetic schedule, plan-only and temptation-only controls each yield
current-minus-superseded target-selection contrast zero in all four strata;
an authority-aware oracle yields `+1` in all four. Missing, duplicate, and
unknown episode outcomes fail closed, while malformed answers remain in the
scheduled denominator and are reported separately. This proves the analyzer
can distinguish the three intended signatures. It does not show how any model
allocates verification, validate the fixture's lineage authority, or authorize
a provider call; model-block inference and real results remain open.

Cycle 68 closes the narrower result-binding and model-block accounting gap at
exact local commit `3aaba3f61478ba2ee8493fbb668139ba0b1c8599`.
A schema-constrained result envelope now carries the exact schedule SHA-256,
rejects malformed or population-incomplete inputs, and preserves per-model
status contrasts before an equal-model mean. In a matched two-model synthetic
control, one policy has `Delta_status=+1` and the inverse policy has `-1` in
all four strata, while their equal-model mean is zero throughout. This directly
supports block-aware reporting and contradicts an interpretation of the pooled
zero as “no status response.” It does not estimate sampling uncertainty or
describe any real model: both policies are deterministic fixtures, no
authenticated result producer or external timestamp is present, and provider
calls remain unauthorized. Confidence is high for the tested accounting
behavior and low for transfer beyond it.

Cycle 69 adds deterministic model/run block resampling at exact local commit
`6a22b25107c1e77b79b4b55e6a0057ce7ee9b424`. The frozen fixture samples
complete model/seed blocks within each named model, keeps equal model weights,
and reports model intervals before aggregation. Opposed deterministic models
retain `+1` and `-1` intervals while their aggregate interval collapses to
`[0,0]` with an explicit direction conflict; a single model with opposed runs
instead produces point zero and interval `[-1,+1]`. This supports whole-run
accounting and contradicts interpreting aggregate precision as agreement.
Confidence is high for the tested mechanics and low for statistical coverage
or real-model transfer: the model set is fixed, only two synthetic runs are
used, and neither an authenticated producer nor provider execution is present.

Cycle 70 freezes the downstream practical-effect policy at exact local commit
`96b5762c675d8710438bdf5aae75cd132d7f708c`. With a synthetic `0.10`
threshold, unanimous-model requirement, and conflict-to-inconclusive rule, the
opposed-model aggregate `[0,0]` is no longer misreported as negligible: every
stratum remains inconclusive because the named models are positive and
negative. Unanimous authority and plan controls still resolve as positive and
negligible. This supports conflict-aware interpretation and contradicts a
pooled-only decision. Confidence is high for the deterministic gate and low
for threshold choice or statistical calibration; no provider result is used.

Cycle 71 calibrates the ideal percentile rule over three frozen symmetric
trinomial null families at exact local commit
`4cce1a0da52ead9f520337eb89442d4ddc0edcaf`. Exact enumeration contradicts a
25-run minimum: balanced and dense nulls produce 1.3211% and 1.4633% false
directional conclusions, above the predeclared 1% tolerance. The dense null
also fails at 48 blocks. A 64-block candidate stays below 1% for all three
families at every checked integer count through 96, with the worst case 0.8772%
at 78 dense blocks. This supports only a bounded exact-oracle candidate, not a
provider gate: the separate 1,024-resample implementation, process families
outside `-1/0/+1`, dependence, power, and real models remain uncalibrated.
Confidence is high for exact enumeration and low for external transfer.

Cycle 72 finds that the finite deterministic resampler was sensitive to an
irrelevant ordering of the same run-effect multiset. Before repair, a 21/43
dense-null composition was positive when negative blocks were grouped but
inconclusive when spread; the symmetric 43/21 composition changed from negative
to inconclusive. Exact local commit
`6cac8790071f1688c00595082ef2902fee795420` canonicalizes run-effect vectors
before drawing and makes front, back, and spread controls match the exact
boundary decisions. This supports permutation-invariant accounting, while
leaving the finite resampler's complete operating rates and real-model transfer
uncalibrated.

Cycle 73 exhausts the remaining fixed-setting comparison at exact local commit
`8667408cd28d224e6cab1eb2a2dc2b405b0af337`. Across all 2,145 possible
64-block `-1/0/+1` compositions, the canonical finite resampler and exact
oracle disagree on 26. Balanced-null false-direction probability rises from
`0.002307919821710335` exact to `0.003173180319440574` finite; sparse rises
from `0.0001755936794143284` to `0.00025673753238608036`; dense remains
`0.008146902228698577` under both. Thus the finite rule still passes the
declared 1% tolerance for these three nulls, supporting the bounded 64-block
candidate, while the nonzero mismatches contradict calling it exact. Confidence
is high only for this complete frozen enumeration. The rates remain conditional
on one resampling seed and model ID, and do not establish power, robustness to
dependence or drift, real-model behavior, or provider authority.

Cycle 74 tests that conditionality at exact local commit
`59268cc62629ebcf3cf274835d259b3b158ac2d6`. A matched three-by-three cross
of model identifiers and frozen resampling seeds keeps every balanced, dense,
and sparse finite false-direction rate below 1%, supporting the bounded
go/no-go conclusion. It also exposes meaningful finite sensitivity: mismatch
counts range from 10 to 32 compositions, dense-null false-direction rates range
from 0.3690% to 0.8147%, and sparse-null overall decision disagreement reaches
2.2724%. The latter includes negligible-versus-inconclusive differences rather
than only false directional calls. This contradicts salt-invariant
classification at 1,024 draws. Confidence is high for the replayed nine-control
fixture and low for untested salts, convergence, alternatives, dependence, or
real models.

Cycle 75 freezes the worst observed sparse-disagreement salt and varies only
the draw count at exact local commit
`bbbcd6e7418293e0e5427bfd1b47f4a6a0114757`. From 1,024 to 4,096 to
16,384 draws, mismatch compositions fall 18→11→3 and sparse disagreement
probability falls 2.2724%→0.00206%→0.00000137%; all false-direction rates
remain below 1%. Supporting convergence is qualified by contradictory
non-monotonic detail: balanced disagreement rises between 4,096 and 16,384,
and the intermediate dense false-direction rate moves below both endpoints.
Confidence is high for this one matched ladder and low for other salts,
optimal-cost selection, alternatives, dependence, or real-model behavior.

Cycle 76 classifies the three residual 16,384-draw mismatches at exact local
commit `433ac5165384e04f901bb62f3118b2a0c4aa18dc`. All are finite-only
directional errors: counts `6/36/22` and `8/31/25` move from exact
inconclusive to positive, while `25/31/8` moves from exact inconclusive to
negative. Their combined probability is 0.03965% balanced, zero dense, and
approximately 0.00000137% sparse. This remains within the finite rule's
already reported sub-1% risk, but contradicts using even the 16,384-draw result
as an exact boundary authority. Confidence is high for the frozen enumeration
and low for other effect supports, dependence, salts, or real models.

Cycle 77 makes the resulting authority boundary executable at exact local
commit `09f33e3831a0be56140c0255f7c9b78141e5e99b`. The exact trinomial oracle,
not the finite bootstrap, now supplies authoritative false-direction rates and
the 1% tolerance decision; finite output is explicitly diagnostic-only. This
preserves mismatch evidence without letting a finite-only directional boundary
case become calibration authority. Confidence is high for the declared
discrete family and low for continuous effects, nonzero alternatives, or real
provider responses.

Cycle 78 adds exact mirror-paired nonzero alternatives at local commit
`311d68216b49cb664ec0019c3259e00f9246bfda`. At 64 blocks, expected effects
±0.15 have only 8.41% correct-direction power and ±0.30 only 59.76%, despite
wrong-direction probabilities of about 0.000186% and 0.000000023%. All four
processes therefore pass the declared 1% wrong-direction limit but fail the
80% power target. This contradicts using the 64-block null-safety result as a
general execution-size gate. Confidence is high for the exact synthetic
enumeration and low for alternative selection, dependence, continuous
effects, drift, or real-model transfer.

Cycle 79 searches every integer count from 64 through 256 at exact local
commit `e19f5cb72a1916268c894da1366ba5373ba81aa3`, under content-addressed
search specification
`bffe0129348403b1e6059a24889b9d823763423aa0cb9433c72751cfbc1023cb`.
The ±0.30 pair rises from 79.73% correct-direction power at 104 blocks to
80.45% at its first passing count, 105. The ±0.15 pair never passes; its
largest power is only 20.37% at 249, then 19.99% at 256. This non-endpoint
maximum supports the exhaustive search and contradicts assuming monotone power.
Wrong-direction risk remains below the declared 1% tolerance throughout.
Confidence is high for all 193 exact discrete counts and low for the synthetic
80% target, operational cost, other interval rules, dependence, continuous
effects, drift, or real-model transfer. Before provider execution, decide
whether 105 complete model-run blocks are affordable or revise the estimand or
interval rule explicitly.

Cycle 80 resolves the immediate sizing interpretation from the same local
implementation. Blocks are resampled within each named model, and the final
rule requires unanimous named-model decisions. The retained six-model,
25-seed design therefore supplies 25—not 150—blocks to each model interval.
Its 4,800 episodes have exact synthetic power of only 30.61% for ±0.30 and
6.92% for ±0.15; the prior 25-block null controls also exceed the 1%
false-direction limit for balanced and dense families. Reaching the Cycle 79
strong per-model crossing would require 20,160 episodes, and under an
illustrative independent-identical six-model assumption its 80.45% per-model
power compounds to only 27.12% unanimous power. This supports neither the
original grid nor 105 pooled blocks as a confirmatory gate. Confidence is high
for the code-path and schedule arithmetic, and low for independence, real
effects, affordability, and provider transfer. A next design must calibrate
per-model and unanimous power explicitly and distinguish a directional claim
from the current practical-effect claim.

Cycle 81 makes that separation executable at exact local commit
`aca937e3f66661e0ccee5aed434cfbe7c309cf64`. A fail-closed six-model contract
uses sharp Fréchet bounds as the unknown-dependence authority and labels the
independence product as illustration only. At 105 blocks per model, the strong
process's 80.45% marginal power implies unanimous bounds `[0, 80.45%]`, while
the independence illustration is 27.12%; guaranteeing an 80% lower bound
would require at least 96.67% marginal power. The moderate process has only
11.13% marginal power. This directly contradicts lifting a single-model
crossing into a multi-model claim. Confidence is high for the bound
calculation and low for equal real-model marginals, dependence, aggregate
support, and provider behavior. The next comparison must freeze directional
and practical-exceedance estimands separately rather than weakening the
practical claim after observing low power.

Cycle 82 tests that next distinction at exact local commit
`ee0d64bf3821fd9b65980cdb9fc33b0dad87cd1d`. With the run count, exact
trinomial controls, and percentile interval held fixed, a directional
threshold raises strong-process power from 80.45% to 98.46% and moderate power
from 11.13% to 53.44%. It also raises symmetric-null false-direction risk to
4.27–5.04%, failing the frozen 1% limit; the practical-exceedance threshold
stays at 0.0024–0.3221%. The directional shortcut is therefore contradicted,
not adopted. Confidence is high for the matched exact controls and low beyond
their discrete support, fixed interval, synthetic alternatives, and absent
provider/model evidence. Any stricter directional interval must be calibrated
against the null family before its alternative power is inspected.

The rule-plus-date P3 ceiling chooses the target in 98.7% of one-slot episodes,
but its wording uniquely identifies that path in this synthetic store; it is
not a general scheduler. P2 dates alone move target selection only +2.3 points.
The supported design implication is staged allocation: use relevance to form a
candidate set, then use trustworthy current-record/supersession state to rank
within it, while preserving uncertainty when those signals conflict. The
study still does not test a stale constraint that is less decision-relevant
than a current one, and the instruction may influence decisions directly as
well as allocation.

The artifact boundary was directly checked at Zenodo concept DOI
[`10.5281/zenodo.22108557`](https://doi.org/10.5281/zenodo.22108557), immutable
v3 record `22147784`. Its 61,508,909-byte archive matches published SHA-256
`41ca426998db106d041f85c8eb1fb2f2cfd692615b98160952d32d3877a63138`.
ZIP integrity, all 14,370 archive-manifest checks, every completion manifest,
and the audit's 8,400 locked-file checks pass. The independent 139-line
recomputation is byte-identical to its committed output at SHA-256
`fe54a5d87f094703a97971a33cbf19ac2b419bcfceba40fcaa074aa789f69989`.
After supplying the separately published checksum-matched PDF to the audit's
documented output location, the full 69-line release audit passes at SHA-256
`47b5e52e5ca11a5cbc71a6c155b148ee2b0f29c7a5595375f4cac0ba5c519d9a`.

This raises confidence in project-authored reproducibility, not external
validity. The stores, stale state, and current truth are synthetic; memory
scale is fixed; all replications are by the same author; most model aliases
were not snapshot-pinned; and repeating the original calls requires provider
credentials without recreating the historical model versions. The durable
design rule is therefore to govern four separate layers: immutable source,
immutable provenance link, append-only supersession/current record, and the
policy that decides which path to verify. Provenance availability cannot stand
in for allocation, just as freshness cannot stand in for mutation authority.

## Retrieval-time validity qualification

arXiv `2609.08258v1` tests the next boundary: a backend may preserve a
supersession or revocation mark without enforcing it when records are assembled
for the agent. Across five memory systems, the authors found no system that
enforced soft revocation in every tested case. Under indirect, plain-text
contradiction, three systems did not record revocation; Zep recorded it but did
not expose status to callers; and Graphiti plus a mem0 configuration returned
records whose revoked state was visible but not filtered.

For the two exposed configurations, the revoked policy ranked above its
replacement in every one of 81 scenario-model cells per system. Agents selected
the revoked policy's unsafe action in **699/1,620 trials (43.1%)**. A read-time
status filter reduced this to **0/1,620**, while prompt hardening alone left
37.2% unsafe and an output filter—given the revoked texts, an advantage a normal
deployment would not have—left 18.1%. This makes a precise distinction:
provenance says where a record came from; **retrieval-time validity** says
whether it is still authoritative when read.

The stronger lifecycle result is authority laundering through agent write-back.
Once an agent journals a conclusion derived from a revoked record as a new,
current record, filtering the original no longer removes the conclusion. In the
paper's direct-write Graphiti extension, filtered reads remained unsafe in
**71.6%, 79.5%, and 83.1%** of poisoned runs over three later hops, compared
with 0% in the single-read test. Under default shared-store retrieval, a reviewer
independently phrased but reading the same store agreed with a poisoned
executor's unsafe choice in **341/354 cases (96.3%)**. Without the journal,
agreement fell to 81.7%: shared retrieval was already a correlated failure, and
write-back compounded it.

The governance implication is to bind lifecycle status and replacement lineage
to each record, enforce current authority before context assembly, and carry
that lineage into derived journals rather than admitting them as clean current
facts. A second agent is not an independent check when its evidence path is the
same memory backend. This remains an arXiv preprint with nine policy scenarios,
nine models, and controlled backend configurations; its product-specific rates
are not fleet-wide prevalence estimates.

Source: https://arxiv.org/abs/2609.08258v1

## Answer-time forgetting qualification

RD-Forget (`2609.10263v1`) sharpens a separate boundary: preserving an
observation and letting it influence this answer are different decisions. Its
archive retains source observations, while a query-conditioned curator builds a
2,048-token answer-time view. Facts grouped into the same semantic slot receive
replacement links; superseded values are normally inactive, but historical
query intent can make them eligible again. Relation closure is preserved so
suppressing an obsolete value does not accidentally sever evidence needed for a
multi-hop answer.

Across four model families and three benchmark slices, RD-Forget reports the
best score in all 12 comparisons. Its mean over AMB-Text, LME-KU, and MAB-FC was
66.59 versus 48.86 for the stronger displayed Qwen baseline, 86.71 versus 67.26
for GPT-5.6-Luna, 77.13 versus 57.77 for MiniMax-M2.5, and 72.83 versus 64.30 for
Kimi-K2.5. In a separate 264-task Luna ablation, leaving older revisions active
reduced scores from **91.86/93.59/74.00** to **68.60/60.26/51.00**; hiding the
query from curation reduced them to **77.91/82.05/56.00**. Removing historical
rescue, slot grouping, or relation closure also hurt at least one benchmark.
This supports a practical design: keep the audit/history layer lossless, then
construct a purpose-specific influence view rather than treating physical
deletion as the only form of forgetting.

The qualification is equally important. This is semantic relevance and
supersession, not authorization or revocation enforcement: historical rescue
must never reactivate evidence that the current principal is forbidden to see or
that policy has invalidated. The method also uses the same model family for
curation, selection, answering, and model-based evaluation, which the authors
explicitly treat as within-protocol rather than independent judgment. Its
benchmark subsets and model configurations establish a promising controlled
result, not production prevalence or governance completeness.

Source: https://arxiv.org/abs/2609.10263v1

## Feedback coverage is not feedback authority — Slowave (HN, September 2026)

Slowave makes a useful adaptive-memory contract unusually explicit. Its five
public MCP verbs separate retrieval from feedback and task closure. Every
memory exposed by `activate` or `recall` receives a target-specific assessment
(`used`, `irrelevant`, or `stale`); declaring coverage complete while leaving a
target unassessed is rejected, and `commit` blocks until all session retrievals
have complete feedback. Partial coverage preserves silence as unknown rather
than converting it into negative evidence. The pinned tests exercise those
mechanics, and the implementation restricts feedback mutations to memory IDs
actually exposed by that retrieval.

This closes a **coverage** gap, not an **epistemic authority** gap. Slowave's own
design says the connected agent decides what is true or important and acts as
the author, consumer, and critic of memory. A `used` assessment can increase a
schema's salience and confidence; stale feedback can retire it or name a
replacement. Complete coverage therefore proves that every exposed item has a
label, not that the labels are correct, independently verified, or safe to turn
into ranking changes. The same agent that acted on a mistaken memory can report
that it was useful, creating an endogenous reinforcement path.

The reusable boundary is to keep three receipts distinct:

1. **Exposure coverage:** which memories were returned, and were all of them
   assessed?
2. **Feedback provenance:** which client or principal supplied each assessment,
   under which retrieval and scope?
3. **Feedback admission:** what independent outcome evidence, corroboration, or
   policy permits that assessment to change shared salience, confidence,
   supersession, or visibility?

Slowave already supplies useful ingredients for the first two: append-only
feedback, retrieval-target binding, explicit partial versus complete coverage,
scope-bound lifecycle calls, and a commit preflight. It explicitly warns that
scope is not an authorization system and recommends separate stores for hard
isolation. Its benchmark page also limits current evidence to retrieval
containment rather than end-to-end agent correctness; historical artifacts omit
the raw records and revision/checksum data needed for forensic reproduction.
Accordingly, this HN signal supports the receipt separation above, not a claim
that adaptive feedback improves deployed agents or that the project has solved
memory truth.

At observation time the Show HN item had 1 point and no comments, and the
repository had four stars. Those counts establish only a very early source
signal. Scout inspected documentation, implementation, and project-authored
tests at revision `8d538b370c37243a39e19e52e4a5fdb35c9527b5`; it did not execute
the suite independently.

HN: https://news.ycombinator.com/item?id=49702887  
Repo: https://github.com/slowave-ai/slowave/commit/8d538b370c37243a39e19e52e4a5fdb35c9527b5

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
- Treat a bounded integrity scan as incomplete unless it proves the result set
  is complete; fetch a sentinel record or return an explicit truncation state
  instead of silently certifying a prefix or suffix as the whole chain.
- Test governance properties separately: authenticated write admission,
  cross-principal leakage, provenance completeness, rollback fidelity, and
  post-deletion reappearance measure different failure boundaries.
- Keep feedback coverage, feedback provenance, and feedback admission distinct.
  A label for every retrieved item does not prove those labels deserve to alter
  shared memory; bind adaptations to independent outcome evidence where the
  client is also the memory's author, consumer, and critic.
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
- Budgeted verification paper v3: https://arxiv.org/abs/2608.25553v3
- Revocation-enforcement paper v1: https://arxiv.org/abs/2609.08258v1
- Query-conditioned forgetting paper v1: https://arxiv.org/abs/2609.10263v1
- Budgeted verification data/code archive v3: https://doi.org/10.5281/zenodo.22147784
- Mnemo repository at inspected revision: https://github.com/sattyamjjain/mnemo/commit/376ca28606c5b6287d9c8274482fa791d4dc8703
- Mnemo agent-managed tool inputs: https://github.com/sattyamjjain/mnemo/blob/376ca28606c5b6287d9c8274482fa791d4dc8703/crates/mnemo-mcp/src/tools/agent_managed.rs
- Mnemo tool handlers and request dispatch: https://github.com/sattyamjjain/mnemo/blob/376ca28606c5b6287d9c8274482fa791d4dc8703/crates/mnemo-mcp/src/server.rs
- Mnemo remember provenance path: https://github.com/sattyamjjain/mnemo/blob/376ca28606c5b6287d9c8274482fa791d4dc8703/crates/mnemo-core/src/query/remember.rs
- Mnemo synthetic crossover test: https://github.com/sattyamjjain/mnemo/blob/376ca28606c5b6287d9c8274482fa791d4dc8703/crates/mnemo-core/tests/agent_managed_crossover.rs
- Current Mnemo public revision used for Cycle 14 provenance: https://github.com/sattyamjjain/mnemo/commit/2994abf185da50d43e5fa4b3f826812bd09c2f20
- Current public general-forget handler: https://github.com/sattyamjjain/mnemo/blob/2994abf185da50d43e5fa4b3f826812bd09c2f20/crates/mnemo-mcp/src/server.rs
- Current public forget engine path: https://github.com/sattyamjjain/mnemo/blob/2994abf185da50d43e5fa4b3f826812bd09c2f20/crates/mnemo-core/src/query/forget.rs
- Slowave Show HN item: https://news.ycombinator.com/item?id=49702887
- Slowave repository at inspected revision: https://github.com/slowave-ai/slowave/commit/8d538b370c37243a39e19e52e4a5fdb35c9527b5
- Slowave architecture: https://github.com/slowave-ai/slowave/blob/8d538b370c37243a39e19e52e4a5fdb35c9527b5/docs/architecture.md
- Slowave design rationale: https://github.com/slowave-ai/slowave/blob/8d538b370c37243a39e19e52e4a5fdb35c9527b5/docs/design.md
- Slowave feedback service: https://github.com/slowave-ai/slowave/blob/8d538b370c37243a39e19e52e4a5fdb35c9527b5/slowave/core/services/feedback.py
- Slowave feedback-coverage tests: https://github.com/slowave-ai/slowave/blob/8d538b370c37243a39e19e52e4a5fdb35c9527b5/tests/unit/test_feedback_events.py
- Slowave benchmark limits: https://github.com/slowave-ai/slowave/blob/8d538b370c37243a39e19e52e4a5fdb35c9527b5/docs/benchmarks.md
