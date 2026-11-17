# Proposal: `@may-agent/sdk` Boundary Hardening, Kernel Polish, and Subpath Governance

**Supports:** [May-Agent SDK](../2a-design/sdk.md), [Host and App Boundary](../2a-design/system-boundary.md), and [Unified Agent and Workflow Invocation](unified-agent-instance-runtime.md).

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource) (*"One authority for each resource"*, *"Simple first"*, *"Apps own meaning; Host owns mechanics"*).

**Design status:** Implemented (2026-11-15) across `may-agent` PRs #542, #546, #555, and #558 (`G1`–`G6` complete).

---

## 1. Decision Summary

Following the consolidation of the unified invocation kernel and standalone runtime into `@may-agent/sdk` (Host PRs #512–#520 and #533–#542), `@may-agent/sdk` now serves **two distinct roles** inside one package (`14,674 LOC` across `src/` and `src/runtime/`):

1. **Authoring & Testing Contracts (App-facing):** `@may-agent/sdk`, `@may-agent/sdk/app`, `@may-agent/sdk/task`, `@may-agent/sdk/testing`, and `@may-agent/sdk/standalone` (used by Gym and standalone scripts).
2. **Host-Internal Execution Primitives:** `@may-agent/sdk/runtime` (exporting `bash`/`edit`/`write` tools, `cli-agent`, environment-agnostic `agent-execution`, `runtime-import`, and `skills` to `src/`).

To keep this boundary rock-solid and prevent App workflows from coupling to Host-internal runtime mechanics, **adopt a 4-part hardening pass on `@may-agent/sdk`**:

1. **Fence Subpath Visibility (`./runtime` vs. App-facing subpaths):** Enforce in `check-canonical-app-boundary.ts` and `check-canonical-agent-app.ts` that `projects/*.app` may import only `@may-agent/sdk`, `/app`, `/task`, `/testing`, and `/standalone`—never `@may-agent/sdk/runtime` (while keeping `runtime-import.ts` deliberately excluding `/runtime` from dynamic workflow resolution). Eliminate the 4 remaining relative deep imports (`../../packages/sdk/src/...` and `../../../packages/sdk/src/...`) in Host `src/lib/`.
2. **Harden `workflow-kernel.ts` Invocation Edge Cases:** Make `ctx.call` input preview serialization exception-safe (`safePromptPreview` inside the async tracked promise so `BigInt` or circular inputs cannot throw synchronously outside `.catch()`), deduplicate the double target resolution (`resolveTargetKind` + `callTarget`) per step, and replace the stale `"agents.call / workflows.run"` validation error string with `"ctx.call"`.
3. **Complete Legacy Test-Shim Retirement in `@may-agent/sdk/testing`:** Add root `outputSchema` / `skill` forwarding to `runTargetTest("target", options)`, migrate the remaining `callAgent` / `agents` / `workflows` test callers in `projects/*.app` onto `call` / `mocks`, and delete `ScriptedAgentFixture`, `ScriptedWorkflowFixture`, `options.agents`, `options.workflows`, `options.callAgent`, and `options.runWorkflow` from `testing.ts`.
4. **Extend `.d.ts` Contract Snapshot Coverage:** Extend `packages/sdk/src/index.test.ts` to verify declaration snapshots (or clean public compile checks) for `/standalone` and `/testing` alongside the root `.` export so breaking changes on public subpaths are caught automatically in CI.

> **Tradeoff Decision Note:**  
> Choose **keeping `@may-agent/sdk` as a single workspace package with mechanically enforced App-vs-Host subpath rules** over **splitting `packages/sdk/src/runtime/` into a separate `@may-agent/runtime` workspace package right now** because `/standalone` and `/testing` share the exact same kernel types and local `file:` bundle distribution (`/app/projects/may-agent/bundle/sdk-current`) without cross-package version skew. Reconsider splitting into two packages only if external third-party Apps install `@may-agent/sdk` from npm and require a zero-Pi-dependency install footprint.

---

## 2. Current State Assessment (`may-agent` @ `ee319ab112`)

### 2.1 What Is Already Solid
- **Single Authoring Vocabulary:** `WorkflowContext` (`AgentContext`) exposes one delegation method (`ctx.call(target, input, options)`), one result envelope (`ExecutionResult<T>`), and clean Task settlement proposals (`TaskReconcileResult`). Legacy `ctx.agents.call`, `ctx.workflows.run`, and `WorkflowGuard` are retired.
- **High-Integrity Portable Kernel (`workflow-kernel.ts`, 1,282 LOC):**
  - Clean separation between pre-start rejections (`started: false`) and started failures (`started: true`).
  - Sticky `tools: "readonly"` narrowing that rejects non-`readonly` code procedures pre-start and omits Task mutation capabilities (`reviseTask`, `closeTask`, `applyTaskChanges`).
  - Structured child join (`Promise.allSettled([...activeOperations])`), `AbortController` propagation, `onEvent` auto-unsubscription, post-completion context fencing, and unswallowable descendant `cleanup.confirmed` tainting.
- **Self-Contained Standalone Entrypoint (`@may-agent/sdk/standalone`):** Gym and CLI (`may run`, `may list`) invoke prompt agents, code procedures, and native CLI executors (`codex`, `claude`) without importing Host SQLite, `EventBus`, or `SubagentManager`.

### 2.2 Concrete Gaps Identified in Audit

| # | Area | Exact Location | Issue & Risk |
| :--- | :--- | :--- | :--- |
| **G1** | **Subpath Boundary Leak** | `packages/sdk/package.json` (`"./runtime"`), `packages/sdk/src/runtime/index.ts` | `@may-agent/sdk/runtime` exports raw filesystem/process tools (`createCodingTools`, `drainBashProcessGroup`, `runCliAgent`, `importRuntimeModule`) as a public package export. Today `runtime-import.ts:217` blocks `/runtime` in bundled workflows, **but** native Bun dev mode and `tsconfig` (`@may-agent/sdk/*`) allow App source files to import `@may-agent/sdk/runtime` directly unless checked by boundary gates. |
| **G2** | **Deep Relative SDK Imports in Host** | `src/lib/manager-agents-tool.ts:28`<br>`src/lib/workflow-tool.ts:13`<br>`src/lib/task-execution-context.ts:2`<br>`src/lib/tools/run-cli-agent.ts:5` | Four Host files still bypass package exports via `../../packages/sdk/src/workflow-kernel.js` and `../../packages/sdk/src/event.js` instead of importing from `@may-agent/sdk` / `@may-agent/sdk/runtime`. |
| **G3** | **Synchronous Throw in `ctx.call`** | `packages/sdk/src/workflow-kernel.ts:942` (`JSON.stringify(input ?? null)`) & `testing.ts:539` | `callOverload` runs `JSON.stringify(input)` synchronously **outside** `try/catch` before constructing the returned `Promise`. Passing an input with a `BigInt`, circular reference, or throwing `toJSON()` throws synchronously instead of returning a rejected `Promise`, bypassing `await`/`Promise.allSettled` and `recordStep` tracing. |
| **G4** | **Double Target Lookup & Stale Diagnostic** | `packages/sdk/src/workflow-kernel.ts:751, 945–953` | 1) Line 751 still formats invalid target errors as `"agents.call / workflows.run called with invalid ..."`.<br>2) Every `ctx.call(...)` invokes `await bindings.resolveTargetKind(target, input)` and then `bindings.callTarget(target, input, ...)`, causing both Standalone and Hosted runners to resolve the target twice per call. |
| **G5** | **Residual Legacy Shims in `testing.ts`** | `packages/sdk/src/testing.ts:147–178, 260–315` | `WorkflowContext` dropped `ctx.agents` / `ctx.workflows`, but `testing.ts` still carries `callAgent`, `runWorkflow`, `options.agents`, `options.workflows`, `ScriptedAgentFixture`, and `ScriptedWorkflowFixture` (~110 LOC). Also, `runTargetTest("target", options)` does not yet accept `outputSchema` or `skill` on `WorkflowTestOptions` to match `run(target, input, options)`. |
| **G6** | **Partial Declaration Snapshot Gate** | `packages/sdk/src/index.test.ts` | Snapshot test verifies `src/index.d.ts` only; accidental type regressions or internal symbol leaks on `@may-agent/sdk/testing` or `@may-agent/sdk/standalone` are not snapshot-checked. |

---

## 3. Proposed Design & Changes

### 3.1 Subpath Architecture & Mechanical Boundary Rules

Define the exact audience and contract stability of each `@may-agent/sdk` subpath:

| Subpath | Audience | Allowed Importers | Contract Responsibility |
| :--- | :--- | :--- | :--- |
| `@may-agent/sdk` (`.`) | **Apps & Workflows** | `projects/*.app`, `projects/gym`, Host `src/` | Canonical App declarations, `WorkflowContext` / `AgentContext`, `ExecutionResult`, Task schemas, Observer & Approval contracts. **Zero runtime I/O.** |
| `@may-agent/sdk/app`<br>`@may-agent/sdk/task` | **Apps & Workflows** | `projects/*.app`, Host `src/` | Focused type/schema subsets of root `.`. **Zero runtime I/O.** |
| `@may-agent/sdk/testing` | **App & Host Tests** | `**/*.test.ts`, `**/*.fixture.ts` | `runTargetTest` (`runWorkflowTest`), `createTestAppWorkflowContext`, `createTestAppRead`—portable in-memory kernel harness (`0` disk/DB). |
| `@may-agent/sdk/standalone` | **Gym, CLI, Standalone Scripts** | `projects/gym`, `standalone-cli.ts`, benchmark scripts | `run(target, input, options)`, `listTargets()`, `createModelRegistry()`. Never imported inside authored App `app.ts`, `watchers/`, or `workflows/*.ts`. |
| `@may-agent/sdk/runtime` | **Host-Internal Only** | Host `src/**` and Host `test/**` **only** | Internal execution primitives shared between `@may-agent/sdk/standalone` and Host daemon (`agent-execution`, `cli-agent`, coding tools, `workflow-kernel` bindings). **Forbidden in `projects/*.app` and `projects/gym`.** |

**Mechanical enforcement:**
1. Update `scripts/check-canonical-app-boundary.ts` (in `may-agent`) and `scripts/check-canonical-agent-app.ts` (in `/app`) to reject:
   - Any import of `@may-agent/sdk/runtime` outside `may-agent/{src,test,packages}` (specifically rejecting it in `projects/*.app` and `projects/gym`).
   - Any import of `@may-agent/sdk/standalone` inside App runtime declarations (`app.ts`, `watchers/**`, `agents/**/workflows/*.ts` excluding `*.test.ts`).
   - Any relative cross-package import matching `packages/sdk/src/` from `src/` or `test/`.
2. Re-export `EventTrace` from `@may-agent/sdk` (or `@may-agent/sdk/runtime`) and `workflow-kernel.ts` primitives from `@may-agent/sdk/runtime` so `src/lib/manager-agents-tool.ts`, `src/lib/workflow-tool.ts`, `src/lib/task-execution-context.ts`, and `src/lib/tools/run-cli-agent.ts` use `@may-agent/sdk` / `@may-agent/sdk/runtime` with zero `packages/sdk/src/` deep relative imports.

---

### 3.2 Kernel Hardening (`packages/sdk/src/workflow-kernel.ts`)

1. **Exception-Safe Step Preview & Async Promise Wrapping (`G3`):**
   Move `safePromptPreview(input)` inside the `async` `trackOperation` body in `callOverload`:
   ```ts
   function safePromptPreview(input: unknown): string {
     if (typeof input === "string") return input;
     try {
       return JSON.stringify(input ?? null) ?? "null";
     } catch {
       return String(input);
     }
   }
   ```
   Any failure after `ctx.call(...)` is invoked is guaranteed to reject asynchronously on the returned `Promise` and record a `WorkflowStepTrace` entry rather than throwing synchronously on the caller stack.

2. **Single-Pass Target Classification + Dispatch (`G4`):**
   Allow `bindings.resolveTargetKind` to cache or pass the resolved target into `callTarget`—or let `standalone.ts` and `workflow-tool.ts` memoize the resolved callable across `resolveTargetKind` and `callTarget` within a single step—so Hosted and Standalone adapters resolve `(callerOwner, target)` **once** per `ctx.call` instead of twice. Update line 751's error message to:
   ```ts
   `ctx.call invoked with invalid target name: ${JSON.stringify(target)}`
   ```

---

### 3.3 Clean Up `@may-agent/sdk/testing` (`G5`)

1. **Symmetry on `WorkflowTestOptions`:**
   Add `outputSchema?: TSchema` and `skill?: string` to `WorkflowTestOptions<TInput>` so `runTargetTest("reviewer", { input: "Check HEAD", skill: "review", outputSchema: MySchema, mocks: { ... } })` exercises the exact same root caller options as `run("reviewer", "Check HEAD", { skill, outputSchema })`.
2. **Retire Phase 1–2 Shims After Migrating App Tests:**
   - Migrate the remaining `callAgent:` usages in `/app/projects/{may.app,alex.app,scout-knowledge-lib.app}` to `call:`.
   - Delete `callAgent` and `runWorkflow` from `TestAppWorkflowContextOptions`.
   - Delete `agents`, `workflows`, `ScriptedAgentFixture`, `ScriptedAgentCallContext`, `ScriptedWorkflowFixture`, and `ScriptedWorkflowCallContext` from `testing.ts`, leaving **`mocks: Record<string, ScriptedTargetFixture>`** as the single fixture table.

---

### 3.4 Public Subpath `.d.ts` Contract Gate (`G6`)

Extend `packages/sdk/src/index.test.ts` so the `tsc --emitDeclarationOnly` pass also snapshots `test/fixtures/sdk-testing.d.ts.snap` and `test/fixtures/sdk-standalone.d.ts.snap` (keeping `@may-agent/sdk/runtime` unconstrained by public snapshots since it is Host-internal).

---

## 4. Phased Implementation Plan

### Phase 1: Kernel Hardening, `runTargetTest` Symmetry & Boundary Gate (`may-agent`)
- **Files:** `packages/sdk/src/workflow-kernel.ts`, `packages/sdk/src/workflow-kernel.test.ts`, `packages/sdk/src/testing.ts`, `packages/sdk/src/index.test.ts`, `packages/sdk/src/runtime/index.ts`, `packages/sdk/src/runtime/app/standalone.ts`, `src/lib/{manager-agents-tool,workflow-tool,task-execution-context}.ts`, `src/lib/tools/run-cli-agent.ts`, `scripts/check-canonical-app-boundary.ts`.
- **Changes:**
  1. Add `safePromptPreview(input)` inside `callOverload`'s async block and update the invalid-target error message to `ctx.call`.
  2. Eliminate double `resolveCallable` lookup per step across `workflow-kernel.ts`, `standalone.ts`, and `workflow-tool.ts`.
  3. Add root `outputSchema` and `skill` support to `WorkflowTestOptions` / `runTargetTest` in `packages/sdk/src/testing.ts`.
  4. Replace the 4 `../../packages/sdk/src/...` relative imports in `src/lib/` with `@may-agent/sdk` / `@may-agent/sdk/runtime` exports, and forbid `packages/sdk/src/` deep relative imports + App `@may-agent/sdk/runtime` imports in `check-canonical-app-boundary.ts`.
- **Verification:** Focused unit tests + `tsc --noEmit` + `eslint` + `check-canonical-app-boundary.ts` pass, including new kernel unit tests for `BigInt` / circular `ctx.call` inputs, single-resolution spy count, and `runTargetTest` root `outputSchema` / `skill`.

### Phase 2: Testing Surface Cleanup & Subpath Snapshots (`may-agent` + `/app`)
- **Files:** `packages/sdk/src/testing.ts`, `packages/sdk/src/index.test.ts`, `test/fixtures/sdk-*.d.ts.snap`, `/app/projects/may.app/**/*.test.ts`, `/app/scripts/check-canonical-agent-app.ts`.
- **Changes:**
  1. Add `outputSchema` and `skill` support to `WorkflowTestOptions` / `runTargetTest`.
  2. Refresh `/app/projects/may-agent/bundle/sdk-current`, migrate `callAgent` -> `call` in `may.app` tests, and enforce the `@may-agent/sdk/runtime` ban in `/app/scripts/check-canonical-agent-app.ts`.
  3. Remove `options.agents`, `options.workflows`, `options.callAgent`, and `options.runWorkflow` from `packages/sdk/src/testing.ts`, and add `.d.ts` snapshots for `/testing` and `/standalone`.
- **Verification:** Full `may-agent` CI (`MAY_TEST_SHARDS=4 bun run ci`) and `/app` verification (`bun run check:may-design && bun test`) pass with zero legacy test shims remaining.

---

## 5. Acceptance Criteria

1. **Zero Deep Imports & Enforced Subpath Fence:** `rg "packages/sdk/src" src/ test/` returns `0` matches in `may-agent`, and `check-canonical-app-boundary` / `check-canonical-agent-app` fail if an App imports `@may-agent/sdk/runtime` or if a workflow imports `@may-agent/sdk/standalone`.
2. **Async-Safe `ctx.call`:** Calling `ctx.call("target", { value: 1n })` or a circular object never throws synchronously; it rejects cleanly on the returned `Promise` and records the step trace.
3. **Single Resolution Per Call:** Calling `ctx.call("owner/proc", input)` invokes target resolution once (not twice).
4. **One Testing Fixture Surface:** `runTargetTest` / `runWorkflowTest` uses `mocks` exclusively, supports root `outputSchema` and `skill`, and `.d.ts` snapshots guard `.`, `/testing`, and `/standalone`.
