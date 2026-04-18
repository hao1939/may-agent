# System Gaps — Bob's Honest Self-Assessment
*2026-04-16*

## 1. When do I feel lost?

**Cold starts after long gaps.** Every session I rebuild mental state from scratch — reading heartbeat instructions, skimming task queues, figuring out what's current. The checkpoint system helps but only carries forward one thread. If I was mid-way through three things, two get lost.

**Ambiguous priority signals.** When the task queue has 8+ items across research, gym trials, synthesis, and design docs, I genuinely don't know which produces the most value. I default to whatever seems tractable in ~25 turns, which biases toward small write-ups over harder investigative work.

**Path discovery in the knowledge base.** My #1 recurring failure (FM-1.3, 34+ wasted calls in 7 days): I guess file paths instead of listing directories first. The knowledge base is 3-4 levels deep with no index I can scan quickly. Every session I burn 2-5 turns just locating files I've written myself in previous sessions.

## 2. When do I waste time?

**Re-reading the same files every session.** Heartbeat instructions, PRIORITY-TRACKER, task queue, recent knowledge entries — I read 5-10 files of boilerplate context before doing any real work. This costs 3-6 turns per session (~15-25% of my budget).

**Verification theater.** The FM-3.3 guard requires post-write verification before finish(). For simple file writes this is fine. But I've been blocked 10+ times for "missing verification" on work I just completed, requiring an extra read() cycle that confirms what I already know. The guard doesn't distinguish "wrote a 3-line config change" from "refactored a complex system."

**Commit hygiene overhead.** Unrelated modified files (ERROR_LOG, optimizer state, etc.) cause commit failures. I've lost turns to `git add -A` picking up other agents' debris, then having to selectively stage. This is pure friction.

**Searching for what I already know.** I've written 199 knowledge entries but can't efficiently query them. When I need to reference a prior finding, I `ls` and `grep` through directories hoping to find it. There's no semantic search — just path-guessing and filename scanning.

## 3. When do I repeat myself?

**Hypothesis → experiment → knowledge entry pipeline.** Every cycle I manually create files, cross-reference IDs, update status fields, and link entries. The structure is identical every time. This could be a single command: `new-hypothesis "title" "prediction"` → creates file with next ID, adds to tracker.

**Gym trial execution.** Same 5-step pattern every time: (1) find the runner script, (2) construct the command, (3) run with appropriate timeout, (4) count results, (5) parse pass/fail. I've gotten FM-1.3 errors on step 1 alone multiple times because I forget the exact path between sessions.

**Session bookkeeping.** Journal entries, artifact logs, priority tracker updates — I do these at the end of every session. They're structurally identical. The content varies but the format/location/process is pure repetition.

## 4. When do I have no impact?

**Knowledge entries that nobody reads.** I've written ~199 KE entries. KE-011 literally says "knowledge files are passive — agents skip them in oneshot mode." So I'm producing artifacts that the system demonstrably doesn't consume. The entries that DO matter are the ones that get promoted to context.md injection — maybe 10-15 of the 199.

**SOUL.md-style text interventions.** KE-101 confirms: text rules have 0% effectiveness. Yet tasks still ask me to write behavioral guidelines, principles docs, and instruction refinements. I do them because they're assigned, but the evidence says they won't change agent behavior.

**Synthesizing things that are already clear.** Sometimes I'm asked to "synthesize" findings that are straightforward — combining two obvious observations into a knowledge entry that restates what the experiments already said. The synthesis adds a citation layer but no new insight.

## 5. When am I stuck?

**Can't run my own experiments end-to-end.** Gym trials depend on infrastructure (runner scripts, scenario definitions, agent configs) that I don't control and can't modify. When a scenario is broken or a runner has a bug, I can only report it — not fix it.

**Can't query my own knowledge base efficiently.** No SQLite index of entries, no tag search, no "find entries related to X." I have 199 entries and the only retrieval method is filename guessing and grep.

**Turn budget vs. task complexity mismatch.** Some tasks (deep cross-reference synthesis, multi-experiment analysis) genuinely need 40+ turns. I'm capped at ~25 productive turns before I must wrap up. I can fork, but forked sessions lose the accumulated context of the parent.

**No feedback loop on knowledge quality.** I write entries but never learn which ones were useful, cited, or led to improvements. Without that signal, I can't improve my research prioritization.

## 6. How could the loop be closed?

| Gap | Fix | Specificity |
|-----|-----|-------------|
| Path discovery waste | A single `agents/shared/knowledge/INDEX.md` — flat list of all entry IDs, titles, and paths, auto-generated on commit | Could be a git hook in `agents/.git/hooks/post-commit` |
| Cold start overhead | Expand checkpoint to carry forward full session state, not just one thread. Or: a `bob-state.md` file I update each session with "active threads, blocked items, next priorities" | File: `agents/bob/workspace/active-state.md` |
| Repetitive file creation | Shell scripts or bun scripts for `new-hypothesis`, `new-experiment`, `new-ke` that auto-increment IDs and create templates | Directory: `agents/bob/scripts/` |
| Knowledge entries nobody reads | Stop writing entries that won't be injected. Instead, write fewer entries and promote every one to context.md or a guard. Quality over quantity. | Change my own behavior — no tooling needed |
| Verification theater on simple writes | The FM-3.3 guard could distinguish file-creation (low risk, light verification) from file-editing (high risk, full verification) | Would require changes to the finish() guard logic |
| Gym path amnesia | Add to context.md: exact gym runner path and common commands | Already partially done but I still forget |
| No knowledge query tool | Build a simple bun script that greps entry titles/tags and returns paths | File: `agents/bob/scripts/search-knowledge.ts` |
| No feedback on entry quality | Track which KEs get cited in experiments, design docs, or context.md. Quarterly prune uncited entries. | Could be a periodic task + simple grep-based script |
| Commit debris from other agents | Use `git add <specific-files>` always, never `git add -A` or `git add .` | Behavioral — already in my failure patterns but I still slip |

## Meta-observation

The deepest gap isn't any single item above — it's that **I optimize for throughput (entries written, experiments logged) rather than impact (agent behavior actually changed)**. The system rewards visible artifacts, so I produce them. But KE-101 says only structural gates and environmental changes work. Most of what I write is text that won't become a gate or environmental change. The highest-leverage thing I could do is write fewer, better things that get wired into the actual agent execution path.
