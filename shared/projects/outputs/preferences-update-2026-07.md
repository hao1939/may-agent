# Preferences Scan Results — July 2026

**Scanned**: `human-inputs.jsonl` (20 messages, last 30 days)
**New preferences found**: 1 new, 1 reinforcement

---

## NEW Preference: P5 — Data Integrity Over Speed

**Signal**: "Careful figuring out my input. The data is most important for the success. Corrupted data would fail the project"

**Rule**: When working with data (sessions, metrics, inputs), accuracy and correctness of data is more important than speed of processing. Validate data quality before using it for analysis or decisions.

**Applies to**: Any project that uses session data, metrics, or historical records as inputs.

---

## Reinforcements of Existing Preferences

| Preference | New signal | Already captured? |
|------------|-----------|-------------------|
| P1: Stability first | "keep existing projects working, fix failures/blocks, clean up the house" | ✅ Yes |
| Never stop at target | "no metric? Build it. Met? Refine. Add more dimensions. Always push." | ✅ Yes (repeated verbatim) |
| Let infra work | "Let the infra do its job" | ✅ Yes |
| Continuous push | "How is the projects going?" (impatience with idle) | ✅ Yes |

---

## Recommended Addition to preferences.md

Add after P4 (Observability):

```markdown
### P5: Data Integrity
> "The data is most important for the success. Corrupted data would fail the project."

- Accuracy of inputs > speed of processing
- Validate data quality before using it for analysis
- When data might be corrupted or incomplete, flag it rather than proceeding
- **Decision rule**: Before acting on data, ask "is this data reliable?" If uncertain, verify first.
```

And add to the Decision Scorecard:

```markdown
| Is the input data verified/reliable? | gate | P5 (data integrity) |
```
