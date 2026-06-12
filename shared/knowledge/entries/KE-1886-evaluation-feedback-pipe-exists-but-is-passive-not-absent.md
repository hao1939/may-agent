# KE-1886: Evaluation Feedback Pipe Exists But Is Passive, Not Absent

**Date**: 2026-06-13
**Source**: `feedback-echo-sync.ts`, `server.ts:3092-3094`, `heartbeat-data.ts`, `manager.ts:1264-1279`, `common-sense.md`
**Corrects**: KE-1883 (overclaim: "no pipe at all"), KE-1870 (partial: correct about heartbeat but misses HTTP path)
**Domain**: evaluation-feedback, prompt-loading, system-architecture

## Claim

KE-1883 states "Zero production agents have ever read an evaluation result" and
proposes "inject the agent's 3 most recent needs_improvement evaluation issues
into its prompt context" as "the single fix that would close the loop." This fix
**already partially exists** via three components:

1. **`feedback-echo-sync.ts`** (cron handler): Reads the latest evaluation with
   issues from the `evaluations` table per agent, formats a summary, and writes
   `agents/<name>/last-eval.md`. Updated for all 6 active agents every cron
   cycle. This is the feedback-echo pipeline.

2. **`server.ts:3092-3094`** (HTTP API): Explicitly loads `last-eval.md` into
   `promptFiles` for HTTP/WebUI sessions. Comment reads: "last-eval.md:
   auto-generated evaluation feedback; inject into prompt so agents see it."

3. **`common-sense.md`** (shared prompt): Instructs all agents: "If
   `agents/<you>/last-eval.md` exists, read it at session start." This is loaded
   into every session's system prompt via `manager.ts resolveSystemPrompt`.

## The Remaining Gap

KE-1870 correctly identifies that **heartbeat/workflow sessions** (the majority
path, via `manager.ts` → `heartbeat-data.ts genericHeartbeat`) do **not**
auto-inject `last-eval.md` into the task prompt. The `genericHeartbeat` function
assembles: metrics + alerts + inbox + projects + heartbeat.md guidance +
red-metric diagnostics. It does not read or include `last-eval.md`.

So the feedback delivery architecture is:

| Session path | last-eval.md loaded? | Mechanism |
|---|---|---|
| HTTP/WebUI (`server.ts`) | **Yes** — auto-injected | `promptFiles.push(lastEval)` |
| Heartbeat workflow (`heartbeat-data.ts`) | **No** — passive only | Agent must `read()` it per common-sense.md |
| Fork/call (`manager-agents-tool.ts`) | **Partial** — via deprecated `contextFiles` | Only if `agent.json` lists it |

For heartbeat sessions, feedback delivery relies on agent compliance with the
common-sense.md instruction. Arc reads it (as demonstrated in this session).
Whether other agents consistently do so is unverified.

## What KE-1883 Gets Right

- The evaluator does consume ~45% of system compute
- The `file_reads` table shows zero explicit file reads of evaluation results
  (agents don't `read()` `.state/eval` files)
- The majority of sessions (heartbeats) don't receive auto-injected feedback
- The overall feedback loop is weaker than it should be

## What KE-1883 Gets Wrong

- "No pipe at all" — a pipe exists (feedback-echo-sync → last-eval.md → prompt)
- "The cheapest intervention: inject issues into prompt context" — this is
  already implemented for HTTP sessions and instructed for all sessions
- The proposed 3-issue injection format is nearly identical to what
  `feedback-echo-sync.ts` already produces (latest issues + recent patterns)
- "Zero agents read evaluations" conflates file_reads table entries with actual
  prompt injection; last-eval.md is injected in HTTP path and readable in all

## The Actual Fix Needed

The gap is narrow: add `last-eval.md` content to the `genericHeartbeat` task
prompt in `heartbeat-data.ts`. This would close the loop for the majority path
(heartbeat sessions). The content is already on disk, the format is already
designed, and the HTTP path already demonstrates the injection pattern.

Approximate diff:
```typescript
// In genericHeartbeat(), after loading guidance:
const lastEvalPath = join(agentsRoot, agent, "last-eval.md");
const lastEval = existsSync(lastEvalPath) ? readFileSync(lastEvalPath, "utf-8") : "";
// Then include in the prompt template
```

This is a `packages/sdk/src/` change (within ORDER-010 scope, requires Hao
approval).

## Evidence

- `feedback-echo-sync.ts`: lines 1-50, reads evaluations table, writes last-eval.md
- `server.ts:3092-3094`: `const lastEval = readFile(...)` + `promptFiles.push(...)`
- `heartbeat-data.ts:454-530`: `genericHeartbeat` function, no last-eval reference
- `manager.ts:1264-1279`: `resolveSystemPrompt` loads only common-sense.md + AGENTS.md
- `common-sense.md`: "If `agents/<you>/last-eval.md` exists, read it at session start"
- Arc's current session: successfully read and processed last-eval.md content
