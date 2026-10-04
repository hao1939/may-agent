# Candidate comparison within Alex

**Supports:** [Evidence-backed improvement](../2a-design/practice-learning-loop.md).
Compare a concrete candidate against a pinned baseline when that evidence helps
decide whether a change is worthwhile. **Choice basis:**
[Simple first](../1-principles/core-principles.md#simple-first).
Reuse the standalone Gym runner through one focused App-local workflow.

Alex can select the `gym` specialist and `compare-candidate` workflow, or
admit its structured comparison input. The workflow verifies frozen source,
benchmark, scorer, model, objective and allowance identities before execution.
It returns a bounded receipt with invalid or inconclusive trials disclosed.
A comparison does not approve or apply the candidate.

The [frozen comparison contract](frozen-comparison-service.md) and
[evidence reliability guide](evidence-reliability.md) explain the method.
Their earlier trial records retain the old Gym App names as provenance. The
current implementation is under `alex.app/agents/gym/workflows/`; the standalone
`projects/gym/` package remains available independently.

Run the workflow regression with `bun run gym:app:check`. Retained comparison
evidence and historical experiments remain reachable through
[retirement and preservation](../../archive/retired-apps/README.md).
