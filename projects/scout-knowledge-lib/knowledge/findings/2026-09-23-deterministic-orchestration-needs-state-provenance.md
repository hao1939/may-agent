<ai_context>
This finding records a September 2026 GitHub implementation signal from Consort: deterministic orchestration still depends on explicit state ownership, artifact coverage, and enforcement wiring. It is based on selected documentation, implementation files, and checked-in tests at the pinned revision; it is not an independent evaluation of the whole system or its Lakebase claims.
</ai_context>

---
title: "Consort — Deterministic Orchestration Needs State Provenance"
source: github
date: 2026-09-23
last_updated: 2026-09-23
type: finding
tags: [github, coding-agents, deterministic-orchestration, state-machines, provenance, gates, verification]
relevance: high
---

# Consort — Deterministic Orchestration Needs State Provenance

## Source signal

Current GitHub repository search surfaced [databricks-solutions/consort](https://github.com/databricks-solutions/consort), a role-based coding-agent system that puts planning, design, build, deployment, and promotion behind a deterministic conductor and human approval gates. This review inspected selected documentation, TypeScript implementation, and tests at pinned revision [`269fadf`](https://github.com/databricks-solutions/consort/commit/269fadf2258899dd6f2e6f21132e5cae88b6b9c6).

The useful signal is narrower than the repository's broad claim that routing and test immutability are enforced by contract: Consort's own implementation shows that deterministic state is safe to reuse only when it says **which unit of work owns it**, and that a verification primitive is not the same as a universally enforced gate.

## Concrete implementation signal

### 1. A phase value without an owner can skip another feature's work

The coarse driver phase lives in one project-level `workflow-state.json`, while drives are feature-scoped. The current implementation stamps `phase_feature_id` whenever it writes a feature phase. On read, it honors a lifecycle phase only when that owner matches the requested feature; an unstamped or foreign-owned phase falls back to `feature` so the orchestrator re-derives progress from that feature's artifacts. Sprint-level `planning` is explicitly global and remains exempt.

The comments preserve the failure that motivated this rule: a second feature could inherit the first feature's `deploy`, `done`, or `shipped` phase and return as if its own work had advanced. Checked-in tests cover foreign ownership and stale terminal phases. This makes provenance part of the state schema, not optional metadata.

### 2. Recovery distinguishes advancement from reconstruction

The SCM design documents a forward path (`scaffold-complete -> feature-claimed -> pr-ready -> ci-green -> merged`) separately from recovery transitions that reconstruct missing or out-of-sync state. Its doctor is described as an advisory cross-check, while each forward CLI asserts its from-state before acting. That distinction prevents a repair observation from being mistaken for a normal transition receipt.

### 3. Artifact hashes prove equality only over an exact declared set

At gate approval, Consort records normalized SHA-256 hashes of named artifacts. Verification refuses mismatched artifact-name sets and returns separate outcomes for an unapproved gate, matching content, and drift. The normalization tolerates line-ending, trailing-whitespace, and repeated-blank-line changes while preserving leading indentation.

This is useful but bounded evidence. `verifyGateIntegrity` is deliberately a pure read: its own source says the caller decides whether drift causes refusal, warning, or another action. A repository-wide production-source search at the pinned revision found the primitive's definition but no production call site outside comments; direct calls were present in tests and migration-related tests. Other mutation paths implement their own hash checks. Therefore the existence of the primitive and passing checked-in cases do not by themselves establish that every build, cycle start, or effect path enforces it.

### 4. Legacy migration cannot recreate approval-time evidence

The gate migrator can reconstruct approval status from a narrative selection log, but it explicitly cannot recover the artifact bytes or hashes from the original approval moment. If current artifacts are supplied, it hashes those as a new baseline and marks history entries as migrated. This preserves operability, not historical proof; consumers must retain the distinction.

## Reusable design rule

> Deterministic orchestration needs provenance on every reusable state value and activation evidence on every guard. A typed state or verification function is not authoritative until the runtime binds it to the correct work item and proves that consequential paths actually consume its verdict.

For agent runtimes, record at least:

1. **scope/owner** — project, feature, story, attempt, or other unit the state belongs to;
2. **transition kind** — forward advancement, observation, or recovery reconstruction;
3. **evidence coverage** — the exact artifact names and bytes represented by a hash or approval;
4. **enforcement point** — which effect path consumes the verdict and whether failure blocks;
5. **migration provenance** — native evidence versus a later baseline synthesized from current state.

This sharpens earlier library findings on deterministic workflows and evidence-authoring boundaries: moving control flow out of an LLM removes model discretion, but it does not remove stale-state, scope, migration, or dead-guard failures.

## Scope and limitations

- Scout inspected selected repository files and checked-in tests but did not run the test suite or exercise a live Consort/Lakebase workflow.
- The source tree was complete according to GitHub's recursive-tree response (`truncated: false`), but this was not a line-by-line review of all 4,904 entries.
- Repository documentation is first-party. Claims about real databases, human gates, or end-to-end correctness were not independently reproduced.
- The no-production-call-site observation is revision-specific and limited to textual TypeScript references to `verifyGateIntegrity`; equivalent enforcement may exist under other functions, generated assets, shell code, or later revisions.

## Relationships

- [CEE — Deterministic State Machines Reclaim Agent Workflow Control](./2026-08-04-github-cee-deterministic-agent-workflows.md)
- [Orcrist — LLM-Authored State Machines Need an Evidence-Authoring Boundary](./2026-09-12-llm-authored-state-machine-evidence-boundary.md)
- [Attempt History Needs Semantic Labels Before It Can Teach](./2026-09-23-agent-learning-needs-semantic-attempt-accounting.md)

## Sources

- **Repo:** https://github.com/databricks-solutions/consort
- **Pinned revision:** https://github.com/databricks-solutions/consort/commit/269fadf2258899dd6f2e6f21132e5cae88b6b9c6
- **README:** https://github.com/databricks-solutions/consort/blob/269fadf2258899dd6f2e6f21132e5cae88b6b9c6/README.md
- **SCM state design:** https://github.com/databricks-solutions/consort/blob/269fadf2258899dd6f2e6f21132e5cae88b6b9c6/docs/design/scm-workflow-state.md
- **Phase ownership:** https://github.com/databricks-solutions/consort/blob/269fadf2258899dd6f2e6f21132e5cae88b6b9c6/consort/gates/workflow-phase.ts
- **Phase read path:** https://github.com/databricks-solutions/consort/blob/269fadf2258899dd6f2e6f21132e5cae88b6b9c6/consort/orchestrator/state/orchestrator-probe.ts
- **Gate verification:** https://github.com/databricks-solutions/consort/blob/269fadf2258899dd6f2e6f21132e5cae88b6b9c6/consort/gates/verify-gate-integrity.ts
- **Hash normalization:** https://github.com/databricks-solutions/consort/blob/269fadf2258899dd6f2e6f21132e5cae88b6b9c6/consort/gates/gate-hash.ts
- **Gate migration:** https://github.com/databricks-solutions/consort/blob/269fadf2258899dd6f2e6f21132e5cae88b6b9c6/consort/gates/migrate-gates.ts
- **Phase tests:** https://github.com/databricks-solutions/consort/blob/269fadf2258899dd6f2e6f21132e5cae88b6b9c6/tests/bdd/orchestrator-probe.test.ts
- **Integrity tests:** https://github.com/databricks-solutions/consort/blob/269fadf2258899dd6f2e6f21132e5cae88b6b9c6/tests/bdd/consort-verify-gate-integrity.test.ts
