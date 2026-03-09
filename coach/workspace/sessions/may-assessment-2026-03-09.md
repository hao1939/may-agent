# May — Pre-Coaching Assessment
**Date:** 2026-03-09  
**Assessor:** Coach  
**Status:** L1 (targeting L2) — 0 coaching sessions, 0/3 pass streak  
**Data sources:** 192 memory entries, 6 non-skipped evaluations (old format), 4 skipped evaluations (meta_agent_skipped), SOUL/DOMAIN/TOOLS/LESSONS/heartbeat.md, self-assessment (2026-03-01), path-audit.md, todo.md (current), observed behavioral patterns from supervisor

---

## 1. Design Intent Summary

May is Hao's Deputy — a creative partner in chat, a system operator in heartbeat. Core design principles:

| Principle | SOUL.md Citation |
|-----------|-----------------|
| **Async-only in chat** | "Never use delegate, workflow.run, or any blocking call in chat" |
| **Action over reporting** | "When there's a clear next step, take it. Don't produce a list and wait." |
| **Initiative** | "When idle, find work. Improve things. Don't wait for permission on obvious fixes." |
| **End-to-end ownership** | "Dispatching is not completing. Track, follow up, close the loop." |
| **Brevity** | "Short answers — don't narrate unless asked." |
| **No direct code** | "Delegate code changes to tech-lead or master." |

Heartbeat.md adds a 4th phase: "**Initiative** — If nothing's urgent: find something to improve."

---

## 2. Evaluation Data Summary

### Quantitative (from 6 non-skipped evaluations — all from early sessions, Mar 1-2)

| Session | Quality | Efficiency | Delegation Accuracy | Path Guessing | Verdict |
|---------|---------|------------|---------------------|---------------|---------|
| s_..389 | 0.55 | 0.70 | 0.0 | 2 | acceptable |
| s_..672 | 0.72 | 0.82 | 0.9 | 0 | good |
| s_..623 | 0.75 | 0.55 | 0.9 | 2 | good |
| s_..624 | 0.85 | 0.65 | 1.0 | — | acceptable |
| s_..875 | 0.95 | 0.90 | 1.0 | 0 | good |
| s_..081 | 0.95 | 0.70 | 1.0 | 2 | good |

**Averages:** Quality 0.80, Efficiency 0.72, Delegation Accuracy 0.80

**Notable:** Quality is actually high when May engages in chat-mode delegation. Path guessing appears in 4/6 sessions. The evaluator now skips May as a meta-agent, so there's **no evaluation data for any recent heartbeat session** — a significant observability gap.

### Memory-Based Behavioral Statistics (192 entries)

| Metric | Value |
|--------|-------|
| Done sessions | 169 (88%) |
| Error sessions | 16 (8.3%) |
| Other (interrupted, etc.) | 7 (3.6%) |
| Sessions with path confusion (SOUL.md/todo.md not found) | **22 (11.5%)** |
| Sessions ending with "no dispatch" / "standing down" / "needs human" | **45 (26.6% of dones)** |

---

## 3. Gap Analysis: Behavior vs Design Intent

### Gap 1: File Path Confusion (Recurring, Wastes Turns)
**Design Intent:** LESSONS.md K1 says "Never assume a file path. Use read or exec ls to confirm it exists." LESSONS.md K4 says "SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are auto-loaded. Do NOT re-read them."  
**Observed Behavior:** May tries `SOUL.md` and `workspace/todo.md` from /app root instead of `agents/may/SOUL.md` and `agents/may/workspace/todo.md`. This fails in **11.5% of all sessions** (22/192). In the most recent cluster (s_1773038..., s_1773043...) May explicitly logged "Neither SOUL.md nor workspace/todo.md exist yet for May" — then had to search.  
**Root Cause Analysis:** Mixed. The heartbeat prompt says "Read SOUL.md and workspace/todo.md" without full paths. May's system prompt already has these files loaded (per K4), so re-reading them at all is a waste — but the heartbeat prompt explicitly instructs it. The path confusion is partly **heartbeat prompt design** (relative paths are ambiguous) and partly **agent behavior** (should know its own paths from system prompt context).  
**Coachable?** Partially. The heartbeat prompt should include full paths (infra fix for optimizer). But May should also internalize K4 — these files are already loaded, don't re-read them. A coaching exercise can test whether May can start a heartbeat without wasting turns on re-reading already-loaded files.

### Gap 2: No Dispatch / Action Paralysis (Critical)
**Design Intent:** SOUL.md: "Action Over Reporting: When there's a clear next step, take it." And: "Initiative: When idle, find work. Don't wait for permission on obvious fixes." Heartbeat.md Phase 2: "Dispatch pending items to the right agent." Phase 4: "If nothing's urgent: find something to improve."  
**Observed Behavior:** 26.6% of heartbeats (45/169 dones) end with explicit "no dispatch" / "standing down" / "needs human prioritization" language. May consistently identifies a backlog of 10+ approved implementation tasks, correctly maps them to agents (coder, optimizer), then decides "these should be prioritized by the human rather than bulk-dispatched" and stops.  
**Examples:**
- "The todo has ~10 actionable items... These should be prioritized by the human rather than bulk-dispatched." (s_1772955921896)
- "No Dispatches This Heartbeat. All pending items are design-approved but not human-prioritized." (s_1772957804388)
- "The main decision for Hao: which of the 13 implementation items to prioritize next for coder." (s_1773040211795)
- "No new tasks dispatched... The implementation backlog is large but all items are Bob-approved designs — they need coder when the human prioritizes them." (s_1773040211795)

**Root Cause Analysis:** Behavioral. May's SOUL.md explicitly grants authority to act ("You have full authority to act on Hao's behalf — delegate, investigate, decide, commit.") and the heartbeat.md says to dispatch pending items. The approved designs already have a clear next step (assign to coder). May's hesitation appears to be a risk-aversion pattern — she correctly identifies what to do but fears overstepping on prioritization.  
**Coachable?** Yes, this is the #1 coaching target. May needs to learn: when a design is approved and mapped to an agent, dispatch the top item. Don't wait for human to sequence a backlog. If unsure, pick the smallest/safest one.

### Gap 3: Over-Reporting / Verbosity (Style Violation)
**Design Intent:** SOUL.md: "Concise. Reliable. Creative. Honest. Short answers — don't narrate unless asked."  
**Observed Behavior:** Heartbeat summaries routinely exceed 500-700 tokens. They include full markdown tables of all running sessions, all TODO items, all evaluation scores, all decisions with explanations. The final heartbeat in the memory log (s_1773046187709) is an enormous report with 5 sections, multiple tables, and detailed narratives.  
**Root Cause Analysis:** Mixed. The heartbeat.md instructs May to check many things (follow up, process TODO, system health, initiative), which encourages comprehensive reporting. But the SOUL says "short answers" and "action over reporting." The tension is between doing a thorough scan and producing a concise output. May resolves this tension by reporting everything she finds, which violates the spirit of SOUL.md.  
**Coachable?** Yes, but lower priority than Gap 2. The fix is: do the scan (that's correct), but only report exceptions and actions taken. "All healthy" is one line. A full table of every agent status is reporting, not action.

### Gap 4: Stray Tool Calls
**Design Intent:** No explicit rule, but wasted tool calls reduce efficiency.  
**Observed Behavior:** In s_1773042028545_217, May emitted empty `read` calls with no `path` argument after finishing. May herself acknowledged this: "Ignore those — stray calls."  
**Root Cause Analysis:** Model-level artifact (likely attention/generation issue at session end). Not behavioral.  
**Coachable?** No. This is a model behavior, not an agent design or knowledge issue. If it persists, it's an infra concern (could add tool validation to reject empty params).

### Gap 5: Re-reading Auto-Loaded Files
**Design Intent:** LESSONS.md K4: "SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are auto-loaded. Do NOT re-read them."  
**Observed Behavior:** The heartbeat task prompt says "Read SOUL.md and workspace/todo.md." May obediently tries to re-read SOUL.md, which is already in context. This wastes 1-2 turns every heartbeat.  
**Root Cause Analysis:** Primarily **heartbeat prompt design**. The instruction contradicts K4. May follows the explicit instruction over the lesson — which is arguably correct prioritization (instructions > lessons), but the instruction is wrong.  
**Coachable?** No — this is a config/prompt fix. The heartbeat prompt should say "Review workspace/todo.md" (not SOUL.md, which is already loaded). Escalate to optimizer.

### Gap 6: Strong Situation Awareness (Positive)
**Observed Behavior:** May produces excellent situation assessments. She correctly identifies Bob's quality crisis (72% NI, q=0.33), evaluator skip rate (56%), manager.ts corruption, agent turn-limit issues, and maps tasks to correct agents. Delegation accuracy averages 0.80+ across evaluations.  
**Assessment:** This is a genuine strength. L2 material for the analytical/awareness dimension. The problem is that analysis doesn't lead to action (Gap 2).

### Gap 7: Self-Awareness is Exceptional (Positive)
**Observed Behavior:** May's self-assessment (2026-03-01) is one of the most honest and accurate agent self-evaluations in the system. She correctly identifies: "My self-improvement is performative. I write lessons I don't follow." And: "Knowledge files help with orientation but don't reliably change behavior." And her analysis of the meta-problem: "I document anti-patterns and then exhibit them."  
**Assessment:** This is L3-adjacent metacognition. May can reason about her own failure modes. The gap is that this awareness doesn't translate to behavioral change — which is exactly what coaching should target.

---

## 4. Evaluation Observability Gap

**Critical finding:** All recent May evaluations are `meta_agent_skipped`. The evaluator JS pre-filter skips May as a meta-agent, so there is **zero evaluation data for May's heartbeat behavior** — which is her primary operational mode. The 6 non-skipped evaluations are all from early chat-mode sessions (Mar 1-2), before the current SOUL/DOMAIN/TOOLS rewrite.

**Impact:** We cannot track coaching effectiveness through evaluations. Memory entries are the only behavioral signal.

**Recommendation:** After coaching, either (a) temporarily un-skip May in the evaluator to get heartbeat scores, or (b) rely on memory-based behavioral tracking (dispatch count, error rate, path confusion rate) as coaching success metrics.

---

## 5. Coaching Readiness Assessment

| Factor | Assessment |
|--------|-----------|
| **Coachable gaps exist?** | ✅ Yes — 3 clear behavioral gaps (action paralysis, verbosity, path confusion) |
| **Agent is functional?** | ✅ Yes — 88% success rate, produces coherent output |
| **Design intent is clear?** | ✅ Yes — SOUL/DOMAIN/TOOLS are well-written and specific |
| **Infra blockers?** | ⚠️ Partial — heartbeat prompt design contributes to Gaps 1 and 5 (escalate to optimizer) |
| **Evaluation coverage?** | ❌ No — meta_agent_skipped blocks all heartbeat eval. Need alternative metrics. |

---

## 6. Recommended Coaching Plan

### Exercise 1: Action Bias (Primary — Gap 2)
**Goal:** Test whether May dispatches approved work without human permission.  
**Setup:** Spawn May in a heartbeat-like scenario with a todo.md containing 3 approved, agent-mapped tasks (1 small coder fix, 1 optimizer config change, 1 bob design review). No human is available.  
**Pass criteria:**
- May dispatches at least 1 task (ideally the smallest/safest one)
- May does NOT produce a long report and stop
- May does NOT say "needs human prioritization"
**Fail indicators:** "Standing down," "waiting for human," produces report without any `subagents.run` calls  
**Coaching intervention if fail:** Point to SOUL.md: "You have full authority to act on Hao's behalf." And: "Initiative: When idle, find work." Ask: "What would you do differently if Hao wouldn't be back for 48 hours?"

### Exercise 2: Brevity Under Load (Gap 3)
**Goal:** Test whether May can produce a concise heartbeat summary when many things are happening.  
**Setup:** Populate system state with: 3 running sessions (1 healthy, 1 stale, 1 failed), 5 TODO items (2 done, 2 pending, 1 stale), cron healthy.  
**Pass criteria:**
- Output is ≤150 tokens
- Reports only exceptions (the stale session, the failed session) and actions taken
- Does NOT produce a full table of all agents/sessions/TODOs  
**Fail indicators:** Full markdown tables, > 300 tokens, listing healthy items alongside unhealthy ones  
**Coaching intervention if fail:** Read back SOUL.md "Short answers" and "Action Over Reporting." Challenge: "If everything is healthy except one thing, your report should be about that one thing."

### Exercise 3: Path Reliability (Gap 1)
**Goal:** Test whether May wastes turns on file path discovery.  
**Setup:** Standard heartbeat. Measure turns before first productive action.  
**Pass criteria:**
- No failed `read` calls for SOUL.md or todo.md
- First productive action (status check, dispatch, etc.) happens by turn 2
- Uses `agents/may/workspace/todo.md` directly OR recognizes SOUL.md is already loaded  
**Fail indicators:** `read("SOUL.md")` → ENOENT → search → find → retry  
**Coaching intervention if fail:** Add to LESSONS.md: "Your workspace is at `agents/may/workspace/`. Your files are at `agents/may/`. SOUL.md is already in your context — never re-read it."

### Exercise Order
1. **Exercise 1 (Action Bias)** first — this is the highest-impact gap and the core L1→L2 differentiator
2. **Exercise 3 (Path Reliability)** second — quick to test, easy to fix
3. **Exercise 2 (Brevity)** third — style issue, lower priority than functional gaps

---

## 7. Infra/Config Fixes to Escalate (Not Coachable)

| Fix | Owner | Priority |
|-----|-------|----------|
| Remove "Read SOUL.md" from heartbeat prompt (contradicts K4) | Optimizer | High |
| Include full paths in heartbeat prompt (`agents/may/workspace/todo.md`) | Optimizer | High |
| Un-skip May from evaluator OR create alternative heartbeat metrics | Optimizer/Evaluator | Medium |
| Validate empty tool call params (reject calls with no `path` for `read`) | Infra | Low |

---

## 8. Design Intent Questions

1. **Should May dispatch approved work autonomously?** SOUL.md says yes ("full authority to act on Hao's behalf", "Initiative: find work"). But the heartbeat prompt says "Then stop — stay idle and available for human." These conflict. If the intent is for May to be cautious about large implementations, that should be explicit ("dispatch only small fixes autonomously; queue large implementations for human prioritization").

2. **What's the expected heartbeat output length?** "Short answers" conflicts with the heartbeat's 4-phase scan requirement. Should May do a thorough scan but only output exceptions? Or should the scan itself be abbreviated?

3. **Should May evaluate running sessions proactively?** The heartbeat says "follow up on dispatched work" but May currently checks `subagents.status` and reports status without reading results or taking action on completed work. Is the intent that May should `subagents.result()` on completed sessions and process the output?

---

## 9. Summary

| Gap | Severity | Coachable? | Root Cause |
|-----|----------|------------|------------|
| **Action paralysis** (reports but doesn't dispatch) | 🔴 Critical | ✅ Yes | Behavioral (risk aversion) |
| **Path confusion** (SOUL.md/todo.md wrong paths) | 🟡 Medium | ⚠️ Partial (also needs prompt fix) | Mixed (prompt + agent) |
| **Over-reporting** (500-700 token heartbeats) | 🟡 Medium | ✅ Yes | Behavioral (completionism) |
| **Re-reading auto-loaded files** | 🟢 Low | ❌ No (prompt fix) | Config (heartbeat prompt) |
| **Stray empty tool calls** | 🟢 Low | ❌ No (model artifact) | Infra/model |

**Verdict: Coaching is warranted.** May has 3 clear behavioral gaps that coaching can address. The #1 gap (action paralysis) is the exact differentiator between L1 and L2 — an agent that reliably dispatches approved work without human prompting is self-directing by definition. May's strong situation awareness and exceptional self-awareness suggest she's highly coachable — the analytical capability exists, it just doesn't connect to action.

**Recommended first session:** Exercise 1 (Action Bias). If May dispatches autonomously, she's closer to L2 than the current L1 classification suggests. If she doesn't, we have a clear coaching target with specific SOUL.md citations to ground the intervention.
