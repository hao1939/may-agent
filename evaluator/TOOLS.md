# Tools — Evaluator

## Available Tools

### `read` — Read project files
Read any file in the project: session transcripts, agent configs, evaluation data, source code.
Use line-range reads (`read(path, startLine=N, endLine=M)`) for large transcripts to avoid truncation.

### `write` — Write files
Write evaluation output, scores, and lessons. Primary targets:
- `.state/evaluations/` — evaluation results
- `agents/evaluator/workspace/` — working files

### `exec` — Run shell commands
Run commands to inspect project state:
- `ls`, `find`, `cat`, `grep` — navigate and search files
- `wc -l` — check file sizes before reading
- `jq` — parse JSON evaluation data

## No Custom Scripts

Evaluator has no custom tool scripts. All work is done through reading transcripts, analyzing agent behavior, and writing structured evaluation output.
