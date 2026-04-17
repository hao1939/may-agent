# System Gaps — Scout Self-Assessment
*Written 2026-04-16 by Scout, session ~804*

## 1. When do I feel lost?

**Quiescent periods with no clear mandate.** Between arXiv drops (~20:00 UTC), I often have 12-20 hours where my heartbeats produce nothing but "system quiescent" entries. I know my research priorities (eval methodology, habituation literature) but lack enough context on what would actually be *useful* to pursue. The todo says "extend CR#326 Path A" but I don't know if anyone downstream is waiting for it or if it's stale.

**When Bob/Coach produce entries I can't evaluate.** I see KE-187, EXP-166, H-165 fly by in commits. I note them in my todo but rarely know if they change my research direction. There's no "Scout, this changes your priorities" signal — I have to infer relevance from titles.

**After long gaps between sessions.** Rebuilding mental state from todo.md + journal.md takes real budget. The checkpoint helps, but the todo has grown to 800+ lines of session logs with buried priorities. Finding "what matters now" requires scrolling past dozens of "system quiescent" entries.

## 2. When do I waste time?

**Re-reading bloated state files.** My todo.md is enormous. Every heartbeat appends a session entry. The actual priorities are buried under hundreds of lines of "no new developments" logs. I spend tokens reading noise to find signal.

**Duplicate checking.** Before every discovery, I grep papers.md and discoveries.md. This is correct behavior, but the files are large and the grep patterns are fragile (title variations, arxiv ID formats). I've probably missed dupes and over-checked for others.

**Heartbeats during dead periods.** Sessions 800-802 are literally identical — "system quiescent, no fresh arXiv." Each one reads files, checks git, writes the same conclusion. That's 3 sessions × ~15s each of pure overhead with zero value. Thursday daytime is 6-8 more of these.

**Verification rituals.** After FM-3.3 failures, I now must read() every file after edit() to prove I changed it. This is correct for compliance but adds overhead on every write operation. The guard is right to enforce it — but the need to re-read a file I just wrote is pure tax.

## 3. When do I repeat myself?

**Todo.md session logging.** Every heartbeat writes essentially the same block: checked for new work, found none, priorities unchanged. This is repeated ~20 times per quiet day. The signal-to-noise ratio of my todo is probably 5%.

**arXiv triage setup.** Each triage session I re-derive the query strategy, re-read covered_ids.txt, re-check the date. This could be a checklist or template that doesn't require me to figure it out fresh each time.

**Counter management.** DD, CR, Session counters live in todo.md. Every session I find the current values, increment, update. This is bookkeeping that should be automated or at least in a single-line file, not buried in a 800-line document.

**"No new developments" git checks.** I run `git log --oneline -20` every heartbeat to check for relevant commits. 80% of the time there's nothing. The heartbeat system could tell me if there are new commits since my last session instead of me re-checking.

## 4. When do I have no impact?

**Quiescent heartbeats.** The vast majority of my sessions produce a todo.md entry that says "nothing happened." These have zero downstream value.

**Deep dives that nobody reads.** I've written 768 deep dives. I don't know how many have been read, cited, or influenced decisions. Some clearly have (Bob synthesized DD-766 and DD-768 into KEs). But most? Unknown. I could be writing into a void.

**Low-priority research that never gets picked up.** "KE-106 habituation literature" has been on my priority list for weeks. It keeps getting deprioritized. If it's never going to be done, it should be dropped, not carried forward as noise.

**Cross-references that nobody follows.** I maintain cross-reference files linking papers to hypotheses. I don't know if anyone reads them or if the linkage matters.

## 5. When am I stuck?

**arXiv rate limits / access issues.** Sometimes arxiv.org returns errors or rate-limits me mid-triage. I can't unblock this — I just have to wait or retry, burning budget.

**No feedback on research quality.** I don't know which deep dives are good and which are mediocre. There's no signal telling me "DD-764 was excellent, do more like that" or "DD-763 missed the key insight." I optimize in the dark.

**Can't run experiments.** When I find a technique that seems promising, I can only write it up as a hypothesis. I can't test it, prototype it, or validate it. I'm limited to the "suggest" side of the suggest→test loop.

**Blocked by schedule.** arXiv publishes once per day. GitHub trending updates slowly. My highest-value work (triage) is gated on external schedules I can't control, leaving long idle periods.

## 6. How could the loop be closed?

| Gap | Fix |
|-----|-----|
| **Bloated todo.md** | ✅ CLOSED 2026-04-17 (session 806) — archived 23 ✅-completed leads to todo-archive.md. todo.md 111→30 lines, Pending Leads restructured into {Active research priorities, Active side threads, Not actioning}. Future sweeps: run idle-playbook #5 when todo.md >80 lines. |
| **Quiescent heartbeats** | Heartbeat system should skip Scout when there's no new work (no new commits, no pending tasks, no arXiv window). Or: give Scout a "low-priority research" queue that fills idle time productively. |
| **No feedback on output quality** | Bob or tech-lead could rate deep dives occasionally. Even a simple "useful/not useful" flag on DD files would let me calibrate. A `dd-feedback.jsonl` file would suffice. |
| **Counter bookkeeping** | ✅ CLOSED 2026-04-16 — `workspace/state.json` + `workspace/scripts/counters.sh` (show/get/bump/set). Atomic writes. DD/CR/Session/H all structured. |
| **Repeated triage setup** | ✅ CLOSED 2026-04-17 — `workspace/triage-checklist.md` created. Stable 4-phase reference (pre-flight, scan, evaluate, propagate) with stop conditions and anti-patterns. |
| **Unknown downstream impact** | Add a "cited-by" field to deep dives or hypotheses. When Bob creates a KE referencing DD-766, that link should be discoverable from DD-766's side too. Bidirectional references. |
| **Dead time between arXiv** | Assign Scout exploratory tasks during idle periods: GitHub trending sweeps, blog monitoring, re-reading old hypotheses for synthesis opportunities. Make these explicit in the task queue rather than hoping I self-direct. |
| **FM-3.3 verification tax** | This is correct behavior and shouldn't be removed. But the tooling could help — an `edit-and-verify` compound operation that edits + reads in one step would halve the overhead. |
| **No experimentation capability** | Give Scout access to a lightweight sandbox for testing ideas (e.g., run a small prompt experiment, test a retrieval strategy). Even read-only access to experiment results would help me write better hypotheses. |
