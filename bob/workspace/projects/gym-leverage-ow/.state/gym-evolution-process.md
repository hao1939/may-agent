# Gym-Driven Evolution Process

## Overview
A repeatable cycle: measure → diagnose → intervene → re-measure.

## The Cycle

### 1. Identify Target
Pick the category with worst pass rate that has ≥2 scenarios (for statistical signal).
From baseline: Verification (0/2), Judgment (1/4), Optimizer Workflow (0/2).

### 2. Diagnose
For each failing scenario in the target category:
- Run the scenario and read the full transcript
- Identify the **specific decision point** where the agent diverged
- Classify the failure: (a) didn't read context, (b) wrong format, (c) wrong judgment, (d) tool misuse

### 3. Intervene
Based on diagnosis, create or improve exactly ONE artifact:
- **Skill file** (agents/shared/skills/ or agent-specific) for procedural gaps
- **Context.md entry** for declarative rules the agent should know
- **Tool/infra change** for structural failures

Rule: ONE intervention per cycle. No stacking.

### 4. Re-measure
Re-run the target category scenarios. Record:
- Pass/fail per scenario
- Check count improvement
- Whether the intervention helped, hurt, or was neutral

### 5. Record
Update gym-baseline.md with new scores. Write cycle results doc.

## Cycle Prioritization (from baseline)

| Priority | Category | Baseline | Why |
|----------|----------|----------|-----|
| 1 | Verification | 0/2 (0%) | Context-reading is foundational |
| 2 | Optimizer Workflow | 0/2 (0%) | Format compliance is trainable |
| 3 | Judgment | 1/4 (25%) | Largest category, most room |
| 4 | Reflexion | 0/1 (0%) | Only 1 scenario, low signal |

## Cycle 1 Target: Verification (context-learning, context-learning-correction)

These scenarios test whether the agent reads context files and applies/corrects learned facts.
This is the same failure pattern identified in H-EXP-012 (mid-session env orientation) — agents skip context reading. The gym can measure whether our H-EXP-012 interventions actually work in practice.
