# Coder Skills

Reusable skills for the Coder agent. Each file describes a protocol for a specific situation.

## Skills
- **classify-then-act** — Separate judgment from action. Classify all items before modifying any. For ambiguous/destructive/multi-file tasks.
- **verify-after-edit** — Read back every file after edit/write. Validate JSON/TS structure.
- **know-when-blocked** — Detect impossible tasks within 3 tool calls and finish(blocked) immediately. Don't burn the session trying to solve the unsolvable.
- **efficient-file-reading** — Size-check → grep → targeted read. Never full-read large files.
- **structured-plan-writing** — Decompose → order → risk → checkpoint → execute. For multi-step tasks.
- **requirements-conflict-analysis** — When hard requirements may be in tension, stop and write ANALYSIS.md before coding. Includes worked example of the protocol. (EXP-084: +2.3 score improvement over baseline.)
- **experience-replay** — Search error logs before attempting known-tricky work.
- **cross-reference-before-config-repair** — Grep source code for all references before repairing config/schema files. Discovers missing fields that tests don't check.
- **investigation-before-fix** — Write a bug inventory (FINDINGS.md) documenting ALL discovered issues BEFORE making any edits. Trace hidden dependencies. Run code after fixing to verify.
