# Proposal: Gym Evaluation Modernization on `@may-agent/sdk/standalone`

**Supports:** [Agent Cooperation](../2a-design/agents.md), [Workflow Discovery and Execution](../2a-design/workflows.md), and [Unify Agent and Workflow Invocation End-to-End](unified-agent-instance-runtime.md).

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource) (*"One authority for each resource"*, *"Simple first"*, *"Composition preserves execution rules"*).

**Design status:** Implemented & verified (2026-11-16).

---

## 1. Decision Summary

**Align `@may-agent/gym` with the unified `@may-agent/sdk/standalone` and `@may-agent/sdk/testing` surfaces so every capability follows the Knowledge Maturity Progression (Prompt → Skill → Code Workflow) across one three-layer evaluation pyramid (Deterministic Contract Test → Scenario Validation → Lab A/B Comparison) with first-class App-agent `.lab/<candidate>` overlays, unified production `TaskReconcileResult` (`task-result.json` via `finish()`) benchmark contracts, leak-free single-file `cases.json` judgment benchmarks, `WorkflowRunReport` (`workflow-run.json`) scoring helpers, and multi-dimensional usage telemetry (`turns`, `ops`, `total_tokens`, `cost_usd`).**

> **Tradeoff Decision Note:**  
> Choose **one pure `@may-agent/sdk/standalone` adapter boundary with first-class App-agent `.lab/<candidate>` overlays, the production `TaskReconcileResult` (`task-result.json` via `finish()`) contract across all decision benchmarks, `WorkflowRunReport` (`workflow-run.json`) scoring helpers, and per-trial usage telemetry (`turns`, `ops`, `total_tokens`, `cost_usd`)** rather than **maintaining deep relative imports into Host `src/app/loader/*` / `src/lib/*`, synthetic `alignment-decision.json` / `system-state.md` benchmark files, requiring manual `GYM_AGENTS_ROOT` copies for App-local agents (`may`, `alex`, `bob`, `scout`, `tech-lead`), or judging runs only by pass/fail and wall-clock `duration_ms`** because the unified invocation kernel already produces structured step/output/cleanup reports and token/turn transcripts out of the box.

---

## 2. The Knowledge Maturity Progression: Prompt → Skill → Code Workflow

Moving from **Prompt (`AGENTS.md`)** to **Skill (`SKILL.md`)** to **Code Workflow (`workflows/*.ts`)** is a process of **deepening our understanding of the task**, and we improve the system in that exact order:

```text
  Stage 1: Prompt (AGENTS.md) ───► Stage 2: Skill (SKILL.md) ───► Stage 3: Code Workflow (workflows/*.ts)
  "Limited task knowledge"         "We know how to do it"         "We know how to effectively do it"
  • Explore & establish core       • Codify domain SOP &          • Executable Prompt + Skill:
    boundaries/judgment              decision map loaded            pre-reads evidence in code,
  • Tune fast in .lab/<candidate>    on demand                      calls agent with `tools: "readonly"`
                                   • Avoids bloating every          and `schema`, and enforces post-step
                                     unrelated turn                 invariants deterministically
```

| Stage | Artifact | When We Use It | Live Gym Proof (`may-align-infer-safe-cleanup`) |
| :--- | :--- | :--- | :--- |
| **Stage 1: Prompt (`AGENTS.md`)** | Always-loaded identity & core invariants | When we have limited task knowledge or need a universal boundary rule across all turns. | **Baseline (`may` Prompt + Skill):** `5 turns`, `6 tool ops`, **`57,800+ tokens`**, `~14,000 ms` (loads skill via `read`, inspects workspace, sometimes forgets `async: true` on delegation). |
| **Stage 2: Skill (`SKILL.md` / compact reference)** | On-demand domain SOP (`skills/<name>/SKILL.md`) | When we know *how* to do a recurring domain task and want to avoid loading 625-line manuals on unrelated turns. | **Use Case 1 (`may-compact-reconcile-v1` on `may-app-outcome-management`):** `5/5 pass`, **`-33.33%` tool ops (`15 → 10`)**, **`-26.90%` tokens (`149,053 → 108,961`)**, **`-11.60%` duration** with 0 regressions. |
| **Stage 3: Code Workflow (`workflows/*.ts`)** | Executable Prompt + Skill (`may/bounded-cleanup.ts`) | When we know *how to effectively do it*: deterministic pre-reads, `readonly` schema-bound `ctx.call`, and invariant normalization in TypeScript. | **Use Case 2 (`may/bounded-cleanup`):** **`18/18 checks passed`**, **`1 turn`**, **`1 tool op`**, **`9,233 tokens (-84% tokens)`**, **`4,151 ms (-70% duration)`**, 100% deterministic `async: true` & non-empty diff enforcement returning a production `TaskReconcileResult`. |

---

## 3. Architectural Boundary: `@may-agent/sdk` vs. `projects/gym`

| Dimension | `@may-agent/sdk` (`packages/sdk`) | `projects/gym` (`@may-agent/gym`) |
| :--- | :--- | :--- |
| **Authority** | **Execution Engine & Contract Authority** | **Scientific Referee, Corpus & A/B Comparison Harness** |
| **Sub-surfaces** | • `@may-agent/sdk`: Authoring contracts (`defineWorkflow`, `ctx.call`, `admitTaskExecutionResult`, `TaskReconcileResult` schemas)<br>• `@may-agent/sdk/testing`: Deterministic `<50ms` unit runner (`runTargetTest`, `runWorkflowTest`) with scripted `mocks`<br>• `@may-agent/sdk/standalone`: Real-model Host-free runner (`run`, `list`, `runDirectAgent`) | • `scenarios/*` & `benchmarks/*`: Fixtures, `task.md`, `expected.json`, `labels.json`, `semantic_criteria.md`<br>• `@may-agent/gym/scoring`: `Score` DSL (`transcript.jsonl` + `workflow-run.json` + `usage` telemetry assertions)<br>• `src/loop/*` (`gym:loop`): Frozen baseline snapshot, `.lab/<candidate>` overlay, semantic judge calibration, `comparison.json` & `report.md` |
| **Boundary Rule** | If a capability is needed to **load, typecheck, execute, or trace** a target (`<agent>` or `<owner>/<workflow>`), it belongs in `@may-agent/sdk`. | If a capability is needed to **grade, compare, or freeze** an experiment across trials (`quality`, `duration_ms`, `total_tokens`, `ops`), it belongs in `projects/gym`. |

---

## 4. Concrete Improvements Implemented

### 4.1 Pure `@may-agent/sdk/standalone` Boundary & Retirement of Dead Metadata
- **Eliminate deep Host relative imports:** `projects/gym/src/workflow-adapter.ts` imports exclusively from `@may-agent/sdk/standalone` and `./loop/store` (no relative imports into `../../may-agent/src/app/loader/*` or `../../may-agent/src/lib/*`).
- **Retire `allow_workflow`:** Remove the unused `allow_workflow` / `allowWorkflow` fields from `ScenarioMeta` (`src/scenarios/types.ts`), `validateMetadata` (`src/scenarios/validate.ts`), and `AdapterOpts` (`src/cli.ts`).
- **Support `GYM_FRAMEWORK_SHA` pinning:** Allow `GYM_FRAMEWORK_SHA` to pin the observed framework revision across `test` and `verify` runs when concurrent development commits land in `projects/may-agent`.

### 4.2 First-Class `.lab/<candidate>` Overlays for App-Owned Agents & Workflows
- **Solution (`prepareGymAgentSandbox` & `runGymWorkflowEntry` in `src/workflow-adapter.ts`):**
  1. Removed the stale `/app/agents/may/last-session.md` leftover directory so `/app/agents` has no ghost agent directory shadowing `projects/may.app/agents/may`.
  2. Resolve the base agent directory across `agentsRoot` (`/app/agents`) and `projectsRoot` (`/app/projects/*.app/agents/*`), checking `existsSync(join(dir, "agent.json"))`.
  3. Overlay `.lab/<candidate>` via `applyGymLabOverlay()`, pre-removing any subdirectories (`skills/`, `workflows/`) that the candidate replaces so deleted skills/workflows do not leak through from the base agent.
  4. In `runGymWorkflowEntry()`, resolve unmodified workflow `.ts` modules directly from the canonical App workflow directory (`projects/<app>.app/agents/<owner>/workflows`) while keeping `agentsRoot` pointed at the `.lab` overlay for prompt and skill resolution—eliminating any need to symlink `node_modules` or copy App-root helper files into `/tmp`.

### 4.3 First-Class `WorkflowRunReport` (`workflow-run.json`) & Efficiency Objectives (`total_tokens`, `ops`)
- **Workflow step/output/cleanup helpers on `Score` (`src/scoring/gym-score-utils.ts`):**
  - `s.hasWorkflowRun()`, `s.workflowStatus()`, `s.workflowSteps(target?)`, `s.hasWorkflowStep(target, status?)`, `s.workflowOutput<T>()`, `s.workflowSummary()`, and `s.workflowCleanupConfirmed()`.
- **Transcript usage telemetry & objectives across `Score`, `RunResult`, `StoredTrial`, `ComparisonObjective`, `RunComparison`, and `report.md` (`src/scoring/transcript-utils.ts`, `src/cli.ts`, `src/loop/{objective,types,store,report}.ts`):**
  - Every scenario run and loop trial records `usage: { turns, ops, total_tokens, input_tokens, output_tokens, cost_usd }`.
  - `ComparisonObjective` now supports `{ metric: "total_tokens", min_reduction_percent }` and `{ metric: "ops", min_reduction_percent }` in addition to `quality` and `duration_ms`.
- **Stage 3 Executable Skill Exemplar (`projects/may.app/agents/may/workflows/bounded-cleanup.ts`):**
  - Graduated `may`'s `bounded-cleanup` skill into a verified App workflow (`may/bounded-cleanup.ts` + `bounded-cleanup.test.ts`), reducing cleanup decision execution on `may-align-infer-safe-cleanup` (`bun run gym run may-align-infer-safe-cleanup --target may/bounded-cleanup`) from `5 turns / 6 ops / ~58k tokens / 14s` to **`1 turn / 1 op / 9,088 tokens / 6.2s`** (`12/12 gating checks + both semantic judges passed`).
- **Unified Verb-First Gym CLI (`projects/gym/src/cli.ts` & `projects/gym/src/loop/cli.ts`):**
  - Aligned `gym` with `may`'s verb-first CLI grammar (`gym list`, `gym show <scenario>`, `gym run <scenario> [--target <agent|owner/workflow|codex|claude>] [--lab <candidate>] [--timeout 3m] [--json]`, `gym test`, `gym verify`, `gym report <run>`, `gym rescore <run>`, `gym validate`), printing a human-readable summary card (`Tests`, `Task`, `Expected`, `Observed`, `Telemetry`, `Gating Checks`) by default and supporting `--target codex` / `--target claude` via `@may-agent/sdk/standalone`'s `run(target, task)` as external reference standards.
- **App-Owner Workflow Ownership & Meta-Improvement Capability (`projects/alex.app/agents/alex/`):**
  - Workflows belong to the App owner (`alex`, `may`, `scout`) under `projects/<app>.app/agents/<app-owner>/workflows/*.ts` and assign specialist agents per step via `ctx.call("<specialist>", ...)`.
  - Evolving `may/bounded-cleanup` (`v1 -> v2`) across 4 `may-alignment` scenarios (`may-align-infer-safe-cleanup`, `may-align-remove-specified-cleanup`, `may-align-block-cleanup-on-diff`, `may-align-closure-before-cleanup`) lifted pass rate from `3/4` to **`4/4` (`Gate: pass`, `-31.67%` duration, `23.08s -> 15.77s`)** by stripping conflicting `Write <file>.json` instructions before `tools: "readonly"` child calls and classifying deterministic cleanup regimes in code (`classifyCleanupRegime()`).
  - Codified these empirical lessons into `alex`'s Stage 2 skill (`projects/alex.app/agents/alex/skills/gym-capability-improvement/SKILL.md`) and Stage 3 workflow (`projects/alex.app/agents/alex/workflows/diagnose-improvement.ts` + `.test.ts`, where `alex` pre-reads a frozen Gym baseline in code and calls the `gym` specialist via `ctx.call("gym", ...)`).

### 4.4 Unified Production `TaskReconcileResult` Contract & Leak-Free Judgment Benchmarks
- **Retired `alignment-decision.json` and `system-state.md`:**
  - All 125 `may-*` scenarios and all single-file benchmarks in `projects/gym/benchmarks/*` now use `"output_contract": "task-agent-result"` and `"artifact": "task-result.json"` (returned via the agent's production `finish()` tool and validated by `@may-agent/sdk`'s `admitTaskReconcileResult`).
  - Removed all synthetic `environment/system-state.md` files (inlining situational facts directly into `task.md`) and stripped prescriptive rule leaks (`"May should / May must"`), enforced by `<scenario>:output-contract` and `<scenario>:no-answer-leak` checks in `benchmarks/may-alignment/review-suite.cjs` (`1488/1488` review checks passing).
- **5 Single-File Role-Specific Judgment Benchmarks (`suite.json` + `cases.json`):**
  - Created `benchmarks/may-judgment/`, `benchmarks/alex-judgment/`, `benchmarks/bob-judgment/`, `benchmarks/tech-lead-judgment/`, and `benchmarks/scout-judgment/` using real production prompts and workspace files (`files: { ... }`).
  - Verified and promoted Stage 1 prompt improvements across `bob` (`0/3 -> 3/3`, **`-69.32%` duration**, **`-76.20%` tokens**), `alex` (`2/3 -> 3/3`, **`-16.83%` duration**, **`-26.69%` tokens**), `tech-lead` (`2/3 -> 3/3`, **`-16.31%` duration**), `scout` (`3/3` pass), and `may` (`may/bounded-cleanup` unified onto `TaskReconcileResult`).

### 4.5 Daily Self-Improving Agent Loop (`alex/learn-from-daily-work`)
- **Multi-Root Harvester & Benchmark Synthesizer (`projects/alex.app/agents/alex/workflows/learn-from-daily-work.ts`):**
  - Discovers and deduplicates user corrections (`failure_correction`), efficiency bottlenecks (`efficiency_gap`), and repeated success patterns (`success_pattern`) across both container (`<projectRoot>/.state`, `/app/.state`) and localhost (`$HOME`, `os.homedir()`, `os.userInfo().homedir`, `/home/*`, `DAILY_LEARNING_ROOTS`) roots from Gemini (`logs.json`), Pi (`*.jsonl`), Codex (`thread_history_1.sqlite`, `history.jsonl`), and May (`may.db`) sessions.
  - Calls `bob` (`ctx.call("bob", ..., { schema: dailyLearningSynthesisSchema })`) to extract role-specific judgment lessons (`may`, `alex`, `bob`, `tech-lead`, `scout`), validates that every drafted benchmark case passes `validateDraftBenchmarkCase` (zero `system-state.md` and zero `<Agent> should/must` answer leaks), optionally stages accepted drafts into `projects/gym/benchmarks/<role>-judgment/cases.json` (`stageDraftCases: true`), and returns a production `TaskReconcileResult` (`state: "converged"`).
  - Wired into `projects/alex.app/app.ts` as input `kind: "daily-work-learning"` → Task `learning/daily-work` (`workflow: "learn-from-daily-work"`) with a 24-hour standing schedule (`id: "daily-work-learning"`).

