---
name: primary-source-analysis
description: >
  When analyzing failures or drawing conclusions, always read primary sources
  (logs, code, data) before accepting summaries or reports. Summaries can be
  wrong, biased, or incomplete.
---

# Primary Source Analysis

## When to Apply

Apply this skill when:
1. A task asks you to analyze/diagnose a problem
2. There's a summary document AND raw source data available
3. You're about to write a conclusion based on someone else's analysis

## Protocol

1. **Read summaries LAST, not first**: Start with raw data (logs, code, configs). Form your own hypothesis.
2. **If you read the summary first** (it happens): Treat it as a HYPOTHESIS to verify, not a conclusion to accept.
3. **Cross-reference**: Does the summary's conclusion match what the raw data shows? If not, trust the raw data.
4. **Cite primary evidence**: Your conclusion must reference specific lines from primary sources, not just agree with a summary.

## Anti-Pattern

❌ `results-summary.md` says "failure caused by ceiling effect." Agent reads summary, writes analysis parroting this conclusion. But `session-logs/run-5.log` shows the intervention was applied to wrong file — the REAL cause.

✅ Agent reads session logs first, discovers the misconfiguration, THEN reads summary and notes it's incorrect.

## Inviolable Constraint

⛔ **Never write an analytical conclusion without citing primary source evidence.** If your analysis only references a summary document, you haven't done analysis — you've done transcription.
