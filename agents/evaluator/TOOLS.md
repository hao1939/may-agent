<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)
`read`, `write`, `edit`, `bash`, `query_db`, `message`, `finish`
<!-- SYNC:TOOLS_END -->

# Tools — Evaluator

## Available Tools

### `read` — Read project files
Read any file in the project: session transcripts, agent configs, evaluation data, source code.
Use line-range reads (`read(path, startLine=N, endLine=M)`) for large transcripts to avoid truncation.

### `write` — Write files
Write evaluation output, scores, and lessons. Primary targets:
- `.state/may.db` `evaluations` table — evaluation results (SQLite)
- `agents/evaluator/workspace/` — working files

### `bash` — Run shell commands

Run commands to inspect project state:
- `ls`, `find`, `cat`, `grep` — navigate and search files
- `wc -l` — check file sizes before reading
- `jq` — parse JSON evaluation data
- `node agents/evaluator/skills/detect-drift.cjs` — run drift detection skill

## Skills

### Monitor Session (L2 Kinetic Defense — Wink Pattern)
Run `node agents/evaluator/skills/monitor-session.cjs [sessionId|--running|--all]`.
Runtime watchdog for active sessions. Reads the tail of session JSONL logs and detects:
- **LOOP**: Same tool call repeated 3+ times with identical args
- **STALL**: No activity for >10 minutes
- **DRIFT**: Recent actions unrelated to the original task (keyword + path heuristic)
- **ERROR_STORM**: 3+ consecutive tool errors
Returns structured JSON with per-session assessments. Exit code 1 if any session unhealthy.

### Detect Drift (L3 Collective Defense)
Run `node agents/evaluator/skills/detect-drift.cjs .state/ops-receipts.jsonl`.
This skill compares recent success rates vs baseline to detect gradual degradation ("Boiling Frog").

### Detect P53 Drift (Compliance Audit)
Run `node agents/evaluator/skills/detect-p53-drift.cjs`.
Compares SHA256 hashes of all `SOUL.md` and `agent.json` files against `agents/bob/workspace/compliance-audit/snapshot.json`. Returns `{ passed, diffs, missing }`. Writes report to `agents/bob/workspace/compliance-audit/reports/` and posts status to `shared/bulletin.md`.
