# Design: Ops Gates (P61 — Evidence-Based Execution)

**Status**: Draft  
**Author**: Tech-Lead  
**References**: `agents/bob/workspace/brief-ops-gates.md`, `agents/bob/workspace/design-ops-gates.md`, P61 in `agents/shared/philosophy.md`  
**Target**: `src/lib/ops-gate.ts`, wrapped tools in `src/lib/tools/`

---

## 1. Problem Statement

Agents self-report success without verification. "I ran the test and it passed" may be a hallucination — the test was never run, or ran and failed but the agent didn't check the exit code. Documentation rules have ~48% compliance; code-enforced rules have ~100%.

**Goal**: Make it structurally impossible for a tool to return a "success" without verifiable evidence.

---

## 2. Core Concepts

### 2.1 OpsGate Interface

A generic wrapper that decorates any `AgentTool` with:

| Phase | Name | Purpose |
|-------|------|---------|
| **Pre** | Context Gate | Runs prerequisite checks before the action. If any check fails, the action is **blocked** and the tool returns a structured error — the underlying command never executes. |
| **Post** | Evidence Gate | After successful execution, produces a verifiable receipt (log path, hash, timestamp). This receipt is included in the tool's structured output. |
| **Audit** | Integrity Multiplier | Logs every gate invocation (pass/fail/skip) to a persistent audit log for downstream evaluation. |

### 2.2 Key Types

```typescript
/** Evidence receipt returned by every gated tool */
interface OpsReceipt {
  tool: string;               // e.g. "run_test", "git_commit"
  status: "PASS" | "FAIL" | "BLOCKED";
  timestamp: number;          // Date.now()
  evidence: Record<string, unknown>;  // tool-specific artifacts
  preChecks: CheckResult[];   // results of all context gates
}

interface CheckResult {
  name: string;               // e.g. "lint", "git-diff-check"
  passed: boolean;
  detail: string;             // stdout/stderr snippet on failure
}

/** Configuration for a single ops gate */
interface OpsGateConfig<TParams = unknown> {
  /** Pre-execution checks. All must pass for the action to proceed. */
  preChecks: PreCheck<TParams>[];
  /** Post-execution evidence extractor. */
  extractEvidence: (params: TParams, rawOutput: string, exitCode: number) => Record<string, unknown>;
}

type PreCheck<TParams = unknown> = (params: TParams, cwd: string) => Promise<CheckResult>;
```

### 2.3 The Wrapper Function

```typescript
/**
 * Wraps an existing AgentTool with OpsGate pre/post checks.
 * Returns a new AgentTool with identical name/schema but gated execution.
 */
function withOpsGate<TParams>(
  tool: AgentTool,
  config: OpsGateConfig<TParams>,
  options?: { auditLogPath?: string }
): AgentTool;
```

This is **not** a new tool — it's a decorator. The tool's `name`, `description`, and `parameters` schema stay identical. Only `execute` is wrapped.

---

## 3. Wrapped Tools

### 3.1 `run_test`

This is not an existing standalone tool — it will be a **new gated tool** that wraps a `bash` execution of the project's test command.

**Parameters**: `{ command?: string; timeout?: number }` (defaults to `npm test`)

**Context Gate (pre-checks)**:
- None required (tests should always be runnable). Could optionally check that `node_modules` exists.

**Evidence Gate (post-execution)**:
```typescript
{
  status: "PASS" | "FAIL",      // derived from exit code (0 = PASS)
  logPath: string,               // test output saved to .state/ops-logs/test-<ts>.log
  timestamp: number,
  exitCode: number,
  hash: string                   // sha256 of the log file content (tamper-evident)
}
```

**Key behavior**: The tool **always returns structured JSON**, even on failure. A test failure is NOT a tool error — it's a `status: "FAIL"` receipt. This prevents the agent from retrying endlessly or misinterpreting a bash error as "something went wrong with the tool."

### 3.2 `git_commit`

Wraps the `bash` execution of `git commit`.

**Parameters**: `{ message: string; files?: string[] }` (files defaults to staged files)

**Context Gate (pre-checks)**:
1. **`lint`**: Run `npm run lint` (or project-configured lint command). If exit code ≠ 0, **BLOCK** the commit. Return lint errors in `CheckResult.detail`.
2. **`git-diff-check`**: Run `git diff --cached --check`. If whitespace errors exist, **BLOCK**.
3. **`staged-files`**: Verify there are actually staged files (`git diff --cached --name-only`). Block if nothing staged.

**Evidence Gate (post-execution)**:
```typescript
{
  commitHash: string,            // from `git rev-parse HEAD`
  filesChanged: string[],        // from `git diff-tree --no-commit-id --name-only -r HEAD`
  timestamp: number,
  branch: string                 // from `git branch --show-current`
}
```

---

## 4. Execution Flow

```
Agent calls tool "git_commit" with { message: "fix: resolve race condition" }
  │
  ├─ 1. Context Gate: run pre-checks sequentially
  │     ├─ lint check       → PASS ✓
  │     ├─ git diff --check → PASS ✓
  │     └─ staged files     → PASS ✓
  │
  ├─ 2. Execute: git commit -m "fix: resolve race condition"
  │     └─ exit code 0
  │
  ├─ 3. Evidence Gate: extract post-execution artifacts
  │     └─ { commitHash: "abc123", filesChanged: [...], ... }
  │
  ├─ 4. Audit: append to .state/ops-audit.jsonl
  │     └─ { tool, status, timestamp, preChecks, evidence }
  │
  └─ 5. Return structured OpsReceipt as tool output
```

If pre-check fails:
```
Agent calls tool "git_commit" with { message: "wip" }
  │
  ├─ 1. Context Gate: run pre-checks
  │     ├─ lint check → FAIL ✗ (3 errors found)
  │     └─ (remaining checks skipped — fail-fast)
  │
  ├─ 2. Execute: SKIPPED (blocked by context gate)
  │
  ├─ 3. Audit: append BLOCKED entry
  │
  └─ 4. Return structured OpsReceipt with status "BLOCKED"
        { tool: "git_commit", status: "BLOCKED", preChecks: [...], evidence: {} }
```

---

## 5. Audit Log

All gate invocations are appended to `.state/ops-audit.jsonl` (one JSON object per line):

```jsonl
{"tool":"git_commit","status":"PASS","timestamp":1719000000,"preChecks":[...],"evidence":{"commitHash":"abc123"}}
{"tool":"run_test","status":"FAIL","timestamp":1719000060,"preChecks":[],"evidence":{"logPath":"...","exitCode":1}}
{"tool":"git_commit","status":"BLOCKED","timestamp":1719000120,"preChecks":[{"name":"lint","passed":false}],"evidence":{}}
```

The evaluator/QA agent can parse this log to:
- Verify claimed test passes against actual receipts.
- Detect hallucination patterns (agent says "tests pass" but no corresponding PASS receipt).
- Score integrity (ratio of verified vs unverified claims).

---

## 6. File Layout

```
src/lib/
├── ops-gate.ts              # OpsGate interface, withOpsGate wrapper, audit logging
├── tools/
│   ├── gated-test.ts        # run_test tool (new, gated from birth)
│   ├── gated-commit.ts      # git_commit tool (new, gated from birth)
│   └── coding.ts            # updated: optionally include gated tools
```

---

## 7. Integration Points

### 7.1 Tool Registration

Gated tools are standard `AgentTool` objects. They plug into `createCodingTools()` or agent definitions directly:

```typescript
// In agent definition or createCodingTools:
import { createGatedTestTool } from "./tools/gated-test.js";
import { createGatedCommitTool } from "./tools/gated-commit.js";

const tools = [
  ...createCodingTools(projectRoot),
  createGatedTestTool(projectRoot),
  createGatedCommitTool(projectRoot),
];
```

### 7.2 Output Format

The tool's `execute()` returns:
```typescript
{
  content: [{ type: "text", text: "/* human-readable summary */" }],
  details: receipt  // OpsReceipt — structured, parseable by evaluator
}
```

This follows the existing pattern used by `bash.ts` (which returns `details: BashToolDetails`) and `health.ts` (which returns `details: HealthReport`).

### 7.3 Downstream Consumption

- **Evaluator**: Can cross-reference agent claims ("Tests pass") against `ops-audit.jsonl`.
- **QA Agent**: Can require `OpsReceipt` in handoff artifacts.
- **Integrity Multiplier**: A cron job or eval hook that counts `BLOCKED` + `FAIL` events and escalates if `hallucination_count > 3`.

---

## 8. Design Decisions

| Decision | Rationale |
|----------|-----------|
| Decorator pattern (not subclass) | Keeps existing tool code untouched. Gates are composable and removable. |
| Fail-fast on pre-checks | No point running lint if staged-files check fails. Sequential execution, stop on first failure. |
| Test FAIL is not a tool error | A failing test is valuable information, not an error. The tool succeeds; the evidence says FAIL. This prevents retry loops. |
| JSONL audit log (not DB) | Simple, appendable, grep-friendly. No dependencies. Matches the `.state/` convention. |
| New tools, not bash wrappers | `run_test` and `git_commit` are first-class tools with their own schemas, not "bash commands the agent happens to type." This gives us type-safe params and structured output. |
| sha256 hash on test logs | Tamper-evident. The log file can be verified against the hash in the receipt. |

---

## 9. Scope & Non-Goals

**In scope**:
- `OpsGate` interface and `withOpsGate` wrapper in `ops-gate.ts`
- `run_test` gated tool
- `git_commit` gated tool
- JSONL audit log

**Not in scope (future)**:
- Integrity Multiplier scoring (evaluator integration) — separate task
- Hallucination detection automation — needs eval infrastructure
- Gating other tools (deploy, publish) — same pattern, later
- UI for audit log — just a file for now

---

## 10. Acceptance Criteria

1. `run_test` tool returns structured `OpsReceipt` with `status`, `logPath`, `timestamp`, `hash`.
2. `git_commit` tool blocks if `lint` fails, returns structured error with lint output.
3. `git_commit` tool returns `OpsReceipt` with `commitHash`, `filesChanged` on success.
4. All gate invocations are logged to `.state/ops-audit.jsonl`.
5. Both tools follow existing `AgentTool` interface — no changes to core.
6. Unit tests for: pre-check failure blocking, evidence extraction, audit log append.
