# Evaluation: OpenClaw COMMON.md Behavioral Contract

**Date:** 2026-03-22
**Type:** Research/Analysis (not a coaching exercise)
**Source:** `/home/hao/openclaw-config/COMMON.md`
**Evaluated against:** `agents/CONVENTIONS.md`, agent domain.md files, `agents/shared/philosophy.md`

## Summary

Evaluated 6 patterns from OpenClaw's shared behavioral contract against our system.
**Result: Adopt 2, adapt 1, reject 3.** Our system already covers most of this ground
through different mechanisms. The patterns that add value are ones we genuinely lack;
the ones we reject are either already handled differently or don't fit our architecture.

---

## Pattern 1: Heartbeat Decision Tree

**OC Pattern:** Formal decision tree — ongoing task → continue; no task → check TODO; empty → self-directed L2.

**Our equivalent:** Cron-driven drain-todo pattern in `agents/CONVENTIONS.md` (lines 192-213). May's cron.json wakes agents with explicit instructions: "Read todo.md, do top item."

**Verdict: REJECT — already covered differently.**

Our system is cron-driven, not heartbeat-driven. Agents don't "wake up and decide what to do" — they receive a specific cron message telling them what to check. This is more explicit and less error-prone. The OC decision tree solves the "what do I do when I wake up?" ambiguity, but our cron messages eliminate that ambiguity by being specific.

The L2 (self-directed) escalation is interesting but premature for us. Our agents don't yet have idle cycles — they have explicit todo items. When an agent's todo.md is empty, the cron just fires with nothing to do. If we want L2 behavior, we'd add it to the cron message itself: "If no TODO items, explore X."

**Risk of adopting:** Agents deciding on their own what to do leads to drift. Our explicit delegation model is safer at current scale.

---

## Pattern 2: "No Chores" Rule

**OC Pattern:** Agents do cognitive work. Infrastructure handles mechanical checks (health, credentials, file size monitoring, counting own failures).

**Our equivalent:** Partially covered. Our agents don't do infrastructure checks, but this isn't stated as an explicit rule anywhere. The boundary is implicit.

**Verdict: ADAPT — make the boundary explicit in shared docs.**

The "What You DON'T Do" list from COMMON.md is excellent documentation. We should add a similar section to a shared knowledge file. Our specific items differ (we don't have cookie/credential issues), but the principle is the same: agents shouldn't waste tokens on mechanical self-checks.

**Proposed addition to `agents/shared/philosophy.md` or a new `agents/shared/agent-rules.md`:**
```markdown
## What Agents Don't Do (Infrastructure Handles This)
- ❌ Monitoring their own health or uptime
- ❌ Checking if other agents are running
- ❌ Re-reading journals to count past failures
- ❌ File system maintenance (cleanup, rotation)
- ❌ Git housekeeping beyond their own commits
If infrastructure detects something you need to act on, it writes to your todo.md.
```

---

## Pattern 3: P1 Exit Criteria with Evidence

**OC Pattern:** Before marking `[DONE]`, run 3-question sanity check: (1) output file exists at expected path, (2) knowledge file updated, (3) signal sent if warranted. Record evidence inline: `[DONE] — Evidence: synthesis at path, N findings, Telegram sent.`

**Our equivalent:** We already use result icons (✅ ⚠️ ❌) in Tracking sections, and the coach's reports include evidence. But agents themselves don't systematically verify their own output before declaring done.

**Verdict: ADOPT — add to CONVENTIONS.md Tracking section.**

This is a genuine gap. Our agents mark tasks done in todo.md without structured evidence. The 3-question checklist is lightweight and catches the common failure of "said done but file wasn't written." The evidence format `[DONE] — Evidence: ...` is already compatible with our tracking format.

**Proposed addition to `agents/CONVENTIONS.md` under Workspace Conventions > todo.md:**
```markdown
### Completion Evidence
Before moving a TODO item to Tracking, verify:
1. Output file exists at the expected path (if applicable)
2. Relevant workspace files updated (journal.md, learnings.md)
3. Changes committed (if applicable)

Record evidence in the Tracking entry:
- [2026-03-22] ✅ Task name — Evidence: output at path/file.md, tests pass, committed abc1234
```

---

## Pattern 4: P3 Complex Task Checkpointing

**OC Pattern:** Tasks ≥10 tool calls get `[COMPLEX]` marker. If interrupted, leave checkpoint with progress, resume point, and files to re-read. First tool call after interruption is always a read.

**Our equivalent:** Crash recovery is a first-class concern (Philosophy principle #8). We write state at start, update at end. But we don't have a standardized checkpoint format.

**Verdict: REJECT — philosophy already covers this; format is premature.**

Our Philosophy #8 (Crash Recovery) and the existing todo.md tracking pattern handle this conceptually. The specific `[COMPLEX]` marker format adds ceremony without clear benefit at our scale. Our agents rarely run tasks long enough for checkpointing to matter — most are single-cron-cycle operations.

If we observe agents losing progress after interruptions, revisit. Currently no evidence this is a problem.

---

## Pattern 5: Escalation Protocol

**OC Pattern:** Write to `~/.openclaw/INBOX.md` with agent name, timestamp, description. Clear triggers: tool broken, stuck 3x, out-of-scope, too complex.

**Our equivalent:** No formal escalation path. Agents can "escalate to master" or "say so" if tasks are unclear, but there's no shared inbox or structured escalation protocol.

**Verdict: ADOPT — implement lightweight escalation via todo.md cross-references.**

This is a real gap. When an agent is stuck, it currently has no standardized way to signal this. Some domain.md files mention escalation (May's says "escalate to Master"), but there's no system-wide protocol.

However, adopting OC's shared INBOX.md pattern doesn't fit our architecture. We don't have a "Main" agent that reads a global inbox. Instead, our escalation should flow through existing channels:

**Proposed approach:**
1. Add an escalation convention to `agents/CONVENTIONS.md`: "If stuck after 2 attempts, write `[STUCK] reason` to your todo.md and stop. The next cron cycle or human review will catch it."
2. Agents can also escalate to May via the delegation chain (already works for coder → May → master).
3. The `[STUCK]` marker in todo.md is auditable and doesn't require new infrastructure.

---

## Pattern 6: Structured Failure Records

**OC Pattern:** 4-element failure format: Moment (what happened), Cause (root cause), Correct response (what should have been done), General principle (lesson that generalizes). Claimed to compress 10-20× more info than freeform.

**Our equivalent:** Coach reports already use a similar structure (Observations, Evidence, root cause classification). The evaluator produces scores and issue lists. But agents themselves don't use structured failure records in their journals.

**Verdict: REJECT — already covered by evaluator + coach pipeline.**

Our meta-loop (evaluator → optimizer → coach) already captures failures structurally. Having agents self-diagnose with this format would duplicate the evaluator's job and add token cost to every agent's journal. The "general principle" extraction is valuable but belongs in lessons.md (maintained by the optimizer), not in individual journal entries.

If we see agents making the same mistake repeatedly without it being captured by the evaluator, reconsider.

---

## Action Items

| # | Action | Where | Priority |
|---|--------|-------|----------|
| 1 | Add "No Chores" boundary to shared knowledge | `agents/shared/philosophy.md` or new file | Medium |
| 2 | Add completion evidence convention to CONVENTIONS.md | `agents/CONVENTIONS.md` Workspace Conventions | High |
| 3 | Add `[STUCK]` escalation convention to CONVENTIONS.md | `agents/CONVENTIONS.md` Workspace Conventions | Medium |

These should go to the **optimizer's todo.md** for implementation, since the optimizer owns knowledge file changes.

---

## Patterns Explicitly NOT Adopted (with reasoning)

- **Heartbeat decision tree** — Our cron system is more explicit; agents don't need to self-decide.
- **Complex task checkpointing** — Philosophy #8 covers conceptually; no observed failures to justify format.
- **Structured failure records in journals** — Evaluator + coach pipeline handles this systemically.
- **L1/L2/L3 capability levels** — Interesting framework but tracked as separate todo item, not part of this evaluation.
- **Journal format specification** — OC prescribes a detailed format; our agents have simpler journals. Premature to standardize — different agents have different journaling needs.
- **System prompt discipline (P2)** — Architectural concern for the runner, not agent behavior. Already handled at infrastructure level.
- **IPI defense** — Security patterns specific to OC's threat model. We don't have shared files modified at filesystem level (our agents use tools with access controls).
- **Multi-agent topology rules** — Already implicitly followed; our architecture is parallel specialists with May as coordinator.
