# Brief: Path Hallucination Guard (beforeToolCall hook)

**Date:** 2026-03-29
**Author:** Bob (infra review)
**Priority:** P1 — #1 current failure mode (16/31 failure chain triggers since Mar 28)
**Common-Sense Item:** C50 (Environment Reality)

## 1. Problem

PATH_HALLUCINATION is the **#1 operational failure mode** as of 2026-03-29, replacing FM-3.3 (Verification Gap) which was successfully reduced by Gate 2 in finish-guard. Optimizer and Coder generate commands targeting nonexistent paths:

- `/home/coder/...` (4 occurrences)
- `/home/user/...` (3 occurrences)  
- `/Users/...` (occasional)
- `/var/tmp/repos/oss-arch/...` (optimizer-specific)

C50 already says: "The filesystem root is `/app`. Do NOT use `/Users/`, `/home/`, or `~`." But agents ignore this — prompting alone is insufficient. The PIVOT guard only fires *after* repeated identical failures, wasting 2-3 ops per occurrence.

## 2. Existing Infrastructure

- **PIVOT REQUIRED** (manager-receipts.ts): Fires after `TOOL_PIVOT_LIMIT` (3) identical failures. Reactive, not preventive.
- **Path Assumption Guard** (per Coach audit): Catches some violations but doesn't block proactively.
- **normalizeForP53** (security.ts): Strips obfuscation from paths but doesn't check for hallucinated paths.
- **Empty Args Guard**: Blocks `bash({})` but not `bash({command: "cd /home/user"})`.

## 3. Proposed Solution

A new `createPathHallucinationGuard()` in `src/lib/tools/path-hallucination-guard.ts` that intercepts `bash`, `read`, `edit`, and `write` tool calls **before execution** and blocks those targeting known-bad paths.

### Blocked Path Patterns
```typescript
const HALLUCINATED_PATHS = [
  /\/home\/\w+/,          // /home/user, /home/coder, etc.
  /\/Users\/\w+/,         // macOS-style paths
  /~\//,                  // Home directory shortcut
  /\/var\/tmp\/repos\//,  // Optimizer-specific hallucination
];
```

### Behavior
- **For `bash`**: Scan the `command` argument for any HALLUCINATED_PATHS match.
- **For `read`/`edit`/`write`**: Scan the `path` argument.
- **On match**: Return `{ block: true, reason: "🚫 PATH_HALLUCINATION: ..." }` with a helpful message reminding the agent that the filesystem root is `/app` and suggesting `pwd` or `ls` to discover paths.
- **Exception**: If the command is read-only discovery (e.g., `ls /home` to check if it exists), consider allowing — but blocking is safer since we know these paths don't exist.

### Wire-up
Add to `composeGuards(...)` in manager.ts alongside existing guards:
```typescript
composeGuards(
  createEmptyArgsGuard(),
  createPathHallucinationGuard(),  // NEW — before finish guard
  createFinishGuard(),
  createReadDedupGuard(),
  createSessionReadGuard(),
  createScrapeDedupGuard(),
)
```

## 4. Expected Impact

- **Prevents**: 16+ wasted ops/day from path hallucination failures
- **Prevents**: Cascading failure chains where a bad path leads to 3+ retries before PIVOT fires
- **Cost**: ~60 lines of code, stateless guard, negligible runtime overhead
- **Risk**: Low — false positives only possible if a legitimate path matches the patterns, which shouldn't happen since `/home/` and `/Users/` genuinely don't exist in this environment

## 5. Implementation Steps (Tech-Lead)

1. Create `src/lib/tools/path-hallucination-guard.ts` following the pattern of `empty-args-guard.ts`
2. Export `createPathHallucinationGuard` function
3. Wire into `composeGuards()` in `src/lib/manager.ts` (2 call sites, lines ~1071 and ~1404)
4. Add to imports at top of manager.ts
5. Run `npx tsc --noEmit` to verify clean compile
6. Test: `bash({command: "ls /home/user"})` should be blocked with helpful message

## 6. Relationship to Common-Sense

This is the **infra enforcement mechanism** for C50 (Environment Reality). Same pattern as:
- Gate 2 enforces C1.7 (Success Requires Evidence)
- Gate 3 enforces C1.8 (Match finish status to reality)
- Empty Args Guard enforces "provide required arguments"

**Ownership update:** C50 can be annotated as "partially enforced by infra" → "fully enforced by infra" once this guard ships.
