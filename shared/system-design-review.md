# System Design Document Review

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

### ✅ STILL OPEN: "No mention of compaction"

Still not documented. May is still registered with `compaction: { threshold: 0.7, keepRatio: 0.4 }`.

### ✅ STILL OPEN: "No mention of the memory system"

Still not documented. `resolveSystemPrompt()` still loads memory entries and injects them into system prompts as "Recent Task History". The default `memoryLimit` is 20.

### ✅ STILL OPEN: "Project structure injection not documented"

Still not documented. `buildProjectStructure()` is still called in `resolveSystemPrompt()` and injects a directory tree into every agent's system prompt.

### ✅ STILL OPEN: "No mention of hallucinated path rewriting"

Still not documented. `rewriteHallucinatedPath()` and `rewriteHallucinatedCommand()` are still active in both read/write tools and exec tool.

### ✅ STILL OPEN: "Turn limits and budget warnings"

Still not documented. Turn limits are still enforced: coder=50, qa=30, evaluator=20, optimizer=40. Warning threshold defaults to 0.8.

### ✅ STILL OPEN: "Idle-time optimizer triggering"

Still not documented. The idle timer in `run/may.ts` still triggers at 5 min idle with 30 min cooldown.

### ✅ STILL OPEN: "'QA is advisory — May decides'"

Still inaccurate for the fast path. In workflows, the verdict mechanically drives retries.

### ⚠️ EVOLVED: "Evaluation data format — 'saved per session ID'"

The previous review said evaluations are saved per task tree, not per session. Looking at the current code: `evaluateTask()` saves one evaluation file **per child session ID** (`writeFileSync(join(evalDir, \`${child.sessionId}.json\`))` in a loop over `children`). So evaluations ARE saved per session ID. The previous review was wrong on this point. The doc's claim is actually correct.

### ✅ STILL OPEN: "'Agents don't share state directly'"

Still technically misleading. Agents share the filesystem. QA reads coder's files. The optimizer edits domain.md files.

---

## 2. New Issues Found

### 🐛 BUG: May's implement-and-review workflow calls unregistered agent

`agents/may/workflows/implement-and-review.ts` calls `ctx.runAgent("reviewer", ...)` three times (initial review, re-review, and the review task construction). But "reviewer" is not registered in `run/may.ts`. This will throw an error at runtime. The workflow description even says "delegates to coder, then reviewer" but there is no reviewer to delegate to.

**Impact**: May's primary fast-path workflow for code tasks is broken. Any call to `workflow.run("implement-and-review", task)` will crash on step 2.

**Fix needed in code**: Either register the reviewer agent in `run/may.ts`, or change the workflow to use "qa" instead of "reviewer" (matching the optimizer's workflow pattern).

### May's tools INDEX.md doesn't mention the workflow tool

May is registered with three tools: `readOnlyExec()`, `maySubagentTool`, and `mayWorkflowTool`. But `agents/may/tools/INDEX.md` only lists `exec` and `subagents`. The `workflow` tool is not documented. This means May's system prompt tells it about two tools when it has three. May might not know workflows exist.

**Impact**: May may never use the workflow tool (fast path) because its tools documentation doesn't mention it. This would force all tasks through the slow path.

### Doc doesn't describe the design-review workflow

`agents/may/workflows/design-review.ts` defines a "design-review" workflow that orchestrates evaluator and optimizer for independent reviews with cross-responses. This is a significant multi-step workflow not mentioned anywhere in the design doc. It demonstrates workflow composition patterns (using evaluator/optimizer as reviewers, not just coder/qa).

### Doc doesn't describe the workflow resume capability

The workflow tool supports a `resume` action that can restart interrupted workflows from their last completed step, replaying archived results. This is a non-trivial crash recovery mechanism (`executeWorkflow()` accepts a `previousRun` parameter and replays steps from archived data). The design doc's workflow section doesn't mention resumption.

### Doc doesn't describe the handoff system

`src/handoff.ts` implements `summarizeForHandoff()` and `extractHandoff()` — a structured system for passing context between workflow steps. Workflows use `ctx.summarize(result)` to build rich context with files modified, commands run, and errors encountered. This replaces raw `lastAssistantText` passing. Not mentioned in the design doc's workflow section.

### Doc doesn't describe the skills system

`src/skills.ts` implements skill discovery: scanning directories for `SKILL.md` files with YAML frontmatter, and formatting them into XML blocks for system prompts. `resolveSystemPrompt()` loads skills from per-agent `skills/` directories and shared `skillsDirs`. The `SubagentDefinition` has a `skillsDirs` property. None of this appears in the design doc.

### Doc doesn't describe context overflow recovery

`src/overflow.ts` detects context overflow errors via regex patterns and `extractProgress()` writes a `progress.md` file to the agent's workspace. `handleCompletion()` in `manager.ts` invokes this automatically on overflow errors. This is a significant structural safety mechanism — when an agent runs out of context, its progress is captured for continuation. Not documented.

### Doc doesn't describe the learn tool

`src/tools.ts` exports `createLearnTool()` — a tool that lets agents record categorized, deduplicated lessons to their own `lessons.md`. While not currently wired into any agent registration in `run/may.ts`, it's exported from `src/index.ts` and is a fully implemented concept. The design doc's "Knowledge Hot-Reload" section is adjacent but doesn't cover agent-initiated learning.

### Doc doesn't describe the health check tool

`createHealthCheckTool()` in `src/tools.ts` runs a comprehensive startup verification: package.json exists, directories exist, tsc passes, tests pass, no stale sessions. Not currently wired in `run/may.ts` but exported and fully implemented. Not documented.

### Doc doesn't describe workflow persistence

Workflow runs are persisted to `.state/workflows/<runId>.json` via `saveWorkflowRun()`. Each run tracks its steps, status, parent relationships, and supports nesting. This enables the `trace` action and the `resume` action. The design doc mentions workflows but not their persistence or observability.

### Doc doesn't describe the session graph / trace system

`manager.trace()` builds a `SessionTrace` tree from any session or workflow run ID, walking parent pointers and workflow run records. The `subagents.trace(id)` tool action exposes this to agents. This gives full observability into the parent→child→workflow session hierarchy. Not documented.

### Doc's "Slow Path vs Fast Path" section is incomplete

The doc says "A workflow like 'implement-and-review' runs coder→qa automatically." But the actual May workflow runs coder→**reviewer** (not qa). The optimizer's copy runs coder→**qa**. Neither version matches the doc's description exactly. The doc also doesn't explain:
- How workflows escalate back to the slow path
- The steering interruption mechanism (`WorkflowInterrupted`)
- Workflow composition (`runWorkflow()` within workflows)
- The one-retry-then-escalate pattern that both workflows implement

### Evaluator's domain.md says "Do NOT use tools" but it has tools

The evaluator is registered with `projectRead()`, `projectWrite()`, and `projectExec()`. Its domain.md says "Do NOT use tools — you have the transcripts already." This is a behavioral instruction fighting against structural capability. The evaluator might ignore the instruction and use tools anyway, wasting turns on unnecessary file I/O during evaluation.

The evaluator is also used for maintenance tasks (via `maintainAgent()`) that genuinely need tools. The contradiction exists because one agent definition serves two purposes.

### May doesn't have a read tool — doc doesn't explain why

May is registered with `readOnlyExec()` (blocked from writing), `subagents`, and `workflow`. It has no `read` tool. May's tools INDEX.md says "You do NOT have read or write tools" and suggests `exec: cat <file>`. This is a deliberate design choice (forces delegation), but the design doc doesn't explain why the supervisor is intentionally tool-limited.

### Doc's "Persistent agents" claim is partially wrong

The doc says "Persistent agents (May): Session starts, runs, goes idle when done. When a new task arrives, the same session wakes up." This is correct. But it also says "When the process restarts, May's persistent session is restored from disk with full message history." 

In the actual code, `resumeAgent()` restores the session JSONL from archive, rebuilds the system prompt from scratch (re-reading all knowledge files), and creates a new Agent instance with the saved messages. The system prompt is NOT restored — it's regenerated. This means if domain.md or lessons.md changed between restarts, May gets different instructions mid-conversation. The doc implies the session is restored identically, but the system prompt can drift.

### Doc says nothing about model assignment

The design doc doesn't mention that different agents use different models. In `run/may.ts`:
- May, coder, optimizer use `opus` (claude-opus-4.6 via localhost proxy)
- QA, evaluator use `gpt52` (gpt-5.2 via localhost proxy)

This is a significant architectural decision — review agents use a different model family than implementation agents, presumably for perspective diversity. The Reviewer agent's domain.md even says "Different model perspective is the point." The doc should cover this.

---

## 3. Inaccuracies in the Design Doc

### "Each agent runs in its own session"

True for non-persistent agents. But May's session is persistent and reused across tasks. The doc does cover this later in "Session Lifecycle" but the opening "What is an Agent" section gives the wrong impression.

### "Agents don't share state directly — they communicate through delegation and results"

Misleading. Agents share the filesystem bidirectionally:
1. Coder writes code → QA reads it (filesystem, not delegation)
2. Evaluator writes lessons → all agents read them on next session (via lessons.md)
3. Optimizer edits domain.md/tools → all agents get different behavior on next session
4. Project structure injection means all agents see the same directory tree

The delegation channel carries task descriptions and results. The filesystem carries the actual work artifacts.

### "Scores are per-agent, not per-task"

Partially accurate. `evaluateTask()` produces per-agent scores, but it ALSO produces `overall` scores (`efficiency`, `quality`, `verdict`, `result_delivered`). The evaluation file saved per-session includes both agent-specific scores AND the overall task scores. The doc's claim that evaluation is purely per-agent is incomplete.

### "The evaluator receives the full task tree"

The evaluator doesn't receive the "full task tree" — it receives a formatted transcript prompt that `evaluateTask()` constructs. It doesn't see May's conversation, workflow run metadata, or the session graph. It sees per-agent transcripts with failure chains pre-extracted.

---

## 4. Structural Observations

### The Reviewer/QA split is a real mess

The current state:
- **QA**: Registered, has write tools, uses PASS/FAIL/CONDITIONAL verdicts, used in optimizer's workflow
- **Reviewer**: NOT registered, has knowledge files but no registration, uses APPROVE/REQUEST_CHANGES/COMMENT verdicts, referenced in May's workflow (which will crash)

This needs to be resolved: either register Reviewer and use it, or delete Reviewer and update May's workflow to use QA. The current state guarantees May's fast-path workflow fails.

### Evaluator is overloaded

The evaluator agent definition serves two roles:
1. **Transcript evaluator**: Receives formatted transcripts, outputs JSON scores (domain.md says "don't use tools")
2. **Maintenance agent**: Called by `maintainAgent()` with a different prompt to prune lessons.md (needs write tools)

This causes a contradiction: the tools are there for maintenance, but the domain.md tells it not to use them during evaluation. A cleaner design would either split these into separate agents or make the maintenance role explicit in the domain.md.

### May's tools documentation is out of sync

May has three tools: `exec` (read-only), `subagents`, `workflow`. The tools INDEX.md only documents `exec` and `subagents`. If May doesn't know about the workflow tool, it won't use the fast path, defeating the purpose of workflows.

### The optimization loop is partially automated

The design doc describes the optimization loop as a sequence but doesn't clarify what's automated vs. manual:
- **Automated**: Post-task evaluation runs automatically after May goes idle (`runPostTaskEvaluation()` in `run/may.ts`)
- **Automated**: Idle-time optimizer trigger (5 min idle → optimizer via May)
- **Manual**: The optimizer's actual fix implementation — it uses tools to edit code, but a human must verify
- **Semi-automated**: Lesson accumulation — evaluator writes lessons, agents read them on next session

---

## 5. What the Doc Gets Right

### Fix hierarchy is well-implemented and documented

The four-level hierarchy (structural → environmental → reductive → behavioral) is genuinely embedded in the codebase. Examples that exist in code:
- **Structural**: `rewriteHallucinatedPath()`, `stripRedundantCd()`, `resolveReadPath()`
- **Environmental**: `buildProjectStructure()`, runtime environment injection in `resolveSystemPrompt()`
- **Reductive**: `maintainAgent()` prunes lessons.md
- **Behavioral**: domain.md instructions, lessons.md entries

### Delegation model is accurate

The parent→child session linking via `parentSessionId`, the `delegate` action that runs-and-waits, the `run`/`waitFor` split — all work as described.

### Knowledge hot-reload works exactly as described

`resolveSystemPrompt()` reads files with `readFileSync()` at session start. No caching. Changes take immediate effect.

### Role-based evaluation is implemented

The evaluator's domain.md implements the "score by responsibility" model. The blame attribution table in the design doc matches the evaluator's actual scoring criteria.

---

## Summary

The design doc accurately describes the **conceptual architecture** — delegation, roles, evaluation philosophy, fix hierarchy. Its weakness is **completeness** and **accuracy of specifics**. Major gaps:

**Critical bugs found** (code, not doc):
1. May's `implement-and-review` workflow calls unregistered "reviewer" agent → runtime crash
2. Optimizer's `implement-and-review` workflow checks for `REQUEST_CHANGES` against QA → retry logic never triggers

**Doc-code mismatches** (11 issues still open from previous review + 15 new):
- QA write capabilities undocumented
- Evaluator dual-role undocumented
- Optimizer sub-agent capability undocumented
- Compaction, memory, project structure, path rewriting, turn limits, idle optimizer, overflow recovery, skills, handoff, workflow persistence, session tracing, learn tool, health check — all implemented but undocumented
- May's workflow tool undocumented in its tools INDEX
- Model assignment strategy undocumented
- System prompt regeneration on resume (vs. the doc's implication of identical restore)

**Most actionable fixes** (prioritized by impact):
1. **Code**: Fix May's workflow — register reviewer OR change workflow to use qa
2. **Code**: Fix optimizer's workflow verdict check — use FAIL/CONDITIONAL instead of REQUEST_CHANGES
3. **Code**: Add workflow tool to May's tools INDEX.md
4. **Doc**: Add section on Reviewer vs QA (or remove Reviewer entirely)
5. **Doc**: Document compaction, memory, project structure, and turn limits — these are core operational behaviors
