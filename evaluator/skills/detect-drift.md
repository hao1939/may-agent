# Skill: Detect Drift

This skill analyzes system operation receipts to detect gradual performance degradation ("Boiling Frog").

## Input
- `path`: Path to the ops receipts file (default: `.state/ops-receipts.jsonl`)

## Output
- A markdown report summarizing drift metrics.
- Identifying any agents or operations with significant negative trends.

## Instructions
1. **Read Data**:
   - Read the last 1000 lines of `path`.
   - Parse each line as JSON.
   - Filter for valid `OpsReceipt` objects.

2. **Calculate Metrics**:
   - Group receipts by `agent` and `operation` (e.g., `coder:run_test`).
   - For each group, calculate:
     - **Success Rate**: (count of `status == "success"`) / total.
     - **Test Density** (for `run_test`): Average `testsPassed` / `testsTotal`.
     - **Error Rate**: (count of `status == "error"`) / total.

3. **Compare Windows**:
   - Split data into "Baseline" (first 80%) and "Recent" (last 20%).
   - Calculate % change for each metric.
   - Flag if:
     - Success Rate drops > 15%.
     - Error Rate increases > 10%.
     - Test Density drops > 20%.

4. **Report**:
   - Output a table of metrics.
   - Highlight flagged items with ⚠️.
   - Provide a "Verdict": "Stable" or "Drift Detected".

## Example Usage
```bash
# Analyze default receipts
node agents/evaluator/skills/detect-drift.cjs

# Analyze specific file
node agents/evaluator/skills/detect-drift.cjs .state/ops-receipts-test.jsonl
```
