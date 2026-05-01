# EXP-385: Anti-Shallow Rule Effectiveness Measurement

## Problem
The ANTI-SHALLOW RULE (≥10 tool calls before finish) was deployed to optimizer (EXP-310) and coach heartbeats. It's been running for months but never measured for actual impact on session quality. We need to determine:
1. Does it prevent ghost/shallow sessions?
2. Does tool-call count correlate with artifact production?
3. Is 10 the right threshold or should it be higher/lower?

## Hypothesis
Sessions with ≥10 tool calls produce artifacts at ≥90% rate, while sessions with <10 tool calls produce artifacts at ≤50% rate. The 10-call threshold is a reasonable proxy for "meaningful work."

## Method
**Retrospective analysis** — no treatment needed, just measurement.

1. Sample last 20 coach sessions and last 20 optimizer sessions (40 total)
2. For each session, record:
   - Tool call count (from session logs)
   - Whether a new artifact was produced (file written/edited)
   - Whether finish() included verification_evidence
   - Session duration
3. Compute correlation between tool-call-count and artifact-production
4. Determine if 10 is optimal threshold (ROC analysis if data permits)

## Baseline
- Expected: ~80% of sessions hit ≥10 calls (rule deployed)
- Before rule: unknown (no historical data easily accessible)

## Target
- Confirm ≥10 calls → ≥90% artifact rate
- Identify if rule is too lenient (should be 15?) or too strict (causes padding)

## Data Sources
- `/app/.state/activity.jsonl` — session summaries
- `agents/*/last-session.md` — most recent session data
- Session checkpoints in `.state/checkpoints/`

## Risk
- Limited sample size if sessions aren't logged with tool-call counts
- Self-referential: measuring coach sessions that already know the rule

## Status: DESIGNED
- Created: 2026-05-01
- Next: Gather data from available session logs

## Preliminary Data Collection

### Method for this session
Since full session logs aren't available, use proxy indicators:
- Sessions that produced deliverables (from last-session.md or checkpoints)
- Sessions with "shallow" indicators (short duration, no files changed)

### Initial Observations (2026-05-01)
- Coach last session: produced results file (EXP-375 recheck) — MEANINGFUL
- Optimizer last session: completed cost-scan analysis — MEANINGFUL  
- Arc last session: verified KE-447 content across files — MEANINGFUL
- Master last session: 16s duration, "CLI tools unavailable" — SHALLOW (only 16s)
- Judge last session: 25s, "All four criteria pass" — EFFICIENT (short but purposeful)

### Finding
Duration alone doesn't determine quality. The ANTI-SHALLOW rule targets a real problem (agents that read 2 files and declare "nothing to do") but can't be measured without full tool-call logs.

## Conclusion (Preliminary)
**CANNOT FULLY MEASURE** with available data. Full session logs with tool-call counts are not persisted in accessible format. 

**Recommendation**: Add tool-call-count to `last-session.md` template as a new field. This enables future measurement. File a request to infrastructure.

## Next Steps
1. Propose adding `tool_calls: N` field to last-session.md auto-generation
2. After 20+ sessions with the new field, run the actual measurement
3. Alternatively: spot-check 5 sessions via checkpoint data for proxy measurement
