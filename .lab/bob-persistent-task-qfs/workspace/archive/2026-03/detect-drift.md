# Detect Drift (L3 Collective Defense)

This skill analyzes `.state/ops-receipts.jsonl` to detect gradual performance degradation (drift).

## Context
Agents drift over time. Success rates drop, test counts shrink, and error rates rise. This skill detects these trends by comparing a recent window (last 10 ops) against a historical baseline (previous 90 ops).

## Detection Logic

### 1. Load Data
Read `.state/ops-receipts.jsonl`. If file is missing or empty, return "No data".

### 2. Group & Calculate Metrics
Group by `agent` and `tool`. Calculate:
- **Success Rate**: `status` == "success" / Total
- **Avg Tests Passed**: `meta.testsPassed` / Total (for `run_test` only)

### 3. Compare Windows
- **Baseline Window**: Ops [0..N-10]
- **Current Window**: Ops [N-10..N]

### 4. Flag Anomalies
Report an anomaly if:
- **Success Rate Drop**: Current < (Baseline - 0.15)  (15% drop)
- **Test Density Drop**: Current < (Baseline * 0.5)   (50% drop in tests written)

## Output Format
```markdown
## Drift Report
### Anomaly Detected: [Agent] - [Tool]
- **Metric**: [Success Rate / Test Density]
- **Baseline**: [Value]%
- **Current**: [Value]%
- **Drift**: -[Value]% ⚠️
```
If no anomalies: "## Drift Report\nAll metrics stable within 15% of baseline."
