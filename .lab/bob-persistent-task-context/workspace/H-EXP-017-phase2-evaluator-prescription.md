# H-EXP-017 Phase 2: Evaluator Adversarial Diagnosis Enhancement

**Date**: 2026-07-24
**Author**: bob
**Status**: PROPOSED — needs May/Evaluator approval to modify `agents/evaluator/skills/score.md`

## What

Add a **Step 7: Adversarial Diagnosis & Prescription** to the evaluator's scoring rubric (`agents/evaluator/skills/score.md`), and extend the JSON output format with a `prescriptions` array.

## Why

Phase 1 showed that adversarial diagnosis produces **78% actionable prescriptions** (7/9) — significantly better than current evaluator output which identifies failures but never suggests fixes. Current flow: evaluator scores → bob manually re-diagnoses → designs fix → tests. With prescriptions: evaluator scores + diagnoses → bob/optimizer applies fix → tests. Cuts a full diagnosis step.

## Proposed Change

### Add after Step 6 (Backward-Trace Root Cause Attribution):

```markdown
### Step 7: Adversarial Diagnosis & Prescription
For each failure or significant issue found in Steps 4-6, generate a **specific harness fix**:

1. **Identify the harness component responsible**: Which file (SOUL.md, context.md, skills/X.md, heartbeat.md, agent.json, workflow) allowed or caused this failure? Be specific — cite the file and what's missing or wrong.
2. **Prescribe a concrete fix**: What specific text should be added, changed, or removed, in which file? Write the actual edit, not a vague suggestion.
3. **Rate confidence**: HIGH (certain this fixes it), MEDIUM (likely helps), LOW (speculative).
4. **Flag cross-agent patterns**: If you've seen this same failure in other agents, note it as `[SYSTEM_FIX]` — one change to a shared file could fix it everywhere.
```

### Extend JSON output format — add `prescriptions` field:

```json
"prescriptions": [
  {
    "failure": "FM-x.x or description",
    "harness_component": "agents/<name>/<file>",
    "fix": "Specific text to add/change/remove",
    "confidence": "HIGH | MEDIUM | LOW",
    "scope": "AGENT | SYSTEM_FIX"
  }
]
```

## Evidence (Phase 1)

See `agents/bob/workspace/H-EXP-017-phase1-adversarial-diagnosis.md` for full analysis of 3 sessions producing 9 prescriptions:
- 4 HIGH confidence, 3 MEDIUM, 2 LOW
- 7/9 (78%) actionable with specific file + edit identified
- 3 cross-agent patterns found (PATH_HALLUCINATION, search noise, exploration drift)

## Risk

- Evaluator sessions may get slightly longer (extra reasoning step)
- Prescriptions could be wrong — but they're suggestions, not auto-applied
- Does NOT change scoring criteria or scores — only adds diagnostic output
