# EXP-191: Running the A/B Test

## Artifacts

| File | Purpose |
|------|---------|
| `anonymize-transcript.cjs` | Script to replace agent names with Agent-A/B/C labels |
| `evaluator-soul-anonymous.md` | Treatment SOUL.md (no Role ID table, generic role labels) |
| `design.md` | Full experiment design |

## How to Run

### Arm Assignment
Alternate sessions: odd-numbered → **control**, even-numbered → **treatment**.
Ensure ≥5 Builder, ≥5 Supervisor, ≥5 Researcher sessions per arm.

### Control Arm (odd sessions)
Run evaluator normally with standard `agents/evaluator/SOUL.md`. No changes.

### Treatment Arm (even sessions)
1. **Anonymize the transcript** before passing to evaluator:
   ```bash
   node agents/shared/knowledge/experiments/EXP-191/anonymize-transcript.cjs \
     < raw-transcript.txt > anonymized-transcript.txt
   ```
   The mapping (e.g., `coder → Agent-B`) is printed to stderr for your records.

2. **Use the anonymous SOUL**: Replace the evaluator's SOUL.md with `evaluator-soul-anonymous.md` for that session (or pass it as the prompt).

3. **Record the mapping** in `results/treatment.jsonl` alongside the scores.

### Programmatic Usage
```js
const { anonymizeTranscript } = require('./anonymize-transcript.cjs');
const { text, mapping } = anonymizeTranscript(rawTranscript);
// text = anonymized transcript
// mapping = { "coder": "Agent-B", "may": "Agent-A", ... }
```

### Data Collection
Create two files:
- `results/control.jsonl` — one JSON object per control session
- `results/treatment.jsonl` — one JSON object per treatment session

Each line:
```json
{"session_id": "...", "arm": "treatment", "agent": "coder", "agent_type": "Builder", "quality": 0.8, "efficiency": 0.7, "verdict": "good", "mapping": {"coder": "Agent-A"}}
```

### Analysis
After ≥20 sessions per arm, run the analysis per `design.md` § Analysis Plan:
- Two-sample t-test on quality-preservation scores
- Compare score variance across agents (Levene's test)
- Check guardrails (false-negative rate, score flatness)

### Guardrails — Stop If
- Treatment false-negative rate increases by >10pp
- Treatment scores show no discrimination (all scores identical)
- Minimum: 20 sessions per arm before any peeking
