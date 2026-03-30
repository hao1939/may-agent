# Delegation Design

## Status: Design Phase — Evidence Gathering

## The Goal

Make delegation amplify agent capability, not limit it. Every delegate should start as informed as the caller, with full ability to learn more.

## Current State (Evidence)

### Timing (from DB, 2026-03-29)
- May→tech-lead send: 1777-3655 seconds (30-60min) to completion
- Within tech-lead's session, coder→qa→fix chain: 7-10 minutes
- Most delay is heartbeat interval (30min), not execution

### Context Loss (from session analysis)
- Coder gets task string only — no files the caller already read
- QA gets "review the last commit" — not what changed or why
- Fix tasks get "fix these issues from QA" — paste of QA output with no original context
- 30-50% of delegate ops spent rediscovering what caller already knew

### Return Quality
- finish() has deliverables + verification_evidence fields
- But callers read lastAssistantText (one formatted paragraph)
- Structured return data exists but isn't used for verification

### What Works
- ctx.summarize() in workflows already extracts: files read/written, commands run, errors, response
- Workflows pass context between steps via task strings
- The code-review chain within one tech-lead session runs in 7-10min

## Design Principles

### 1. Delegate starts informed, not from zero

The task should include:
- **What**: the specific thing to do
- **Where**: file paths, line numbers, error messages
- **Why**: what problem this solves (so the agent can make judgment calls)
- **How to verify**: the command or check that proves it worked
- **What was tried**: if this is a retry, what didn't work last time

The delegate still has tools to read more. But it shouldn't NEED to rediscover what the caller already knows.

### 2. Return is auditable without re-reading

finish() should flow back to the caller with:
- **What changed**: deliverables (file paths + descriptions)
- **Proof it works**: verification_evidence (specific tool outputs)
- **What to watch for**: known limitations or edge cases

The caller can audit from the return data alone. If they want to deep-verify, they read the files. But the default path doesn't require it.

### 3. Agents can pull context, not just receive it

Instead of stuffing everything into the task string (which bloats it), give agents:
- **File references**: "read agents/shared/may-agent-docs/design/X.md for the full design"
- **Session references**: "previous session s_XXX worked on this — read its output at .state/sessions/history/s_XXX/output/"
- **DB queries**: "check requests table for related work: SELECT ... WHERE ..."

The task tells them what to look at. They decide how deep to go.

### 4. Accountability boundaries are role-based

Separate sessions when:
- **Different accountability**: coder implements, QA verifies — QA must not see coder's reasoning, only output
- **Different authority**: May decides what to build, coder decides how
- **Different cost**: evaluator uses cheap model, coder uses expensive one

Same session when:
- **Same accountability**: coder reading files and writing code — no reason to split
- **Sequential steps by same agent**: coder fix round 2 should see round 1 context

### 5. Workflows hold the loop, agents hold the expertise

Workflows coordinate: what order, what context to pass, when to escalate.
Agents execute: read the code, write the fix, run the test, find the bug.

The workflow is the process. The agent is the skill. Don't make agents manage the process (that's what tech-lead's heartbeat does now, poorly).

## Design Questions (Need Evidence)

### Q1: Does richer context actually reduce ops?

**Test**: Send 5 tasks to coder with full context (file paths, errors, verification commands). Send 5 similar tasks with minimal context ("fix the build"). Compare ops.

### Q2: Does QA find more issues with coder's full output vs just "review the commit"?

**Test**: Run QA on 5 sessions with ctx.summarize (files changed, commands, diffs). Run QA on 5 sessions with just "review commit X". Compare issue detection rate.

### Q3: Does the caller actually use structured return data?

**Test**: Check 20 delegation chains. Does the caller read deliverables/verification_evidence from finish(), or just lastAssistantText?

### Q4: How much context is too much?

**Test**: Measure task string size vs delegate performance. Is there a point where more context hurts (context window saturation, distraction)?

## Proposed Patterns

### Pattern A: Workflow-driven loop (code-review-loop)
```
workflow → coder (task + context) → qa (coder's output) → coder fix (qa findings) → done
```
Workflow holds full context. Each agent gets focused slice.

### Pattern B: Rich send (better agents.send)
```
may sends: task + file refs + verification command + "read X for more context"
delegate reads what it needs, works, returns structured result
```
No workflow. Just better task descriptions. Simpler.

### Pattern C: Shared workspace (filesystem as context)
```
caller writes TASK.md to workspace with full context
delegate reads TASK.md, works, writes RESULT.md
caller reads RESULT.md to verify
```
Context passes through files, not task strings. More durable.

### Which pattern?

Start with B (rich send) — it's the simplest change. Measure if it helps. If it does, keep it. If context still gets lost, try A (workflow) for the code-review loop specifically. C is for later.

## Next Steps

1. May measures baseline: context quality in recent delegations (Q1-Q4 above)
2. May tries rich send for 5 delegations, compares ops
3. If rich send works, update delegation practice across the team
4. If not, build workflow for the specific loops that need it

Follow evidence-first-process.md.
