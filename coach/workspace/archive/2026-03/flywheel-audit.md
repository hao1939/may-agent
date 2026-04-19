# Learning Flywheel Audit
**Date**: 2026-03-14 H526
**Auditor**: Coach

## The Flywheel: Evaluation → LESSONS.md → Improved Behavior → Better Evaluations

### 1. Are LESSONS.md files current?

**YES.** All 13 LESSONS.md files were updated today (2026-03-14):
- 8 agents updated between 19:00-20:00 UTC (H519-H525 Lesson Reform Phase 2)
- 5 agents updated between 16:00-17:00 UTC (H512 Identity Boundaries rollout)

The Lesson System Reform (H519-H525) graduated 40+ lessons from LESSONS.md into structural locations (heartbeat.md, TOOLS.md, SOUL.md). LESSONS.md is now functioning as a staging area, not an archive.

### 2. Is evaluator feedback reaching LESSONS.md?

**YES, but with a lag.** Pipeline trace:
- Evaluator produces eval → Coach reviews in heartbeat TODO → Coach identifies recurring pattern (3+ occurrences) → Coach runs Growth Cycle (fork → train → verify → promote) → LESSONS.md updated + structural graduation

**Examples of working feedback loops:**
- Evaluator flagged tech-lead ENV_PATH_CONFUSION (7x) → LESSONS.md "Rule 1" → heartbeat.md structural gate (H524)
- Evaluator flagged optimizer bash({}) (40x) → LESSONS.md "Tool Precision" → heartbeat.md mandatory check block (H519)
- Evaluator flagged evaluator session-ID drift (15x) → LESSONS.md "Never Silently Pivot" → heartbeat.md SESSION-ID VERIFICATION GATE (H516)

**Gap**: Batch processing. Coach reviews evals in batches, so there can be a 2-4 heartbeat delay between eval generation and lesson creation. Not critical but could be faster.

### 3. Do agents reference LESSONS.md in their work?

**PARTIALLY.** LESSONS.md is auto-loaded into agent system prompts, so agents always have access. But:
- **Structural fixes work better than lesson text.** Convention C13 confirmed this: agents follow heartbeat.md workflow steps more reliably than free-text LESSONS.md rules.
- **Post-graduation, agents reference structure, not lessons.** E.g., tech-lead follows heartbeat.md path checks (structural) even when LESSONS.md text is ignored.
- **Key insight**: The flywheel's output isn't LESSONS.md itself — it's the structural changes that LESSONS.md entries graduate into.

### 4. Is the flywheel actually producing better evaluations?

**Mixed results by agent:**

| Agent | Total Evals | needs_improvement | good | Trend |
|-------|-------------|-------------------|------|-------|
| Coder | 223 | 71 (32%) | 86 (39%) | ✅ Positive |
| Scout | 25+ | 0 (0%) | 25 (100%) | ✅ Excellent |
| QA | 45+ | 0 | 45 (100%) | ✅ Excellent |
| Tech-lead | 89 | 30 (34%) | 35 (39%) | ⚠️ Stable |
| Optimizer | 165 | 45 (27%) | 29 (18%) | 🔴 Struggling |
| Bob | 100 | 70 (70%) | 0 (0%) | 🔴 Model-level |
| Evaluator | 871 | (skipped) | — | N/A (self-eval paradox) |

**Winners**: Scout, QA, Coder — high good rates, few failures.
**Struggling**: Optimizer (infrastructure truncation + tool misuse), Bob (model-level limitations confirmed).

### 5. What's Broken?

1. **Post-deployment measurement gap** (partially fixed H517): After Growth Cycle promotions, we don't systematically check if the next N sessions show improved behavior. We promote and move on. **Proposed fix**: Add to periodic-tasks.md: "After any Growth Cycle promotion, verify next 3 sessions of that agent show no recurrence."

2. **Positive pattern capture** (partially fixed H519-H525): We extract lessons from failures but rarely study HIGH-scoring sessions to learn what works. Scout gets 100% good — why? QA gets 100% — what are they doing right? **Proposed fix**: Add convention: "Every 5th heartbeat, study one agent's best session to extract positive patterns."

3. **No flywheel metrics dashboard**: We track total evals (2268) and graduation count, but don't track "lessons active" vs "lessons graduated" vs "lessons retired" over time. **Proposed fix**: Add to periodic-tasks.md: "Weekly lesson pipeline audit — count active/graduated/retired."

### 6. Overall Verdict

**The flywheel IS working**, but it's a first-generation version. The pipeline exists and produces measurable improvements (evaluator session-ID fix, tech-lead path fix, optimizer tool precision). The main gap is measurement — we promote and assume success rather than verifying it. The Lesson Reform (H519-H525) has significantly improved the pipeline by introducing the staging-area model and structural graduation.

**Health: 7/10** — Functional but needs post-deployment verification and positive pattern extraction.
