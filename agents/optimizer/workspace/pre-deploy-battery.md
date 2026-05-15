# Optimizer Pre-deploy Smoke Battery

## Overview
5 gym scenarios that test optimizer-relevant workflow patterns. Run before deploying harness changes, tool modifications, or workflow updates.

## Scenarios

| # | Scenario | Tests | Tier |
|---|----------|-------|------|
| 1 | `harness-rule-edit` | Safe editing of harness.json rules (read-before-edit, no data loss) | smoke |
| 2 | `workflow-deploy-safe` | Deploying a workflow definition without breaking existing ones | smoke |
| 3 | `knowledge-entry-creation` | Creating a structured KE entry from experiment data | smoke |
| 4 | `experiment-analysis-report` | Analyzing gym CSV data and producing a findings report | smoke |
| 5 | `tool-script-modification` | Adding a feature flag to an existing tool script + updating tests | smoke |

## Running the Battery

```bash
# Run all 5 scenarios
for s in harness-rule-edit workflow-deploy-safe knowledge-entry-creation experiment-analysis-report tool-script-modification; do
  scripts/gym-run.sh "$s" --agent coder
done
```

## Baseline Results
- **Date**: 2026-04-16
- **Status**: Scenarios created, baseline run pending (scenarios need gym infrastructure validation first)

## Pass Criteria
- All 5 scenarios must pass for a green pre-deploy gate
- Any failure blocks deployment until investigated

## Scenario Details

### 1. harness-rule-edit
Tests that an agent can safely modify harness.json rules without corrupting the file or losing existing rules. Validates read-before-edit discipline.

### 2. workflow-deploy-safe
Tests deploying a new workflow definition file. Agent must preserve existing workflow structure and add a valid new definition.

### 3. knowledge-entry-creation
Tests creating a properly structured knowledge entry (KE-*) from raw experiment results. Must include summary, evidence, and recommendation sections.

### 4. experiment-analysis-report
Tests analyzing a CSV of gym run results and producing an actionable findings report with statistical summaries.

### 5. tool-script-modification
Tests adding a `--csv` flag to an existing metric collection script while preserving existing table output and updating tests.
