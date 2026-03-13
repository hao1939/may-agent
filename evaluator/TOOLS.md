# Tools — Evaluator

## Available Tools

### `read` — Read project files
Read any file in the project: session transcripts, agent configs, evaluation data, source code.
Use line-range reads (`read(path, startLine=N, endLine=M)`) for large transcripts to avoid truncation.

### `write` — Write files
Write evaluation output, scores, and lessons. Primary targets:
- `.state/evaluations/` — evaluation results
- `agents/evaluator/workspace/` — working files

### `bash` — Run shell commands
Run commands to inspect project state:
- `ls`, `find`, `cat`, `grep` — navigate and search files
- `wc -l` — check file sizes before reading
- `jq` — parse JSON evaluation data
- `node agents/evaluator/skills/detect-drift.cjs` — run drift detection skill

## Skills

### Detect Drift (L3 Collective Defense)
Run `node agents/evaluator/skills/detect-drift.cjs .state/ops-receipts.jsonl`.
This skill compares recent success rates vs baseline to detect gradual degradation ("Boiling Frog").

### Detect P53 Drift (Compliance Audit)
Run `node agents/evaluator/skills/detect-p53-drift.cjs`.
Compares SHA256 hashes of all `SOUL.md` and `agent.json` files against `agents/bob/workspace/compliance-audit/snapshot.json`. Returns `{ passed, diffs, missing }`. Writes report to `agents/bob/workspace/compliance-audit/reports/` and posts status to `agents/shared/bulletin.md`.

## No Custom Scripts

Evaluator has no custom tool scripts. All work is done through reading transcripts, analyzing agent behavior, and writing structured evaluation output.
