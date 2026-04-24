# Fragility Lens: agents/shared/workflows/

## Ranked Fragility Scores

| File | Lines | Fragility Score | Key Risk |
|------|-------|----------------|----------|
| `project.ts` | 878 | **9/10** | Extreme cyclomatic complexity, massive duplication, deep nesting |
| `verify-wrap.ts` | 233 | **3/10** | Clean two-phase design, minimal branching |
| `implement-and-verify.ts` | 203 | **2/10** | Simple retry loop, well-structured |

## #1: project.ts — Critical Fragility

### Problem: Giant `execute()` function (lines 308–878)
The `execute()` function is ~570 lines with **4+ levels of nesting** (while → if → if → if). This single function handles: project initialization, comment iterations, worker iterations, reviewer iterations, evaluator gates, milestone auto-checking, false-done detection, stall detection, and status management.

### Fragile Code Sections

**1. Duplicated done-handling logic (3 copies)**
The "reviewer says DONE → evaluate → check milestones → maybe override" sequence is copy-pasted in three places:
- Comment-iteration done path: `project.ts:494-548`
- Comment-iteration blocked path: `project.ts:549-572`  
- Main-loop done path: `project.ts:664-738`
- Main-loop blocked path: `project.ts:740-770`

Each copy has the same eval prompt → score parse → PASS/FAIL → false-done increment → milestone gate → override logic. A bug fix in one copy will be missed in the others.

**2. Mutable state soup (lines 340-347)**
Six mutable variables (`iteration`, `consecutiveFailures`, `continueWithoutProgress`, `lastMilestoneDone`, `falseDoneCount`, plus `projectContent`) are threaded through the entire loop with complex interdependencies. The `continueWithoutProgress` counter is incremented/reset in **5 different places** (`project.ts:519`, `project.ts:541`, `project.ts:685`, `project.ts:707`, `project.ts:779`), making it nearly impossible to reason about.

**3. File I/O coupling throughout the loop**
`writeFileSync` is called **18+ times** inside `execute()`, interleaved with state mutations. The function both computes logic AND manages persistence, making it untestable without filesystem mocking. Examples: `project.ts:354`, `project.ts:487`, `project.ts:502`, `project.ts:612`, `project.ts:631`.

**4. Deep nesting in review phase (lines 640-800)**
The reviewer phase has 5 levels of nesting: `while` → `if (iteration % reviewEvery)` → `if (decision.status === "done")` → `if (evalVerdict === "FAIL")` → `if (falseDoneCount >= 3)`. This is where bugs will hide.

**5. Legacy/new format branching**
`config.isLegacy` branching appears in **8+ places** (`project.ts:479`, `project.ts:497`, `project.ts:567`, `project.ts:620`, `project.ts:639`, `project.ts:669`, `project.ts:755`, `project.ts:760`), each with different file-write behavior. This is a maintenance hazard.

### Concrete Simplification Recommendations

1. **Extract `handleDoneDecision()` helper** — The evaluate → score → milestone-gate → override logic appears 3 times. Extract to a single function returning `{finalStatus, shouldContinue}`.

2. **Extract `handleBlockedDecision()` helper** — Same pattern, duplicated twice.

3. **Create a `ProjectFile` class** — Encapsulate all `readFile`/`writeFileSync`/`updateField`/`appendFileSync` calls. The legacy vs. new branching belongs here, not scattered through execute().

4. **Extract `runCommentIteration()` and `runWorkerReviewIteration()`** — Break the 570-line while loop into two named sub-workflows.

5. **Replace mutable counter soup with a `LoopState` object** — Group `iteration`, `consecutiveFailures`, `continueWithoutProgress`, `lastMilestoneDone`, `falseDoneCount` into a single state object with named transition methods like `state.recordProgress(milestoneDone)`.

## #2: verify-wrap.ts — Low Fragility

Clean two-phase structure (`project.ts:152-199`). `extractWrittenFiles()` (`verify-wrap.ts:36-82`) has moderate complexity parsing multiple message formats but is self-contained. The hard-fail vs soft-fail distinction (`verify-wrap.ts:186-199`) is clear. No significant fragility concerns.

## #3: implement-and-verify.ts — Lowest Fragility

Simple attempt loop (`implement-and-verify.ts:120-180`). Clean separation of parsing, verification, and orchestration. The one minor concern is the inline retry for transient coder errors (`implement-and-verify.ts:149-156`) which could be extracted but is not a real risk.

---

*Follow-up: Consider refactoring project.ts execute() into extracted helpers as described above. This is the highest-leverage code quality improvement in the workflows directory.*
