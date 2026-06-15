# Focus Plan: Combined Runs, Source Completion, Hygiene

Date: 2026-06-14
Horizon: next 12-24 hours
Project: aks-rp-e2e.app

## Purpose

Move the project from "many individual specs exist" to "the spec system is
trustworthy and efficient":

1. Plan and run combined-scenario tests so compatible scenarios share one CRUD
   lifecycle, saving AKS capacity and exposing dependency bugs.
2. Re-inventory Go e2ev3 source so we know which scenarios and variants are
   truly covered.
3. Tidy feature/spec/model structure so the knowledge base remains readable and
   canonical as new source discoveries land.

## Current State

- Active:
  - `combined-generator-real-assertions-20260614`
  - `combined-planner-contract-aware-grouping-20260614`
  - `combined-suite-runner-shared-lifecycle-20260614`
  - `go-e2e-source-inventory-manifest-20260614`
  - `managedsystem-combined-suite-live-verification-20260614`
- Completed since this focus started:
  - `combined-scenario-capability-audit-20260614`
- Review:
  - `feature-spec-duplicate-inventory-20260614`
- Runnable backlog: none at this instant.
- Dependency-gated backlog:
  - Go source variant discovery
  - coverage reconciliation and extraction planning
  - combined rollout candidates and execution waves
  - hygiene canonicalization

## Workstream 1: Combined-Scenario Execution

Near-term sequence:

1. Use the accepted `combined-scenario-capability-audit-20260614` as the
   starting diagnosis.
2. Run the three P0 hardening tasks in parallel where possible:
   - `combined-planner-contract-aware-grouping-20260614`
   - `combined-generator-real-assertions-20260614`
   - `combined-suite-runner-shared-lifecycle-20260614`
3. Use ManagedSystem as the golden combined path:
   - `managedsystem-combined-suite-live-verification-20260614`
4. Plan repeated execution waves:
   - `combined-scenario-rollout-candidates-20260614`
   - `combined-wave-plan-1-20260614`
   - `combined-scenario-execution-waves-20260614`
5. Feed dependency findings and per-spec verdicts back into specs/suites/model:
   - `combined-wave-feedback-loop-20260614`

Success criteria:

- At least one combined suite is live-verified against staging with per-spec
  verdicts and cleanup.
- The planner does not collapse specs with empty metadata into one cluster.
- Generated combined scripts do not hardcode assertion success.
- Execution waves record CRUD savings, dependency bugs, and diagnostic
  contamination separately from product failures.

## Workstream 2: Go E2E Source And Variant Completion

Near-term sequence:

1. Complete `go-e2e-source-inventory-manifest-20260614`.
2. Run `go-e2e-variant-dimension-discovery-20260614`.
3. Run `go-e2e-coverage-reconciliation-20260614`.
4. Plan and create extraction batches from both source coverage and variant
   classification:
   - `go-e2e-gap-extraction-plan-from-source-and-variants-20260614`
   - `go-e2e-gap-extraction-batches-20260614`

Success criteria:

- Every Go e2ev3 scenario is mapped to an existing feature/spec, new extraction
  task, duplicate/canonical mapping, or explicit out-of-scope reason.
- Variant dimensions are not flattened away. Each condition change is classified
  as product input path, expectation path, execution variant, environment
  variant, or setup-only detail.
- Newly discovered real behavior variants create or update feature packets,
  specs, model paths, and replay/combined-suite follow-up tasks.

## Workstream 3: Feature/Spec/Model Hygiene

Near-term sequence:

1. Complete `feature-spec-duplicate-inventory-20260614`.
2. Apply safe canonicalization through
   `feature-spec-canonicalization-pass-20260614`.
3. Create review tasks for risky semantic merges instead of applying them
   silently.

Success criteria:

- Duplicate or overlapping features/specs have a canonical ID and action.
- Specs have source refs, feature path IDs, run plan/probe refs, state metadata,
  and evidence links where applicable.
- Live evidence is relinked, not deleted.
- `bun run check` passes in the domain project after cleanup.

## Parallelism

- Source inventory and hygiene inventory can run now; both are non-mutating
  analysis tasks.
- Combined hardening can start after the capability audit review is accepted.
- Live staging combined runs should wait until the runner path is honest enough
  to preserve per-spec verdicts, except for the existing ManagedSystem
  hand-authored probe if the review confirms it remains reliable.
- Azure-mutating tasks must use conflict scopes so multiple workers do not fight
  for the same resource group, feature family, or staging capacity.

## Review Cadence

Review every 4-6 hours or after any of these happen:

- combined hardening completes,
- a live combined run finishes,
- source inventory discovers a major unmapped feature family,
- hygiene finds duplicates that would invalidate existing model evidence,
- any lane blocks on devbox/source access, runner correctness, or Azure
  capacity/auth.

## Owner Next

1. Pick up `managedsystem-combined-suite-live-verification-20260614` and the
   three combined-runner hardening tasks.
2. Keep `go-e2e-source-inventory-manifest-20260614` and
   `feature-spec-duplicate-inventory-20260614` moving.
3. Do not claim project completion until combined execution waves, source
   variants, and hygiene canonicalization have produced durable evidence.
