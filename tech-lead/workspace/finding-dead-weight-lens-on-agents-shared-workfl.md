# Dead Weight: `agents/shared/workflows/project.ts` (878 lines)

## Summary
The file's bulk comes from **massive copy-paste duplication** between the comment-iteration path and the reviewer-phase path. ~150 lines of eval-gate/false-done/milestone-override logic are duplicated nearly verbatim. Legacy branching adds another ~50 lines of `if/else` scattered throughout. There's also a likely runtime bug where `score` is referenced in an outer scope where it's undefined.

## Findings

### 1. CRITICAL — Duplicated eval-gate logic (~150 lines extractable)
**Severity: High (size + maintenance risk)**

The "DONE" handling sequence (run evaluator → check score → false-done loop → milestone override → mark complete) appears twice:
- **Comment iteration**: `project.ts:555-615`
- **Reviewer phase**: `project.ts:738-810`

The "BLOCKED" handling (run evaluator → journal entry → update status) also appears twice:
- **Comment iteration**: `project.ts:618-642`
- **Reviewer phase**: `project.ts:820-840`

These blocks are structurally identical — same variables, same logic, same thresholds. They differ only in minor legacy-branch details. A single `handleDoneDecision()` and `handleBlockedDecision()` helper would eliminate ~150 lines.

### 2. MEDIUM — Legacy branching scattered throughout (~50 lines)
**Severity: Medium**

`if (config.isLegacy)` / `if (!config.isLegacy)` branches appear for every journal write operation. Examples at `project.ts:544-548`, `project.ts:663-666`, `project.ts:709-715`, `project.ts:725-728`, `project.ts:751-756`, `project.ts:787-792`, `project.ts:826-830`. 

Extracting a `writeJournal(config, projectContent, entry)` helper that encapsulates the legacy check would eliminate all these branches.

### 3. MEDIUM — `writeFileSync` called 35 times with no abstraction
**Severity: Medium (readability)**

`writeFileSync(config.projectPath, projectContent, "utf-8")` appears 35 times (see grep output). A `saveProject(config, content)` one-liner would reduce noise and provide a single point for future concerns (e.g., fsync, logging).

### 4. LOW-BUG — `score` referenced where undefined
**Severity: Low (potential runtime error)**

At `project.ts:853`, inside the CONTINUE/auto-escalate branch:
```ts
emitProjectEvent(ctx, config, "project.blocked", { iteration, health: score, reason: ... });
```
`score` is only defined inside the `decision.status === "done"` block (`project.ts:745`) and `decision.status === "blocked"` block (`project.ts:823`). In the CONTINUE branch, `score` is undefined — this would emit `health: undefined` rather than crash (JS), but it's clearly unintended.

### 5. LOW — `parseMetrics` is a niche feature adding ~15 lines
**Severity: Low**

`parseMetrics` (`project.ts:218-226`) is only called once, at `project.ts:402`, inside `buildEvalPrompt`. It parses a `## Metrics` section that few projects likely use. Not dead code, but a candidate for removal if unused in practice.

### 6. LOW — `checkOffMilestones` fuzzy matching is fragile
**Severity: Low (correctness risk)**

`project.ts:207-216`: Milestones are checked off by matching the first 30 characters case-insensitively against reviewer text. This is prone to false positives (short milestone names matching incidental text) and false negatives (reviewer paraphrasing).

## Recommended Actions (for separate fix sessions)

1. **Extract `handleDoneDecision()` and `handleBlockedDecision()`** — biggest win, ~150 lines removed
2. **Extract `writeJournal()` helper** — eliminates legacy branching duplication
3. **Extract `saveProject()` helper** — reduces 35 call sites to readable one-liners  
4. **Fix `score` reference in CONTINUE branch** at `project.ts:853` — use `0` or remove from event
5. Consider whether `parseMetrics` and `## Metrics` support is actively used

## Comparison with verify-wrap.ts (183 lines)
`verify-wrap.ts` demonstrates the target pattern: clean phase separation, extracted helpers (`extractWrittenFiles`, `verifyFile`), no duplication. The project workflow would benefit from similar structural discipline — extract the repeated eval-gate pattern into a reusable function, just as verify-wrap extracted file verification into `verifyFile()`.
