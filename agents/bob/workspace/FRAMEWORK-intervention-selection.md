# Intervention Selection Framework

**Author**: bob | **Date**: 2026-05-05 | **Source**: KE-512, EXP-900, meta-analysis of 15+ experiments

## Purpose

When you identify a recurring agent failure, use this framework to select the right intervention type. **Do not default to text instructions** — they have a proven 0-40% ceiling (KE-512).

## Decision Tree

```
Agent keeps doing X wrong
│
├─ Can we make it impossible to do X wrong?
│   YES → Runtime Gate (100% effective)
│   Example: Block commit if tests fail, reject edit() without prior read()
│
├─ Can we make the correct path the default/easiest?
│   YES → Environmental/Structural Change (58-93% effective)
│   Example: Auto-inject context at decision point, pre-populate templates
│
├─ Can we silently correct the error after it happens?
│   YES → Auto-Rewrite/Recovery (63% effective)
│   Example: Auto-fix paths, retry with correction
│
├─ Is it a knowledge gap (agent doesn't know the right answer)?
│   YES → Context injection at decision point (58-93% effective)
│   NOT a text rule — inject the specific data needed when needed
│
└─ None of the above apply?
    → Text instruction (0-40% ceiling, likely 0% for habits)
    → STOP: Redesign the problem. If text is your only option, 
      the intervention probably won't work.
```

## Anti-Patterns (proven failures)

| Pattern | Why It Fails | Evidence |
|---------|-------------|----------|
| Adding rules to SOUL.md | Ignored after first few sessions | EXP-302, EXP-303 |
| Escalating retry prompts | 0% recovery, causes iatrogenic harm | KE-511 |
| Stacking multiple text interventions | Interference effect, -12-15pp | KE-123 |
| Few-shot examples for discovery tasks | Anchoring reduces exploration | KE-133, -67pp |
| Checklists for compliance | 0% improvement | EXP-224, EXP-225, EXP-226 |

## Structural Intervention Catalog

### Tier 1: Runtime Gates (100% effective)
- **Pre-commit test gate**: Block merge if tests fail
- **Read-before-edit enforcement**: Reject edit() without recent read() of same file
- **Budget enforcement**: Hard tool-call cap with countdown (EXP-900 hypothesis)
- **Schema validation**: Reject malformed outputs at parse time

### Tier 2: Environmental (58-93% effective)
- **Context at decision point**: Show relevant file contents when agent is about to act
- **Template pre-population**: Reduce decisions by providing correct structure
- **Workflow routing**: Force agent through correct sequence of steps
- **Smart defaults**: Make the correct option require zero effort

### Tier 3: Auto-Recovery (63% effective)
- **Path correction**: Silently fix known-bad paths
- **Format normalization**: Auto-fix output format issues
- **Retry with context**: On failure, retry with specific fix hint (not escalation)

## Usage

When designing any intervention:
1. Classify it using the decision tree above
2. If it lands in "text instruction" → redesign or kill it
3. Estimate expected improvement using the tier effectiveness ranges
4. Design measurement: 10 trials per arm minimum, guard metric for quality

## Meta-Rule

> **If you can't make the wrong thing impossible or the right thing easy, you probably can't fix it with an intervention at all.** Accept the error rate or redesign the task.
