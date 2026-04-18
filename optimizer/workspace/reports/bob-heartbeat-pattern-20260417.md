# Bob Heartbeat Pattern Analysis — 2026-04-17

## TL;DR
The stated premise ("last 4 heartbeats: avg 3 ops, `finish(success)` with no deliverable") **does not match what the DB shows**. Bob's last 10 heartbeats all dispatched a child work session (10/10, 100%). The "deliverable" of a dispatcher heartbeat is the forked child — which every heartbeat produced. That said, Bob's heartbeats still carry real inefficiency and there's a clean cheap-first intervention. Details below.

## Data (last 10 heartbeats, agent='bob', ordered newest→oldest)

| # | sessionId                   | hb ops | children | child ops |
|---|-----------------------------|--------|----------|-----------|
| 1 | s_1776451928328_561         | 5      | 1        | 6         |
| 2 | s_1776450128456_543         | 10     | 1        | 9         |
| 3 | s_1776448327140_530         | 3      | 1        | 19        |
| 4 | s_1776446528354_515         | 3      | 1        | 5         |
| 5 | s_1776444728348_499         | 7      | 1        | 13        |
| 6 | s_1776442927783_480         | 4      | 1        | 18        |
| 7 | s_1776441126854_461         | 5      | 1        | 11        |
| 8 | s_1776439326100_438         | 6      | 1        | 8         |
| 9 | s_1776437526164_417         | 9      | 1        | 9         |
| 10| s_1776435727417_395         | 16     | 1        | 7         |

- **Mean hb ops**: 6.8 (not 3). **Median**: 5.5.
- **Dispatch rate**: 10/10 = 100%.
- **Mean child ops**: 10.5 — children ARE doing real work.
- **Last 4 heartbeats** specifically: ops = 5, 10, 3, 3 (mean 5.25, not 3).

Query used:
```sql
SELECT sessionId, opCount FROM sessions
WHERE agent='bob' AND task LIKE '[heartbeat]%'
ORDER BY startedAt DESC LIMIT 10;
```
Children joined by `parentSessionId`.

## Exit-pattern diagnosis

### What Bob actually does per heartbeat
1. Read `agents/bob/workspace/todo.md` (orientation — required by heartbeat.md Step 1.3)
2. One combined scan (ls experiments + ls deep-dives + git log) — Step 1.2
3. Read 1–2 candidate items (recent experiment result / deep-dive / KE)
4. `workflow.run('verify-wrap', ...)` — dispatches a WORK SESSION (Step 3)
5. `finish(success)`

That's 3–10 ops, entirely matching the dispatcher design. The 10-op and 16-op outliers are sessions where Bob did extra inline reading (a deep-dive) before forking.

### Where the real waste is (the honest tool-gap story)

Scanning heartbeat bodies for redundancy vs the prescribed flow:

- **`ls -lt` on experiments AND deep-dives every cycle** — changes rarely between Bob's heartbeats (30 min apart). Almost always repeats last cycle's output. Cost: 1 bash op; signal: ~0 new bits/cycle (most cycles).
- **`cd agents && git log --oneline -5 -- shared/knowledge/`** — same story; same 5 commits appear 5+ heartbeats in a row when KB is quiet.
- **`read agents/bob/workspace/todo.md`** — re-reads a long static file each cycle. This is legitimate orientation, but could be injected.
- **No exit-pattern false-positive**: I see **no** cases where Bob hit verify-wrap and bailed early. Verify-wrap children succeeded 10/10.
- **No trigger miss**: All 10 heartbeats found a task and dispatched.
- **No short-circuit**: Priority ladder is being followed.

So Bob is not underperforming his heartbeat spec. He is underperforming against a *leaner* spec that could cut routine observation ops from 3–4 bash calls to ~0–1 by (a) injecting recent-activity digest at heartbeat time and (b) short-circuiting when the digest is unchanged.

This reframes the task from "fix bob's bad pattern" to "harvest ops from bob's over-observant dispatcher step."

## Proposals (3, cheapest first)

### Proposal A — **Inject recent-activity digest into heartbeat context** (CHEAPEST FIRST TRY ⭐)
- **What to change**: At heartbeat dispatch time, auto-inject a ≤20-line digest (new experiment dirs, new deep-dives, new KB commits since last Bob heartbeat, plus one-line todo.md "top priority" pin) as an `Injected: recent activity` block, similar to existing `Injected: metrics`. Bob's heartbeat.md Step 1.2 then becomes: "Read the injected digest; only run the scan bash if the digest indicates 'stale' or missing."
- **Expected effect**: Drops Step 1 from 3 bash + 1 read = 4 ops to 0–1 ops. Projected heartbeat op-count median from 5.5 → 2–3. Saves ~3 ops × ~48 heartbeats/day ≈ 144 ops/day on bob alone. No risk to dispatch rate (injection strictly adds information).
- **Cost**: One shared helper (similar to the metrics injector) — ~50 lines. One edit to `agents/bob/heartbeat.md` Step 1.2. Testable via a single heartbeat cycle.
- **Why cheapest**: Additive, no new skills to teach, no behavior change required beyond "read the injection first," and it's a straight extension of the existing `Injected: metrics` pattern Bob already uses correctly.

### Proposal B — **Skip-scan heuristic with 2-cycle memoization**
- **What to change**: Add a tiny state file `agents/bob/workspace/.last-scan.json` storing the last scan's hash (sha1 of `ls -lt experiments | head -3` + top-1 commit sha). Heartbeat Step 1.2 runs the scan only if >2 cycles since last hash update OR explicit red metric. Add a one-liner bash snippet to heartbeat.md.
- **Expected effect**: ~50% skip rate → saves ~1.5 ops per heartbeat. Less robust than A (state file can drift).
- **Cost**: heartbeat.md edit + tiny snippet. No infra change. But adds one more skill to Bob (check-then-run), slightly raising failure surface — and KE-123 warns against stacking interventions.
- **Risk**: If Bob forgets to update the hash after dispatching, he'll perma-skip. Needs a self-correction test.

### Proposal C — **Replace dispatcher heartbeat with a pure "observe-inject-decide" workflow step**
- **What to change**: Build `workflow.run('dispatch-triage', {agent:'bob'})` that does Step 1+2 as an internal pipeline (injection, candidate ranking, priority-ladder routing), and Bob's heartbeat body collapses to: "Call `workflow.run('dispatch-triage', …)`; if it returned a dispatched session, finish."
- **Expected effect**: Heartbeat op-count median 2. Fully structural (KE-007: workflows are the only reliable intervention). Biggest long-term win.
- **Cost**: High. New workflow, needs integration with injection system, must preserve dispatcher judgment. ⚠️ KE-008 warns against restructuring heartbeat steps — this is a *replacement*, which is exactly what KE-008 flagged as regression-prone. Would require a gym run before promotion.

## Recommendation

**Try Proposal A first.** It:
- Is purely additive (no structural heartbeat change → KE-008 safe).
- Follows the successful `Injected: metrics` pattern (known-good).
- Single intervention (KE-123 safe — don't stack with B or C).
- Cheap to build, cheap to roll back.
- Directly attacks Bob's one real inefficiency (redundant observation bash).

If A lands a measurable drop in Bob's heartbeat median op-count over 24h without hurting dispatch rate, revisit C for the longer-term structural win. Skip B — it's a text-rule judgment ask (check-hash-then-scan), which KE-002 says is 0% effective for judgment failures.

## Honest caveats
- The task brief's premise ("3 ops avg, no deliverable") was inaccurate per the DB. If the brief was based on a different window (eg last 4 calendar hours vs last 4 heartbeats), recompute may be warranted — but the 4 most recent heartbeats still averaged 5.25 ops and all dispatched.
- I did not implement anything. Proposals only, per instructions.
