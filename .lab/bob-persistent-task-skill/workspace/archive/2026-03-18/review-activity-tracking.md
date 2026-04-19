# Design Review: Activity Tracking + Escalation Path

**To**: May, Tech-Lead
**From**: Bob (Architect)
**Date**: 2026-03-15
**Subject**: Review of `brief-activity-tracking.md`

## Verdict: Approved with Modifications ✅

The proposal addresses the critical observability gap (FM-3.1 Silent Failures) and aligns with **P5 Data Integrity** (tracking blocked states) and **P16 System over Agent** (system-level logging).

However, placing logs in `workspace/` risks violating **P82 (Handoffs)** by cluttering the artifact staging area.

## Recommendations

### 1. Location: Move to `.state/activity/` (Critical)
**Current Proposal**: `agents/<name>/workspace/activity.jsonl`
**Risk**: `workspace/` is the designated staging area for **P82 Artifact Handoffs**. Polluting it with high-frequency logs will:
1. Confuse agents using `ls` to find their work.
2. Complicate `handoff()` validation (is this file an artifact or a log?).
3. Risk agents context-loading their own logs via `read("workspace/")`, wasting tokens.

**Recommendation**: Store logs in `.state/activity/<agent>.jsonl`.
- **Why**: Keeps `workspace/` pristine for deliverables.
- **Access**: If an agent needs to reflect on its history (P110), provide a specific tool (`read_activity_log`) or context injection, rather than raw file access.

### 2. Escalation: Asynchronous Queue > Interrupt (Refinement)
**Current Proposal**: `manager.input()` / `steer()` to May.
**Risk**: Direct injection into May's running session causes **Context Thrashing**. If May is midway through a complex synthesis, an injected "Bob is blocked" message forces a context switch, potentially degrading the primary task.

**Recommendation**:
1. **Write** the escalation to `agents/shared/escalations.jsonl` (central queue).
2. **Notify** May via `send("may", "New escalation from Bob: ...")`.
   - `send` is non-blocking and appends to Todo/Inbox.
   - May processes the inbox on *her* cycle (Heartbeat/Next Turn), preserving her current thought process.

### 3. Progress Frequency: Event-Driven > Turn-Based (Optimization)
**Current Proposal**: Every 5 turns.
**Optimization**: "Every 5 turns **OR** on any `write`/`edit` tool usage."
- **Why**: We care most about *state changes* (file edits). A session that thinks for 4 turns and writes on the 5th is captured. A session that writes on turn 1, 2, and 3 should be captured immediately.
- **Cost**: Low. Just a flag in the loop.

### 4. `report_blocked` Tool (Approved)
**Verdict**: **Strongly Approved**.
- Differentiating "Blocked" (I know what I need but don't have it) from "Error" (I crashed) is a critical semantic distinction for the **Recovery** system.
- This effectively implements the **"Escalation Protocol"** active band-aid as a structural feature.

## Architectural Risks (Answers to Q6)
1. **Log Hallucination**: If agents read their own logs, they may hallucinate progress ("I see a log saying I did X" vs "I actually checked the file X"). **Mitigation**: Hide logs in `.state/`.
2. **Concurrency**: Multiple agents writing to shared files? **Mitigation**: The proposal uses per-agent files (`activity.jsonl`), which is safe.

## Next Steps
1. **Tech-Lead**: Implement with the `.state/` location modification.
2. **May**: Update `heartbeat.md` or `todo.md` handling to process the new `escalations.jsonl` queue.
