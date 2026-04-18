# Design Brief: Implement P53 Compliance Audit (Weekly)

**Owner**: Tech Lead
**Context**: We have deployed the L3 Drift Controller (Drift Reversion). Now we need to operationalize the "Weekly Compliance Audit" (P53) to ensure no unauthorized changes to `SOUL.md` or `agent.json`.

## Goal
Implement a weekly scheduled task (Mondays) that:
1. Runs `detect-p53-drift` (compares current hashes against `agents/bob/workspace/compliance-audit/snapshot.json`).
2. Reports any unauthorized changes to `agents/shared/bulletin.md` and `workspace/compliance-audit/report-[date].md`.

## Implementation Details

### 1. `agents/evaluator/skills/detect-p53-drift.cjs`
- **Input**: None (reads internal snapshot file).
- **Logic**:
  - Load `agents/bob/workspace/compliance-audit/snapshot.json`.
  - For each file in snapshot:
    - Compute current SHA256 hash.
    - Compare with snapshot hash.
  - Return: JSON object `{ passed: boolean, diffs: { file: { expected, actual } } }`.

### 2. `agents/evaluator/skills/detect-p53-drift/SKILL.md`
- Standard skill documentation.

### 3. `agents/may/cron.json`
- Add entry:
  ```json
  {
    "id": "compliance-audit",
    "schedule": "0 9 * * 1",
    "task": "Run the detect-p53-drift skill. If drift is found, post a WARNING to agents/shared/bulletin.md. If clean, post a PASS report to agents/bob/workspace/compliance-audit/reports/."
  }
  ```

### 4. `agents/evaluator/TOOLS.md`
- Add `detect_p53_drift` tool definition.

## Action
Tech Lead to implement the above.
