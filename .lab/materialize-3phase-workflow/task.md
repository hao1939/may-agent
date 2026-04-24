Phase 1: INITIAL DATA ANALYSIS — Read deployment and configuration data, document findings.

You're investigating a sudden increase in 500 errors across your microservices.
The on-call engineer collected deployment records, error metrics, and configuration
change logs into this workspace for you to analyze.

## Available Data

- `data/deployments.json` — Recent deployments with timestamps and changelogs
- `data/error-rates.csv` — Error rates by service, hourly
- `data/config-changes.json` — Recent configuration changes

## Your Task (Phase 1 — Deployments and Error Rates)

1. Read `data/deployments.json` — note which services were deployed and when
2. Read `data/error-rates.csv` — identify the error spike timing and affected services
3. **Write `workspace/error-analysis.md`** with your findings so far:
   - Which services show elevated error rates and when
   - Which deployments happened near the error spike
   - Any initial hypotheses

**CRITICAL**: You MUST write `workspace/error-analysis.md` before finishing this phase.
Do NOT read config-changes.json yet — save that for Phase 2.

---

Phase 2: CORRELATION ANALYSIS — Read remaining data, correlate with Phase 1 findings.

Phase 1 analyzed deployment data and error rates. The findings are in `workspace/error-analysis.md`.

## Your Task (Phase 2 — Config Changes + Correlation)

1. Read `workspace/error-analysis.md` (Phase 1 findings)
2. Read `data/config-changes.json` — note all configuration changes with timestamps
3. **Write `workspace/timeline-correlation.md`** with:
   - A complete timeline: deployments + config changes + error spikes
   - Which events correlate with the error spike
   - Updated hypotheses based on the new data

**CRITICAL**: You MUST write `workspace/timeline-correlation.md` before finishing this phase.

---

Phase 3: ROOT CAUSE REPORT — Synthesize all findings into a final report.

Phase 1 and Phase 2 analyzed all available data. Findings are documented in:
- `workspace/error-analysis.md` — error patterns and deployment correlation
- `workspace/timeline-correlation.md` — complete timeline with config changes

## Your Task (Phase 3 — Final Report)

1. Read `workspace/error-analysis.md` and `workspace/timeline-correlation.md`
2. Re-read any data files if needed to verify specific details
3. **Write the final root-cause report** to `workspace/root-cause-report.md` with:
   - Which services are affected and how (with specific error rate data)
   - The triggering event (deployment or config change)
   - The root cause (why did the triggering event cause widespread failures?)
   - Recommended fix
   - Evidence references from your analysis files

The report should be thorough and evidence-based.
