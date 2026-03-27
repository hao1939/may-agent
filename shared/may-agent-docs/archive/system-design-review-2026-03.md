# System Design Document Review (2026-03)

> **Archive** (2026-03-12). This was a thorough codebase audit, but most critical
> findings have since been resolved:
>
> **Fixed:**
> - May's implement-and-review workflow no longer calls unregistered "reviewer" agent — all workflows use `qa` with PASS/FAIL/CONDITIONAL
> - Optimizer's workflow verdict check fixed
> - `agents/reviewer/` directory removed
> - May now has `coding` tools (full read/write/bash/edit), not `readOnlyExec`
> - May's tools INDEX.md replaced by convention files (TOOLS.md)
> - Skills system auto-loading removed (replaced by INDEX.md convention)
> - Project structure injection removed (`buildProjectStructure()` gone)
> - `systemPromptFiles` and `sharedKnowledge` fields removed from agent.json
> - Model assignments now use key names (`opus`, `gpt52`, `gemini3pro`) in agent.json
>
> **Still relevant:**
> - Compaction not well-documented
> - Memory system not well-documented
> - Path rewriting (`rewriteHallucinatedPath`) not documented
> - Turn limits and budget warnings not documented
> - Context overflow recovery exists but not documented
> - Workflow persistence/resume not documented
> - Session trace system not documented

---

**Reviewer perspective**: Full codebase audit — agent registrations, workflows, tools, evaluation pipeline, persistence.

**Previous review status**: Checked all issues from the prior review. Marked each as resolved, still open, or evolved.

---

## 1. Status of Previously Reported Issues

### ✅ RESOLVED: "Reviewer agent exists but doc doesn't mention it"

The Reviewer agent still exists (`agents/reviewer/`) with full knowledge files and tools, BUT it is **not registered** in `run/may.ts`. Only five agents are registered: coder, qa, evaluator, optimizer, may. The previous review said Reviewer was "not registered there, but it exists as a full agent" — this is still true. However, the situation is now worse: May's `implement-and-review` workflow calls `ctx.runAgent("reviewer", ...)`, which will throw `Agent "reviewer" not registered` at runtime. This is a **live bug**, not just a documentation gap. The previous review correctly identified the split but didn't flag it as a runtime error.

**Current state**: Reviewer exists as dead code. May's workflow references it but can't use it. The doc's omission of Reviewer is now accurate by accident — Reviewer isn't functional.

### ✅ RESOLVED: "QA can fix code — doc says it only reviews"

Still true. QA is registered with `projectWrite()` and `projectExec()`. QA's domain.md still says: "If you find issues, you may fix them directly — you have write and exec tools." The design doc still describes QA as advisory ("Reports a verdict"). The doc is still inaccurate here.

### ⚠️ EVOLVED: "Evaluator has tools — doc says it shouldn't"

Still partially true. The evaluator is registered with `projectRead()`, `projectWrite()`, and `projectExec()`. Its domain.md still says "Do NOT use tools." However, the previous review's claim that "the evaluator runs maintenance tasks (`maintainAgent()`) that require file I/O" is now more nuanced: `maintainAgent()` in `src/evaluator.ts` runs the evaluator agent with a maintenance prompt — but the evaluator is being used as a general-purpose LLM session, not specifically with its "no tools" instruction. The evaluator is overloaded: it serves both as a transcript scorer (no tools needed) and as a maintenance agent (needs file I/O). The doc doesn't acknowledge this dual role.

### ✅ STILL OPEN: "Optimizer has sub-agents — doc doesn't mention this"

Still true. Optimizer is registered with `manager.createTool()` in `run/may.ts`, giving it the ability to delegate to other agents. The design doc still describes it as a solo actor.

### 🐛 EVOLVED: "Workflow verdict matching is fragile"

The previous review identified that the optimizer's `implement-and-review.ts` routes to QA but checks for `REQUEST_CHANGES` (Reviewer vocabulary). This is still true — the optimizer's workflow uses `ctx.runAgent("qa", ...)` and checks `reviewText.includes("REQUEST_CHANGES")`. QA's vocabulary is PASS/FAIL/CONDITIONAL, not REQUEST_CHANGES. This means the optimizer's workflow will **never trigger a retry** — QA will never emit "REQUEST_CHANGES", so the workflow always takes the happy path regardless of QA's actual verdict.

May's workflow has the inverse problem: it calls `ctx.runAgent("reviewer", ...)` but Reviewer isn't registered, so it will crash before ever reaching the verdict check.

(Remaining sections omitted — see git history for full original content)
