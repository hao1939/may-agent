# Proposal: Unify Agent and Workflow Invocation End-to-End

**Supports:** [Agent Cooperation](../2a-design/agents.md), [Workflow Discovery and Execution](../2a-design/workflows.md), and [Simplify the System: Fewer Paths, Clear Owners](authority-boundary-simplification.md).

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource) (*"One authority for each resource"*, *"Simple first"*, *"Composition preserves execution rules"*).

**Design status:** Completed & shipped (2026-11-14, Host PRs #512–#515, #517, #518, #520) — Sections 1–5 are the single normative specification (incorporating all review feedback from Sections 6–11). Sections 6–11 are retained in the Appendix as historical, non-normative review notes.

---

## 1. Decision Summary

**Unify bounded Agent and Workflow invocation behind one call contract (`ctx.call`), one stateless owner-scoped resolver, and one shared invocation kernel—across Standalone/Direct, Gym, nested code/LLM delegation, and Hosted `TaskAttempt` dispatch (`TaskRunner`)—while pruning dead runtime surfaces first.**

Whether an executable is authored as a **Prompt** (`agents/<name>/agent.json` + `AGENTS.md`) or **Code** (`agents/<owner>/workflows/<name>.ts`), callers invoke `ctx.call(name, input, options)` and receive `ExecutionResult<T>`.

Three identities remain separate:
- **Agent Role (`alex`):** Durable owner and authority on Tasks, workspaces, and permissions (never altered by nested procedure selection).
- **Prepared Definition (`alex` or `tech-lead/verified-coder`):** Immutable, content-hashed definition in a `PreparedCatalog` release snapshot (`reload` prepares a new snapshot; running invocations never reread mutable instructions, skills, or configs from disk and inspection + execution use the same pinned snapshot).
- **Invocation Scope:** Per-call runtime scope owning `AbortSignal`, deadline clamping, child join, PGID cleanup confirmation, and bounded traces.

> **Tradeoff Decision Note:**  
> Choose **one public `ctx.call` / `TaskRunner` contract backed by small internal prompt and code adapters over immutable owner-scoped `PreparedCatalog` snapshots—preceded by retiring unused `WorkflowGuard` and speculative schema features** rather than **maintaining parallel Agent and Workflow runners, tools, and Hosted Task adapters** because callers and Task core care about typed contracts, bounded lifetimes, and verified cleanup, not whether internal steps use a model loop or TypeScript. Keep durable Task settlement (`TaskAttempt`), persistent Conversation turns, and external registered executors (`opts.executors`) under their existing owners.

---

## 2. Why Unify (and What to Prune First)

| Layer | Current "Agent" Path | Current "Workflow" Path | Essential Convergence |
| :--- | :--- | :--- | :--- |
| **Discovery & Snapshot** | `agent-discovery.ts` + `SubagentManager` | `workflow-catalog.ts` | 1 immutable `PreparedCatalog` snapshot |
| **Standalone & Gym** | `direct-agent.ts` + `gym/src/cli.ts` | `direct-workflow.ts` + `gym/src/workflow-adapter.ts` | 1 kernel runner; delete `unconfirmedToolWorkflows` & Gym stitcher |
| **Nested Code Calls** | `ctx.agents.call(agent, task, opts)` (`9` live files) | `ctx.workflows.run(name, input)` (`0` live files) | `ctx.call(name, input, opts)` |
| **Model Delegation** | `agents` tool (`manager-agents-tool.ts`) | `workflow` tool (`1` live skill call) | `agents` (`action: "call"`); retire `createWorkflowTool` |
| **Hosted Task Dispatch** | `TaskAgentRunner` (`runTaskAgent`) | `TaskWorkflowRunner` (`runTaskWorkflow`) | 1 `TaskRunner` (`inspect`, `execute`, `snapshot`) |
| **Legacy Guards** | — | `WorkflowGuard` / `Demand` (`0` live files) | **Retire before unifying** |

---

## 3. Proposed Architecture

### 3.1 Two Execution Environments, One Shared Invocation Kernel

Both top-level execution environments (**Standalone environment** vs. **Host environment**) use the **same bounded invocation implementation**. Environment adapters bind capabilities and persistence; they do not independently implement validation, deadlines, child lifetime, or cleanup:

```text
Standalone composition ─┐
                        ├─► Shared Invocation Kernel ──► Prompt / Code Adapter
Host composition ───────┘
```

```text
  [ Top Layer: Execution Environments ]
    ├── Standalone Environment (CLI / Gym / SDK Test — local models, workspaces, fixtures, artifacts)
    └── Host Environment       (Daemon — owns SQLite, Tasks, Attempts, Inbox, EventBus, Worktrees)
                                │
                                │  both resolve from an immutable PreparedCatalog
                                ▼
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
 agents/<name>/agent.json                  agents/<owner>/workflows/<wf>.ts
 + AGENTS.md + skills                      (WorkflowExecutableModule)
        │                                               │
 PromptDefinition                              CodeDefinition
        └───────────────────────┬───────────────────────┘
                                ▼
            resolveCallable(callerOwner, name, snapshot)
                                │
                                ▼
           [ Core Layer: Shared Invocation Kernel ]
     (`ctx.call(name, input, options)` — schema, deadline, child join, PGID drain)
```

### 3.2 Canonical Contracts (`@may-agent/sdk`)

Reuse `@may-agent/sdk`'s [`ExecutionResult`](../../../may-agent/packages/sdk/src/workflow.ts) and [`WorkflowContext`](../../../may-agent/packages/sdk/src/workflow.ts) without inventing a separate `AgentResult` or second context interface:

- **Authored return (`Prompt` or `Code` body):** `ExecutionResult<TOutput>` (or `TaskReconcileResult` when an owned root procedure proposes Task settlement).
- **Caller return (`ctx.call`):** `ExecutionResult<TOutput>`, continuing to populate `result.kind` (`"agent"` for prompt targets, `"workflow"` for code targets) so existing receipts, telemetry, and `ExecutionDeferredError.callerExecution` stay 100% compatible. Pre-start denials throw `ExecutionDeferredError` (`started = false`, no fabricated ID, no consumed fixture).
- **Runner report (`<traceDir>/run.json`):** `WorkflowRunReport` (`executionId`, `durationMs`, bounded `steps`, bounded `logs`, `cleanup`, and `sessionId`/`transcriptPath`). For structured non-string `input`, `WorkflowStepTrace.prompt` records `JSON.stringify(input)` bounded to `MAX_PROMPT_CHARS` (`2_000`) without adding new trace fields.

```ts
export type CallOptions<S extends TSchema | undefined = undefined> = {
  /** Optional caller-side structured output contract (checked in addition to target outputSchema). */
  schema?: S;
  /** Clamped to the enclosing invocation's remaining deadlineAt. */
  timeoutMs?: number;
  /** Tool restriction inherited by descendants. Caller restrictions cannot be widened by callees. */
  tools?: "full" | "readonly";
  /** Prompt-target skill selection; rejected if passed directly to a code target. */
  skill?: string;
  /** Prompt-target finite positive tool-operation allowance; rejected on code targets. */
  operationAllowance?: number;
  /** Exact source classification persisted on prompt sessions. */
  source?: string;
};

export interface WorkflowContext<TInput = unknown> {
  input: WorkflowInput<TInput>;
  signal: AbortSignal;
  /** Present only when a durable App Task owns this attempt. */
  reconciliation?: TaskReconciliationContext<TInput>;
  reviseTask?: TaskAttempt["reviseTask"];
  closeTask?: TaskAttempt["closeTask"];
  applyTaskChanges?: TaskAttempt["apply"];
  readCommunication?: TaskAttempt["read"]["communication"];
  read: AppRead;
  events: {
    emit(event: AppEvent): Promise<void>;
    read(type: string, localKey: string): Promise<{ eventId: number; data: Record<string, unknown> } | null>;
    onEvent(listener: (event: AppEvent<Record<string, unknown>>) => void): () => void;
  };
  metrics: WorkflowMetricCapability;
  workspace?: {
    appRoot: string;
    projectRoot: string;
    root: string;
    output: string;
    taskFile?: string;
  };
  log: Logger;

  /**
   * Canonical bounded invocation API for both prompt-backed and code-backed definitions.
   * Production calls pass string names resolved against the captured catalog snapshot.
   */
  call<S extends TSchema>(
    name: string,
    input: unknown,
    options: CallOptions<S> & { schema: S },
  ): Promise<ExecutionResult<Static<S>>>;
  call<TOut = unknown>(
    name: string,
    input: unknown,
    options?: CallOptions,
  ): Promise<ExecutionResult<TOut>>;

  /** Preserved terminal helpers (existing positional signatures and partial-work semantics unchanged): */
  done<T>(summary: string, output?: T): ExecutionResult<T>;
  blocked(reason: string, facts?: unknown): ExecutionResult;
}

/** Alias for callers adopting unified naming without duplicating context shapes. */
export type AgentContext<TInput = unknown> = WorkflowContext<TInput>;
```

Code modules (`WorkflowExecutableModule`) retain optional `readonly?: boolean`, `workspace`, `verify`, `inputSchema`, `outputSchema`, `executionTimeoutMs`, and source provenance (`sourcePath`, `sourceScope`, `entryContentHash`).

### 3.3 Stateless, Owner-Scoped Resolution

Instead of a mutable global `AgentRegistry` map whose short names depend on load order, resolution is a **pure function over an immutable prepared catalog snapshot**:

```ts
export type PreparedDefinition =
  | { kind: "prompt"; name: string; owner: string; definition: SubagentDefinition; outputSchema?: TSchema }
  | { kind: "code"; name: string; owner: string; module: WorkflowExecutableModule; readonly: boolean };

export function resolveCallable(
  callerOwner: string,
  name: string,
  snapshot: PreparedCatalog,
): PreparedDefinition;
```

Resolution and contract rules:
1. **Scoped, deterministic lookup (with App-local isolation):**
   - Each App's `PreparedCatalog` contains **only that App's local agents/procedures plus shared global agents/procedures**—never another App's `appLocal` definitions (preserving the cross-App Task boundary by construction, except explicit May break-glass).
   - Unqualified `name` resolves inside `callerOwner`'s local procedures (`agents/<callerOwner>/workflows/<name>.ts`) first, then configured prompt agents visible in the bound release.
   - Qualified `<owner>/<name>` resolves that exact owner's procedure (`agents/<owner>/workflows/<name>.ts`).
   - Duplicate definitions or ambiguous short names throw an explicit error—load order never decides winners.
   - Production `ctx.call` accepts `name: string` only so callers cannot bypass catalog provenance or admission; test-only inline modules/handlers enter through `@may-agent/sdk/testing` (`mocks`).
2. **Lexical catalog owner vs. Task authority owner:**
   - Calling `<other-owner>/<proc>` within the same App switches the **lexical catalog owner** (`callerOwner = "<other-owner>"`) so unqualified calls inside `<proc>` resolve against `<other-owner>`'s local catalog first.
   - It **never** changes the **Task authority owner** (`ctx.reconciliation.agent`), generation, attempt, workspace, or creator permissions, and a nested `done` result never directly settles the enclosing Task.
3. **Input & output validation (keep essential contracts simple):**
   - **Prompt definitions:** Accept `string` task prompts (`0` prompt agents declare `inputSchema`; do not invent speculative `agent.json` input schemas or JSON prompt renderers).
   - **Code definitions:** Validate `input` against `module.inputSchema` when declared before starting execution.
   - **Outputs:** When `status === "done"`, validate `output` against the definition's `outputSchema` (if declared) **and** the caller's `options.schema` (if supplied). Caller options cannot weaken a declared `outputSchema`. Partial `output` and `facts` on `blocked`/`error`/`interrupted` results are preserved.

### 3.4 Cross-Calling, Restriction Enforcement, and Capacity Rules

1. **Symmetric nested calls (`Code <-> Prompt`):**
   - **Code -> Prompt/Code:** Invokes `await ctx.call(name, input, options)` directly on the kernel scope.
   - **Prompt -> Code/Prompt:** Inside a bounded prompt run, synchronous sub-delegation (`agents` tool `action: "call"`) delegates through the enclosing kernel scope's `ctx.call(...)`:
     - `action: "call"` accepts `input?: unknown` alongside `task?: string` and converts `ExecutionDeferredError` into structured `deferredExecutionResult` tool data.
     - `action: "list"` lists both callable prompt agents and callable code procedures (with descriptions and expected inputs), while live-session controls (`fork`, `follow-up`, `peek`) explicitly reject code procedures (`"use action: 'call' for code procedure ..."`).
     - Retires the separate model-facing `workflow` tool (`createWorkflowTool`).
2. **Honest restriction enforcement (`tools: "readonly"`, `skill`, `operationAllowance`):**
   - Caller tool restrictions are sticky down the call tree; conflicting overrides from callees or child call options are rejected.
   - On **prompt definitions**, `tools: "readonly"` filters model tools to observation tools plus `finish()`.
   - In-process TypeScript is trusted code, not filesystem-sandboxed. Therefore, calling a **code definition** with `tools: "readonly"` **fails fast before start** unless the module explicitly declares `readonly: true`. Inside a `readonly` invocation scope, `tools: "readonly"` propagates to all descendants and Task mutation bindings (`reviseTask`, `closeTask`, `applyTaskChanges`) are omitted (`undefined`).
   - Prompt-specific options (`skill`, `operationAllowance`) apply to prompt definitions and fail fast if passed directly to a code procedure.
3. **Preserved admission & capacity rules (no "slot lending"):**
   - Kernel call allowances (`maxConcurrentCalls`) continue to be held for the full duration of each `ctx.call` step, failing fast with `WorkflowAllowanceExhaustedError` when saturated (with Direct default `maxConcurrentCalls >= maxDepth + 1`, e.g., `4` vs. `maxDepth = 3`, so bounded linear recursion completes without deadlock while `maxConcurrentCalls = 1` preserves deterministic rejection).
   - `maxDepth` counts every nested `ctx.call` frame uniformly across prompt and code calls.
   - Hosted execution capacity (`host-capacity.ts` / `ExecutionDeferredError`) retains its existing reservation lifetime until joined cleanup—no slots are released while awaiting tool calls.

### 3.5 Single Invocation-Scope Cleanup & Complementary Evidence

- **Unified descendant tracking:** Every child execution spawned via `ctx.call` registers its `AbortController` and bash PGID cleanup check on the enclosing kernel invocation scope.
- **No swallowed cleanup leaks:** Before returning, the scope cancels/joins unfinished children and verifies tracked process-group termination. Even if authored code or an LLM catches a child error and returns `done`, an unconfirmed descendant PGID still surfaces `cleanup.confirmed: false` / `WorkflowUnconfirmedCleanupError` at the root boundary—eliminating manual `unconfirmedToolWorkflows` arrays and `options.workflowTool` plumbing.
- **Complementary artifacts:** `session.jsonl` (raw model/tool transcript) and `run.json` (`WorkflowRunReport` bounded step/log summary with `sessionId` / `transcriptPath` references and explicit truncation counters) remain complementary rather than duplicating full descendant payloads in ancestor tool outputs.

### 3.6 Standalone Environment vs. Host Environment (`TaskRunner`)

Both execution environments bind their capabilities into the shared invocation kernel without duplicating validation, deadline, child-join, or cleanup logic:

1. **Standalone Environment (CLI / Gym / Scripts / SDK Unit Tests — `may run`, `may list`, `run`, `runTargetTest`):**
   - **CLI Surface (`src/app/may.ts` + `src/app/standalone-cli.ts`):** Exposes **`may run <target> [input]`** (alias `may call`) and **`may list`** at the top of `may.ts`—before any SQLite, socket, or daemon Task recovery runs—working identically in source mode (`bun run may run ...`) and in the compiled `may-agent` binary, and retiring the legacy `--run-workflow` CLI exit mode (`src/app/modes/run-workflow.ts`).
     - **Zero-`--app` Auto-Discovery:** `run(target, input, options?)` (`src/app/standalone.ts`) automatically infers `projectRoot` from `cwd`, discovers the owning App across `projects/*.app/agents/*` and `agents/*`, and locks `PreparedCatalog` to that App's boundary (requiring `<app>/<target>` or `--app` only if two enabled Apps share an agent name).
     - **Minimal Orthogonal Flags & Safe Stdin:** Supports `--readonly`, `--cwd <dir>`, `--out <dir>`, `--timeout <45s|2m|45000>`, `--skill <name>`, and `--json`; reads piped stdin lazily only when no positional or `--input` payload is supplied (never blocking `--help`, `list`, or explicit inputs).
   - **Programmatic & SDK Standalone Surfaces:** Exposes `run(target, input, options?)`, `listStandaloneTargets(options?)`, `runDirect(options)`, and `runStandalone(moduleOrTarget, options)` directly from `@may-agent/sdk/standalone` (implemented in `src/app/standalone.ts` and `packages/sdk/src/standalone.ts`, with `runTargetTest` in `@may-agent/sdk/testing`) so callers can run prompt agents, `<owner>/<procedure>` code modules, and native `codex`/`claude` CLI executors by importing `@may-agent/sdk/standalone` alone.
   - **Explicitly supplied local reads vs. unbound Host authority:** Standalone execution has no durable Task ownership, no SQLite, and no implicit live Host authority; unbound Host operations (`events.emit`, Task mutations, unconfigured reads) fail explicitly, while explicitly supplied local reads, Task-shaped snapshots, and fixtures remain available.
   - Creates an independent per-root `WorkflowExecutionAllowance` (`maxConcurrentCalls`) on each root invocation to prevent **cross-root call-allowance interference**.
   - Writes `<outputRoot>/run.json` (`WorkflowRunReport`) and per-session `sessions/<id>/session.jsonl` when `--out` / `outputRoot` / `traceDir` is provided; omitting `--out` / `outputRoot` cleans up temporary scratch output directories automatically (and code-only runs never fabricate empty `session.jsonl` files).
2. **Host Environment (`TaskRunner` in `src/app/composition/task-execution.ts` & `src/app/core/tasks/execution.ts`):**
   - Unifies `TaskAgentRunner` + `TaskWorkflowRunner` behind **`TaskRunner`** (`createTaskRunner` in `src/app/composition/task-execution.ts`), wired into `AppTaskRuntimeOptions.runner` with zero SQLite or `TaskSpec` migration:
     - `available`, `prepare`, `role`, `executionRecipient`, `execute`: handles prompt-backed Task execution, preserving `15m` default timeout, `"task"` worktree allocation on non-conversation `git` Apps, in-turn `validateResult` (`preflightTaskChanges` + final settlement check during `finish()`), and canonical workspace residue checks.
     - `inspect`, `executeWorkflow`: inspects and executes code-backed Task procedures (`module.executionTimeoutMs ?? 30m` clamped to `maxAttemptMs` / `coordination.maxAttemptMs`, `"shared"` workspace unless `module.workspace` is declared), preserving post-return normalization, 8 KB `workflow-blocker-context` bounding, and `workflow_runs` session-recovery linkage.
     - `snapshot()`: returns a `TaskRunner` pinned to the captured immutable agent and workflow definitions at the synchronous App publication boundary so running invocations never reread mutable definitions from disk.
     - Recovery-critical SQLite association writes (binding `attempt.sessionId` or inserting/updating `workflow_runs`) are **awaited** before model/code execution continues (never swallowed as diagnostic observer errors).
   - Durable Task lifecycle (`claimObservedAppTask` -> `TaskAttempt` -> `TaskReconcileResult` settlement), persistent Conversation turns, and external registered executors (`opts.executors`) remain owned by their existing authorities.

---

## 4. Essential-First Migration Plan ("Critical First, Drop the Rest")

Start by pruning dead/unused scenarios so the core runtime unification stays small, high-integrity, and free of legacy baggage:

### Phase 0 (Completed — Host PR #512): Prune Dead Scenarios (`WorkflowGuard` & Unused `"workflow"` Presets)
- **Why first:** Live repo inventory showed **`0` production `guards/*.ts` files** anywhere (`test/fixtures/guards/` only), **`0` `ctx.workflows.run` callers**, **`0` `agent.json` `inputSchema` declarations**, and only **1** live skill calling the LLM `workflow` tool (`may/skills/evaluation-and-metric-intake/SKILL.md`).
- **Completed changes:**
  1. Retired `WorkflowGuard` / `Demand` (`packages/sdk/src/workflow-guard.ts`, `guardsDir`, `sharedGuardsDir`, and `test/fixtures/guards/`).
  2. Removed unused `"workflow"` entries from `alex`, `gym`, and `scout` `agent.json` manifests (and updated `scout-knowledge-lib.app/app.test.ts`).

### Phase 1A (Completed — Host PR #513): SDK Unified `ctx.call`, Owner-Scoped Resolver, & Testing `mocks`
- **Where:** `packages/sdk/src/workflow.ts`, `packages/sdk/src/workflow-kernel.ts`, `packages/sdk/src/testing.ts`, `src/app/direct-workflow.ts`, `src/lib/workflow-catalog.ts`, `src/lib/workflow-tool.ts`.
- **Completed changes:**
  1. Added `ctx.call(name, input, options?)` to `WorkflowContext` (with `AgentContext` alias) returning `ExecutionResult<T>`, routing `ctx.agents.call` and `ctx.workflows.run` through the same kernel step runner.
  2. Implemented stateless owner-scoped resolution (with App-local isolation), honest `readonly` enforcement, dual output schema validation (on `done` results while preserving partial `blocked`/`error`/`interrupted` evidence), and unified `mocks` in `packages/sdk/src/testing.ts`.

### Phase 1B (Completed — Host PR #514): Prune Unused Standalone `workflowTool` Plumbing & Converge Standalone/Gym
- **Where:** `src/app/direct-agent.ts`, `src/app/direct-workflow.ts`, `src/lib/workflow-tool.ts`, `projects/gym/src/cli.ts`, `projects/gym/src/workflow-adapter.ts`.
- **Why drop instead of rebuild:** Live repo audit shows **`0` Gym scenarios** use `allow_workflow` (`createDirectWorkflowTool` / `createGymAgentWorkflowTool`).
- **Completed changes:**
  1. Deleted unused `createDirectWorkflowTool`, `allowChildAgentWorkflowTool`, `options.workflowTool`, `unconfirmedToolWorkflows`, and `createGymAgentWorkflowTool` instead of rebuilding standalone LLM-tool-to-workflow recursion.
  2. Pinned full prepared prompt definitions (instructions, skills, and config—not just directory paths) in `PreparedCatalog` so running invocations never reread mutable files from disk, and shared one step-completion/schema helper across Standalone and Hosted prompt adapters.
  3. Updated Gym to consume `run.json` (`WorkflowRunReport`) and per-session `session.jsonl` evidence directly and retired duplicate Gym adapter stitching.
- **Proof:** `bun test packages/sdk/`, `direct-agent.test.ts`, `direct-workflow.test.ts`, and `projects/gym` suites pass, including mixed recursion, mid-flight disk-edit snapshot isolation, and swallowed child-cleanup failure detection.

### Phase 2 (Completed — Host PR #515): Converge Host Environment (`TaskRunner`) & Model Delegation (`agents` Tool)
- **Where:** `src/app/core/tasks/execution.ts`, `src/app/core/tasks/attempt-execution.ts`, `src/app/core/tasks/attempt-runner.ts`, `src/app/adapters/executors/`, `src/lib/manager-agents-tool.ts`, `src/lib/workflow-tool.ts`.
- **Completed changes:**
  1. Collapsed `TaskAgentRunner` + `TaskWorkflowRunner` and `runTaskAgent` + `runTaskWorkflow` into one `TaskRunner` (`inspect`, `execute`, `snapshot`) where `inspect` and `execute` share the same pinned `PreparedCatalog` snapshot and recovery-critical DB associations are awaited before execution continues.
  2. Added structured `input?: unknown` support and code-procedure discovery to `manager-agents-tool.ts` (`action: "call"` / `action: "list"`), rejecting `fork`/`follow-up`/`peek` on code procedures, and treated `"workflow"` in `toolset-loader.ts` as a folded alias.
- **Proof:** Full Host Task reconciliation, recovery-association failure injection, and executor suites pass (`bun run check:ci` and `MAY_TEST_SHARDS=4 bun run ci`).

### Phase 3 (Completed — Host PRs #517 & #518 + App Repo): Migrate Callers, Delete Legacy Shims, & Update Docs
- **Where:** `projects/*.app/` (9 workflow files + May's 1 intake skill), `packages/sdk/`, `src/lib/workflow-tool.ts`, `projects/alex.app/docs/2a-design/{agents,workflows}.md`, `projects/alex.app/docs/2b-manual/workflow-authoring.md`.
- **Completed changes:**
  1. Migrated the 9 `ctx.agents.call` workflow files to `ctx.call` and May's `evaluation-report-intake` skill to `agents({ action: "call", ... })`.
  2. Deleted `ctx.agents.call`, `ctx.workflows.run`, and `createWorkflowTool` / `WorkflowTool` in `src/lib/workflow-tool.ts` so one invocation path is permanent.
  3. Updated accepted design, principles, and authoring docs (`evolution.md`, `agents.md`, `workflows.md`, `sdk.md`, `escalation.md`, `system-boundary.md`, `agent-app.md`, `task-attempts.md`, `execution-contributions.md`, `workflow-authoring.md`, `handler-authoring.md`, `user-guide.md`, `task-execution-guide/SKILL.md`).
- **Proof:** `bun run check:may-design` and full Host + App verification pass with zero legacy alias callers remaining.

### Phase 4 (Completed — Host PR #520): Unified `may run` / `may list` CLI & Zero-Config `run(target, input)`
- **Where:** `src/app/may.ts`, `src/app/standalone-cli.ts`, `src/app/standalone.ts`, `packages/sdk/src/standalone.ts`, `packages/sdk/src/testing.ts`, `projects/alex.app/docs/2b-manual/{user-guide,workflow-authoring}.md`.
- **Completed changes:**
  1. Exposed `may run <target> [input]` and `may list` at the top of `may.ts` (zero SQLite/daemon startup) with `--readonly`, `--cwd`, `--out`, `--timeout`, `--skill`, `--json`, and lazy stdin reading.
  2. Auto-discovered App-local target owners in `run(target, input, options?)` without requiring `--app`, while preserving strict App-local catalog isolation and honest `readonly` / `cleanupConfirmed` enforcement across prompt, code, and native CLI (`codex` / `claude`) targets.
  3. Added `@may-agent/sdk/standalone` (`runStandalone`) and `runTargetTest(moduleOrTarget, options)` in `@may-agent/sdk/testing`, and consolidated standalone exports through `src/app/standalone.ts`.

---

## 5. Simplification Criteria & Required Acceptance Proofs

Simplification is judged by **fewer independent authorities** for resolution, schema validation, descendant lifetime/cleanup, Hosted Task dispatch, and result conversion:

| Surface | Current Baseline | Post-Migration Target |
| :--- | :--- | :--- |
| **Nested & standalone call API** | `ctx.agents.call` + `ctx.workflows.run` | **`ctx.call(name, input, options)`** |
| **Model synchronous delegation tools** | `agents` tool + `workflow` tool | **`agents` tool (`action: "call"`)** |
| **Standalone + Gym child cleanup** | Manual `workflowTool` + `unconfirmedToolWorkflows` + Gym stitcher | **1 kernel invocation scope (dead `workflowTool` deleted)** |
| **Hosted Task bounded runners** | `TaskAgentRunner` + `TaskWorkflowRunner` (`runTaskAgent` / `runTaskWorkflow`) | **1 `TaskRunner` (`inspect` + `execute` + `snapshot`)** |
| **Workflow guard subsystem (`guards/*.ts`)** | `WorkflowGuard` + `Demand` (`0` production files) | **Retired in Phase 0** |
| **Existing `workflows/*.ts` compatibility** | — | **Zero authoring rewrite required in Phases 0–2** |

### Required Acceptance Proofs Before Merge
1. **Deterministic Resolution & Full Snapshot Isolation:** Short names resolve within `callerOwner` first; cross-owner calls require `owner/name`; duplicate/ambiguous names fail fast; `inspect` and `execute` use the same pinned snapshot, and running invocations never reread mutable prompt instructions, skills, or configs from disk.
2. **Contract & Restriction Enforcement:** `ctx.call(name, input, { schema, tools: "readonly", timeoutMs })` enforces declared + caller schemas on `done` results (while preserving partial `blocked`/`error`/`interrupted` evidence), clamps deadlines, filters prompt tools, and rejects code modules lacking `readonly: true` while omitting Task mutation bindings in `readonly` scopes.
3. **Admission & Recursion:** Mixed chains (`Prompt -> Code -> Prompt`) complete within `maxDepth` when admitted; saturation throws `WorkflowAllowanceExhaustedError` or pre-start `ExecutionDeferredError` (`started = false`, no fabricated ID, no consumed fixture) without hanging or slot lending, and independent root runs have no cross-root call-allowance interference.
4. **Swallowed Child-Cleanup Proof:** An unconfirmed descendant `bash` PGID at any depth surfaces `cleanup.confirmed: false` / `WorkflowUnconfirmedCleanupError` at the root boundary even if an intermediate caller catches the child error.
5. **Hosted Task & Gym Preservation:** Hosted Tasks await recovery-critical session/workflow DB associations before execution and settle `converged`, `waiting`, and `incomplete` identically across prompt and code definitions through `TaskRunner`; Gym scenarios preserve isolation denials, supplied local read fixtures, `session.jsonl` references, and scoring accuracy.

---

## Appendix: Historical, Non-Normative Review Notes (Incorporated into Sections 1–5 Above)

> *Note: Sections 6–11 below are preserved as the chronological review record that shaped Sections 1–5. Where earlier review notes discuss intermediate type names (such as `AgentResult` or `AgentInstance`), **Sections 1–5 above are authoritative**.*

## 6. Review comments — 2026-11-14

**Direction:** Proceed with the unified API. Callers should use one invocation
surface regardless of whether a target uses a model loop or TypeScript. These
comments clarify that design. Prompt/code adapters can remain internal where
their execution mechanics differ.

**Review basis:** Apps `c2af14518d` and Host `4dfc062250`. This is a design and
source review; no candidate implementation or new runtime trial was executed.
Update accepted design docs with the migration, because their current guidance
explicitly retains the existing separate entrypoints.

### 6.1 Clarify the unified contract and its identities

The useful invariant is: **resolve one target, invoke it within the caller's
bounded scope, and return one contribution contract.** Keep `ctx.call(target,
input, options)` as the canonical nested API and one model-facing delegation
tool. Root execution uses the same invocation machinery. Callers discover the
target's input/output contract, without selecting its implementation type.

An agent's durable role, a registered executable, and one invocation remain
different identities. A workflow remains a reusable procedure owned by an
agent; registration does not create another Task owner. If `AgentInstance`
names the reusable registered object, say so explicitly. Mutable cancellation,
child tracking, warnings and results belong to a fresh invocation scope, so
concurrent calls cannot affect each other. Reload prepares future definitions;
running invocations retain their captured definitions.

The SDK already has one
[`ExecutionResult`](../../../may-agent/packages/sdk/src/workflow.ts) vocabulary
for bounded agent and workflow contributions. Extend that contract. This
proposal unifies bounded invocation; Task admission/recovery, persistent
Conversation turns and native executor lifetimes retain their existing owners.
A standalone call does not acquire durable Task identity through this runner.

### 6.2 Make target resolution deterministic and scoped

The registry example currently makes short-name resolution depend on load
order: the first `module.name` wins, while duplicate full names silently
overwrite. This conflicts with current owner-scoped discovery and ambiguity
rejection in the
[`workflow catalog`](../../../may-agent/src/lib/workflow-catalog.ts).
Two owners can legitimately have a procedure named `review`; neither should
receive the other's call because initialization order changed.

Specify these rules:

- Resolve short names inside the selected owner's catalog and bound release.
  Reject collisions and ambiguous targets explicitly. A qualified reference
  identifies a target; it does not grant another owner's or App's authority.
- Separate the callee's catalog/definition identity from the inherited caller
  authority and responsible Task agent. Selecting a target cannot change the
  Task's owner, generation, attempt, workspace or permissions.
- Preserve captured definitions and source provenance through the call tree.
  Use an immutable prepared catalog, rather than looking up mutable global
  definitions again after reload.
- Route production calls through the trusted resolver. The proposed arbitrary
  `AgentInstance` object argument must not bypass admission or provenance.
  Test-supplied modules can enter through the trusted test/root binding.

Prompt-backed targets can default to string input. Structured input needs a
declared schema and defined rendering into the prompt; do not guess how an
arbitrary object becomes an assignment. A unified API does not require every
target to accept the same payload. Define how target `outputSchema` and caller
`options.schema` are both checked; caller options cannot weaken the target's
contract. Preserve schema-derived TypeScript inference.

### 6.3 Specify what restrictions the runner can enforce

`tools: "readonly"` currently filters model tools in
[`agent-execution.ts`](../../../may-agent/src/lib/agent-execution.ts). It does
not restrict arbitrary TypeScript imports. A code target can call
`writeFileSync`, spawn a command, or publish through a bound capability without
invoking a model tool. `verified-coder` already runs verification commands
directly. Forwarding `options.tools` to descendants does not make that procedure
read-only.

Keep one options surface, with explicit applicability. Preserve caller tool
restrictions, narrow bound mutation capabilities, and reject a code target that
cannot honor a requested restriction. Document the trusted-code boundary;
filesystem isolation of arbitrary in-process code would require a separate
sandbox design. The initial API should make no such enforcement claim.

Likewise, `skill` and tool-operation allowances have adapter-specific meaning;
document their application or reject unsupported use rather than silently
ignoring them. Existing hosted profiles are not an ordered privilege scale:
preserve the caller restriction and reject conflicting overrides, as the
[`manager`](../../../may-agent/src/lib/manager.ts) currently does. Replace the
generic "intersect tools" wording with that precise rule.

### 6.4 Preserve current results and capability availability

The proposed interfaces need corrections before supporting zero-migration
loading of existing workflows:

- `WorkflowExecutableModule.execute` returns `ExecutionResult` **or**
  `TaskReconcileResult`, rather than the enriched `AgentResult`. Adapt authored
  contributions at the invocation boundary. Keep Task settlement separate: a
  completed procedure can propose `state: "waiting"`, and a helper finishing
  cannot settle the enclosing Task.
- Preserve useful `output` and `facts` on blocked/error/interrupted results.
  `blocked(...): AgentResult<never>` conflicts with its own `output` option and
  prevents typed partial work. Preserve existing `blocked(reason, facts)`
  semantics; the proposed second `context` argument would otherwise move
  existing evidence silently. Retain CLI receipt evidence and exact child IDs.
- Keep `ExecutionDeferredError` and other pre-start failures distinct from a
  started result. Capacity denial must not invent an execution ID or consume
  an execution fixture as though the child ran.
- Preserve Task-bound `reviseTask`, `closeTask`, `applyTaskChanges` and
  `readCommunication`, which the new context omits. Keep their scoped bindings
  and fencing. `workspace` is currently optional, and Task mutation/event reads
  can be unavailable in standalone mode; represent that availability explicitly.
  Local snapshots do not supply live Task authority.
- Carry module `workspace`, `verify` and source-provenance metadata where the
  embedding runner uses them. Retain hosted workflow guard behavior without
  silently enabling it in Direct/Gym.

Define the executable's authored return separately from the runtime-owned run
report. Identity, duration, descendant cleanup and traces are recorded by the
runner; the authored function should not manufacture them. A shared context
can replace `WorkflowContext`, with compatibility aliases forwarding to the
same implementation.

### 6.5 Keep admission policy distinct from API consolidation

Section 3.4 changes capacity semantics by acquiring places only during model
streams and releasing them while tools run. Current SDK allowance exhaustion
fails immediately; its nested-call test at `maxConcurrentCalls = 1` expects
`WorkflowAllowanceExhaustedError`, not an indefinite wait. Hosted execution
separately counts live/uncertain execution and retains reservations until joined
cleanup. The
[shared-accounting design](agent-task-workload-implementation.md#4-enforce-additional-execution-limits-using-the-same-authority)
explicitly has no slot lending.

Preserve those admission rules in this migration. A caller awaiting a tool can
still own a running process and effects; a code target can consume resources
without any model stream. A provider-stream throttle, if needed, is a different
resource from execution capacity. Changing one must not release the other.

The recursion proof should say: a mixed call chain completes when admitted,
and saturation produces the existing bounded non-start/failure signal without
hanging or exceeding capacity. Slot lending would need a separate decision and
proofs for suspension, parallel children, cancellation, resumption and restart.
Define whether `maxDepth` counts all calls; current direct limits count workflow
nesting, so changing that meaning also needs deliberate compatibility coverage.

### 6.6 Consolidate cleanup ownership and preserve evidence

The manual `unconfirmedToolWorkflows` plumbing is a good simplification target.
Its responsibility remains: a nested cleanup failure must stay visible even
when authored code or the model catches the child error and reports success.
The existing
[`direct workflow tests`](../../../may-agent/src/app/direct-workflow.test.ts)
already exercise that case. Put descendant tracking and finalization under one
invocation scope, and join/cancel children before returning or releasing their
reservations. Checking a returned cleanup flag alone is insufficient.

Move required-finish and schema-result checks into the shared prompt adapter
before deleting `enforceDirectStepCompletion` or its converters. Retain partial
evidence and fence late calls/results. Cancellation still requires cooperative
TypeScript I/O; cleanup confirmation covers tracked processes, not every
subprocess arbitrary App code might create. The
[Scout comparison](../../../scout-knowledge-lib.app/docs/verification/standalone-runner-comparison-20261113.md)
demonstrates that a runner does not make synchronous code preemptible.

A common report is useful, but `session.jsonl` and `run.json` are complementary
evidence: raw model/tool history versus an invocation summary. Keep transcript
references and historical readers. Bound report children/logs/output and record
truncation; avoid embedding every descendant's full result in every ancestor's
tool response. The current kernel already caps step/log retention. Gym
transcript stitching can disappear when its scoring/evidence consumers read the
replacement report. Gym isolation denials remain policy even if wiring is shared.

Inlining `agent-runner.ts` is independent of this API. That small module
isolates the Pi loop from persistence and Host concerns; assess its removal by
dependency clarity rather than including it automatically in this migration.

### 6.7 Suggested implementation sequence and acceptance

Keep the unified API as the destination, with this implementation sequence:

1. **Finalize the contract, then implement the unified bounded dispatcher and
   `ctx.call`.** Reuse the current kernel and execution scope; put prompt and
   code adapters behind the same resolver. Route existing SDK aliases through
   it, preserving argument/result semantics and strict fixture consumption.
   Replace the relevant existing authorities instead of leaving a second
   registry or result authority alongside them.
2. **Prove the standalone path, then migrate Gym.** Exercise prompt-to-code,
   code-to-prompt, code-to-code and prompt-to-prompt through the same invocation
   boundary. Demonstrate that manual child-cleanup wiring and repeated result
   conversion disappear while isolation and evaluation remain intact.
3. **Integrate hosted bounded calls and Task adapters through that dispatcher.**
   Keep the Task attempt interface, durable settlement, admission, creator
   authority and native executor extension. Consolidate the model-facing tool
   with its existing inspection/fork/cancel responsibilities accounted for;
   `call` is not that tool's entire behavior.
4. **Migrate callers and retire aliases on an explicit boundary.** Compatibility
   helps during migration but cannot be the permanent meaning of "one API."
   Add a common CLI entry after the invocation contract is stable. New CLI
   commands and the unmeasured `<5ms` inspection claim need not block the
   runtime consolidation.

Add acceptance cases for duplicate/ambiguous names and reload during a call;
concurrent calls to the same target; restricted callers reaching code and prompt
descendants; pre-start admission denial without fabricated identity; partial
reports and Task waits; a swallowed child-cleanup failure; cancellation/late
results at mixed-call boundaries; and preserved Gym scoring/transcript access.
Keep tests that prove existing contracts. Change an expected behavior only
with an explicit design decision.

Judge simplification by fewer independent owners for resolution, validation,
child lifetime and evidence conversion. The estimated 450–650 lines saved is
not yet demonstrated and is not the acceptance criterion. **One public call
contract with small internal adapters fits the design when it preserves these
identity, authority and lifetime guarantees.**

---

## 7. Review comments (Simplicity & End-to-End Task Alignment) — 2026-11-14

**Direction:** Strongly support unifying Agents and Workflows end-to-end—**including Hosted `TaskAttempt` dispatch**—so Standalone/CLI, Gym, nested `ctx.call(...)`, LLM delegation, and Hosted Tasks all share one target interface and stay aligned and easy to maintain. At the same time, strip out heavy new abstractions in Sections 3–4 so the result is a genuine simplification rather than an extra layer.

### 7.1 Hosted `TaskAttempt` dispatch must reuse the unified interface

Unifying only Standalone and Gym while leaving Hosted Tasks split between `Agent` and `Workflow` would preserve two parallel maintenance paths in the core runtime. Today, Hosted Task execution duplicates inspection, preparation, timeout policy, and dispatch across:

- `TaskAgentRunner` vs. `TaskWorkflowRunner` (`opts.agents` vs. `opts.workflows`) in [`execution.ts`](../../../may-agent/src/app/core/tasks/execution.ts),
- `runTaskAgent` vs. `runTaskWorkflow` in [`attempt-execution.ts`](../../../may-agent/src/app/core/tasks/attempt-execution.ts), and
- `workflow:` vs. prompt-agent branching in `taskWorkspaceRequirement` and `executeTaskHandler` in [`attempt-runner.ts`](../../../may-agent/src/app/core/tasks/attempt-runner.ts).

Hosted Tasks should resolve, inspect (`workspace`, `verifier`, `role`, `timeoutMs`), and execute both prompt-backed (`alex`) and code-backed (`alex/verified-coder`) targets through **one unified Task target runner** backed by the same invocation kernel used in Direct and Gym:

- Durable Task ownership (`claim` -> `TaskAttempt` lease/events -> `TaskReconcileResult` settlement) remains in Task core.
- Ongoing external native executors (`executor:codex`) remain on `TaskExecutor`, while all bounded May targets (`prompt` or `code`) flow through the single unified runner.

### 7.2 Reuse `ExecutionResult` and `WorkflowContext` instead of inventing heavy new types

Sections 3.2–3.3 propose a new `AgentInstance` hierarchy and a new `AgentResult` return type carrying `durationMs`, `children: AgentStepTrace[]`, and `cleanupConfirmed`. Mixing runner-owned trace fields into the authored function's return contract adds unnecessary churn and breaks existing workflows returning `TaskReconcileResult`.

- Keep [`ExecutionResult`](../../../may-agent/packages/sdk/src/workflow.ts) (and `TaskReconcileResult` at Task settlement boundaries) as the authored return contract.
- Keep timing, step trees, and descendant cleanup status in the runner-owned [`WorkflowRunReport`](../../../may-agent/packages/sdk/src/workflow-kernel.ts) (`run.json`).
- Add `ctx.call(target, input, options)` directly on the existing context (`AgentContext` / `WorkflowContext`) rather than maintaining two context shapes.

### 7.3 Replace the stateful `AgentRegistry` class with a pure owner-scoped resolver

The `AgentRegistry` class in Section 3.3 uses a mutable global `Map` where the first loaded `module.name` wins short-name lookup, introducing load-order collisions (e.g., two owners each defining `review`) and creating a third stateful registry alongside `SubagentManager` and [`workflow-catalog.ts`](../../../may-agent/src/lib/workflow-catalog.ts).

- Use **one stateless, owner-scoped resolver function** `(callerAgent, target, snapshot) => ResolvedTarget` over immutable captured definitions.
- Resolve unqualified names within the caller owner's catalog first, require `<owner>/<name>` across owners, and fail fast on ambiguity.

### 7.4 Keep capacity and `readonly` rules straightforward—no "slot lending"

- **No slot lending during tool waits (Section 3.4):** Releasing concurrency slots while awaiting tool calls changes admission invariants, breaks deterministic `WorkflowAllowanceExhaustedError` behavior, and ignores active subprocesses/code steps. Keep existing capacity and allowance semantics unchanged.
- **Simple, honest `tools: "readonly"` rule:** `tools: "readonly"` restricts model tools on prompt targets; it does not sandbox arbitrary TypeScript I/O. If a caller passes `tools: "readonly"` to a code target, reject immediately at call start unless that module explicitly declares `readonly: true` (and propagates `readonly` to all nested `ctx.call` invocations).

### 7.5 Delete duplicate plumbing and converge on one surface

To keep the codebase lean:

1. **SDK (`@may-agent/sdk`):** Add `ctx.call(target, input, options)` + unified `mocks` in `@may-agent/sdk/testing`, with `ctx.agents.call` and `ctx.workflows.run` as thin temporary shims.
2. **Unified Runner (`workflow-kernel` + `direct-*` + `gym`):** Route both prompt turns and code modules through one invocation scope, deleting manual `options.workflowTool` injection, `unconfirmedToolWorkflows` arrays in [`direct-agent.ts`](../../../may-agent/src/app/direct-agent.ts) / [`direct-workflow.ts`](../../../may-agent/src/app/direct-workflow.ts), and duplicate stitching in [`workflow-adapter.ts`](../../../gym/src/workflow-adapter.ts).
3. **Hosted Tasks & Model Delegation:** Collapse `TaskAgentRunner` + `TaskWorkflowRunner` into one unified Task target runner, route model-side synchronous workflow calls through `action: "call"` in [`manager-agents-tool.ts`](../../../may-agent/src/lib/manager-agents-tool.ts), and retire the separate model-facing `workflow` tool surface in [`workflow-tool.ts`](../../../may-agent/src/lib/workflow-tool.ts).

---

## 8. Review comments (Document Consistency & Implementation Readiness) — 2026-11-14

### 8.1 Core Strengths of the Proposal
- **Right architectural boundary:** Unifying the caller-facing invocation surface (`ctx.call(target, input, options)`) while keeping prompt-backed and code-backed execution mechanics as internal adapters eliminates duplicate orchestration plumbing (`direct-agent` vs. `direct-workflow`, dual Gym runners, and manual `unconfirmedToolWorkflows` wiring).
- **Incremental path:** Routing `ctx.agents.call` and `ctx.workflows.run` through `ctx.call` first allows the kernel and standalone stack to converge without a flag-day rewrite of authored workflows.

### 8.2 Key Contradictions to Resolve Inside the Document
Right now, **Sections 1–5** and **Sections 6–7 (Review comments)** contradict each other on several concrete mechanics. An implementer reading the file top-to-bottom will hit ambiguity unless Sections 3–5 are updated to align with the review decisions:

1. **Authored Return Type vs. Runtime Report (`AgentResult` vs. `ExecutionResult`)**
   - *Conflict:* Section 3.2 has `AgentInstance.run(ctx)` returning `AgentResult<TOutput>` (which includes runtime-owned fields like `id`, `durationMs`, `children`, `cleanupConfirmed`). Meanwhile, Section 5 claims *"Zero authoring migration required"* for existing workflows, which actually return `ExecutionResult` or `TaskReconcileResult`.
   - *Suggestion:* Split the types explicitly in Section 3.2:
     - **Authored return:** `ExecutionResult<TOutput> | TaskReconcileResult` (returned by workflow `execute(ctx)` and `ctx.done()` / `ctx.blocked()`).
     - **Caller/Runner return:** `ExecutionResult<TOutput>` at the `ctx.call()` boundary and `WorkflowRunReport` (`run.json`) at the root runner boundary, assembled by the kernel around the authored return.
   - Fix `ctx.blocked(reason, facts, options)` in Section 3.2 so it does not change the second positional parameter from `facts` to `context` or type the return as `AgentResult<never>` (which breaks typed partial `output`).

2. **Target Resolution & Registry Scoping (`AgentRegistry`)**
   - *Conflict:* Section 3.3's `registerCodeAgent` uses a flat `Map<string, AgentInstance>` where unqualified `if (!this.instances.has(module.name))` wins on first-load order, and `ctx.call(target)` accepts an arbitrary in-memory `AgentInstance` object.
   - *Suggestion:* Replace the Section 3.3 snippet with owner-scoped, immutable catalog resolution (`resolve(callerOwner, targetName, snapshot)`):
     - Short names resolve within the caller's owner catalog first; cross-owner calls require `owner/name`; ambiguous short names throw an explicit error.
     - Drop arbitrary `AgentInstance` object targets from production `ctx.call(target: string, ...)` so callers cannot bypass catalog provenance or admission (keep custom module injection in the test harness only).

3. **Concurrency & Admission Semantics**
   - *Conflict:* Section 3.4(3) proposes releasing `maxConcurrentCalls` slots while awaiting nested `ctx.call()` executions. Sections 6.5 and 7.4 explicitly reject slot lending because `maxConcurrentCalls` is an execution/workload capacity limit (where exhaustion must fail fast with `WorkflowAllowanceExhaustedError` or `ExecutionDeferredError`), not just an LLM stream throttle.
   - *Suggestion:* Remove the "slot lending" claim from Section 3.4(3) and Acceptance Proof #2. If LLM provider stream throttling is needed, name it separately from execution admission capacity, and clarify whether `maxDepth` counts all `ctx.call` frames or only workflow frames.

4. **Capability & Restriction Enforcement (`tools: "readonly"`)**
   - *Conflict:* Section 3.2 and Acceptance Proof #1 claim identical `"readonly"` tool enforcement whether the target is `AGENTS.md` or `<name>.ts`. However, arbitrary TypeScript in `<name>.ts` can still call `fs` or spawn processes directly.
   - *Suggestion:* Update Section 3.2 and Proof #1 to state what the kernel actually enforces for code targets:
     1. Propagates `tools: "readonly"` to all descendant prompt-backed calls.
     2. Narrows/disables bound mutation capabilities on `ctx` (e.g., `reviseTask`, `closeTask`, `applyTaskChanges`).
     3. Rejects code targets that do not explicitly declare compatibility with `readonly` execution.

5. **Missing Context Capabilities & Model Delegation Tool Scope**
   - *Conflict:* `AgentContext` in Section 3.2 omits Task-bound capabilities (`reviseTask`, `closeTask`, `applyTaskChanges`, `readCommunication`) and makes `workspace` non-optional (`readonly workspace: WorkflowWorkspace`). Also, Section 3.4 treats the LLM `agents` tool as a simple `ctx.call()` wrapper, whereas `manager-agents-tool.ts` also handles async task creation, inspection, fork, and cancel.
   - *Suggestion:*
     - Keep `workspace?: WorkflowWorkspace` optional and include the Task-bound capabilities on `AgentContext` (matching `WorkflowContext`).
     - Clarify that the LLM delegation tool uses `ctx.call()` for **synchronous bounded sub-calls**, while retaining its existing Host task management actions where configured.

### 8.3 Recommended Next Edits to the Document
To move this proposal from "Reviewed" to "Ready for Phase 1 Implementation":
1. **Fold Sections 6–8 into Sections 3, 4, and 5** so the TypeScript interfaces in Sections 3.2–3.3 and the Phased Plan in Section 4 reflect the agreed rules (no slot lending, owner-scoped resolution, split authored return vs. runner report, preserved `blocked(reason, facts)` signature).
2. **Decouple Phase 4's CLI additions** (`may run`, `may list`, `may inspect` and the `<5ms` claim) into an optional follow-up so they do not block core runtime and Hosted Task dispatch consolidation.

---

## 9. Review comments (Post-Refinement Implementation Details) — 2026-11-14

**Status:** Sections 1–5 are now well-aligned with Sections 6–8 and ready to guide Phase 1 implementation. Below are five concrete edge cases from the current runtime code to keep explicit as implementation begins:

### 9.1 Separate Hosted Task default timeouts and `maxAttemptMs` policy per target kind
In [`attempt-execution.ts`](../../../may-agent/src/app/core/tasks/attempt-execution.ts), prompt agents currently default to `APP_TASK_AGENT_TIMEOUT_MS` (15 minutes) while workflows default to `APP_TASK_WORKFLOW_TIMEOUT_MS` (30 minutes) and also clamp against `coordination.maxAttemptMs` and `module.executionTimeoutMs`.
- When collapsing `runTaskAgent` and `runTaskWorkflow` into `TaskTargetRunner`, preserve those per-kind default timeouts (or have `TaskTargetRunner.inspect(target)` return the resolved default timeout alongside `executionTimeoutMs`) so unifying the runner does not unintentionally halve workflow attempt timeouts or double prompt-agent attempt timeouts.

### 9.2 Preserve preflight settlement validation inside `TaskTargetRunner`
Currently, `runTaskAgent` passes a `validateResult` callback into `opts.agents.execute` that runs `preflightTaskChanges` and `validateTaskFinalSettlement` *during* the agent's `finish()` tool call (allowing the model to self-correct a rejected settlement before the session closes), whereas `runTaskWorkflow` normalizes the returned output *after* `runWorkflowDirect` returns.
- Ensure `TaskTargetRunner.execute` preserves in-turn `validateResult` preflight for prompt targets while running the same post-return normalization and `workflow-blocker-context` fact bounding (8 KB cap in [`executors/workflow.ts`](../../../may-agent/src/app/adapters/executors/workflow.ts)) for code targets.

### 9.3 Unify `WorkflowStepTrace.input` representation for structured `ctx.call` inputs
In [`workflow-kernel.ts`](../../../may-agent/packages/sdk/src/workflow-kernel.ts), `WorkflowStepTrace` currently records `prompt: string` (truncated to `MAX_PROMPT_CHARS = 2_000`). Now that `ctx.call(target, input, options)` accepts arbitrary structured `input: unknown` for both code targets and schema-backed prompt targets:
- Define how `WorkflowStepTrace` serializes non-string `input` into `prompt` (or add a bounded `input?: unknown` field alongside `prompt`) so `run.json` traces stay bounded and deterministic when `input` is an object.

### 9.4 Keep `ExecutionResult.kind` (`"agent" | "workflow"`) stable for existing callers
[`ExecutionResult`](../../../may-agent/packages/sdk/src/workflow.ts) and `ExecutionDeferredError.callerExecution` include `kind: "agent" | "workflow"`.
- Even though callers invoke everything via `ctx.call`, keep populating `result.kind` (`"agent"` for prompt targets, `"workflow"` for code targets) from the resolved target's adapter kind so existing telemetry, receipts, and tests inspecting `result.kind` remain 100% backward-compatible.

### 9.5 Define `callerOwner` switching on cross-owner `ctx.call("other-owner/proc", ...)`
Section 3.3 states that selecting `<owner>/<name>` never changes the enclosing Task's responsible `agent`, generation, attempt, workspace, or creator permissions, and that unqualified names resolve inside `callerOwner`'s local procedures first.
- Explicitly distinguish **Task authority owner** (`ctx.reconciliation.agent`, which never changes across nested calls) from **lexical catalog owner** (`callerOwner` for resolving relative short names inside `<owner>/<name>`): when `alex` calls `scout/ingest`, any unqualified `ctx.call("parse", ...)` inside `scout/ingest` should resolve relative to `scout`'s catalog while retaining `alex`'s Task authority and workspace scope.

---

## 10. Review comments (Final Pre-Implementation Check & Phase 0 Alignment) — 2026-11-14

**Status:** Sections 1–5 now cleanly integrate all feedback from Sections 6–9, and adding **Phase 0 (retiring dead `WorkflowGuard` / `Demand` and unused `"workflow"` tool entries first)** is a great call that removes unnecessary surface area before unifying the kernel.

Four small, practical implementation checks as Phase 0 / Phase 1 PRs land:

### 10.1 Delete `packages/sdk/src/workflow-guard.ts` completely in Phase 0
When removing `./workflow-guard` from `packages/sdk/package.json` and `packages/sdk/src/index.ts`, also delete `packages/sdk/src/workflow-guard.ts`, `test/fixtures/guards/`, and `guardsDir` / `sharedGuardsDir` plumbing in `src/app/adapters/executors/workflow.ts` (`appWorkflowRuntimePaths`) and `src/lib/workflow-tool.ts` (`loadGuards`, `emitAndCollectDemands`, `resolveDemands`) so no orphan files or dead helper functions remain.

### 10.2 Keep `ctx.call` runtime input check explicit when calling a Prompt Target with non-string input
Section 3.2 types `ctx.call(target: string, input: unknown, options?)` so one overload set covers both prompt and code targets, while Section 3.3(3) specifies that prompt targets accept `string` task prompts only.
- Make sure the prompt adapter validates `typeof input === "string" && input.trim().length > 0` before start and throws `WorkflowValidationError("step", ...)` (matching the existing `WorkflowValidationError` phase contract) if a caller accidentally passes an object or empty string to a prompt target.

### 10.3 Align `MAY_TEST_SHARDS=4 bun run ci` (from PR #450) as the verification gate across phases
Since PR #450 established native Bun file sharding (`bun run ci` with 16 local shards / `MAY_TEST_SHARDS=4` in CI and 4,393 cases), keep each phase's test additions inside the existing suite owners (`packages/sdk/src/workflow-kernel.test.ts`, `src/app/direct-workflow.test.ts`, `src/app/core/tasks/app-task-runtime.test.ts`) rather than spawning new slow standalone test files, so full-suite wall time stays within PR #450's budget.

### 10.4 Sync Host (`#510`) `session-recovery` simplification with `TaskTargetRunner`
Host PR #510 retired `claim.handoff` / `fallbackReason` plumbing (`attempt.previousAttempt` is now the single retry context channel). When implementing Phase 2 (`TaskTargetRunner` in `attempt-runner.ts` and `executors/{managed-agent,workflow}.ts`), build directly on the post-#510 `attempt.previousAttempt` contract without reintroducing `fallbackReason` or `claim.handoff` fields.

---

## 11. Review Comments (Environment Runtimes and Remaining Consolidation Work)

**Direction:** The architecture makes sense. Two execution environments sharing one bounded execution implementation is a sound design:

- **Host environment:** Owns durable Tasks, admission, recovery, workspaces, and persistence.
- **Standalone environment:** Supplies local models, workspaces, fixtures, and artifacts.
- **Shared kernel:** Owns invocation rules regardless of environment or prompt/code implementation.

This is compatible with the earlier "one runtime" goal. What matters is **one implementation of execution mechanics**, not whether the surrounding environments have different names.

### 11.1 Restore an explicit Standalone/Gym consolidation phase

This is the most important remaining gap. Sections 3.1, 3.5, and 5 promise one kernel and removal of `options.workflowTool`, `unconfirmedToolWorkflows`, and Gym's duplicate execution/evidence plumbing. But the updated phases do not explicitly deliver that:

- Phase 1 describes the SDK API/resolver work in PR #513.
- Phase 2 consolidates Hosted Task dispatch and model delegation.
- Phase 3 migrates callers and deletes aliases.

**PR #513 establishes useful plumbing; it does not finish unifying standalone prompt execution, Hosted prompt execution, and Gym.**

Add an explicit step—perhaps **Phase 1b: Converge bounded execution paths**—covering:

1. Root prompt and code calls enter the same invocation scope.
2. Both prompt adapters use shared completion/schema enforcement.
3. Nested delegation uses that scope's `ctx.call`.
4. Kernel-owned child tracking replaces manual cleanup arrays.
5. Gym consumes the replacement evidence before its adapter is retired.

Otherwise, the plan can finish while retaining the duplication it intends to eliminate.

### 11.2 Define `AgentInstance` or retain the existing `PreparedTarget` name

Sections 3.1 and 3.6 repeatedly reference an `AgentInstance`, but the actual contract defines `PreparedTarget`, not `AgentInstance`. It is unclear whether `AgentInstance` means an immutable prepared executable, a per-call invocation, or a new object wrapping `PreparedTarget`.

**Prefer retaining `PreparedTarget` and calling this the "shared target invocation kernel."** The proposal already distinguishes definitions from invocation scopes clearly; another name adds ambiguity.

If `AgentInstance` remains, explicitly equate it with the prepared executable and prohibit per-call mutable state on it.

### 11.3 Replace the wrapper prohibition with an ownership invariant

Sections 3.1 and 3.6 make the absence of a middle wrapper object sound like an architectural requirement. Another stateful orchestration layer would be undesirable, but a small function or reusable facade can improve dependency clarity without creating another authority.

Prefer this invariant:

> Both environments use the same bounded invocation implementation. Environment adapters bind capabilities and persistence; they do not independently implement validation, deadlines, child lifetime, or cleanup.

For example:

```text
Standalone composition ─┐
                       ├─ shared invocation → prompt/code adapter
Host composition ──────┘
```

Whether the entry point is a function or object is secondary.

### 11.4 Allow explicitly supplied Standalone reads without granting live Host authority

Section 3.6 says that calling `ctx.read` in Standalone mode fails explicitly. Standalone execution can legitimately have injected reads: fixture data, local snapshots, or a read-only service. Existing Direct tests already use supplied read capabilities and Task snapshots.

Prefer:

> Standalone execution has no implicit live Host authority. Unbound Host operations fail explicitly; supplied local reads and fixtures remain available.

Likewise, "zero Task state" should mean **no durable Task ownership**, not an inability to inspect a Task-shaped snapshot. Omitting `outputRoot` should disable **runtime-managed artifact writes**, not promise arbitrary trusted TypeScript performs zero disk I/O.

### 11.5 Separate the intended snapshot guarantee from Phase 1's implementation

The immutable, content-hashed definition guarantee is valuable, but stronger than merely retaining a map or selected source directory.

Specify that running invocations must not reread mutable instructions/configuration and silently adopt a later definition. Inspection and execution must also use the same pinned snapshot.

PR #513 preserves the selected prompt source, but that alone does not prove complete prompt/skill/config reload isolation. Keep this as an explicit remaining acceptance requirement rather than implying Phase 1 completed it.

### 11.6 Small wording corrections

- Independent per-root allowances prevent **cross-root allowance interference**, not all starvation; roots still share CPU, provider limits, and other resources.
- Label Sections 6–10 as **historical, non-normative review notes**. Several describe interfaces already replaced, so they should not compete with Sections 1–5.

**Recommendation:** Keep this direction, but restore an explicit Standalone/Gym execution-consolidation phase and clarify the naming. Those changes make the proposal describe a genuine simplification rather than merely renaming two execution stacks.




