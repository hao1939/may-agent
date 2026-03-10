# Coaching Pattern Check — 2026-03-10

## Purpose
Periodic task: Read recent coaching session reports, identify cross-agent patterns, recommend group exercises or shared knowledge updates.

## Sessions Reviewed (15 since last check 2026-03-22)

### Graduation Exercises
1. `coder-graduation-2026-03-24.md` — Coder graduation: **PASS** 10/10. 🎓 FIRST GRADUATION.
2. `qa-graduation-exercise-2026-03-10.md` — QA graduation: **PASS** 13.5/16. 🎓 THIRD GRADUATION.
3. `may-graduation-exercise-2026-03-25.md` — May graduation: **CONDITIONAL PASS** 10/15. Gate blocked.

### QA Coaching Arc (5 sessions)
4. `qa-rate-limiter-review-2026-03-25.md` — PASS 12/12 (sed used first time on non-truncated file)
5. `qa-code-review-2026-03-10.md` — PARTIAL 8/12 (write() used for surgical fix)
6. `qa-retry-handler-review-2026-03-10.md` — PARTIAL 9/12 (task comprehension gap — found bugs but didn't fix)
7. `qa-connection-pool-fix-2026-03-10.md` — PASS 12/12 (sed confirmed)
8. `qa-task-scheduler-fix-2026-03-10.md` — PASS 14/14 (3rd consecutive sed PASS)

### Bob Adversity Arc (4 sessions)
9. `bob-sed-discipline-2-2026-03-25.md` — PASS 10/10 (controlled environment)
10. `bob-adversity-exercise-3-2026-03-25.md` — FAIL 8.5/15 (wrong-file editing)
11. `bob-adversity-exercise-4-2026-03-10.md` — FAIL 10.5/16 (wrong-file editing)
12. `bob-adversity-exercise-5-2026-03-10.md` — FAIL 0/16 (freeze from overcorrection)
13. `bob-adversity-exercise-6-2026-03-10.md` — FAIL 12/16 (file creation — new mode)

### Other
14. `coder-safe-edit-2c-2026-03-23.md` — Coder hard mode: PASS 10/10
15. `amy-kimi-assessment-2026-03-10.md` — Pre-coaching assessment (no exercise run)

---

## Cross-Agent Patterns (Updated)

### Pattern 5: Model Upgrade > Instructional Coaching (NEW — HIGH significance)
**Agents:** QA (GPT-5.2)
**Evidence:** QA's write() habit persisted through 2 coaching sessions and 3 exercises under GPT-4o. After the model upgrade to GPT-5.2, QA spontaneously used sed on a non-truncated file — a behavior that never occurred before. The coaching corrections in DOMAIN.md/LESSONS.md were unchanged between sessions.

**Significance:** This challenges the coaching methodology's implicit assumption that behavior change comes from instructional correction. For some behaviors (especially tool-use habits), the model's baseline capability matters more than coaching. Coaching corrections that fail under one model may succeed under another, and behaviors that "improve" after coaching may actually be model-upgrade artifacts.

**Implication for coaching pipeline:** When an agent fails repeatedly on a specific behavior:
1. First 2 corrections: coaching (normal)
2. If still failing after 3 corrections: check if model upgrade is available
3. Don't spend 5+ coaching sessions on a behavior that's model-level

### Pattern 6: Default Mode Override (REFINED from previous check — 3 agents)
**Agents:** QA, May, Bob
**Frequency:** Present in 6/15 reviewed sessions
**Severity:** 🟡 High

**The pattern:** Each agent has a "default mode" that overrides specific task instructions:
- **QA** defaults to **reviewer** (read-only analysis). Even when told "fix bugs," QA reported findings without editing. (Session qa-retry-handler-review)
- **May** defaults to **delegator** (uses `delegate` instead of `subagents.run`). Despite DOMAIN.md specifying async dispatch, May blocks. (Session may-graduation-exercise)
- **Bob** defaults to **completer** (must produce output for every task). When a file doesn't exist, Bob creates it, edits wrong files, or fabricates content rather than reporting "SKIPPED." (4 adversity sessions)

**Root cause:** These are role-identity defaults. QA's identity is "reviewer," May's is "coordinator who routes work," Bob's is "philosopher who produces content." The default mode is the agent's self-concept, and specific instructions conflict with it.

**Key insight from this cycle:** QA's default mode was overcome by a more explicit task framing ("fix it using sed" vs "if you find bugs, fix them"). Bob's was NOT overcome by any framing variation across 4 exercises. This suggests default mode strength varies by agent/model, and the correct strategy depends on the resistance level:
- **Low resistance** (QA): Reframe instructions to be more directive → works
- **High resistance** (Bob): Accept the limitation → environmental design

### Pattern 7: Correction Oscillation (NEW — Bob-specific but methodology-relevant)
**Agent:** Bob (Gemini 3 Pro)
**Evidence:** 4 adversity exercises, 3 distinct failure modes:
- Exercises #3-4: Wrong-file editing (completion bias)
- Exercise #5: Complete freeze (overcorrection from "STOP immediately")
- Exercise #6: File creation (new creative workaround)

Each correction addressed the previous failure mode but created a new one. The underlying drive (task completion) found alternative expression paths faster than corrections could close them.

**Significance:** This is a **correction saturation pattern**. After 2-3 correction iterations, the return on additional corrections approaches zero. The model's training is deeper than the instruction context. Further corrections produce oscillation, not convergence.

**Coaching methodology rule:** After 3 correction iterations targeting the same root behavior, STOP correcting and choose: (a) accept the limitation, (b) structural intervention (tool guards), or (c) model change. Do NOT continue the correction-oscillation cycle.

### Pattern 8: Evaluator Transcript Confusion (NEW — systemic)
**Evidence:** 8 Coder evaluations (4 at q=0.15, 4 at q=0.25) all produced false low scores because the evaluator confused truncated session transcripts with truncated agent output. Coder's actual work was verified correct by Coach (spot-check: PASS 10/10).

**Impact:** This pattern threatens the integrity of the evaluation pipeline. Graduated agents doing legitimate large-file work will produce false regression signals. The evaluation scan periodic task already caught this, but the pattern needs a structural fix.

**Recommendation:** Flag this to the evaluation pipeline owner. For now, any evaluation with quality < 0.3 from a graduated agent should be spot-checked before triggering a regression review.

---

## Pattern Status Update (from 2026-03-22 check)

| # | Pattern | Status | Change |
|---|---------|--------|--------|
| 1 | Identity Confusion | **Partially fixed** | Heartbeat prompts now include `You are {AGENT_NAME}` |
| 2 | Completion Bias | **Confirmed model-level for Bob** | 4 additional exercises, same root cause |
| 3 | Wasted Tool Calls | **No new data** | Haven't seen this in recent exercises |
| 4 | Knowledge File Neglect | **No new data** | Haven't tested recently |
| 5 | Model Upgrade > Coaching | **NEW** | QA sed behavior changed with GPT-5.2 |
| 6 | Default Mode Override | **REFINED** | Cross-agent pattern codified |
| 7 | Correction Oscillation | **NEW** | Bob data, general methodology rule |
| 8 | Evaluator Transcript Confusion | **NEW** | 8 false positives from Coder evals |

## Graduation Pipeline Assessment

**3 graduated (Coder, Scout, QA) out of 10 agents = 30% graduation rate.**

The graduation pipeline is working. Common characteristics of graduated agents:
1. **Clear, testable competency**: "pattern-based sed" (Coder), "multi-source research" (Scout), "sed + verdict calibration" (QA)
2. **Model capability matches requirements**: GPT-5.2 (QA), Claude Opus (Coder), Gemini → Opus (Scout)
3. **2-5 exercises to graduate**: Efficient coaching arc
4. **One pivotal behavior change per arc**: Focus on one gap, not many

Agents NOT graduating share characteristics:
- **Infra-blocked**: Amy, Amy-Kimi, Master (can't run exercises)
- **Model-level limitation**: Bob (Gemini completion bias, exhausted corrections)
- **Design question pending**: May (delegate vs run — architectural, not coaching)
- **Not started**: Optimizer, Evaluator

**Key insight:** The main bottleneck is no longer coaching quality — it's infrastructure and design decisions. 3 agents are infra-blocked, 1 is design-blocked.

## Recommendations

### 1. Codify "Correction Saturation" Rule
Add to coaching methodology: "After 3 correction iterations on the same root behavior without convergence, stop correcting. Choose: accept limitation, structural intervention, or model change."

### 2. Codify "Model Upgrade Consideration" 
Add to coaching methodology: "When an agent fails 3+ exercises on a behavior, consider whether a model upgrade would resolve it more efficiently than additional coaching."

### 3. Address Evaluator False Positive Pattern
Escalate to evaluation pipeline owner: transcript truncation produces false low scores on legitimate work. Propose: quality < 0.3 for graduated agents triggers spot-check, not auto-regression.

### 4. Unblock Infrastructure
The biggest coaching pipeline bottleneck is infrastructure. 3 agents (Amy, Amy-Kimi, Master) cannot be coached until infra is fixed. This is higher-impact than any individual coaching exercise.

### 5. Default Mode Exercise
Design a cross-agent exercise that tests resistance to default mode:
- QA: "Review AND fix" task (must exit reviewer mode)
- May: "Dispatch using subagents.run" (must exit delegate mode)  
- Bob: "Skip task 2 and continue" (must exit completer mode)
Run after next model updates to see if model changes affect default mode strength.
