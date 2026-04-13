- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- sqlite3 CLI is not available — query .state/may.db with bun: `bun -e "import {Database} from 'bun:sqlite'; const db = new Database('.state/may.db', {readonly:true}); ..."`
- Gym runner: scripts/gym-run.sh <scenario> --agent <name>
- Gym stats: bun scripts/gym-stats.ts
- agents/ is a separate git repo — commit from agents/ dir
- Session data is in .state/may.db sessions + evaluations tables, not filesystem scans
- Cron handlers are in agents/<name>/handlers/ — referenced by cron.json "handler" field
- Don't add harness guards without gym evidence — text rules don't fix *judgment* failures (KE-002, 0/57), but process-level text rules work fine (88-100% compliance for conventions like C2.1, C1.5)
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths (they don't exist in this environment)
- When calling finish(), status must match reality — if you found missing files or blockers, use 'blocked' or 'partial', not 'success'
- Research preference: workflows and efficiency — we believe workflows are very valuable for structuring agent work. Evaluate them, measure impact, design better ones. But not limited to this.
- DO NOT propose heartbeat-skipping or idle-skip optimizations. We tried this (shouldSkipIdleHeartbeat, hasPendingWork, skipIfIdle) and removed it — heartbeats must always fire. The cost savings aren't worth the missed initiative work and complexity. If you see "waste" from heartbeats finding nothing to do, that's acceptable — the value is in the heartbeats that DO find work.
- For multi-deliverable tasks: after reading context files, create DELIVERABLES_CHECKLIST.md listing all expected outputs before starting execution. Check items off as you go. A production guard enforces this — finish(success) is blocked without it. See skills/deliverable-checklist.md for details.
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Heartbeat regressions are caused by structural changes, not content. Add content within existing steps only.

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.
