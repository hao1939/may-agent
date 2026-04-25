# Brief: Implement Unified Guard Architecture ("Hard Constraints")

**Status**: Request
**Target**: Tech-Lead
**Priority**: P0 (Safety/Reliability)

## Context
We have identified three critical failure modes that cannot be solved by prompts alone:
1.  **FM-3.3 (Verification Gap)**: Agents claim success without running verification tools.
2.  **Path Hallucination**: Agents try to read `/Users/` or `/home/` (FM-2.1).
3.  **P78 (Supply Chain)**: Agents load malicious skills (addressed in previous brief, but fits here).

Current guards (`finish-guard.ts`, `read-dedup-guard.ts`) are ad-hoc. We need a standardized **Middleware Pattern** to enforce these constraints systemically.

## Task
Refactor `src/lib/manager.ts` to support a `Guard` interface and implement the first two critical guards.

## 1. The Interface
Create `src/lib/guards/types.ts`:
```typescript
export type GuardContext = {
  agent: string;
  sessionId: string;
  history: any[]; // AgentMessage[]
  workspace: string;
};

export interface Guard {
  name: string;
  // Pre-execution check: Can block or modify args
  onInput?: (
    tool: string,
    args: any,
    context: GuardContext
  ) => Promise<{ allowed: boolean; reason?: string; modifiedArgs?: any }>;
  
  // Post-execution check: Can modify result
  onOutput?: (
    tool: string,
    args: any,
    result: any,
    context: GuardContext
  ) => Promise<{ modifiedResult?: any }>;
}
```

## 2. The Guards

### A. `EnvironmentGuard` (Path Safety)
-   **Intercepts**: `read`, `write`, `edit`, `bash`.
-   **Logic**:
    -   Reject any arg containing `/Users/`, `/home/`, `~`.
    -   Reject `bash` commands containing `sudo`, `rm -rf /` (basic sanitization).
-   **Error**: "GUARD BLOCK: Invalid path or command. Root is /app. Do not use absolute user paths."

### B. `VerificationGuard` (FM-3.3)
-   **State**: Needs to track "verified files" in memory (or a lightweight `.state/verified.json`).
-   **Logic**:
    -   `onInput`: If tool is `read` or `bash` (grep/ls/test), add the target file to `verified_files`.
    -   `onInput`: If tool is `finish(status='success')`:
        -   Check `args.deliverables`.
        -   If any deliverable is NOT in `verified_files`, return `{ allowed: false, reason: "GUARD BLOCK: You claimed deliverable X but have not verified it..." }`.

## 3. Integration
-   Modify `src/lib/manager.ts` (or `tool-runner.ts`) to iterate through a list of active guards before/after every tool call.

## Deliverables
1.  `src/lib/guards/` directory with interface and 2 implementations.
2.  `src/lib/manager.ts` updated to use them.
3.  `test/guards/` ensuring they block correctly.
