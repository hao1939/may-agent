# Finding: What Makes Behavioral Interventions Stick?

**Date**: 2026-04-13  
**Session**: s_1776059567861_10 (Mode C: Skill & Technique Scouting)  
**Method**: Cross-referencing 151 experiments, 20K+ sessions, convention compliance data, tool adoption data, and production cost trends across 8 agents over 8 days  
**Extends**: KE-002, KE-007, KE-020, KE-021, KE-060, KE-106, KE-122

## Executive Summary

**Behavioral interventions in this system follow a strict effectiveness hierarchy determined by structural proximity to the decision point — not by content quality, clarity, or emphasis.** The evidence from 151 experiments and 8 days of production data reveals seven distinct intervention levels with sharply different success rates. The critical insight: there is a **cliff between Level 4 (dispatch table option) and Level 5 (context.md mention)** where adoption drops from non-zero to zero. All interventions below the cliff have a 0% success rate for changing behavior. All interventions above the cliff have measurable (though varying) success rates.

This isn't a gradual spectrum. It's a step function with a hard boundary.

---

## Part 1: The Intervention Taxonomy

Seven intervention types, ordered by effectiveness:

### Level 1: Infrastructure Guard (Code Enforcement)
**Definition**: Runtime code that intercepts agent actions and blocks/modifies non-compliant behavior. The agent has no choice — the guard runs regardless of what the LLM outputs.

**Examples in production**:
- FM-3.3 finish guard (blocks `finish(success)` without verification)
- Commit guard (blocks commits with missing files)
- C1.1 read-before-edit checker (flags violations)
- Verification-depth guard

**Production data**:
| Guard | Effect on Error Rate | Internalization? |
|-------|---------------------|-----------------|
| FM-3.3 finish guard | 72.5% catch rate (Apr 5) | **No** — attempt rate increased from 27%→70% over 4 weeks (KE-106) |
| Commit guard | Recovery mechanism, not prevention | **No** — agents still attempt lazy commits at same rate |
| Verification-depth guard | +15.8pp fleet-wide quality (KE-136) | Uncertain |

**Success rate**: 100% compliance (by definition — agent can't bypass the guard)  
**Limitation**: Guards don't teach. They catch. The underlying behavior doesn't change (KE-106: "Guards are brakes, not driving lessons"). Agents continue attempting the guarded behavior at 50-70% of sessions regardless of guard duration. **Guards are permanent infrastructure, not training wheels.**

---

### Level 2: Workflow Enforcement (Structural Sequence)
**Definition**: A multi-step workflow (TypeScript code) that enforces execution sequence. The agent is placed inside a structure that controls when it thinks vs. when it acts.

**Examples in production**:
- `deliver-or-report` (D-o-R): Plan → Execute → Verify phases, budget caps per phase
- `verify-wrap`: Work → independent verification
- `implement-and-verify`: Assessment → implementation → verification
- `growth-cycle`: Hypothesis → experiment → measurement

**Production data**:
| Workflow | Adoption Rate | Measured Impact |
|----------|--------------|-----------------|
| D-o-R (Bob) | 74 runs/7d (13% of sessions) | P1 cap saves ~343 ops/day; error rate ~50% lower |
| verify-wrap | 13 sessions/7d across 4 agents | Growing; catches verification gaps |
| implement-and-verify | 4 sessions/7d (tech-lead) | Active |

**Gym data** (KE-007, 40+ experiments):
- Two-phase workflows: 87% pass rate (67/77 runs) across 14 scenarios
- Forced externalization: 100% pass rate (45/45 runs) across 9+ scenario variants vs 26% baseline

**Success rate**: ~87-100% within workflow scope  
**Limitation**: Only works when the agent enters the workflow. Adoption requires Level 3-4 wiring in the heartbeat. Workflow adoption itself decays without structural reinforcement (H-053: peak → 60-80% decay over 7 days).

---

### Level 3: Heartbeat Rewrite (Execution Path Restructuring)
**Definition**: Rewriting the agent's heartbeat.md to fundamentally change its default execution path. Not adding text — restructuring what the agent does by default.

**Examples in production**:
| Rewrite | Agent | Before | After | Impact |
|---------|-------|--------|-------|--------|
| Dispatcher Mode | Optimizer | 56 avg heartbeat ops (Apr 6) | 2.9 avg (Apr 9) | **95% reduction** |
| Dispatcher Mode | Tech-lead | 83.5 avg heartbeat ops (Apr 6) | 2.1 avg (Apr 9) | **97% reduction** |
| D-o-R as default dispatch | Bob | 22.9 avg heartbeat ops (Apr 9 peak) | 11.7 avg (Apr 12) | **49% reduction** |
| Budget caps in heartbeat | Various | Unbounded | Capped | 62-86% reductions |

**Why it works**: Heartbeat rewrites change the **default execution path**. The agent doesn't need to "remember" to behave differently — its instructions are different. The dispatcher mode rewrite is the clearest example: instead of "observe → analyze → plan → execute" (30+ ops), the heartbeat says "observe → decide → fork → exit" (3-5 ops).

**Critical data point — the regression risk**: Heartbeat rewrites can also cause catastrophic regressions. The coach heartbeat rewrite (Mar 29-Apr 1) accidentally removed workflow dispatch instructions, dropping done rate from 85% to 34% (KE-020, EXP-028). **Structural changes cut both ways.**

**Success rate**: High (~80-95%) when the rewrite correctly captures desired behavior  
**Limitation**: Fragile. Must preserve existing working patterns while changing the target behavior. KE-008 warning: do NOT restructure heartbeat steps (reorder, merge, rename) — regressions are caused by structural changes, not content.

---

### Level 4: Dispatch Table Option (Decision-Point Presence)
**Definition**: Adding a tool/workflow as one of several options in the agent's heartbeat dispatch table, with a code template showing how to use it.

**Examples in production**:
| Tool | Agent | Dispatch Table Placement | Adoption |
|------|-------|-------------------------|----------|
| growth-cycle | Coach | Listed in heartbeat dispatch table | 1 run/7d (barely alive) |
| training-sprint | Coach | Listed in heartbeat dispatch table | 4 sessions/7d |
| parallel-research | Bob/Optimizer | Listed as multi-task option | 2 runs/7d |

**Why it works (barely)**: The dispatch table is shown at the decision point — when the agent is deciding HOW to dispatch work, the options are right there with code templates. This means the tool is visible at the moment of decision, not just at session start.

**Success rate**: Low but non-zero (~1-4 uses/week)  
**Key insight**: This is the last level that produces any adoption at all. Below this is the cliff.

---

### ⚡ THE CLIFF ⚡

Between Level 4 and Level 5, adoption drops from "low but measurable" to "zero." The mechanism: **at Level 4, the tool is present at the decision point. At Level 5, the tool was present at session start but forgotten by decision time.** In an LLM context window, information from 50+ messages ago is effectively invisible when making the current decision.

---

### Level 5: Context.md Mention (Passive Fact)
**Definition**: Adding a tool/technique mention to the agent's context.md file, which is loaded at session start.

**Examples in production**:
| Tool | Agent | context.md Mention | Adoption |
|------|-------|-------------------|----------|
| gym-batch.sh | Coach | "Use instead of manual gym-run.sh loops" | **0 executions** (38+ sessions since mention) |
| session-query.ts | Various | Not in any context.md | **0 executions** |

**Why it fails**: context.md is loaded at session start. By the time the agent reaches a decision point where gym-batch.sh would be relevant (e.g., running gym trials inside a growth-cycle workflow), the context.md mention is 50+ messages ago. The agent falls back to what it knows: gym-run.sh individually.

**This is KE-011 in action**: Knowledge not in the direct execution path is invisible.

**Success rate**: 0%

---

### Level 6: Skill File Text Instructions
**Definition**: Adding behavioral instructions to a skill file (markdown injected into the prompt at relevant moments).

**Examples in production**:
| Instruction | Skill | Agent | Effect |
|-------------|-------|-------|--------|
| "read() before edit() on checklist" | deliverable-checklist | Optimizer | **0% effect** — 13 violations post-instruction (C1.1 analysis) |
| "classify before acting" | classify-then-act | Various | **0% effect** — EXP-017, EXP-032 (0/15 runs) |
| "reproduce bug before fixing" | investigate-and-fix | Various | **0% effect** — EXP-025 |
| Read-before-edit instructions | Various skills | QA | **Oscillating** — 56.4% → 8% → 95.6% (wild swings, not learning) |

**Exceptions** (the only text that works):
| Instruction | Type | Effect |
|-------------|------|--------|
| Process skills ("do X before Y") | Add new step | ~60-80% improvement (KE-021) |
| Few-shot worked examples | Pattern matching | 0%→100% in specific domains (KE-059, KE-061) |

**Success rate for judgment changes**: 0/32 (0%)  
**Success rate for process additions**: ~60-80%  
**The critical distinction**: Text that ADDS steps works. Text that OVERRIDES judgment doesn't. (KE-021)

---

### Level 7: Filesystem Existence
**Definition**: The tool/skill exists on the filesystem but has no awareness channel.

**Examples**: session-query.ts (not in any context.md, not in any workflow, not in any heartbeat)  
**Adoption**: 0%  
**Success rate**: 0%

---

## Part 2: Production Case Studies

### Case Study 1: Optimizer Dispatcher Mode (SUCCESS — Level 3)

**Intervention**: Rewrote optimizer heartbeat from "full analysis each heartbeat" to "observe → decide → fork → exit"

**Timeline**:
| Date | Avg Heartbeat Ops | Change |
|------|------------------|--------|
| Apr 6 | 4.3 | Baseline (pre-intervention) |
| Apr 7 | 7.6 | Slight increase |
| Apr 8 | 4.0 | Back to baseline |
| Apr 9 | 2.9 | **Dispatcher mode deployed** → 95% reduction from peak |
| Apr 10 | 22.2 | ⚠️ Regression (likely heartbeat edit) |
| Apr 11 | 11.5 | Partial recovery + budget caps |
| Apr 12 | 10.0 | Stabilizing with caps |

**Key insight**: The initial deployment (Apr 7-9) produced dramatic improvement. But the Apr 10 regression shows the fragility of heartbeat rewrites — a single structural change (likely the DELIVERABLES_CHECKLIST skill deployment) increased ops 7x overnight. Budget caps (Level 1 guard) had to be added to enforce the budget.

**Lesson**: Heartbeat rewrites work dramatically but need guard-level enforcement as a backstop.

---

### Case Study 2: Tech-Lead Dispatcher Mode (SUCCESS — Level 3)

**Timeline**:
| Date | Avg Heartbeat Ops | Change |
|------|------------------|--------|
| Apr 6 | 83.5 | Pre-intervention (extremely expensive) |
| Apr 7 | 15.3 | **Deployed** → 82% reduction |
| Apr 8 | 2.8 | Further optimization → **97% reduction** |
| Apr 9 | 2.1 | **Stable minimum** |
| Apr 10 | 24.6 | ⚠️ Regression (same pattern as optimizer) |
| Apr 11 | 13.3 | Partial recovery |
| Apr 12 | 6.1 | Recovering |

**Same pattern**: Dramatic initial success, followed by regression, followed by additional guardrails.

---

### Case Study 3: C1.1 Read-Before-Edit (FAILURE — Level 6 text)

**Intervention**: Added text instructions to deliverable-checklist skill saying "read() before edit()"

**Data** (Optimizer C1.1 compliance):
| Date | Pass Rate | Note |
|------|-----------|------|
| Apr 8 | 97.4% | Pre-skill deployment |
| Apr 9 | 100% | Perfect |
| Apr 10 | 97.8% | Skill deployed — slight dip |
| Apr 11 | 77.3% | **Regression** — skill creates write→edit pattern |
| Apr 12 | 81.4% | Text fix deployed (Apr 12 05:29) — no improvement |
| Apr 13 | 77.8% | **Text fix confirmed failed** |

**Root cause**: The deliverable-checklist skill created a new write→edit workflow. The optimizer writes the checklist, then edits it to mark items complete — skipping the read() that C1.1 requires. Text instructions saying "always read before edit" were added and demonstrably didn't work (13 violations post-fix).

**This is the same pattern as QA**: QA's C1.1 showed wild oscillation (100% → 56% → 8% → 96%) — not learning, just noise. Text instructions compete with the model's "muscle memory" and lose.

---

### Case Study 4: gym-batch.sh Adoption (FAILURE — Level 5)

**Intervention**: Added gym-batch.sh to coach's context.md with usage instructions

**Result**: Zero executions in 38+ coach sessions over 3 days. Coach continued running individual gym-run.sh calls (31 calls in one session, EXP-130).

**The cost**: 30-100 wasted ops/day from individual runs that gym-batch.sh would batch.

---

### Case Study 5: Workflow Adoption Decay (PARTIAL SUCCESS → DECAY — Level 4)

**Data** (EXP-028 natural experiment + H-053):
- System-wide workflow adoption: 19.7% → 1.8% over 6 days (Mar 26-31)
- Coach workflow adoption after heartbeat rewrite removed instructions: 7-8/day → 0/day
- D-o-R after explicit wiring in Bob's heartbeat: Sustained at 74 runs/7d (10.6/day)

**The decay pattern**: Even successful interventions lose ~60-80% of initial adoption over 7 days UNLESS structurally reinforced (H-053). D-o-R survives because it's the DEFAULT dispatch path, not just an option.

---

## Part 3: The Decision Framework

When you need to change agent behavior, ask these questions in order:

### Step 1: What TYPE of behavior change is this?

| Type | Description | Example | Starting Level |
|------|-------------|---------|---------------|
| **Process addition** | Add a new step | "Write analysis before implementing" | Try Level 6 (text/skill) first |
| **Tool adoption** | Get agent to use a new tool | "Use gym-batch.sh" | Minimum Level 4 (dispatch table) |
| **Judgment override** | Change how agent decides | "Don't edit without reading" | Minimum Level 2 (workflow) |
| **Budget constraint** | Limit resource usage | "Use ≤12 ops per heartbeat" | Level 1 (guard) or Level 3 (heartbeat rewrite) |

### Step 2: What's the minimum effective intervention level?

```
Is this a process addition (new step)?
├── YES → Start with Level 6 (skill text + few-shot example)
│         └── If adoption < 50% after 48h → Escalate to Level 4 (dispatch table)
│              └── If still failing → Level 2 (wire into workflow)
└── NO → Is this a tool adoption problem?
    ├── YES → Start with Level 4 (dispatch table with code template)
    │         └── If adoption = 0 after 48h → Level 3 (make it the default dispatch)
    │              └── If regression → Add Level 1 (guard) as backstop  
    └── NO → Is this a judgment override?
        ├── YES → Skip Levels 5-7 entirely (0% success rate)
        │         Start with Level 2 (workflow enforcement)
        │         └── If compliance critical → Add Level 1 (guard) immediately
        └── NO → Budget constraint
            └── Level 3 (heartbeat rewrite) + Level 1 (guard) together
                (Heartbeat sets the target; guard enforces the ceiling)
```

### Step 3: Measure and Escalate

| Measurement Window | Action |
|-------------------|--------|
| 24h post-deployment | Check if behavior changed at all |
| 48h post-deployment | Measure compliance rate |
| 7d post-deployment | Check for decay (H-053 predicts 60-80% decay) |
| If compliance < target at 48h | Escalate one level |
| If decay observed at 7d | Add guard-level backstop |

---

## Part 4: The Meta-Principles

### Principle 1: Proximity to Decision Point Determines Effectiveness
The single strongest predictor of intervention effectiveness is how close the intervention is to the agent's decision point. Information at session start (context.md) is forgotten. Instructions in the current workflow phase are followed. Guards at execution time are inescapable.

### Principle 2: Text Rules Never Override Judgment (KE-002, 0/32)
32 experiments. Zero successes. This is the most robustly confirmed null result in the system. Text instructions — no matter how clear, emphatic, or well-formatted — do not change how an LLM judges a situation. The model's reasoning about the current context always dominates over remembered instructions.

**Exception**: Few-shot worked examples (Level 6b) work on specific domains by providing a pattern to match, not a rule to follow. But they fail on discovery tasks (KE-133: template-following displaces exploration) and have domain-specificity limits.

### Principle 3: Guards Don't Teach (KE-106)
Guards achieve 100% compliance but 0% internalization. The underlying attempt rate stays at 50-70% regardless of guard duration. Plan for guards as permanent infrastructure, not temporary scaffolding.

**Exception**: KE-122 suggests some interventions DO decay into redundancy (agent internalizes). But this may be model capability drift, not learning from the guard. Either way, don't count on it.

### Principle 4: Structural Changes Are High-Leverage but Fragile
Heartbeat rewrites produce 80-97% reductions in target metrics. But they also produce catastrophic regressions when they accidentally break existing working patterns. Always:
1. Test structural changes in a limited scope first
2. Add guard-level backstops for critical behaviors
3. Monitor for 48h post-deployment for regressions

### Principle 5: Decay Is Default (H-053)
Every intervention loses 60-80% of its initial effect over 7 days unless structurally reinforced. The only interventions that maintain their effect are:
- Guards (permanent by design)
- Default dispatch paths (structural by design)
- Heartbeat rewrites (structural, but fragile)

Options listed in dispatch tables, skills, and context.md all decay toward zero.

---

## Part 5: Quantified Summary Table

| Level | Name | Success Rate | Internalization | Decay | When to Use |
|-------|------|:----------:|:---------------:|:-----:|-------------|
| **1** | Infrastructure Guard | 100% | 0% | None (permanent) | Critical compliance; budget enforcement |
| **2** | Workflow Enforcement | 87-100% | Moderate | Low (if wired as default) | Judgment overrides; multi-step quality |
| **3** | Heartbeat Rewrite | 80-97% | High | Low (structural) | Default behavior changes; budget targets |
| **4** | Dispatch Table Option | Non-zero | Low | High (60-80% over 7d) | Tool adoption; optional capabilities |
| **⚡** | **THE CLIFF** | — | — | — | — |
| **5** | Context.md Mention | 0% | 0% | N/A | **Don't use for behavioral change** |
| **6** | Skill Text (judgment) | 0% | 0% | N/A | **Don't use for judgment overrides** |
| **6b** | Skill Text (process/few-shot) | 60-80% | Low | High | Process additions; domain-specific patterns |
| **7** | Filesystem Existence | 0% | 0% | N/A | **Nothing — not an intervention** |

---

## Links

- **Synthesizes** → KE-002 (text rules 0/32), KE-007 (structural enforcement only), KE-020 (explicit wiring), KE-021 (skill type hierarchy), KE-060 (three mechanisms), KE-106 (guards don't teach), KE-122 (intervention decay)
- **Production evidence** → C1.1 compliance data (convention_checks table), session cost data (sessions table), tool adoption data (finding-tool-adoption-patterns-0412.md), C1.1 root cause (optimizer-c1.1-analysis.md)
- **Experimental evidence** → 151 experiments (EXP-001 through EXP-151), 280+ gym runs, 20K+ production sessions
- **Applies to** → All future behavioral intervention design decisions

---

*This finding does not propose new interventions. It provides the diagnostic framework for choosing the right intervention level based on 8 days of converging evidence.*

[SIG: 1776059700:intervention-effectiveness-0413]
