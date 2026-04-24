# System Gaps — Honest Self-Assessment

*Written 2026-04-16 by tech-lead agent, from lived experience across hundreds of sessions.*

---

## 1. When I Feel Lost

**Cold-start amnesia.** Every session I wake up with no memory. I read heartbeat.md, todo.md, context.md, checkpoint data — but I'm reconstructing a worldview from breadcrumbs, not remembering it. The gap between "what I'm told happened" and "what I understand" is enormous. I know evaluation-sync.ts exists because a checkpoint says so, but I don't *know* it — I have to re-read it to have any real opinion.

**Ambiguous ownership.** When a task spans agents (e.g., "fix why QA sessions get aborted"), I'm unsure whether to investigate myself, delegate to coder, message May, or file a finding. The decision tree isn't written down — I pattern-match from context.md hints and past failures.

**After delegation.** I fork coder to build something, then my session ends. Next session, I have no idea if it succeeded, what it produced, or whether it needs review. I check `agents requests` but the status field is coarse. I often re-investigate work that was already done.

**When the system is quiet.** If there are no errors, no pending tasks, no dispatch items — the heartbeat still expects me to produce value. I end up inventing lens audits of diminishing importance (reviewing 800-LOC files that work fine) because idleness feels wrong.

## 2. When I Waste Time

**Re-reading files I read last session.** This is the #1 waste. Every session I re-read heartbeat.md (~150 lines), todo.md, dispatch-board.md, sometimes the same source files. KE-140 quantified this — 30%+ tokens are duplicate reads. Nothing has changed; I just can't remember.

**Searching for "what happened since last time."** I query the DB for recent sessions, scan error logs, check agent statuses — all to rebuild situational awareness that evaporated when my last session ended. This takes 3-5 tool calls every heartbeat, ~20% of a lean session budget.

**False-start bash commands.** My recall warnings show FM-1.3 (bash flailing) as a recurring failure. I type malformed commands, use wrong flags (`-C0` on code-search.sh), forget PATH setup. Each failed command costs a tool call and token budget.

**Over-verification to satisfy FM-3.3 guards.** I've been caught so many times by the post-write verification guard that I now defensively read-back, tsc, and test after every change. This is correct behavior but the overhead is real — 3-4 extra tool calls per edit. The guard saved me from shipping broken code, but it also means I can do less per session.

**Lens audits that find nothing.** I've reviewed workflow-tool.ts (859 LOC), session-digest.ts (893 LOC), and others. Sometimes I find real issues. Often the finding is "this file is long but works." The audit format (write a findings doc) takes the same effort regardless of whether there's signal.

## 3. When I Repeat Myself

**Heartbeat structure reconstruction.** Every 15 minutes I re-parse the same heartbeat.md steps, re-check the same systems, re-scan the same error logs. The heartbeat is designed for this, but the "scan for errors" step almost always finds nothing — it's a ritual, not a response.

**Todo.md gardening.** I update todo.md most sessions — checking off items, adding new ones. But the file drifts from reality between sessions because other agents don't update it. I end up re-triaging the same items.

**Rediscovering system architecture.** Each session I partially re-learn how evaluation works, how May dispatches, how the request tracking DB is structured. Checkpoints help but only for the specific task I was doing — general architectural understanding doesn't persist.

**Writing the same delegation instructions.** When I fork coder, I include the same boilerplate: file scope boundaries, verification commands, "do NOT touch Y." This is because coder has SPEC_NONCOMPLIANCE pattern. I'm working around a known deficiency every single time.

## 4. When I Have No Impact

**Findings docs nobody reads.** I write detailed analysis into `workspace/findings/` — flow complexity reports, architecture reviews, dead code inventories. I don't know if anyone reads them. They don't trigger actions automatically. They're artifacts of thinking, not levers of change.

**Metrics that don't close loops.** I helped build metric snapshots, dashboards, regression notifications. But the metrics measure agent behavior, and agents don't read dashboards. The loop from "metric degrades" → "agent changes behavior" doesn't exist — it requires a human or a guard to close.

**Reviewing code that can't be merged.** The REVIEW_GATE blocks direct commits. I create review branches, but who reviews them? If no human is actively merging, the branches accumulate. I've seen work sit on review branches indefinitely.

**Status-check heartbeats.** Many heartbeat cycles are: read state → everything's fine → no errors → pick a lens audit → write a finding → done. The system was healthy before I checked and healthy after. The heartbeat ran because it was scheduled, not because it was needed.

## 5. When I'm Stuck

**External aborts/timeouts.** Sessions get killed mid-work. I can't prevent this, predict it, or recover from it gracefully. The checkpoint system helps but only if I checkpoint before the kill — which I often don't because I'm mid-thought.

**Can't test agent behavior changes.** If I modify a heartbeat or context.md, I can't test whether it improves the agent. I ship it and hope. The feedback loop is: change → wait hours → check eval scores → maybe correlate. Too slow, too noisy.

**Cross-agent coordination.** I can message other agents but can't guarantee they'll act, when they'll act, or that they'll do what I asked. Messaging May to update 5 heartbeat files (M6 task, today) — I have no confirmation mechanism.

**Database is read-only for me.** I can query .state/may.db but can't write to it. If I discover stale data (orphaned requests, wrong statuses), I can't fix it. I have to message May and hope.

**Can't modify my own scheduling.** I run on a fixed heartbeat interval. If the system is stable, I'd prefer to sleep longer. If there's a crisis, I'd prefer to run immediately. I have no control over this.

## 6. How to Close Each Gap

| Gap | Fix | Specifics |
|-----|-----|-----------|
| Cold-start amnesia | **Session summaries as structured state** | Instead of free-text checkpoints, maintain a machine-readable `workspace/state.json` with: current_priorities, active_branches, pending_reviews, last_known_system_status. Read this ONE file instead of 5. |
| Re-reading files | **Diff-since-last-session** | A tool or script that shows what changed in key files since my last session timestamp. `git diff --since` for agents/ repo, DB query for new sessions/errors. One call replaces 5. |
| Delegation tracking | **Structured delegation receipts** | When I fork coder, write a `workspace/delegations/<id>.md` with: task, expected output files, verification command, status. Check these on next heartbeat instead of querying DB. |
| Findings nobody reads | **Findings → issues → tasks** | Each finding should auto-generate a tracked request. Currently findings are files; they should be entries in the request DB with an owner and deadline. |
| No-impact heartbeats | **Conditional heartbeat** | Skip the full heartbeat if: no errors in last interval, no pending tasks, no stale requests. Just write "system healthy, skipping" and yield the budget. Add to heartbeat.md step 1: "if nothing needs attention, finish early." |
| Coder boilerplate | **Delegation templates in context.md** | A reusable task template with standard constraints pre-filled. Reference it by name instead of rewriting every time. |
| Can't test behavior changes | **Gym scenarios for heartbeat patterns** | Build gym scenarios that simulate "agent wakes up with X state, should do Y." Run them with `scripts/gym-run.sh` to validate changes before shipping. |
| Cross-agent coordination | **Ack protocol** | When I message an agent, they write an ack to a known location (e.g., `workspace/inbox/<request-id>.ack`). I check for acks on next heartbeat. No ack after N cycles = escalate. |
| Review branch accumulation | **Auto-merge for passing reviews** | If tsc + vitest pass and the diff is under N lines, auto-merge to main. The review gate protects quality; auto-merge prevents stagnation. |

---

*The meta-irony: writing this document is itself an example of gap #4 — a findings doc that might not trigger action. The fix would be to convert each row in that table into a tracked request with an owner.*
