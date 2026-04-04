# DRAFT: Universal Context.md Entries

> **Purpose**: These 5 one-liners go into EVERY agent's context.md.
> They represent our most replicated, most universally-applicable findings.
> **Status**: DRAFT — awaiting review before deployment to all agents.
> **Author**: Bob | **Date**: 2026-04-04

---

## The 5 Entries (copy-paste ready)

```
- Text rules (SOUL.md, skills, LESSONS.md) have 0/20 success rate for judgment — one was harmful. Use workflows for behavioral change, context.md only for environmental facts. (KE-002, KE-007)
- Agents skip knowledge files — if info matters, put it in context.md or inject it in the task. Passive reference files have ~5% utilization. (KE-011)
- Decision topology R predicts workflow value: R > 0.5 → helps (up to +100pp), R < 0.3 → hurts (up to -33pp). Estimate R before adding workflow steps. (KE-015)
- Include file paths, error messages, and fix approach when delegating tasks — reduces wasted ops by 47%. Bounded tasks (clear input, single output) have 90% success vs 41% for open-judgment tasks. (KE-003, KE-013)
- Sycophancy/judgment failures need materialization gates (forced self-commitment), not nudges or regular workflows. Agent must write its classification then re-read it before acting. (KE-019)
```

---

## Rationale for Each

### 1. KE-002 + KE-007: "Text rules don't work, workflows do"
- **Why universal**: Every agent designs interventions or follows instructions. This prevents the #1 time-waster: trying to fix judgment with text.
- **Evidence**: 0/20 text rule attempts, one harmful (EXP-018). 5 promoted workflows, 92-100% pass rates.
- **Who benefits most**: Coach (designs interventions), Tech-lead (builds them), but ALL agents need this mental model.

### 2. KE-011: "Agents skip knowledge files"
- **Why universal**: Self-referential — agents need to know this ABOUT THEMSELVES. Changes how you expect other agents to consume your output.
- **Evidence**: 3 experiments showed agents in oneshot mode go straight to task without reading references.
- **Who benefits most**: Everyone who writes findings, proposals, or reference docs (all agents).

### 3. KE-015: "Decision topology predicts workflow effectiveness"
- **Why universal**: Prevents misapplying workflows. Every agent encounters workflow-structured tasks.
- **Evidence**: ρ=0.95 correlation, 8+ sources, controlled experiments showing +100pp (high R) to -33pp (low R).
- **Who benefits most**: Coach (assigns workflows), Tech-lead (builds them), May (orchestrates).

### 4. KE-003 + KE-013: "Rich delegation context + bounded tasks"
- **Why universal**: Every agent either delegates or receives delegation. Task structure is the #1 quality predictor.
- **Evidence**: 47% ops reduction (EXP-002), 49pp quality gap bounded vs open-judgment (EXP-007).
- **Who benefits most**: May (primary delegator), but any agent that calls another agent.

### 5. KE-019: "Materialization gates for judgment failures"
- **Why universal**: Sycophancy/compliance pressure affects all agents. The mechanism (self-commitment via writing) is universally applicable.
- **Evidence**: EXP-024: L4 nudge 0%, regular workflow 0%, strict+gate 0%→100%.
- **Who benefits most**: Any agent facing user pressure to act against analysis. Coach (designs interventions).

---

## Deployment Plan

1. Bob writes these entries (this file) ✅
2. Coach reviews for accuracy and wording
3. Hao approves
4. Tech-lead adds to each agent's context.md (or writes a script)
5. Monitor: do agents reference these in sessions? (informal, via session review)

---

## Notes on Wording

- Each entry is action-oriented ("use X", "put it in Y", "estimate R before Z") — not descriptive ("research shows that...")
- Evidence citations in parentheses let curious agents dig deeper without cluttering the directive
- Combined KE-002+KE-007 and KE-003+KE-013 because they're complementary pairs — reduces from 5 entries to 5 lines
- Kept under 2 lines each to respect context.md budget (~2KB limit)
