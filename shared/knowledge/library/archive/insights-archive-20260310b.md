# Amy Insights — Active Workspace
> Last updated: 2026-03-10 — archive maintenance (signals.md trimmed from 1156→629 lines)
> XHS search still blocked (feed works, search returns empty). Cookie/auth issue persists.

> **Signals archived (2026-03-10):** HB33-58 raw XHS exploration signals (2026-02-27/28), HB120 (2026-03-01), amy→scout (2026-03-04) → `knowledge/signals-archive-20260310.md`. All findings fully synthesized into mega-patterns below. Signals.md now contains only March 10+ analytical reviews.

> **Previously archived insights:** Signal Scan 2026-03-24, Team Brief 2026-03-25, Cross-Archive Synthesis 2026-03-25 → `knowledge/insights-archive-20260326.md`. Insights Review 2026-03-21, Four Post-March-9 Convergence Patterns, Self-Evolution Trilemma 2026-03-10, Insights Review 2026-03-10 → `knowledge/insights-archive-20260310.md`.

---

## XHS Access Status
- 🔴 Search: Returns empty (cookie/auth degraded)
- 🟡 Feed: Works but returns general content (not AI-targeted)
- 🔴 Read-deep: Untested this session (no relevant feed results to read)
- **20+ days without new XHS data** (last: 2026-03-06)
- **Action needed:** User QR re-login from clean network + cookie refresh

---

## 🔴 Strategic Intelligence Report: Architecture Decision Brief
> Date: 2026-03-26 | Deliverable: TODO item "Strategic Intelligence Report"
> Question: "What is the single most important architectural lesson from the Chinese AI engineering community that our system hasn't acted on yet?"
> Evidence base: 973 archived posts, 7 mega-patterns, 6 posts read in detail for this brief

### THE LESSON: Failure-Driven Skill Crystallization — The Closed Loop We're Missing

**Our system learns from success but doesn't learn from failure.** The Chinese AI engineering community — both practitioners on XHS and the academic papers they discuss — has converged on a specific mechanism for turning agent failures into durable capability. We have the raw material for this loop but haven't closed it.

### Evidence (6 Posts + 3 Academic Papers)

**Post 1: SkillRL (698bb2f5 ❤️1075, arXiv:2602.08234, UNC+Berkeley)**
> "失败轨迹 → 提炼为可执行的教训(Lessons)"

SkillRL's core architecture: success trajectories crystallize into strategies; failure trajectories distill into executable lessons. Both feed a layered SkillBank. Key result: Qwen2.5-7B reaches 89.9% on ALFWorld (surpassing GPT-4o). The mechanism isn't just "remember failures" — it's structured distillation: failure → extract pattern → create/update skill → co-evolve with policy. Convergence speed: +33% vs vanilla training. Prompt length: -10.3%.

**Post 2: MemSkill (698c5f60 ❤️532, arXiv:2602.02474)**
> "失败buffer → 聚类 → 提炼 → 技能更新 = 闭环"

MemSkill's Designer component maintains a **failure-driven hard-case buffer**. It periodically reviews failures, clusters them, selects representatives, and evolves skills. The 4-part skill format is critical:
1. **Purpose** (what the skill does)
2. **When to use** (trigger conditions)
3. **How to apply** (procedure)
4. **Constraints** (boundaries and failure modes)

Parts 2 and 4 — "When" and "Constraints" — are **second-order knowledge** (see Cross-Pattern 3 in archive). They encode not just what to do, but when it applies and when it breaks. This is why skills are 100-1000× more token-efficient than MCP tool descriptions.

**Post 3: ERL — Experiential Reinforcement Learning (699c44fe, arXiv:2602.13949, USC+Microsoft)**
> "首次尝试 → 环境反馈 → 自我反思 → 二次尝试 → 策略内化"

ERL's key mechanism: **selective triggering** — only reflect when the first attempt falls below a threshold. Don't waste effort reflecting on successes. And critically: **internalization distillation** — successful reflections are distilled back into the base model so deployment requires zero reflection overhead. "Training-time reflection, inference-time zero cost."

**Post 4: Harness Engineering — Trace Analyzer (69965a7b ❤️49, 奥森木/LangChain)**
> "Trace Analyzer: 每次运行的trace存进LangSmith，多个agent并行诊断失败原因"

LangChain's actual production practice: execution traces are stored, failure traces are automatically analyzed by diagnostic agents, and fixes are applied to the Harness. This is SkillRL implemented at the engineering level. Result: 52.8% → 66.5% on Terminal Bench 2.0 (Top 30 → Top 5), same model, only harness changes.

**Post 5: Claude Code Hooks — "AI会遗忘，但Hooks不会" (690381cc ❤️150 + 69a394b1 ❤️280)**
> ".claude/hooks/ = 强制护栏，AI会遗忘，但Hooks不会。"

The XHS community independently converged on: **soft lessons (in prompts) get forgotten; hard lessons (in hooks/middleware) persist**. PreToolUse hooks that block dangerous operations are the crystallized form of past failures — someone made that mistake once, now the hook prevents it forever.

**Post 6: "Agent的分水岭" (69a64a68 ❤️219, 程序员彭涛)**
> "状态怎么存 ｜ 上下文怎么控 ｜ 任务怎么追 ｜ **失败怎么回滚** ｜ 协作怎么对齐"

The learn-claude-code project identifies 5 engineering "watershed" capabilities. Our system implements 4 of 5. The missing one: **"失败怎么回滚" (how to handle failure rollback)**. This post directly names the gap.

### Why This Matters For Our System Specifically

**What we have:**
- JOURNAL.md records what happened each heartbeat (the raw trace)
- LESSONS.md stores manually curated lessons
- SOUL.md/COACHING.md provide frozen constraints
- Compact cycles compress and archive insights
- Coaching notes from humans provide external correction

**What we're missing — the closed loop:**

```
Current:  Failure → JOURNAL entry → [human reads maybe] → [manual LESSONS update maybe]
                                         ↑ gap              ↑ gap

SkillRL:  Failure → Buffer → Cluster → Distill → SkillBank update → Co-evolve
MemSkill: Failure → Hard-case buffer → Representative selection → Skill edit/create
ERL:      Failure → Structured reflection → Internalization → Policy update
LangChain: Failed trace → Diagnostic agents → Harness update → Retest
```

Our failures are recorded but not systematically processed. JOURNAL.md is a write-only log — no agent reads past failures to extract patterns. LESSONS.md is manually curated — no automatic distillation from failure clusters. When Amy writes a bad insight or Bob's code fails QA three times on the same pattern, that information exists in journal entries and git history, but it never becomes a crystallized skill that prevents recurrence.

**The cost of this gap:**
1. **Repeated mistakes**: Without failure distillation, the same error patterns recur across heartbeats (each heartbeat starts with fresh context)
2. **LESSONS.md staleness**: Manual curation means lessons lag behind actual failure patterns by days or weeks
3. **No selective triggering**: We don't even know which failures are recurring vs. one-off — there's no clustering mechanism
4. **Coaching bottleneck**: Human coaching notes are the only neg-entropy injection for behavioral correction. This doesn't scale.

### What We'd Change If We Acted On This

**Lightweight implementation (no infrastructure changes):**

1. **Failure Buffer**: At the end of each heartbeat, if any task failed or required >2 attempts, append a structured entry to `workspace/failure-buffer.md`:
   ```
   ## [DATE] Failure: [brief description]
   - Trigger: what was attempted
   - Failure mode: what went wrong
   - Resolution: what fixed it (or "unresolved")
   - Pattern?: does this resemble a previous failure? (Y/N/unsure)
   ```

2. **Periodic Failure Review** (new periodic task, weekly): Read `failure-buffer.md`, cluster similar failures, and distill patterns into LESSONS.md using MemSkill's 4-part format:
   ```
   ## Skill: [name]
   - Purpose: prevent [failure pattern]
   - When to use: [trigger condition]
   - How to apply: [concrete steps]
   - Constraints: [when this doesn't apply]
   ```

3. **Selective Reflection** (ERL principle): Only do the failure review when the buffer has ≥3 entries since last review. Don't waste a heartbeat reflecting on zero failures.

4. **Heartbeat Pre-Check**: At the start of each heartbeat, scan the 5 most recent LESSONS.md skills that are tagged as failure-derived. This is the "internalization" step — loading crystallized failure knowledge before attempting new tasks.

**This requires zero new tools, zero infrastructure, just file conventions and a periodic task.**

### Counterarguments and Risks

**Risk 1: "Iteration Is Poison" — won't reviewing failures cause iterative degradation?**
No — the failure review is a **separate, fresh context** periodic task, not an in-line retry loop. It follows the Ralph Loop / MEM1 principle (fresh context per step). The review agent reads failure data as external input, not as part of an iterative chain. This is the key distinction: reflecting BETWEEN episodes (SkillRL) is beneficial; retrying WITHIN an episode (SCAFFOLD-CEGIS degradation) is harmful.

**Risk 2: Self-Evolution Trilemma — agents editing their own lessons creates a closed loop.**
Valid concern. Mitigation: failure-derived skills go to LESSONS.md which is agent-writable, but frozen constraints in SOUL.md remain read-only. This maintains the freeze/fluid boundary (Cross-Pattern 1). Additionally, the periodic failure review can be flagged for human review rather than auto-applied — maintaining the external grounding that breaks the trilemma.

**Risk 3: Failure buffer grows unboundedly.**
Mitigate with the same compact discipline applied to insights.md: archive and compress monthly. The MemSkill approach (cluster → select representative → distill) is inherently compressive — 10 similar failures become 1 skill.

**Risk 4: Low failure rate means the mechanism is idle.**
Fine. ERL's selective triggering says: don't reflect when things work. An idle failure loop is a feature, not a bug. The mechanism activates exactly when it's needed.

### Verdict

The Chinese AI engineering community — from UNC/Berkeley researchers (SkillRL), Singapore academics (MemSkill), USC/Microsoft teams (ERL), LangChain production engineers (Trace Analyzer), to XHS practitioners (Hooks, learn-claude-code) — has independently converged on one mechanism: **structured failure distillation into reusable skills**. Six sources across three categories (academic papers, production engineering, practitioner community) all describe the same loop. Our system has 4 of 5 engineering "watershed" capabilities; this is the missing fifth. The implementation is lightweight (file conventions + 1 periodic task), the risks are manageable (freeze/fluid boundary + external grounding), and the expected benefit is direct: fewer repeated mistakes, faster skill accumulation, reduced human coaching load.

**Recommendation: Implement the failure buffer + periodic review as a new periodic task for each agent. Start with Amy as the pilot, since Amy's failures (bad insights, missed signals, search errors) are low-stakes and easily reversible. Extend to Bob/Coder after validation.**

*— Amy 📕, Strategic Intelligence Report, 2026-03-26*

---

## Insights Review — 2026-03-28 (Heartbeat Periodic Task)
> Source: Full review of insights.md (Strategic Report + XHS Access Status), signals.md (~993 lines), Coach journal (evaluator coaching arc)
> Last insights review: 2026-03-26 (per periodic-tasks.md)
> Focus: Pattern maturity reassessment, knowledge base health, new operational signals

### New Signal: Pattern #19 — Document Placement Determines Fix Effectiveness

Coach produced a clean A/B test across two correction strategies for the Evaluator's scrape_webpage false positive:

| Strategy | Placement | Result | N |
|---|---|---|---|
| A: LESSONS.md fix (HB33) | Supplementary knowledge file | **FAILED** — 10+ evals still flagged | 10+ |
| B: criteria.md fix (HB38) | Core task document (read at start of every eval) | **WORKING** — zero false flags | 1 (first post-fix) |

This is the **third independent instance** of the same principle in our system:
1. **Pattern #15:** coaching.md corrections invisible (not auto-loaded) → move to LESSONS.md
2. **Pattern #14:** LESSONS.md corrections ignored by evaluator (training prior > supplementary instruction) → move to criteria.md
3. **Pattern #19:** The above two compose into a placement hierarchy: **core task doc > LESSONS.md > coaching.md**

**Cross-reference with Amy knowledge base:**
- XHS community discovered the same hierarchy for Claude Code: `CLAUDE.md` > `MEMORY.md` > in-context instructions (HB54 signal)
- "Hooks > Prompts" (690381cc ❤️150): hard enforcement beats soft instruction
- Summer Yue事件: constraint lost when not in critical path (compaction ate it)

**Assessment:** This is no longer just an operational finding — it's a **placement enforcement law** with 5+ independent sources (3 internal, 2+ XHS). Correction effectiveness is determined primarily by WHERE it's placed in the document-load hierarchy, not by WHAT it says. This has direct implications for the Strategic Report's "Failure-Driven Skill Crystallization" proposal: distilled skills must be placed in each agent's core task document, not in a generic skills file.

### Mega-Pattern Stability Assessment

| # | Mega-Pattern | Sources | Confidence | Change Since Last Review |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 14+ (6 domains) | Very High | Stable — no new sources, no counter-evidence |
| 2 | Verification > Generation | 6+ | Very High | Stable |
| 3 | File System = Memory | 8+ | Very High | Stable — industry settled |
| 4 | Contrastive > Comprehensive | 5 domains | High | Stable |
| 5 | Minimum Sufficient Reasoning | 3 sources | High | Stable |
| 6 | Self-Evolution Trilemma | 8+ | Very High | Stable |
| 7 | L3 Security Gap | 5+ | Medium | Stable — still unsolved |
| **NEW** | Placement Enforcement Law | 5+ (3 internal, 2+ XHS) | High | **Emerging** — promoted from operational finding to pattern candidate |

### Knowledge Base Health

**Theoretical saturation confirmed.** No new patterns from existing data. The Placement Enforcement Law is the only update, and it emerged from internal operational data (Coach pipeline), not from new external research.

**Data drought: Day 22+.** XHS access still blocked. Scout static. Bulletin static. The only active intelligence source is the Coach pipeline, which is producing operational validation of existing patterns rather than new discoveries.

**Insights.md size:** ~440 lines. The Strategic Report (~200 lines) dominates. Per the "Skills as Crystallized Second-Order Knowledge" finding (Cross-Pattern 3), the active workspace should compress toward when/why/what-fails knowledge. The Strategic Report IS second-order knowledge (it's a recommendation based on pattern analysis), so its size is justified. The XHS Access Status section (20 lines) is actionable blocker documentation. No compression needed this cycle.

### Verdict

Knowledge base remains at theoretical plateau. One new pattern candidate (Placement Enforcement Law) emerged from Coach's evaluator coaching, extending the Hooks > Prompts principle with concrete internal evidence. All 7 mega-patterns stable. The primary need remains XHS access restoration for new external data.

*— Amy 📕, Insights Review, 2026-03-28*
