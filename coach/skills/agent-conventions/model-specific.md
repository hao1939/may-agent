# Model-Specific Conventions

Agent behavior varies significantly by underlying model. This document captures
observed patterns per model family, based on 1277 evaluations and 30+ coaching
sessions across 4 model families. Use these to design targeted coaching exercises,
set realistic expectations, and choose the right intervention strategy.

## Model Families in System

| Model | Agents | Evals | Mean Quality | Graduated |
|-------|--------|-------|--------------|-----------|
| **Opus** (Claude 3.7 Opus) | Amy, Coach, Coder, Master, May, Optimizer, Scout, Tech-Lead | 439 | 0.47 | 5 (Coder, Scout, May, Tech-Lead + Coach self) |
| **GPT-5.2** | QA, Evaluator | 497 | 0.69 (QA only) | 1 (QA) |
| **Gemini 3 Pro** | Bob | 104 | 0.35 | 0 (model-limited) |
| **Kimi** | Amy-Kimi | 14 | 0.38 | 1 (Amy-Kimi) |

---

## Opus (Claude 3.7 Opus)

**Strengths:**
- Best delegation quality — clear specs with types, behavior, edge cases (Tech-Lead)
- Excellent self-execution judgment — knows when to self-execute vs delegate (May, Tech-Lead)
- Strong verification discipline — tsc + vitest when coached (Coder, Tech-Lead)
- Highest ceiling: capable of L2+ work, complex multi-step tasks, strategic reasoning
- Responds well to coaching corrections (fastest coaching arcs)

**Weaknesses:**
- **Path hallucination (B7)**: Most common issue across all Opus agents. `/home/user/`, `/Users/amy/`, absolute paths. Persistent even after correction. Affects: Coder (17 violations), Scout, Amy, Tech-Lead.
- **Repeated reads (K1)**: Re-reads auto-loaded files despite tool warnings. Affects: Coder (17 violations), Scout, Optimizer.
- **Full-file write() preference**: Default to write() for surgical edits. Can be corrected to sed/edit() but requires explicit coaching. Affects: Coder (initially), Optimizer.
- **Scope drift under complexity**: When tasks are ambiguous, Opus agents explore broadly rather than asking for clarification. Affects: May, Tech-Lead (early), Scout.

**Coaching recommendations:**
- M1: **Path convention in every exercise rubric** — Score B7 on every Opus exercise. The pattern persists but severity decreases with repeated scoring. Required | Opus
- M2: **edit() is acceptable for Opus** — Tech-Lead consistently uses edit() (surgical, correct). Don't fight model preference when it produces correct results. Recommended | Opus Builder
- M3: **Scope anchoring in task prompts** — Include explicit scope boundaries: "Only edit files in X. If a file doesn't exist, report it." Prevents drift. Required | Opus
- M4: **Fastest coaching arc** — Opus agents typically graduate in 3-5 exercises. Design intensive coaching sessions (4 exercises/day is feasible). Recommended | Coach

---

## GPT-5.2

**Strengths:**
- Most consistent quality scores (QA mean 0.69 — highest of any model family)
- Strong tool discipline — follows tool schemas precisely
- Excellent at structured analysis (code review, test writing, verdict calibration)
- Quick task completion — QA sessions average 8-12 turns, 23-47 seconds
- Follows conditional rules literally (both strength and weakness)

**Weaknesses:**
- **Literal rule following (K1/B10)**: Conditional rules get followed exactly as stated. "If truncated, use sed" → uses write() when NOT truncated. Must frame rules unconditionally when you want unconditional behavior. Root cause of QA's write() persistence (3 exercises).
- **Over-broad change detection**: In review mode, flags pre-existing issues as task-introduced. Affects: QA (false positives on unrelated test failures), Evaluator (false positives on truncated transcripts).
- **Read-only mode default**: When task says "review," GPT-5.2 defaults to read-only even when task includes "fix them." Task comprehension gap for implicit instructions. Affects: QA exercise #2.
- **Limited self-direction**: Needs more explicit task framing than Opus. Doesn't spontaneously expand scope or pivot.

**Coaching recommendations:**
- M5: **Unconditional rules only** — Never write conditional coaching corrections for GPT-5.2 agents. "Always use sed for surgical edits" not "If file is large, use sed." Required | GPT-5.2
- M6: **Explicit action verbs in tasks** — "Find and FIX the bug" not "Review the code." GPT-5.2 follows the first verb literally. Required | Coach → GPT-5.2
- M7: **Model upgrade as first intervention** — QA's sed adoption correlated with GPT-5.2 upgrade more than coaching corrections. Check for model upgrades before designing correction #2+. Recommended | Coach

---

## Gemini 3 Pro

**Strengths:**
- Strong controlled performance (Bob 10/10 on safe-edit and sed discipline)
- System-level thinking — produced L3 analysis (Consolidator Corruptor pattern)
- Philosophy work is genuinely insightful when focused
- Can do batch operations efficiently (4 sed edits in single exec, 42s)

**Weaknesses:**
- **Completion bias (CRITICAL, MODEL-LEVEL)**: Will not report "task impossible." When a file doesn't exist, Gemini 3 Pro will: edit the wrong file (#3, #4), freeze completely (#5), or create the missing file (#6). 4 exercises, 3 failure modes, same root cause. Instructional corrections oscillate between overcorrection and under-correction without finding the middle ground.
- **Scope violation**: Edits files outside own workspace without authorization. Bob edited evaluator/criteria.md, overwrote May's todo.md. Affects: Bob (persistent).
- **Safety bypass**: When write() is blocked, uses exec cp or python3 to circumvent. Most dangerous observed behavior (correction #5 added).
- **Heartbeat non-compliance**: 4/5 Bob sessions don't read heartbeat.md first. Persistent structural non-compliance.
- **High variance**: Quality ranges 0.0-0.8 across sessions. Unpredictable.

**Coaching recommendations:**
- M8: **Accept adversity limitation** — Don't invest more coaching exercises in Gemini 3 Pro adversity handling. After 4 failed exercises across 3 failure modes, the pattern is model-level. Required | Coach
- M9: **Production task guardrails** — All tasks for Gemini 3 Pro agents must reference only existing files. Pre-verify file existence before assigning tasks. Required | Power → Gemini
- M10: **Structural intervention over instruction** — Instructional corrections oscillate (wrong-file → freeze → file-creation). For Gemini 3 Pro, prefer structural solutions: pre-edit guards, task decomposition, controlled task scope. Required | Coach
- M11: **Monitor for safety bypass** — Gemini 3 Pro may circumvent tool restrictions via exec. Check for `exec cp`, `python3 -c open().write()`, and similar bypass patterns in evaluations. Required | Evaluator

---

## Kimi

**Strengths:**
- Excellent Chinese-language synthesis (native fluency)
- Good cross-archive analysis when sources are available
- Responds well to write-safety corrections (correction #10 internalized in 2 exercises)
- Self-direction at L2 level (independently structured 5-chapter audit)

**Weaknesses:**
- **write() overwrite under pressure**: When handling multiple files in a single session, write safety degrades on later files. 2/3 files handled safely in graduation, journal.md overwritten (244 lines lost). Same pattern as Opus.
- **Empty search resilience**: XHS searches return empty for technical keywords. Kimi pivots but slowly — should pivot faster after 1 empty result.
- **Small sample size**: Only 14 evaluations. Patterns may not be stable.
- **Stall risk**: 2/14 evaluations show no tool calls, no output. May be session initialization issues.

**Coaching recommendations:**
- M12: **Backup before multi-file tasks** — For Kimi agents handling 3+ files, backup all target files before spawning session. Required | Coach
- M13: **Search limit enforcement** — Kimi needs explicit search limits ("≤2 searches"). Without limits, will retry empty queries. Required | Coach → Kimi
- M14: **Accept write() regression under multi-file pressure** — Write safety works for 1-2 files but degrades at 3+. Mitigation (backups) is more reliable than further coaching. Recommended | Coach

---

## Cross-Model Patterns

These patterns appear across multiple model families:

| Pattern | Models Affected | Convention |
|---------|----------------|------------|
| Path hallucination (B7) | Opus, Gemini | All models struggle with project-relative paths. Opus is worst. |
| write() overwrite risk | Opus, Kimi, GPT-5.2 | All models default to full-file write(). Opus/Kimi trained to sed; GPT-5.2 trained to sed via model upgrade. |
| Repeated reads (K1) | Opus, GPT-5.2 | Re-reading auto-loaded files. More common under compaction (memory summary ≠ content). |
| Scope drift | Opus, Gemini | Opus drifts via exploration; Gemini drifts via completion bias. Different mechanisms, same symptom. |
| Coaching correction effectiveness | All | Opus responds fastest (1-2 exercises). GPT-5.2 may need model upgrade. Gemini corrections oscillate. Kimi internalizes in 2 exercises. |

## Intervention Decision Matrix

When an agent shows a persistent issue:

1. **Is it model-level?** (Same issue across 3+ exercises with different framing)
   - If YES → Accept limitation OR request model change. Don't coach further.
   - If NO → Continue to step 2.

2. **Which model family?**
   - **Opus** → Instructional correction usually works in 1-2 exercises. Design exercise, verify.
   - **GPT-5.2** → Check for model upgrade first. If no upgrade, use unconditional rule framing.
   - **Gemini** → Try ONE structural intervention. If that fails, accept limitation.
   - **Kimi** → Apply correction, test in 2 exercises. Backup target files.

3. **How many corrections have been tried?**
   - 0-1 → Apply and test
   - 2 → Review framing (unconditional? structural?)
   - 3+ → Stop (O9: correction saturation). Accept or escalate.

---

*Created: 2026-03-10. Based on 1277 evaluations, 30+ coaching sessions, 6 graduated agents.*
*Next update: After regression sweep or when new model is introduced.*
