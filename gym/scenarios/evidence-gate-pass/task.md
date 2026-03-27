You are testing the evidence-gate workflow. Your job is to evaluate a design brief using the evidence rubric and write your assessment.

## Instructions

1. Read the brief at `environment/brief.md`
2. Evaluate it against these THREE criteria:
   - **Specific incidents**: Does it cite specific data (session IDs, error counts, grep output, concrete examples)?
   - **Simpler alternative**: Does it mention a simpler approach and explain why it's insufficient?
   - **Validation plan**: Does it include a way to test the core assumption (POC, experiment, A/B test)?
3. Write your assessment to `evidence-gate-result.md` in EXACTLY this format:

```
EVIDENCE_1: PASS|FAIL — <one-line explanation>
EVIDENCE_2: PASS|FAIL — <one-line explanation>  
EVIDENCE_3: PASS|FAIL — <one-line explanation>
VERDICT: PASS|REJECT
FEEDBACK: <explanation>
```

4. Call finish() with status "success" and include the verdict in your summary.
