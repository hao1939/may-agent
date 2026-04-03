# MetaClaw POC Spec: Borrowable Ideas for OpenClaw

**Status**: proposal  
**Author**: Bob (Architect)  
**Date**: 2026-04-03  
**Priority**: HIGH  
**Depends on**: [MetaClaw Research](./metaclaw-self-evolving-agent.md), [Harness Engineering](./harness-engineering-long-running-agents.md), KE-002, H-043, H-047  

---

## Executive Summary

MetaClaw (`aiming-lab/MetaClaw`, ⭐1,024) is the first production system implementing continuous self-improvement from live deployment. It combines skill auto-extraction, context injection, and optional RL weight updates through a proxy architecture.

**This document evaluates MetaClaw's ideas through our validated knowledge base** — particularly KE-002 (text rules don't fix judgment, 0/19), H-043 (utilization = P(exists) × P(access) × P(applies)), and the skill-distillation-convergence analysis — to identify which ideas are genuinely borrowable and which would fail for reasons MetaClaw doesn't encounter.

The recommended POC is **not** naive skill injection. It is a **Structured Session Primer** that combines MetaClaw's auto-extraction with Anthropic's sprint contract pattern, delivered as enforceable pre-task context.

---

## MetaClaw's Five Borrowable Ideas — Honest Assessment

### Idea 1: Auto-Skill Extraction from Sessions
**What MetaClaw does**: After each conversation, automatically extracts reusable skills as SKILL.md files. The skill library grows with usage.

**Our equivalent**: `context-learn` workflow already extracts insights from session transcripts into knowledge entries. Compact cycle distills journal→insights.

**Verdict: ✅ Already implemented (Stage 1 of distillation pipeline)**  
Our extraction infrastructure is sound (per cross-ref-skill-distillation-convergence). The bottleneck is not extraction but enforcement. Adding MetaClaw-style auto-extraction would improve volume but not utilization — we'd have more skills that get ignored.

**What we'd learn**: Nothing new. Skip.

---

### Idea 2: Skill Injection at Task Start (Context Shaping)
**What MetaClaw does**: Retrieves top-k skills by similarity to current conversation and injects them into the prompt before the model generates.

**Why it works for MetaClaw but not for us (critical distinction)**:

| Dimension | MetaClaw | OpenClaw |
|-----------|----------|----------|
| Context at injection | Fresh — skill is among first things model sees | Cluttered — skill competes with SOUL.md, tools, prior conversation |
| Model state | Pre-generation — skill shapes generation prior | Mid-session — agent already has habitual action patterns |
| Task type | General chat/coding (factual) | Judgment under ambiguity (behavioral) |
| Skill quality | Grows from real usage patterns | 37 AI-generated skills, quality below SkillsBench threshold |

Trace2Skill achieves +57pp because skills enter a **fresh context** and shape the **generation prior**. Our skills enter a loaded context and compete with the **action prior**. KE-002 confirms: 0/19 text injections change behavior on judgment tasks.

**Verdict: ⚠️ Partially borrowable — but ONLY with structural enforcement**

The injection *timing* is interesting. If we inject skills not as text advice but as **structured task contracts** (following Anthropic's sprint contract pattern), we convert declarative knowledge into procedural constraints. This is the core of the recommended POC (see below).

---

### Idea 3: Process Reward Model (PRM) for Step-Level Scoring
**What MetaClaw does**: Uses GPT-5.2 as a PRM to score each conversation step. These scores become RL training signals (GRPO).

**Our equivalent**: Post-session evaluation via evaluator agent. We score sessions, not individual steps.

**What's new**: Step-level scoring could identify *where* in a session things go wrong, not just *whether* they went wrong.

**Verdict: ⚠️ Interesting but high cost, medium priority**  
An extra LLM call per step would double our API costs. We already know WHERE failures happen (the judgment point — KE-002, EXP-017). The bottleneck isn't diagnosis, it's remedy. A cheaper version: post-hoc step attribution (analyze completed sessions to identify the decisive step) — this we can do offline with existing evaluator infrastructure.

**POC potential**: Low. The information gain doesn't justify the cost until we have a use for step-level signals (i.e., until we have RL or active intervention capability).

---

### Idea 4: Two-Speed Learning (Fast Skills + Slow Weights)
**What MetaClaw does**: Fast channel = skills extracted per-session (immediate). Slow channel = RL weight updates during idle (gradual). Skills give instant capability; weights give deep learning.

**Our equivalent**: Fast = skills + context.md updates (per-session). Slow = journal entries + knowledge consolidation (cross-session). But we have no "weight update" equivalent.

**Verdict: ✅ Conceptually aligned, gap is on the "slow" channel quality**

Our fast channel works well for factual knowledge (KE-001: text rules work for facts). Our slow channel (knowledge base growth) is validated by H-043 (utilization model) but H-047 predicts we're approaching K_peak where more knowledge = more noise.

**POC potential**: Medium. The interesting experiment is adding **structured forgetting** to our slow channel (per HB-250403-memory-forgetting-agents: recency × frequency × semantic scoring). But this is a separate proposal, not MetaClaw-specific.

---

### Idea 5: MadMax Scheduler (Idle-Aware Training)
**What MetaClaw does**: Defers expensive training to idle windows (sleep hours, meeting blocks, 30+ min idle).

**Our equivalent**: Cron-based scheduling already runs maintenance tasks at intervals.

**Verdict: ✅ Already implemented conceptually. Minor optimization possible.**  
We could improve scheduling of expensive tasks (deep consolidation, cross-referencing) to avoid competing with interactive sessions. But this is operational tuning, not architectural innovation.

**POC potential**: Low. Skip.

---

## Recommended POC: Structured Session Primer

### The Insight

MetaClaw's best idea (skill injection) fails in our system because of the knowledge-action gap. But the **principle** — shaping context before task execution — is sound if we change what's injected.

The Anthropic harness engineering blog identifies the key missing piece: **sprint contracts**. Before each sprint, the generator and evaluator agree on what "done" looks like. This converts declarative intent into procedural constraints.

**The synthesis**: MetaClaw's auto-extraction + Anthropic's sprint contracts + our workflow enforcement = **Structured Session Primer**.

### What It Is

A **pre-task context document** that is:
1. **Auto-generated** (like MetaClaw's skill extraction) from the task description + relevant knowledge
2. **Structurally enforceable** (unlike text advice) through explicit checkpoints
3. **Injected at session start** (like MetaClaw's fresh-context injection) before the agent begins work

### Architecture

```
Task Assignment (from coordinator/tech-lead)
    ↓
Session Primer Generator (new)
    ↓
┌────────────────────────────────────────────┐
│           STRUCTURED SESSION PRIMER         │
│                                            │
│  ## Task Contract                          │
│  - Deliverable: [specific, testable]       │
│  - Success criteria: [3-5 bullet points]   │
│  - Anti-patterns: [known failure modes]    │
│                                            │
│  ## Required Checkpoints                   │
│  □ Before editing: evidence of reading     │
│  □ Before finishing: all criteria verified  │
│  □ Verification command: [specific test]   │
│                                            │
│  ## Relevant Context                       │
│  - Similar past sessions: [links]          │
│  - Known pitfalls: [from knowledge base]   │
│  - Active hypotheses: [if relevant]        │
│                                            │
└────────────────────────────────────────────┘
    ↓
Agent Session Start (primer loaded in system prompt)
```

### Why This Should Work (Theory)

Per H-043: U = P(exists) × P(access) × P(applies)

| Factor | Text Skill | Session Primer |
|--------|-----------|----------------|
| P(exists) | 0.9 (extracted) | 0.9 (auto-generated) |
| P(access) | 0.5 (buried in context) | 0.9 (first thing seen, fresh context) |
| P(applies) | 0.12 (text advice, ignored) | 0.7 (structural checkpoints, testable criteria) |
| **U** | **0.054** | **0.567** |

The primer's advantage is structural: checkpoints are verifiable gates, not suggestions. Success criteria are testable, not aspirational. Anti-patterns reference specific known failures, not generic advice.

### Why This Might Fail (Honest Risks)

1. **KE-002 applies to primers too?** If the model's generation prior dominates even structured primers, we'll see 0% improvement. Mitigation: primers include checkpoint *verification commands* (bash tests), not just text instructions. The structural enforcement mechanism (workflow gates) has proven effective at 92-97%.

2. **Primer generation quality.** If the primer generator produces generic boilerplate, it becomes exactly the kind of noise DD#489 warns about. Mitigation: tight template with hard requirements (must include specific test command, must reference specific past failure). Quality > quantity.

3. **Cost of primer generation.** An extra LLM call per task. ~$0.10-0.50 per session. Acceptable if it improves session success rate.

4. **Over-constraining.** Too-detailed primers could cause the "context anxiety" Anthropic documented — agents rushing to satisfy checkpoints rather than doing good work. Mitigation: limit to 3-5 success criteria max, keep primer under 500 words.

### Experiment Design

**EXP-next: Structured Session Primer vs. Baseline**

| Parameter | Value |
|-----------|-------|
| **Hypothesis** | Sessions with structured primers have higher task completion rate than sessions without |
| **IV** | Presence of session primer (generated and injected into system prompt) |
| **DV** | Evaluator score, task completion binary, number of revision cycles |
| **Task pool** | Judgment-heavy tasks where we have baseline failure rates (behavior-escalation, ambiguous-spec) |
| **N per arm** | Minimum 10 sessions per condition |
| **Control** | Standard system prompt (SOUL.md + skills + context.md) |
| **Treatment** | Standard system prompt + session primer (replacing generic skills with task-specific primer) |

**Key measurement**: Does replacing N generic skills with 1 focused primer improve utilization?

This directly tests the SkillsBench finding ("2-3 focused modules > comprehensive documents") in our system.

### Implementation Plan

#### Phase 1: Manual Primers (1-2 days, no code changes)
Write 5 manual session primers for known-failing scenarios. Run them through the gym alongside unprimed baselines. Measure delta.

**Why start manual**: Avoids building infrastructure for an idea that might fail. If manual primers show 0% improvement (like EXP-017), we stop. If they show improvement, we automate.

**Concrete manual primer template**:
```markdown
## Session Primer: [Task Name]

### Contract
You will [specific deliverable]. You are done when:
1. [Testable criterion 1 — include verification command]
2. [Testable criterion 2]
3. [Testable criterion 3]

### Known Failure Modes
Previous sessions on this task failed because:
- [Specific failure with session reference]
Avoid this by: [Specific structural step, not advice]

### Required Steps
Before declaring done, you MUST run:
```bash
[specific verification command]
```
If this command fails, you are not done.
```

#### Phase 2: Auto-Generation (if Phase 1 shows >20% improvement)
Build a primer generator that:
1. Takes task description as input
2. Queries knowledge base for relevant KE entries, past session failures, active hypotheses
3. Generates primer using constrained template (not free-form)
4. Injects into system prompt, replacing generic skills

#### Phase 3: Feedback Loop (if Phase 2 works)
After each session, evaluate primer effectiveness:
- Did the agent follow the checkpoints?
- Did the success criteria match actual task requirements?
- Update primer templates based on results

This creates the MetaClaw-style auto-improvement loop but at the **structural** level (improving primers) rather than the **text** level (improving skills).

---

## What We're NOT Doing (and Why)

| MetaClaw Feature | Our Decision | Reason |
|------------------|-------------|--------|
| RL weight updates (GRPO) | Skip | No training infrastructure; harness-level system |
| Cloud LoRA fine-tuning | Skip | We don't control model weights |
| Embedding-based skill retrieval | Skip for now | Our skill count (41) is small enough for manual curation; embedding adds complexity without proportional gain |
| Proxy architecture | Skip | Our system already wraps the LLM; proxy adds latency for no architectural benefit |
| Per-step PRM scoring | Defer | High cost, medium signal; revisit when we have step-level intervention capability |

---

## Success Criteria for POC

The POC is **successful** if:
1. Manual primers (Phase 1) show ≥20% improvement in task completion on judgment-heavy scenarios (current baseline ~33% on ambiguous-spec)
2. The improvement holds across at least 2 different task types (not overfitted to one scenario)
3. The primer template is simple enough to auto-generate (Phase 2 feasibility)

The POC is **failed** if:
1. Primers show 0% improvement (KE-002 applies even to structural primers) → conclusion: enforcement must be in code, not in context
2. Primers show improvement but only on one scenario → conclusion: too task-specific to generalize
3. Primer generation takes >2 minutes per task → conclusion: cost exceeds benefit

---

## Connection to Broader Research

This POC sits at the intersection of three research projects:

1. **MetaClaw Self-Evolving Agent** → Borrows auto-extraction and injection timing concepts
2. **Harness Engineering** → Borrows sprint contract pattern and the insight that "constrain deliverables, let agents figure out the path"
3. **Adaptive Reasoning Efficiency** → If primers work, they reduce wasted reasoning by front-loading relevant context

It also directly tests:
- **H-043** (Knowledge Utilization): Does changing injection format improve P(applies)?
- **KE-002** boundary: Is the text-rule-failure specific to generic advice, or does it extend to task-specific structural contracts?
- **SkillsBench finding**: Do 1-2 focused modules actually outperform 41 generic skills in our system?

---

## Next Steps

1. **Immediate**: Write 5 manual primers for gym scenarios (Bob or Tech-lead)
2. **This week**: Run Phase 1 experiment (10 sessions per arm, 2 scenarios)
3. **If positive**: Design auto-generator (Phase 2 spec)
4. **If negative**: Document as KE extension (text-structural-primers also fail → enforcement must be purely code-level)

---

*Bob (Architect) | 2026-04-03*
