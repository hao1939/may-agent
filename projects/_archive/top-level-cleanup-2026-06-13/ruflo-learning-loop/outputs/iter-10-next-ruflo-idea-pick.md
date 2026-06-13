# Iter-10 — pick the next Ruflo idea (cold re-read of scout map)

**Iteration:** 10
**Owner:** arc
**Constraint inherited from iter-9:** select a Ruflo *idea*, not a may.db symptom; do not extend the dispatch_waiting thread; no STATUS/NEXT/consolidation/closeout prose.
**Cold inputs:** `agents/scout/knowledge/ruflo-feature-map.md` re-read in full; live `/app/.state/may.db` snapshot 2026-05-09 ~02:25Z.

## 1. Ground number (one query, from may.db)

24h event volume by category:

| Category | Count | Share |
|---|---|---|
| Plumbing (`handler.*`, `session.start/end/completed`, `message.created`, `context.read`) | 7,055 | **86.9%** |
| Transitions / decisions / signals (everything else) | 1,062 | 13.1% |
| **Total events 24h** | 8,117 | 100% |

The narrower "high-signal" slice (`agent.decision`, `project.iteration|blocked|nudge`, `escalation.created`, `metric.breach`, `evaluation.learning_created`, `session.escalated`, `handler.failed`, `message.delivery_failed`, `telegram.reply`) = **6.4 %** of all events.

That is the ground fact this iteration is allowed to reason from.

## 2. Cold re-read of scout map — what's there besides statusline

The scout file lists five Ruflo mechanisms. Iter-2 picked #1; #2–5 are untouched:

1. **Statusline** (used; iter-2..9 thread, now closed via KE-902).
2. **`*_status` MCP tools** (`swarm_status`, `agent_status`, `task_status`, `workflow_status`) — focused inspectors, not generic event taps.
3. **Shell-daemon → JSON-file pattern** (e.g. `swarm-monitor.sh` writing `.claude-flow/metrics/v3-progress.json`); the fast `.cjs` reader joins those files synchronously. Subsystems *own their own state file*; the inspector never queries the live event stream.
4. **AgentDB vector memory + HNSW** retrieval.
5. **Pattern-storage scores** (learning-system visibility metric).

## 3. Which one is grounded by §1's number

86.9 % plumbing means the `events` table is acting as both a **transition log** *and* a **subsystem heartbeat dump**. Iter-2..9 implicitly assumed the right fix lived inside `events` (add `escalation.resolved`, derive closure, watch counts). Ruflo's actual discipline (#3) is the opposite: **subsystems do not write heartbeats into the shared event stream; they write to their own file, and the inspector reads files.** That keeps the event stream at ~13 % transition density instead of ~6 %.

#2 is a smaller variant of the same idea (focused inspectors over the shared stream). #4 and #5 are not grounded in any current may-agent pain — picking either would be speculative.

## 4. Iter-11 selection

**Idea:** Ruflo pattern #3 — *subsystem-owned state file, not shared event row*.

**Falsifiable form:** name **one** event_type currently in the top-7 plumbing list whose payload is a periodic status snapshot rather than a state transition, and whose removal from `events` (in favour of a file or a dedicated table) would not break any reader. If no such event_type exists, the idea is rejected for may-agent.

**Numeric exit criteria** (so iter-11 cannot loop):
- If candidate(s) found: report (a) the event_type, (b) row-count over 24h, (c) the grep result for readers of that event_type in `agents/`. **One findings file.**
- If zero candidates: write a one-paragraph rejection citing the grep, and the Ruflo loop moves on to idea #2 in iter-12.

**Owner:** dev/may runs the grep + count. arc only judges go/no-go on the findings.

## 5. What iter-11 must not do

- Re-open dispatch_waiting / KE-902 / v2-spec-coverage-buildout.
- Propose adding *another* event_type. The whole point of the idea is the opposite direction: move data out of `events`.
- Edit STATUS.md, NEXT.md, project.md, journal, or the iter-6 watch log.
- Run any join wider than exact PK equality.
- Produce a second file "in support" of the findings file. One findings file or one rejection paragraph — not both, not neither.

## 6. Heartbeat note

No watch loop this iteration. Iter-9 explicitly retired the dispatch_waiting heartbeat. The next signal that matters is `project.md::iteration` advancing past 10 *with* an iter-11 findings or rejection file present in `outputs/`.
