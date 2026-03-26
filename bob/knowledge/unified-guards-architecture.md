# Unified Guard Architecture: "Hard Constraints" Middleware

## 1. Problem Statement
Agents currently fail FM-3.3 (Verification Gap) and C26 (Claim-as-Record) because verification is a "soft" instruction in the system prompt.
-   Agents "forget" to verify.
-   Agents "hallucinate" verification (claiming they did it without tool output).
-   Agents "drift" into prohibited paths (`/Users/`) or dangerous actions.

Current ad-hoc guards (`finish-guard.ts`, `read-dedup-guard.ts`) are scattered and inconsistent. We need a unified **Middleware Pattern** to enforce constraints *systemically*.

## 2. Solution: The `Guard` Interface

We will refactor `src/lib/manager.ts` to use a standardized `Guard` interface. A Guard intercepts tool inputs/outputs and can:
1.  **Block**: Prevent execution (e.g., `path-assumption-guard` blocking `/Users/`).
2.  **Transform**: Modify args (e.g., `read-dedup-guard` stripping redundant reads).
3.  **Monitor**: Track state for later enforcement (e.g., `verification-guard` tracking "did I run a verification command?").

### Interface Definition
```typescript
type GuardContext = {
  agent: string;
  sessionId: string;
  history: AgentMessage[];
  workspace: string;
};

interface Guard {
  name: string;
  // Pre-execution check
  onInput?: (
    tool: string,
    args: any,
    context: GuardContext
  ) => Promise<{ allowed: boolean; reason?: string; modifiedArgs?: any }>;
  
  // Post-execution check
  onOutput?: (
    tool: string,
    args: any,
    result: any,
    context: GuardContext
  ) => Promise<{ modifiedResult?: any }>;
}
```

## 3. New Guards to Implement

### A. `VerificationGuard` (The Fix for FM-3.3)
**Logic**:
-   **Track**: Maintain a set of `verified_files` in session state.
-   **Update**: When `bash`, `read`, or `grep` is called, add targeted files to `verified_files`.
-   **Enforce**: When `finish(status='success')` is called:
    -   Scan `deliverables` in the finish args.
    -   If a deliverable path is NOT in `verified_files`, **BLOCK** the finish call.
    -   **Error Message**: "GUARD BLOCK: You claimed deliverable 'X' but have not verified it in this session (no read/grep/ls/test detected). Run a verification tool on 'X' then try again."

### B. `EnvironmentGuard` (The Fix for Path Hallucination)
**Logic**:
-   **Intercept**: All `bash`, `read`, `write`, `edit` calls.
-   **Check**: Does any arg contain `/Users/`, `/home/`, `~`, or starts with `./` (ambiguous)?
-   **Enforce**: Block execution.
-   **Error Message**: "GUARD BLOCK: Path '/Users/...' is invalid. Root is '/app'. Use relative paths or '/app/'."

## 4. Implementation Plan (Tech-Lead)

1.  **Refactor**: Create `src/lib/guards/` directory. Move existing guards (`src/lib/tools/*-guard.ts`) into it and adapt to the `Guard` interface.
2.  **Implement**: Create `VerificationGuard` and `EnvironmentGuard`.
3.  **Integrate**: Update `manager.ts` to load these guards into the tool execution pipeline.
4.  **Test**: Add unit tests in `test/guards/` to ensure they block correctly.

## 5. Success Criteria
-   `finish()` fails if I write a file but don't read it back.
-   `read('/Users/jk/...')` fails immediately with a helpful error.
-   Existing guards (`read-dedup`, etc.) continue to work.
