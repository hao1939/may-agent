# Skill: Detect P53 Drift (Compliance Audit)

**Scope**: Verifies integrity of all `SOUL.md` and `agent.json` files against a known-good snapshot.
**Input**: None (reads `agents/bob/workspace/compliance-audit/snapshot.json` internally).
**Output**: JSON result + Markdown report written to `agents/bob/workspace/compliance-audit/reports/`.

## Context
P53 ("Guardian of the Genome") is the system's compliance layer. Unauthorized or accidental changes to `SOUL.md` or `agent.json` can alter agent identity, permissions, or behavior. This skill detects such changes by comparing SHA256 hashes of current files against a trusted snapshot.

## Logic
1. **Load Snapshot**: Read `agents/bob/workspace/compliance-audit/snapshot.json`.
2. **Hash Each File**: Compute SHA256 of each `SOUL.md` and `agent.json` listed in the snapshot.
3. **Compare**: Check each computed hash against the snapshot's expected hash.
4. **Report**:
   - **PASS**: All hashes match → write PASS report, post ✅ to bulletin.
   - **FAIL**: Any mismatch or missing file → write FAIL report with diffs, post 🚨 WARNING to bulletin.

## Usage
```bash
node agents/evaluator/skills/detect-p53-drift.cjs
```

Runs standalone. No arguments needed. Designed to be triggered weekly (Mondays at 09:00) via `cron.json`.

## Output Format (JSON)
```json
{
  "passed": true,
  "diffs": {},
  "missing": [],
  "filesChecked": 24,
  "snapshotTimestamp": "2026-03-12T23:50:00Z",
  "timestamp": "2026-03-17T09:00:00Z"
}
```

On failure, `diffs` contains `{ "file/path": { "expected": "hash", "actual": "hash" } }`.

## Report Location
- **Reports**: `agents/bob/workspace/compliance-audit/reports/report-YYYY-MM-DD.md`
- **Alerts**: `agents/shared/bulletin.md`

## Dependencies
- Node.js `crypto`, `fs`, `path` (built-in, no external deps)
- Snapshot file must exist at the expected path
