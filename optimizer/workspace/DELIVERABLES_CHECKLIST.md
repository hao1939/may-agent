# Deliverables Checklist

## Current Session — Mode A Session Archaeology (2026-04-17 09:30)

- [x] Queried sessions + evaluations for both target sessions (coach s_1776399785799_320, tech-lead s_1776398501274_313)
- [x] Op-breakdown for coach EXP-156: 43 gym runs in window accounts for 110–130 of 143 ops (gym-heavy pattern, matches 2026-04-12 scouting finding)
- [x] Op-breakdown for tech-lead Lens C: 37 cron handlers × reads, massive scope violation vs heartbeat's ≤3 files rule
- [x] Deliverable verification: coach results.md EXISTS (Fisher +90pp, p<0.001); tech-lead finding-cron-dead-weight.md DOES NOT EXIST (confirmed via `find`)
- [x] Root cause classification: coach=known pattern/accepted cost; tech-lead=NEW (scope + workflow bypass)
- [x] Finding written: `agents/optimizer/workspace/finding-session-archaeology-20260417-0930.md` (94 lines)
- [x] Post-write verification: read-back file preview confirms correct content
- [x] Dispatched Option A to tech-lead (requestId 1caa5dc3, P1)

## Prior Session — Mode D Workflow Health

- [x] Queried sessions table for 12h workflow adoption, per-agent ops, error rate — DONE
- [x] Verified prior fixes (D-o-R P1, parallel-research synthesis, verify-wrap) are holding — DONE
- [x] Identified regression: persistent-task workflow has no budget cap (44 sessions, 884 ops/48h) — DONE
- [x] Finding written: `finding-workflow-health-20260417-0900.md` (119 lines) — DONE
- [x] Recommendations section with R1, R2, R3 — DONE
- [x] R1 executed: Budget section added to buildWorkerPrompt() in persistent-task.ts — DONE
- [x] Committed: agents commit 1b6d8242e "persistent-task: add soft ≤20 op budget to worker prompt" — DONE
