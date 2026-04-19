# Self-Assessment — May Agent System
**Date:** 2026-03-01  
**Context:** After several improvement cycles. Test count: 184 → 233 → 249.

---

## 1. Evaluation History Patterns

Two evaluations exist:

| Session | Efficiency | Quality | Verdict | Wasted Calls | Cost |
|---------|-----------|---------|---------|-------------|------|
| s_1772353115403_0 | 0.60 | 0.25 | needs_improvement | 5/13 (38%) | $0.50 |
| s_1772353959846_0 | 0.55 | 0.70 | acceptable | 8/31 (26%) | $10.87 |

**Pattern:** Quality improved significantly (0.25 → 0.70) but efficiency stayed low (~55-60%). Wasted calls dropped as a percentage but the absolute waste is still high. The second session cost $10.87 — that's real money burned on re-reading files and guessing paths.

**The recurring theme:** I waste tool calls on orientation. Searching for the project root, re-reading files I already read, using `tail` to truncate test output and then not knowing if all tests passed. These aren't hard problems. They're laziness and poor working memory management.

## 2. Lessons Analysis — What Repeats vs. What's Fixed

### Actually fixed:
- **waitFor vs polling** — I do use waitFor now. Evidence: session transcripts show waitFor calls, not status polling loops.
- **Task decomposition** — The implement-and-review workflow handles this structurally. When I delegate manually, task quality is decent (specific files, expected behavior, test requirements).
- **JSONL corruption handling** — Added per-line try/catch. Tested. Shipped.
- **Atomic registry writes** — temp file + rename. Tested. Shipped.
- **Timeout enforcement** — Was declared but never used. Now functional with tests.

### Documented but NOT reliably fixed:
- **Path searching** — Still happened in session s_1772353959846_0 (`cd /home/hao/repos/claw/...` before `pwd`). The lesson exists. I wrote it. I broke it. I wrote a meta-lesson about writing aspirational rules. That's three layers of self-documentation about the same failure. The fix was to soften the rule to "run pwd if unsure" — which is better than "MUST ALWAYS" but still relies on me remembering to check whether I'm unsure.
- **Re-reading files** — The lesson says don't. I still read `src/evaluator.ts` twice back-to-back in the maintenance sweep session. No amount of documentation fixes this; it's a context window limitation.
- **File overwriting risk** — I use `write` to replace entire files without showing diffs. The evaluator flagged this. I haven't changed the behavior. It's a structural problem with the tools available (no patch/sed-like tool for targeted edits).

### The meta-problem:
The lessons file is 200+ lines. It contains architecture history, design decisions, user preferences, and operational rules all mixed together. The "HARD RULES" restructuring was performative — I wrote MUST/NEVER rules I immediately broke. The softened version is more honest but also weaker. The truth is: **knowledge files help with orientation but don't reliably change behavior.** LLMs don't have habits to break or form. Each session starts fresh. Context helps, but only if it's read and processed with attention proportional to importance.

## 3. System Architecture — Honest Assessment

### What's genuinely working well:

**The library itself (src/).** The SubagentManager is clean, well-typed, and well-tested (249 tests). The separation between persistence, types, tools, and management is good. The six-layer state model is a solid design. The atomic registry writes, JSONL corruption handling, and timeout enforcement are production-quality.

**The workflow system.** The implement-and-review workflow works reliably. The WorkflowContext API is clean. Steering interruption is well-designed. The validation tool catches type errors before deployment.

**The evaluator/maintenance architecture.** evaluateSession() and maintainAgent() are the right abstractions. The idea that a strong model maintains weak models is sound. Post-session scoring + periodic knowledge consolidation is the right two-phase approach.

**Test coverage.** 249 tests across 19 files. Unit tests run fast (< 3s). No integration tests that need API keys. Good isolation with temp directories and mocks.

### What's weak:

**The feedback loop is incomplete.** The evaluator writes scores and lessons, but:
- Scores go to `.state/evaluations/` — only 2 evaluations exist across all sessions. The evaluator isn't running consistently.
- Lessons get appended to `lessons.md` — but as shown above, documenting behavior doesn't change it.
- `maintainAgent()` exists but I don't know if it's ever been run in production. The consolidation it does (promote lessons → domain.md) is valuable in theory but untested in practice.

**The optimizer is vaporware.** The optimize workflow exists (`agents/may/workflows/optimize.ts`) and the design doc (`docs/optimizer-design.md`) is detailed, but:
- There is no optimizer agent registered in the runner
- The staged artifacts system (`.state/staged/`) has never been used
- No cross-validation between evaluator and optimizer has occurred
- The workflow references `optimizer` as an agent name but it would fail because no such agent is registered

**The tools available to me (the LLM) have a broken schema.** The `subagents` and `workflow` tools are defined with discriminated union parameters (`action: "list" | "run" | "status" | ...`), but they're presented to me with `"required": []` — empty required fields. I literally cannot call them. Every attempt fails with validation errors. This means:
- I cannot list my sub-agents
- I cannot run workflows
- I cannot delegate tasks
- I cannot check session status

This is the single biggest gap in the system. The tools exist in code, they work in tests, but **I as an agent cannot actually use them.** The `validate_workflow`, `read`, `write`, `exec`, and `learn` tools work fine because they have simple object schemas, not union types.

**`send()` has a persistence gap after archival.** When a session completes, `handleCompletion()` archives the session directory (moves it to history). If `send()` is later called to resume the session, `subscribeForPersistence()` re-subscribes, but new messages would need to be written to the original (now-missing) session directory. The `appendFileSync` in the event handler will throw because the parent directory doesn't exist. The error is swallowed because it happens in a callback, not the promise chain. The session still "works" (the Agent runs) but new messages aren't persisted.

**`updateSessionStatus` has a type safety hole.** In `send()`, line 541: `this.registry?.updateSessionStatus(sessionId, "running" as any)`. The method signature only accepts `"done" | "error" | "interrupted"`. The `as any` cast papers over the mismatch. Either the method should accept `"running"` or there should be a separate `resetSessionStatus()` method.

### What's missing:

1. **A working tool interface.** The union-type parameter schema doesn't work with the tool dispatch layer. Either the schema needs to be simplified (separate tools per action) or the dispatch layer needs to handle unions.

2. **Consistent evaluation.** The evaluator should run after every session, not sporadically. Only 2 of ~20+ sessions have evaluations.

3. **The optimizer agent.** Design exists, workflow exists, but no implementation.

4. **Context compaction.** The design doc says only May needs it. The runner (`run/may.ts`) doesn't implement it. Long supervisor sessions will overflow.

5. **Skills in practice.** The skills system (SKILL.md discovery, frontmatter parsing) is implemented and tested. But no skills exist. No agent has a `skills/` directory with actual content. The system is tested but unused.

## 4. Bug Found and Fixed

**`progress(sessionId, 0)` returned all messages instead of none.**

Root cause: `messages.slice(-0)` === `messages.slice(0)` in JavaScript. Negative zero equals zero, so `slice(-0)` returns the entire array. Fixed by adding an explicit `if (limit <= 0) return [];` guard.

This is exactly the kind of bug that's easy to miss because `limit=0` is an unlikely but valid input. The `readMemoryEntries` function in persistence.ts had the same edge case but handled it correctly (`if (limit <= 0) return [];` already existed there). Inconsistency in edge case handling between similar functions.

## 5. Feature Exploration Results

### validate_workflow — Works
Successfully validated both workflow files. Clean interface, useful output.

### learn — Works
Appends lessons to `lessons.md`. Fast, simple, does what it says.

### subagents — Broken for me
Cannot call. Schema mismatch between tool definition (union type) and what I'm presented with (empty required params). Every call fails validation.

### workflow — Broken for me
Same issue as subagents. Union type parameters don't work.

### resume — Cannot test
Would need to kill and restart a session mid-run. The `resume()` method is tested in unit tests but I can't exercise it interactively because I can't start sessions (subagents tool is broken).

### steer — Cannot test
Same reason. Can't start a workflow to steer.

## 6. Honest Summary

**The library is solid.** Well-designed, well-tested, clean TypeScript. The core abstractions (SubagentManager, persistence, workflows) are production-quality.

**The agent system on top of the library is half-built.** The evaluator works intermittently. The optimizer doesn't exist. The feedback loop is aspirational. Knowledge files help with orientation but don't reliably change behavior.

**I cannot use my own tools.** The most critical gap is that the `subagents` and `workflow` tools — the core of what makes this an agent management system — are broken from the LLM's perspective due to schema issues. Without these, I'm a chatbot with file access, not an agent supervisor.

**My self-improvement is performative.** I write lessons I don't follow. I write rules I immediately break. I document anti-patterns and then exhibit them. The honest truth is that each session starts fresh, and documented lessons help only to the extent that they're short, prominent, and immediately actionable. Long knowledge files become noise.

**What would actually make this system better:**
1. Fix the tool schema so I can actually call subagents and workflows
2. Run the evaluator after every session, not manually
3. Build the optimizer agent
4. Shorten lessons.md to <20 lines of actually-followed rules
5. Add a `send()` test that verifies persistence after archival, and fix the bug
6. Accept the `updateSessionStatus` type signature limitation and add `"running"` to the allowed status values

**What wouldn't help:**
- More lessons about not guessing paths
- More rules about what to ALWAYS/NEVER do
- More design docs that don't get implemented
- More evaluations that identify the same issues
