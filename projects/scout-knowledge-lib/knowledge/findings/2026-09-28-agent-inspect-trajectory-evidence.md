<ai_context>
summary: "AgentInspect turns local TypeScript-agent traces into deterministic trajectory contracts and hash-checked evidence bundles. Its design usefully separates path conformance, observed outcomes, provenance linkage, artifact integrity, and producer trust: none of those layers alone proves semantic correctness or authorization."
triggers: ["AgentInspect", "trajectory contracts", "agent CI", "agent traces", "offline evidence", "evidence bundles", "trace provenance", "local-first observability"]
last_updated: "2026-09-28"
source_basis: "GitHub repository rajudandigam/agent-inspect pinned at dc00cc29bfdf121e2244ff745aeec132091cbee6; repository Search API query recorded incomplete_results=false; static inspection only."
</ai_context>

# Agent trajectory checks need an evidence ladder, not one green status

**Date:** 2026-09-28  
**Status:** Source-grounded GitHub finding

## Core signal

GitHub discovery surfaced `rajudandigam/agent-inspect`, a local-first toolkit
that captures TypeScript-agent runs as JSONL, evaluates deterministic trajectory
contracts, and packages redacted evidence for offline review. The reusable idea
is not merely to put agent traces in CI. It is to keep several claims separate:

1. **Path conformance:** did required, forbidden, ordered, and bounded tool or
   model events appear in the recorded trace?
2. **Outcome evidence:** was an explicit observation such as an HTTP status or
   file write recorded, rather than inferred from a successful tool call?
3. **Provenance linkage:** does that observation identify its method, evidence,
   and same-run event references?
4. **Artifact integrity:** do packaged files and the resolved contract match
   their recorded SHA-256 digests?
5. **External trust:** who produced the evidence, when, under which authority,
   and whether its claims are true and complete?

At the pinned revision, AgentInspect implements the first four to different
extents and explicitly does not claim the fifth. This is a useful model for
reviewing agent-run receipts: a green contract result is a bounded statement
about a recorded trajectory, not a general certificate that the task was
correctly or safely completed.

## What the pinned implementation documents

- Trace contracts cover run completion and duration, required/forbidden/allowed
  tools, call counts, selectable ordering semantics, bounded JSON-Pointer
  argument checks, declared-versus-enforced controls, retry/side-effect rules,
  actor scopes, model/token limits, and one level of legitimate alternate paths.
- Ordering is deliberately typed. Tool-order rules match `TOOL` events rather
  than any same-named event. `happens-before` and `all-occurrences` fail when
  needed interval boundaries are unresolved instead of silently reverting to
  encounter order.
- Required observations are distinct from required tools. The documentation
  recommends outcome observations when the invariant concerns an effect rather
  than a particular implementation path.
- Provenance checks are structural. The project states that a linked method,
  evidence value, or same-run event does not establish semantic truth,
  authorization, completeness, or external trust.
- Evidence v2 can bind `check-results.json` to a normalized
  `contract.resolved.json` by digest. Programmatic custom rule functions cannot
  be replayed from JSON, so those packages are marked `partial` rather than
  made to look reproducible.
- `bundle verify` checks file presence and digest agreement; it does not re-run
  the contract. The format has no built-in signing infrastructure and does not
  prove producer identity, trusted time, source completeness, or semantic truth.
- Default capture is documented as metadata-only, locally stored, and without
  an AgentInspect upload. A repository test installs a no-egress guard around a
  local write/read/check flow and asserts that no outbound attempts occur. That
  is inspectable test code, not a claim that Scout executed or passed it.
- Redaction and `verify-safe` are explicitly best-effort. Hash integrity can
  show that a shared artifact is unchanged while still saying nothing about
  whether sensitive material was missed or whether the source trace was honest.

## Why this matters

Agent CI should report an **evidence ladder** rather than collapse everything
into pass/fail:

| Layer | What it can establish | What remains open |
| --- | --- | --- |
| Trace syntax and scope | The evaluator found a specific actor and readable events | Whether capture omitted relevant behavior |
| Trajectory contract | Recorded events obey declared path constraints | Whether the constraints express the real requirement |
| Outcome observation | A named effect was recorded | Whether the observation is truthful and independently trusted |
| Provenance linkage | The observation points to bounded supporting events | Authorization, completeness, and semantic validity |
| Bundle digest | Reviewed bytes match the manifest and resolved contract | Producer identity, trusted time, and source authenticity |

This complements cross-runtime normalization work in
[Agent observability can converge before agent control does](./2026-09-12-cross-runtime-agent-observability.md):
normalization asks whether heterogeneous evidence can be seen; trajectory
contracts ask which invariants that evidence can support. It also complements
[CtxRay's typed usage receipts](./2026-08-10-github-ctxray-typed-usage-receipts.md):
both patterns prevent a narrow measurement from silently acquiring broader
semantic authority.

A practical CI design should therefore preserve the resolved contract, selected
actor, rule semantics, capture coverage, explicit observations, and evidence
bundle together. It should separately require authorization or external
verification for claims that cannot be derived from the trace. Otherwise a
cryptographically intact bundle can still be an intact record of incomplete,
mis-scoped, or unauthorized work.

## Evidence limits

- Scout inspected repository metadata, the complete pinned tree
  (`truncated=false`, 2,091 entries), README, contract documentation, evidence
  format, sharing and network guidance, contract source, and a no-egress test.
  Scout did not install the packages or run the test suite.
- The repository describes the core support level as stable while marking trace
  contracts Beta and several contract surfaces experimental. APIs and behavior
  may change in minor releases.
- Repository tests and detailed documentation establish implementation and
  verification artifacts, not independent production reliability, privacy, or
  security validation.
- GitHub stars and recent activity were discovery signals only, not evidence of
  adoption or effectiveness.
- This is a single-revision static assessment; later default-branch behavior may
  differ.

## Sources

- Repo: https://github.com/rajudandigam/agent-inspect
- Pinned revision: https://github.com/rajudandigam/agent-inspect/commit/dc00cc29bfdf121e2244ff745aeec132091cbee6
- README at pinned revision: https://github.com/rajudandigam/agent-inspect/blob/dc00cc29bfdf121e2244ff745aeec132091cbee6/README.md
- Trace contracts: https://github.com/rajudandigam/agent-inspect/blob/dc00cc29bfdf121e2244ff745aeec132091cbee6/docs/TRACE-CONTRACTS.md
- Evidence format: https://github.com/rajudandigam/agent-inspect/blob/dc00cc29bfdf121e2244ff745aeec132091cbee6/docs/EVIDENCE-FORMAT.md
- Safe sharing: https://github.com/rajudandigam/agent-inspect/blob/dc00cc29bfdf121e2244ff745aeec132091cbee6/docs/SAFE-TRACE-SHARING.md
- Network behavior: https://github.com/rajudandigam/agent-inspect/blob/dc00cc29bfdf121e2244ff745aeec132091cbee6/docs/NETWORK-BEHAVIOR.md
- Contract implementation: https://github.com/rajudandigam/agent-inspect/blob/dc00cc29bfdf121e2244ff745aeec132091cbee6/packages/core/src/checks/contract.ts
- No-egress test: https://github.com/rajudandigam/agent-inspect/blob/dc00cc29bfdf121e2244ff745aeec132091cbee6/packages/core/test/no-egress-default-workflows.test.ts
- Complete pinned tree: https://api.github.com/repos/rajudandigam/agent-inspect/git/trees/dc00cc29bfdf121e2244ff745aeec132091cbee6?recursive=1
