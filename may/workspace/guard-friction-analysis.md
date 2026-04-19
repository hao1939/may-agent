# FM-3.3 Guard Friction Analysis

## Guard Architecture

Two guards intercept `finish(status: "success")`:

### 1. `finish-guard.ts` — 3 gates
| Gate | Trigger | False Positive Risk |
|------|---------|-------------------|
| Gate 0: Ghost Deliverable | Summary has action keywords ("Fixed", "Implemented") + no write evidence + no deliverables | **Low** — legitimate |
| Gate 1: No Write Evidence | Deliverables listed but no write/edit/bash-write in transcript | **Low** — legitimate |
| Gate 2: No Verification | Writes exist but no verification after last write (bash-writes only; write()/edit() exempt) | **Medium** — overlaps with verification-depth-guard |

### 2. `verification-depth-guard.ts` — 2 rules
| Rule | Trigger | False Positive Risk |
|------|---------|-------------------|
| T1: Git on Gitignored | Git commands on agents/ as sole verification | **Low** — rare |
| T2: No Post-Write Verification | Writes exist, no verification after last write (write()/edit() exempt) | **Medium** — same check as Gate 2 |

## Key Finding: Redundancy

**finish-guard Gate 2** and **verification-depth-guard T2** check the same condition: "bash-based writes with no post-write verification." Both exempt write()/edit(). An agent blocked by one is almost always blocked by the other → **double error messages, double confusion**.

## Why FM-3.3 Keeps Appearing

The guards work correctly. The friction comes from:

1. **Retry cost**: Agent calls finish(), gets blocked, runs a read/test, calls finish() again → 2-3 extra tool calls per session. This is by design but accounts for most FM-3.3 mentions in evaluations.
2. **Double-blocking**: Both guards fire on the same condition → agent sees two error messages.
3. **agents.call() not recognized**: When an agent delegates work via `agents.call()` and the child succeeds, the parent has no "write" in its own transcript but `hasWriteEvidence` correctly detects the `agents` tool. However, verification-depth-guard does NOT check for `agents`/`workflow` tool usage — it could false-positive on orchestration sessions.

## Concrete Recommendations

### R1: Remove finish-guard Gate 2 (deduplicate)
**Risk: Low.** verification-depth-guard T2 covers the same case with better logic (tracks per-call indices, not message indices). Remove Gate 2 from finish-guard to eliminate double-blocking.

### R2: Add orchestration exemption to verification-depth-guard
**Risk: Low.** If the session used `agents` or `workflow` tools, writes happened in child sessions. The verification-depth-guard should skip or soften its check, matching finish-guard's existing logic.

### R3: Improve error message specificity  
**Risk: None.** T2's message says "verify your work" generically. It should name the specific bash command that triggered the write detection, so the agent knows exactly what to verify.

## Implementation Priority

1. **R1** — highest impact, simplest change (delete ~15 lines)
2. **R2** — prevents false positives on orchestration sessions
3. **R3** — nice-to-have, lower priority
