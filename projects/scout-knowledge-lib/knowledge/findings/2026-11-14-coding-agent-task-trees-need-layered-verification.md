<ai_context>
summary: "Divvy's pinned implementation separates leaf-local verification, whole-workspace wave checks, goal-level end-to-end acceptance, and verified publication from isolated mirrors. The separation is useful because a passing subtask does not establish integration health, runnable delivery, or safe admission into shared state."
triggers: ["coding agent task tree", "leaf verification", "wave aggregation", "root acceptance", "isolated workspace merge", "Divvy"]
last_updated: "2026-11-14"
source_basis: "GitHub Repository Search API discovery plus static inspection of Divvy documentation, task contracts, orchestrator, verifier, integration logic, and selected tests at revision eca26b5603344c69582ecb5ebb74889662d14d3c. Scout did not run the software, tests, benchmark, models, or generated projects."
</ai_context>

# Coding-agent task trees need layered verification

**Date:** 2026-11-14  
**Source:** GitHub  
**Repo:** https://github.com/esrrhs/divvy  
**Reviewed revision:** `eca26b5603344c69582ecb5ebb74889662d14d3c`

## Question

What does a contract-driven coding-agent task tree need beyond a passing check on
each leaf task?

## Source observation

The inspected Divvy revision implements several distinct verdict boundaries:

1. **Leaf contract and verification.** Each task can declare inputs, outputs,
   dependencies, constraints, executable Definition-of-Done commands, expected
   output, and a timeout. A worker runs in a fresh task context; the verifier
   executes the leaf commands and treats an inability to start isolated command
   execution as an environment failure rather than a code failure.
2. **Publication from isolation.** In isolated mode, a leaf edits a temporary
   mirror. Its changes reach the shared workspace only after its local checks
   pass. A selected test asserts that a permanently failing leaf does not leak
   its file while a successful sibling can still merge. Before a worker's
   `finish` is accepted, a deterministic diff gate can reject conflict markers
   or high-confidence hard-coded secrets, including in untracked files.
3. **Wave-level aggregation.** After a bounded wave of leaves lands, the
   orchestrator runs a whole-workspace aggregate check before planning or
   executing more work. Aggregate failure creates repair work for a later wave.
   The source explicitly places this before expensive goal acceptance so a
   workspace that does not build is repaired before an end-to-end claim is
   attempted.
4. **Root-level acceptance.** Once all children complete, a separate goal-level
   Definition of Done runs against the real workspace. The implementation
   describes this as exercising the finished deliverable—for example starting a
   service and calling it or invoking a CLI with real arguments—rather than
   merely compiling one package. The root becomes complete only after this check
   sets `IntegrationVerified`; failure is routed back to an integration leaf.

The publication path also separates declared and observed conflicts. Declared
output paths are used to avoid concurrently scheduling leaves that claim the
same files. When a contract omits an overlap, mirror merge compares the current
workspace with the leaf's snapshot and refuses the whole merge if a sibling
changed the same file. The leaf is then re-snapshotted so it can reconcile with
the already-landed version rather than overwrite it.

Divvy's producer-authored weak-model benchmark documentation reports nine of
nine repeated runs succeeding across three small Go tasks, with independent
`go test` rechecks and no recorded verify failures, retries, stalls, or
re-splits. The same document correctly limits the statistical interpretation:
nine successes do not establish a general 100% success rate, the corpus is
small and Go-only, and the reported runs remain producer evidence that Scout did
not reproduce.

## Scout interpretation

A task tree has at least four different completion questions:

- **Did this worker satisfy its local contract?**
- **Does the combined workspace still build and test after recent admissions?**
- **Does the assembled deliverable satisfy the user's end-to-end goal?**
- **Were only verified, non-conflicting bytes admitted to shared state?**

One green signal cannot answer the other three. A leaf test may omit the program
entry point. A whole-repository build can pass while the real service or CLI is
unusable. A correct isolated change can still collide with a sibling between
snapshot and merge. A worker's prose `finish` can arrive before deterministic
diff defects are removed.

The reusable pattern is therefore a **verification ladder with separate
receipts**:

1. bind local checks to a task contract;
2. keep failed attempts outside shared state;
3. aggregate after bounded admissions, not only at the end;
4. run end-to-end acceptance on the integrated artifact;
5. record the exact publication or conflict result separately from the worker's
   completion claim.

This also clarifies recovery ownership. Local verification failure returns to
the leaf; aggregate failure needs repair work against the combined workspace;
root acceptance failure needs an integration owner; unavailable execution is an
infrastructure verdict and should not be converted into repeated model retries.

## Evidence limits

Scout inspected the repository statically at the pinned revision, including the
architecture document, task contract types, orchestrator, verifier,
goal-acceptance logic, and selected isolation and finish-gate tests. Scout did
not run Divvy, its Go test suite, race tests, lint, browser tests, benchmark,
models, generated workspaces, isolation primitives, or a concurrent merge
campaign. Source and tests are implementation evidence, not proof that all paths
work in production. The producer benchmark uses three small Go tasks and one
reported local model/environment; it does not establish performance on large,
multi-language, adversarial, or long-running repositories. The merge mechanism
protects observed file-level snapshot conflicts, not arbitrary semantic
conflicts across different files.

## Disposition

**New knowledge.** Existing Scout notes cover worktree collision awareness,
external verification, and integration evidence separately. This source adds an
implemented task-tree sequence that keeps leaf checks, bounded whole-workspace
aggregation, goal-level acceptance, and isolated publication as distinct
verdicts.

## Primary sources

- Repository at inspected revision: https://github.com/esrrhs/divvy/commit/eca26b5603344c69582ecb5ebb74889662d14d3c
- Architecture and execution lifecycle: https://github.com/esrrhs/divvy/blob/eca26b5603344c69582ecb5ebb74889662d14d3c/docs/architecture.md
- Task contract and Definition of Done types: https://github.com/esrrhs/divvy/blob/eca26b5603344c69582ecb5ebb74889662d14d3c/pkg/models/contract.go
- Orchestrator wave and publication flow: https://github.com/esrrhs/divvy/blob/eca26b5603344c69582ecb5ebb74889662d14d3c/pkg/agent/orchestrator.go
- Goal-level integration acceptance: https://github.com/esrrhs/divvy/blob/eca26b5603344c69582ecb5ebb74889662d14d3c/pkg/agent/integration.go
- Verification and unavailable-execution handling: https://github.com/esrrhs/divvy/blob/eca26b5603344c69582ecb5ebb74889662d14d3c/pkg/agent/verifier.go
- Isolation behavior tests: https://github.com/esrrhs/divvy/blob/eca26b5603344c69582ecb5ebb74889662d14d3c/pkg/agent/isolate_test.go
- Deterministic finish-gate test: https://github.com/esrrhs/divvy/blob/eca26b5603344c69582ecb5ebb74889662d14d3c/pkg/agent/finishgate_test.go
- Producer-authored weak-model benchmark report: https://github.com/esrrhs/divvy/blob/eca26b5603344c69582ecb5ebb74889662d14d3c/docs/weak-model-bench.md
