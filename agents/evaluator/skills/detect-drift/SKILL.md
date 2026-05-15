# Skill: Detect Drift

**Scope**: Detects statistical degradation in agent performance (L3 Collective Defense).
**Input**: `.state/ops-receipts.jsonl`
**Output**: Markdown report flagging anomalies (Success Rate, Test Density, Tool Integrity).

## Context
The "Boiling Frog" effect (arXiv:2603.10955) describes how agent systems degrade slowly over time (e.g., success rate drops from 95% to 80% over weeks). This skill analyzes the Ops Receipts log to detect these subtle shifts.

## Logic
1. **Load Data**: Read the last 500 lines of `.state/ops-receipts.jsonl`.
2. **Group**: Organize by `agent:tool`.
3. **Window**: Compare "Recent Window" (last 20 ops) vs "Baseline Window" (previous 80 ops).
4. **Metrics**:
   - **Success Rate**: `status == 'success'` / Total.
   - **Test Density**: `meta.testsPassed` (for Coder).
   - **Tool Integrity**: `status != 'error'`.
5. **Threshold**: Flag if metric drops by >15% (0.15).

## Usage
Run this skill periodically (e.g., every 50 sessions) via `cron`.

```javascript
// Example: Detect drift
const receipts = readOpsReceipts();
const anomalies = detectAnomalies(receipts);
if (anomalies.length > 0) {
  reportDrift(anomalies);
}
```

## Report Format
```markdown
## 🚨 Drift Alert
### [Agent]: [Tool]
- **Metric**: [Metric Name]
- **Baseline**: [X]% (N=[count])
- **Recent**: [Y]% (N=[count])
- **Delta**: -[Z]% 📉
```
