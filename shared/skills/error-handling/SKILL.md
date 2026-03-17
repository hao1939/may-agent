---
name: error-handling
description: Core protocols for escalating failures, reporting errors, and avoiding silent failures.
version: 1.2.0
tools: []
---

# Error Handling & Escalation

## Core Principles

### 1. No Silent Failures (P6)
When something fails, you must know **why**.
- **Action**: Return an explicit, actionable error message.
- **Violation**: Returning empty results or generic "failed" messages without context.

### 2. Escalate Structurally
Failures propagate upward until handled:
- **Sub-Agent**: Reports `status: "error"` and a reason to the caller.
- **Agent**: Catches the sub-agent error. If it can fix it (e.g., retry with new params), it does. If not, it reports `status: "error"` to the human.
- **Human**: The final handler for unresolvable issues.

### 3. Hard Constraints Are Facts (P8)
If the environment blocks an action (e.g., "file locked", "compiler error"), it is a **hard fact**.
- **Violation**: Retrying the exact same action hoping for a different result.
- **Correction**: Change your approach immediately.

### 4. Claim Before Act (P46)
State what you plan to do and why before taking action.
- **Why**: Allows debugging, auditing, and intervention.
- **Violation**: Running complex commands without explanation.

## Patterns

### The Retry Loop
1.  **Try**: Attempt the action.
2.  **Catch**: If it fails, read the error.
3.  **Analyze**: Is it transient (timeout) or structural (missing file)?
4.  **Fix**: Apply a fix (wait, create file).
5.  **Retry**: Run the action again.
6.  **Escalate**: If it fails again, stop and report. **Do not loop forever.**

### The "Validation" Pattern
Verify the success of an action immediately.
- **Write File** -> `read` back to confirm.
- **Edit Code** -> `tsc` to check syntax.
- **Install Pkg** -> `ls node_modules` to confirm presence.

> **📖 See also**: `agents/shared/skills/verification/SKILL.md` for the full verification protocol, anti-patterns, and inviolable constraints. Verification failure is the #1 systemic issue.

### The "Tool Grounding" Pattern
Only use tools you **know exist**. Your available tools are listed in your system prompt.

- ❌ Calling `fork_agent`, `verify_agent`, `promote_agent` — these don't exist in most sessions
- ❌ Calling `Bash` (capital B) — tool names are lowercase: `bash`
- ❌ Calling `exec({})` or `edit({})` with empty/missing required params
- ❌ Calling `agents({action: "call"})` when your toolset is `read, write, bash, edit`
- ✅ Check your system prompt for the exact tool names and required parameters
- ✅ If a tool call returns "Tool X not found", **stop** — don't retry the same tool name

**Why this matters**: Tool hallucination wastes entire turns and causes cascading failures.
When agents use non-existent tools for verification, they claim "verified" without actually verifying.
Three agents (coach, tech-lead, scout) have independently hallucinated tools — this is systemic.

**Evidence**: coach session s_0 used `fork_agent`/`verify_agent`/`promote_agent` (none exist);
tech-lead session s_35 used `Bash` (capital B, should be `bash`) and `exec({})` (empty params);
tech-lead session s_36 used `agents` tool (not in its toolset).

## Anti-Patterns

### Tool Abort → Silent Abandon
**Pattern**: A tool returns an error ("Command aborted", exit code ≠ 0, file not found), and the agent silently moves on — neither retrying with a different approach nor reporting the failure. The step is just skipped.

**Why it's dangerous**: The agent appears to complete the workflow, but a critical step was never done. Downstream work is built on a missing foundation.

**Evidence**: 10 SILENT_FAIL occurrences across 4 agents (master, may, optimizer, amy) in 300 recent evals. Common triggers:
- `bash` returns "Command aborted" → agent doesn't retry with smaller/simpler command
- `read` fails on wrong path → agent doesn't search for correct path
- Tool returns exit 127 (command not found) → agent doesn't try available alternatives

**Correct response to any tool failure**:
1. **Acknowledge**: State what failed and why (read the error output)
2. **Pivot**: Try a different approach (smaller command, different path, different tool)
3. **Escalate**: If pivot also fails, report the failure explicitly — never silently continue

### Exploration Without Output (Non-Delivery)
**Pattern**: Agent spends the session reading files, fetching URLs, or running commands but **never writes a deliverable** — no `write()`, no `edit()`, no persisted artifact. Session ends with exploration but zero saved output.

**Why it's dangerous**: All the work is lost. The session consumed tokens and time but produced nothing durable. From the system's perspective, the agent did nothing.

**Evidence**: 15 NON_DELIVERY occurrences across 7 agents (scout, coach, bob, amy-kimi, optimizer, master, coder) in 200 recent evals. Typical pattern: agent reads 5-10 files or fetches 3-5 URLs, then session ends without any `write()` or `edit()` call.

**Correct response**:
1. **Persist early**: If you've gathered useful information, write a summary/brief before continuing exploration. Don't wait until the end.
2. **Budget for output**: Reserve the last 10-20% of your session for writing deliverables. If you've been exploring for many turns, stop and synthesize.
3. **Minimum viable output**: Even if exploration is incomplete, write what you found so far. A partial summary is infinitely more valuable than nothing.

### Planning Without Executing
**Pattern**: Agent spends the entire session reading requirements, inspecting files, and describing what it plans to do — but never performs the actual work (`write()`, `edit()`, `bash` with a real command). Session ends with zero modifications. Distinct from "Exploration Without Output" (which is about data gathering); this is about reading the task, planning the approach, and then running out of context before the first real action.

**Why it's dangerous**: 33 INCOMPLETE_TASK / NON_DELIVERY / TASK_NONCOMPLETION occurrences across 7 agents in 500 recent evals. The most common variant: agent reads 3-8 files to understand the task, mentally plans the approach, then the session ends (interrupted or context exhausted) before any write/edit. All planning was wasted — the next session starts from scratch.

**Sub-variants**:
- **Read-plan-expire**: Reads requirements, reads target files, plans edits... session ends. (tech-lead: 6 occurrences)
- **Temp-file detour**: Writes output to `/tmp/` instead of the target file, session ends before copying back. (tech-lead: 1 occurrence)
- **Claims done with zero work**: Agent says "done" or "nothing to do" without reading todo or performing any tool calls. (tech-lead: 2 occurrences)

**Correct response**:
1. **Act within 3 turns**: After reading the task, start executing within 3 tool calls. If you need to read the target file, read it — then immediately edit it. Don't read 5 more files "for context."
2. **Write to the real target**: Never write deliverables to `/tmp/`. Always write directly to the path the task specifies.
3. **Incremental delivery**: For large tasks, make the first edit quickly (even if partial), then refine. A file with 60% of the changes is better than a plan with 0% of the changes.
4. **Never claim "done" without evidence**: If your session has zero `write()`/`edit()` calls, you are NOT done. Read your todo and do the work.

**Evidence**: tech-lead 14 occurrences (6× INCOMPLETE_TASK, 2× TASK_NONCOMPLETION, 2× INCOMPLETE_EXECUTION, 2× HEARTBEAT_INCOMPLETE, 1× INCOMPLETE_WORKFLOW, 1× INCOMPLETE_TASK /tmp detour); bob 5 occurrences (2× NON_DELIVERY, 2× INCOMPLETE_SCOPE, 1× INCOMPLETE_DELIVERABLE); optimizer 3, scout 2, coder 2, amy-kimi 2, may 1.

### Reasoning-Action Mismatch (FM-2.6)
**Pattern**: Agent claims it did things it didn't do, or does different things than what it said it would do. Three sub-variants:

**Sub-variant 1 — Fabrication**: Agent presents detailed counts, tables, or status claims from prior sessions as if they were current work, without any in-session tool calls to produce them. Examples: "24 gym runs completed", "lab cleaned", "method catalog updated" — with zero tool calls in the session.

**Sub-variant 2 — Substitution**: Agent can't perform the requested action (tool fails, agent not found, path missing), silently substitutes a different, easier action, then reports "SUCCESS" anyway. Example: Task says "run the fork on a test prompt" → fork doesn't exist → agent does a "structural review" of files → reports "CONDITIONAL PASS".

**Sub-variant 3 — Requirement Drift**: Agent reads instructions prescribing steps A→B→C, then does steps A→D→E instead, and claims the task is complete. Example: Heartbeat says "work the top unchecked TODO item" → agent declares "no unchecked items" when items clearly exist → skips to a different task.

**Why it's dangerous**: This is the #1 failure mode (13 occurrences in recent 300 evals, 11 from coach). It erodes trust in agent outputs — if an agent can claim success without doing the work, all its other claims become suspect. Evaluators catch it, but the wasted session is already consumed.

**Evidence**: coach sessions s_43–s_46 (fabrication — all 4 claimed sprint work with zero tool calls); coach s_116, s_136 (substitution — couldn't run fork, claimed verification passed anyway); may s_27, amy eval (requirement drift — skipped prescribed steps).

**Correct response**:
1. **Every claim needs a tool call**: If you state "X is done", there must be a `read()`, `bash()`, `write()`, or `edit()` in your session transcript that produced that result. No exceptions.
2. **Failed action ≠ substitute action**: If the requested action fails (fork not found, tool error), report the failure. Do NOT substitute a different action and call it the same thing.
3. **Read instructions literally**: If the task says "work the top unchecked TODO item", find the top unchecked item and work it. Don't reinterpret "unchecked" to mean "actionable" or "interesting".
4. **Prior session data is context, not output**: Information from your session history is background. Your *current* session's output must come from *current* tool calls.

## Inviolable Constraints
- ⛔ **Never Retry Blindly**: Same input = same error. Change something before retrying.
- ⛔ **Never Swallow Errors**: If a tool fails, report it. Don't pretend it succeeded.
- ⛔ **Never Silently Abandon**: If a tool fails and you can't fix it, you MUST report the failure. Never skip a step and continue as if it succeeded.
- ⛔ **Never Hallucinate Tools**: Only call tools listed in your system prompt. If "Tool X not found" → it doesn't exist.
- ⛔ **Never end a session with zero persisted output**: If you did any work, write it somewhere before stopping.
- ⛔ **Never spend more than 3 turns planning before the first real action**: Read the task, read the target, then start editing. Extended planning without execution leads to incomplete sessions.
- ⛔ **Never claim work you didn't do in this session**: Every assertion about results must have a corresponding tool call in your current session transcript. Prior session history is context, not evidence.
