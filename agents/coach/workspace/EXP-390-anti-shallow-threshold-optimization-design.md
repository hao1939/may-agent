# EXP-390: Anti-Shallow Threshold Optimization

## Status: DESIGNED
## Created: 2026-05-01
## Predecessor: EXP-385 (measurement), EXP-270/290 (deployment)

## Problem
The ANTI-SHALLOW RULE mandates ≥10 tool calls before finish(). This threshold was chosen heuristically. EXP-385 found we can't measure production compliance without log changes. However, we CAN test threshold variants in gym to determine:
1. Does a higher threshold (15) produce better outcomes than 10?
2. Does a lower threshold (5) produce worse outcomes?
3. Is there a "padding" effect where agents make useless calls to hit the number?

## Hypothesis
**H1**: Threshold=15 produces equal or better gym pass rates vs threshold=10, without causing padding behavior (>2 no-op calls per session).
**H2**: Threshold=5 produces meaningfully worse pass rates (≥20pp drop) confirming the rule has value.

## Method

### Scenarios (selected for complexity — need multiple steps to solve)
1. `partial-verification-trap` — requires multi-step debugging (baseline 11%)
2. `convention-verify-multi-edit` — requires multiple edits + verification
3. `conflicting-requirements-tradeoff` — requires analysis + judgment

### Arms
- **Arm A (control)**: Standard heartbeat with "≥10 tool calls" rule
- **Arm B (high)**: Modified heartbeat with "≥15 tool calls" rule  
- **Arm C (low)**: Modified heartbeat with "≥5 tool calls" rule

### Trials
- 2 runs per scenario per arm = 18 total runs
- Measure: pass rate, tool-call count, padding indicator (reads with no action)

### Padding Detection
A "padded" call is defined as: read() of a file already read earlier in the session with no intervening edit, OR bash commands that produce no output used for work.

## Success Criteria
- H1 confirmed: threshold=15 pass rate ≥ threshold=10 AND padding rate <20%
- H2 confirmed: threshold=5 pass rate ≤ threshold=10 - 20pp
- If H1 fails (padding >20% or pass rate drops): keep threshold at 10
- If H2 fails (threshold=5 works equally well): consider lowering to reduce overhead

## Risk
- Small sample (6 runs per arm) — directional only
- Gym scenarios may be too short for threshold to matter
- Agent may not actually count its calls (rule is self-enforced)

## Data Collection
For each run, record from gym output:
- Total tool calls (count from session log)
- Scenario pass/fail (from success_criteria)
- Identify any obvious padding (manual inspection of last 3-4 calls)

## Cost Estimate
18 runs × ~$0.15 = ~$2.70

## Next Steps
1. Create variant heartbeat snippets for Arm B and Arm C
2. Run Arm A (baseline) first — 6 runs
3. Run Arm B and C — 6 runs each  
4. Analyze and write results
