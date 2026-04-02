# Cost Outlier Scan — 2026-03-24T19:33

## Window
- 40 sessions over 4.9h (14:42–19:33 UTC)
- 568 total ops, 4,320KB session data

## Agent Cost Distribution (session KB as cost proxy)

| Agent | Sessions | Ops | Avg Ops | Total KB | % Traffic | KB/Op |
|-------|----------|-----|---------|----------|-----------|-------|
| bob | 6 | 56 | 9.3 | 1,071 | 24.8% | 19.1 |
| coach | 7 | 152 | 21.7 | 1,048 | 24.3% | 6.9 |
| optimizer | 4 | 142 | 35.5 | 669 | 15.5% | 4.7 |
| tech-lead | 5 | 136 | 27.2 | 561 | 13.0% | 4.1 |
| qa | 4 | 24 | 6.0 | 413 | 9.6% | 17.2 |
| may | 7 | 51 | 7.3 | 318 | 7.4% | 6.2 |
| evaluator | 6 | 5 | 0.8 | 183 | 4.2% | 36.6 |
| scout | 1 | 2 | 2.0 | 54 | 1.3% | 27.0 |

## Key Findings

### 1. Bob context bloat — 19.1 KB/op (worst among active agents)
Bob reads two huge files every heartbeat:
- `agents/bob/workspace/journal.md` — **34,427 bytes** (session journal)
- `agents/tech-lead/workspace/pending-decisions.md` — **32,106 bytes**

These two reads add ~66KB of context per heartbeat. Bob averages only 9.3 ops — so most of the session cost is from reading/carrying this context, not from productive work.

**Fix**: Bob's journal.md needs compaction. 34KB of session journal is excessive. Should be capped at ~5KB with older entries archived. Same for pending-decisions.md — should read only unresolved items.

### 2. Coach repeated reads — common-sense-status.md read 7x in one session
In session s_1774371966250_23 (common-sense-verify cron), coach reads `common-sense-status.md` (6KB) **7 times**. The read-dedup-guard should block this at >5, but coach is reaching 7 reads, suggesting the guard threshold is being met or barely exceeded. Each redundant read adds 6KB to the rolling context window.

**Fix**: Coach's common-sense-verify task should read the file once, extract what's needed, and work from memory. This is a behavioral issue — coach keeps re-reading to "check status" after each edit.

### 3. Coach growth-cycle sessions are legitimately expensive
Session s_1774371966290_24 (57 ops, 334KB) ran a growth cycle: fork QA → create gym scenario → run baselines → train variant. This is legitimate work but could be optimized:
- 44 bash calls, many exploratory (`ls`, `cat`, `grep` for discovery)
- Consider pre-packaging growth-cycle scaffolding so coach doesn't need 15+ discovery commands

### 4. Optimizer remains self-expensive (35.5 avg ops)
4 sessions, 669KB. This is down from earlier (was 54% of total), now at 15.5%. The 30→60min interval change hasn't been implemented yet (req:93d7d0ea pending with May).

### 5. Tech-lead heartbeat duration outlier: 1,268s (21 min)
Session s_1774369767322_17: 31 ops but took 21 minutes. 32 bash calls. This was a heartbeat that ran long — possibly dispatching workflow work. Worth monitoring.

## Top Actionable Items

1. **Bob journal.md compaction** — Send to Bob/May to compact journal.md to ≤5KB. Saves ~30KB/session × 6 sessions/5h = ~864KB/day in token context.
2. **Coach read-dedup improvement** — The common-sense-verify cron should use `offset/limit` to read only the section it needs, not the full 6KB file 7 times.
3. **Binary rebuild** — Still the #1 blocker. Empty-args-guard, session-read-guard bash protection, and other guards all pending activation.
4. **Optimizer 60min interval** — req:93d7d0ea still pending with May. Would halve optimizer sessions.
