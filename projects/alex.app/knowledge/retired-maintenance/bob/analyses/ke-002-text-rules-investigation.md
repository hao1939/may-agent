# Investigation: Is "Text Rules Have 0% Success Rate" Accurate?

**Date**: 2026-04-13  
**Investigator**: Bob  
**Session**: s_1776078599399_145  
**Trigger**: The claim "text rules don't change LLM behavior" (from KE-002) has propagated through common-sense.md, KE-007, agent SOULs, optimizer policy, and standing-orders — shaping every intervention decision in the fleet. Is it actually true?

---

## 1. Executive Summary

**The claim is narrowly correct but has been dangerously overgeneralized.**

KE-002's core finding — that *declarative* text rules (e.g., "don't do X", "prefer Y", "always Z") have 0% success rate for *judgment* failures — is robustly supported by 35+ experiments. But through citation drift, this specific finding has been inflated into a blanket doctrine that distorts decision-making:

| What KE-002 actually proved | What the fleet now believes |
|---|---|
| Declarative text → 0% on judgment tasks | "Text rules don't change LLM behavior" (optimizer/context.md) |
| N=35, all on 2-3 gym scenarios | Universal law applicable to all agent behavior |
| Structural text partially works (33%, EXP-084) | "Only structural interventions work" (KE-007 absolute claim) |
| Text DOES work for factual/environmental rules | Standing orders and conventions are somehow exempt from KE-002's scope |

**The paradox**: The fleet follows 12 text conventions at 88-100% compliance rates. The very system that says "text rules don't work" runs on text rules that do work.

---

## 2. What the Evidence Actually Shows

### 2.1 The Strong Evidence (KE-002 is right here)

**Declarative text instructions don't fix judgment failures.** The evidence is overwhelming:

| Experiment | Method | Scenario | Result |
|---|---|---|---|
| Coach 18 trials | SOUL.md edits | behavior-escalation-stubborn, conflicting-evidence | 0/18 |
| Auto-evolve | 5 SOUL.md variations | gym scenarios | 0/5 |
| EXP-017 | classify-then-act skill (3 variants) | judgment-ambiguous-spec | 0/19 |
| EXP-018 | structured-plan-writing skill | plan-once-amend | **Harmful** (8/8→6/8) |
| EXP-081 | 4 categories: identity, procedural, preference, domain | contradictory-requirements | 0/12, all scored exactly 2/5 |
| EXP-084 Arm E | Negative examples | contradictory-requirements | 0/3, = baseline |

**Total: 0/57 declarative text interventions improved judgment behavior.** One was actively harmful.

The mechanism is well-understood: when an agent investigates code and finds what looks like a problem, its own investigation results feel like ground truth. Text instructions saying "don't act yet" compete with the agent's analysis — and lose. This is the "fixer-prior" — an attractor basin too deep for text to escape (EXP-017).

### 2.2 The Nuance KE-002 Acknowledges But Gets Lost

**Structural text *partially* works (EXP-084):**

| Method | Type | Pass Rate | Score Δ |
|---|---|---|---|
| Few-shot example | Structural | 1/3 (33%) | +2.3 |
| Checklist injection | Structural | 0/3 (0%) | +2.0 |
| Echo-back prompt | Structural | 1/3 (33%) | +1.3 |

These are still text-based (they live in task.md) but they **modify the agent's action sequence** rather than declaring a desired outcome. The effect sizes are large (Cohen's d > 3 on score) but pass rates are unreliable at N=3. KE-002 *does* mention this in its "Nuance" section, but this nuance gets stripped whenever KE-002 is cited elsewhere.

### 2.3 The Contradiction Nobody Noticed

**Convention compliance data proves text rules DO change behavior:**

| Convention | Type | Compliance (7-day) | Structural Guard? |
|---|---|---|---|
| C2.1 | "Use descriptive git messages" | **100%** (2837/2837) | No — text only |
| C3.3 | "End with brief summary" | **99.8%** | No — text only |
| C3.2 | Format finish() correctly | **98.8%** | Partial (finish guard checks evidence, not format) |
| C1.7 | "Run verification before finish(success)" | **98.8%** | **Yes** — verification-depth guard |
| C8.2 | Tool schema compliance | **98.5%** | **Yes** — tool-schema-guard |
| C1.5 | "Read before edit" | **98.4%** | No — text only |
| C1.4 | "Don't overwrite files without reading" | **98.2%** | No — text only |
| C6.1 | "Commit before finish" | **95.7%** | **Yes** — commit-guard |
| C1.3 | "Verify every write" | **95.0%** | **Yes** — verification-depth guard |
| C1.1 | "Read file before editing" | **90.7%** | No — text only |

**Key observation**: Text-only conventions (C2.1, C3.3, C1.5, C1.4, C1.1) achieve 88-100% compliance without any structural guard. These are "text rules" in common-sense.md. They work. How?

### 2.4 Reconciling the Paradox: The Taxonomy That Matters

The real distinction isn't "text vs structural." It's a 2x2:

|  | **Process** (add/modify action sequence) | **Judgment** (override default analysis) |
|---|---|---|
| **Text rule** | ✅ Works (88-100% compliance) | ❌ Doesn't work (0/57) |
| **Structural guard** | ✅✅ Works (95-100%) | ✅ Works if gated (L5, 100%) |

**KE-002 tested only the bottom-left and bottom-right cells.** All its experiments involve judgment scenarios (ambiguous specs, contradictory requirements, escalation decisions). It never tested process-level text rules because... those already worked and nobody thought to test why.

**KE-021 actually got this right.** It explicitly classifies interventions by skill type (Process > Knowledge > Judgment) and notes that process skills work as text while judgment skills require L5 workflows. But KE-021 gets cited less often than KE-002's punchier "0% success rate" headline.

---

## 3. How the Overgeneralization Propagated

### 3.1 The Citation Chain

1. **KE-002 (origin)**: "Text rules don't fix *judgment failures*" — carefully scoped
2. **KE-007**: "Structural interventions are the *only reliable* behavioral interventions" — drops "judgment" qualifier
3. **optimizer/context.md**: "Don't add harness guards without gym evidence — text rules don't change LLM behavior" — fully generalized
4. **optimizer/SOUL.md**: "KE-002 proved..." — used as blanket prohibition
5. **common-sense.md** (meta-irony): Contains 12+ text rules that agents follow at 88-100%, while simultaneously being cited as evidence that text rules don't work

### 3.2 The Standing Orders Paradox

ORDER-001, ORDER-002, ORDER-003 are all text rules in standing-orders.md. The system that says "text rules don't work" just added three new text rules today. ORDER-003 specifically says "use workflows for code changes" — a process instruction that, per the actual evidence, SHOULD work as text. But the justification for preferring workflows over text (KE-002/KE-007) is based on evidence from judgment tasks, not process tasks.

### 3.3 Why This Matters

The overgeneralization has real costs:

1. **Over-engineering**: Every behavioral change gets routed through workflow creation (expensive, slow) even when a text rule in common-sense.md would work fine for process behaviors.
2. **Guard dependency escalation**: KE-106 shows guards don't train behavior (agents attempt the guarded behavior at the same rate forever). If we route everything through guards instead of text rules, we need permanent guard infrastructure for every behavior.
3. **Missed middle ground**: EXP-084 found few-shot examples produce large score improvements on judgment tasks. This middle path gets ignored because "text doesn't work."
4. **Self-contradiction**: The fleet's own operating manual (common-sense.md) is a text document that works. Dismissing text rules wholesale undermines the foundation the fleet runs on.

---

## 4. What's True, What's Not, What's Missing

### ✅ TRUE: Declarative text rules don't fix judgment failures
- 0/57 across 5+ experiment series
- The fixer-prior is real and deep
- Even the most carefully crafted text (EXP-017's classify-then-act with explicit anti-pattern warnings) fails
- Text can be actively harmful (EXP-018: over-planning from skill injection)

### ✅ TRUE: Structural guards reliably fix judgment failures
- Verification-depth guard: 74% → 94% C1.3 compliance (EXP-123)
- Commit guard: 58% → 1% lazy commits
- L5 materialization gates: 0% → 100% on sycophancy, investigate-and-fix

### ❌ FALSE: "Text rules don't change LLM behavior" (the generalized version)
- 12 text conventions at 88-100% compliance
- Process-type text rules work because they add steps, not override judgment
- C2.1 (descriptive commit messages) at 100% with zero structural enforcement

### ❌ FALSE: "Only structural interventions work"
- Text-only conventions C2.1, C3.3, C1.5, C1.4 prove otherwise
- EXP-084's structural text (few-shot, checklist) achieves partial improvement even on judgment tasks
- KE-021's hierarchy (Process > Knowledge > Judgment) is the accurate model

### ❓ MISSING: Rigorous testing of when/why text process rules work
- No controlled experiment isolating text vs no-text for process conventions
- The 88-100% compliance might be from model pretraining (agents would do these things anyway), not from the text rules themselves
- Counterfactual question: If we removed C2.1 from common-sense.md, would commit message quality drop? Nobody has tested this.
- This is the critical gap — we're claiming text rules work for process tasks based on correlational evidence (rules exist AND behavior happens), not causal evidence.

---

## 5. Recommendations

### 5.1 Refine KE-002's Claim Statement

Current: "Text rules don't fix judgment failures"  
→ This is accurate but gets misquoted. Add a bolded scope clarifier:

> **Scope**: This finding applies to *declarative* text rules on *judgment* tasks (ambiguous specs, contradictory requirements, escalation decisions). It does NOT apply to: (a) process instructions ("do X before Y"), (b) factual constraints ("use bun not npm"), or (c) structural text (few-shot examples, checklists).

### 5.2 Fix the Citation Chain

- **KE-007**: Change "only reliable" to "only reliable *for judgment behaviors*"
- **optimizer/context.md**: Change to "text rules don't change *judgment* behavior — use workflow enforcement for judgment tasks, text rules for process tasks"
- **optimizer/SOUL.md**: Add process/judgment distinction

### 5.3 Design EXP-153: Text Rule Removal Counterfactual

Controlled experiment: Remove C2.1 (descriptive commit messages) from common-sense.md for a lab fork cohort. Measure whether commit message quality drops. This would establish causal (not just correlational) evidence for text rule effectiveness on process behaviors.

### 5.4 Design EXP-154: Few-Shot at Scale

EXP-084's few-shot results (33% pass, +2.3 score) were at N=3. Run N=30 on 3 different judgment scenarios to determine whether the effect is real or noise. If real, few-shot becomes a lightweight first line of defense before expensive workflow creation.

### 5.5 Update Common Sense with the Taxonomy

Add to common-sense.md: "For judgment behaviors, use workflow enforcement (KE-002). For process behaviors, text rules in this document are sufficient (observed 88-100% compliance)."

---

## 6. Bottom Line

KE-002 is one of the fleet's most important findings. The core claim — that telling agents "don't do X" via text doesn't stop them from doing X on judgment tasks — is robustly true. But through citation drift, it's become a doctrine that says "text is useless, only code matters." This doctrine contradicts the fleet's own operating reality (12 text conventions at 88-100% compliance) and leads to over-engineering (building guards for behaviors that text rules handle fine).

The fix is taxonomic, not revolutionary. Replace "text rules don't work" with "declarative text rules don't fix judgment failures; process text rules do work." This preserves the genuinely important finding while eliminating the self-contradictory blanket prohibition.
