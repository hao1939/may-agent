# EXP-191 Run Protocol

## Overview

50 evaluator sessions: 25 control (standard), 25 treatment (anonymized). Alternating assignment — odd sessions → control, even → treatment.

## Prerequisites

- Anonymization script: `agents/evaluator/skills/anonymize-transcript.cjs`
- Treatment SOUL: `agents/shared/knowledge/experiments/EXP-191/evaluator-soul-anonymous.md`
- Results dirs: `EXP-191/results/control.jsonl` and `EXP-191/results/treatment.jsonl`

## Arm Assignment

For each evaluation-eligible session (numbered 1–50):
- **Odd** (1, 3, 5, ...): **Control arm**
- **Even** (2, 4, 6, ...): **Treatment arm**

Stratify to ensure ≥5 Builder, ≥5 Supervisor, ≥5 Researcher sessions per arm.

## Control Arm (Standard)

1. Run the evaluator with the standard `agents/evaluator/SOUL.md`
2. Pass the unmodified session transcript
3. Record output to `results/control.jsonl` (one JSON object per line)

## Treatment Arm (Anonymized)

1. **Anonymize the transcript**:
   ```bash
   node agents/evaluator/skills/anonymize-transcript.cjs <transcript-file> > /tmp/anon-transcript.txt
   ```
   Save the mapping printed to stderr for de-anonymization later.

2. **Run the evaluator** with the treatment SOUL:
   - Use `EXP-191/evaluator-soul-anonymous.md` instead of `agents/evaluator/SOUL.md`
   - Pass the anonymized transcript from step 1

3. **Record output** to `results/treatment.jsonl` with the agent mapping attached:
   ```json
   {"session_id": "...", "scores": {...}, "mapping": {"coder": "Agent-A", ...}}
   ```

## Data Collection Format

Each JSONL line:
```json
{
  "session_id": "abc-123",
  "session_number": 1,
  "arm": "control|treatment",
  "agent_type": "Builder|Supervisor|Researcher",
  "original_agent": "coder",
  "scores": { "efficiency": 0.8, "quality": 0.9, "verdict": "good" },
  "reference_score": null,
  "mapping": null
}
```

`reference_score` is filled in during calibration review (post-hoc).

## Guardrails

- **Do not peek** at results until ≥20 sessions per arm are complete
- **Stop** if treatment false-negative rate exceeds control by >10pp
- **Stop** if treatment scores show zero variance (broken evaluator)

## Analysis

After all 50 sessions, run analysis per `design.md` § Analysis Plan:
1. Two-sample t-test on quality-preservation scores
2. Compare score variance across agents (Levene's test)
3. Compute Identity Bias Coefficient per arm
4. Write results to `EXP-191/analysis.md`
