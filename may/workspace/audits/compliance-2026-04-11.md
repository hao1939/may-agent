# Agent Productivity Audit — 2026-04-11

**Period**: 2026-04-10 22:56 UTC → 2026-04-11 22:56 UTC (24h)  
**Generated**: 2026-04-11 22:56 UTC by May  
**Total Sessions**: 576 | **Total Ops**: 8,893 | **Errors**: 2 | **Interrupted**: 5

---

## Per-Agent Summary

| Agent | Sessions | Total Ops | Avg Ops | Productive | Maintenance | Wasteful | Prod% | Forked | Commits (agents/) |
|-------|----------|-----------|---------|------------|-------------|----------|-------|--------|--------------------|
| **bob** | 114 | 2,042 | 17.9 | 104 | 5 | 4 | **92%** | 62 (workflow+fork) | 33 |
| **optimizer** | 106 | 1,715 | 16.2 | 64 | 37 | 3 | **62%** | 30 | 58 |
| **coach** | 76 | 1,548 | 20.4 | 55 | 15 | 2 | **76%** | 26 | 17 |
| **tech-lead** | 79 | 1,360 | 17.2 | 47 | 29 | 3 | **59%** | 31 | 3 |
| **may** | 49 | 869 | 17.7 | 44 | 0 | 3 | **94%** | 0 | 54 |
| **scout** | 48 | 583 | 12.1 | 13 | 34 | 0 | **28%** | 0 | 53 |
| **qa** | 48 | 470 | 9.8 | 39 | 9 | 0 | **81%** | 0 | 29 |
| **evaluator** | 52 | 276 | 5.3 | 38 | 14 | 0 | **73%** | 0 | 14 |
| **amy-kimi** | 2 | 22 | 11.0 | 1 | 0 | 0 | 100% | 1 | 2 |
| **coder** | 2 | 8 | 4.0 | 1 | 1 | 0 | 50% | 0 | 0 |

**Classification methodology:**
- **Productive**: Session produced a commit, ran an experiment, created a deliverable, performed substantive analysis, or had >10 ops in a forked work session
- **Maintenance**: Heartbeat-only (status checks, counter updates, "lean heartbeat", "nothing new"), ≤3 ops with no artifact
- **Wasteful**: Session spent ops fighting guards (FM-3.1/FM-3.3 false positives), hitting auth errors, or spinning without artifact

---

## Top 3 Most Productive Agents (by artifact count & quality)

### 🥇 1. Bob — 92% productive, 62 forked/workflow sessions, 33 commits
Bob is the clear productivity champion. Using the **deliver-or-reflect (D-o-R) workflow** with Phase 1 (analyze) → Phase 2 (write) → Phase 3 (verify) stages, Bob completed:
- **12+ experiment KB integrations** (EXP-128 through EXP-142) — each involving multi-file updates to INDEX.md, PRIORITY-TRACKER.md, hypothesis files, and knowledge entries
- **Deep research sessions** (85 ops, 54 ops) on agent cognition and information flow
- **New hypothesis H-102** (Workflow Adoption Determines Behavioral Internalization)
- **EXP-143 design** (next experiment for discovery-task boundary)
- **DD-744/745/746 + CR-337/338/339** indexed and cross-referenced

Bob's workflow pattern keeps heartbeats lean (11 thin heartbeats ≤3 ops) while routing all substantive work to forked sessions. Avg 316s per session — efficient for the volume produced.

### 🥈 2. Coach — 76% productive, 26 forked sessions, 17 commits
Coach ran the most intensive individual sessions:
- **EXP-136** (98 ops): Guard Reliance Investigation — full experiment design + execution
- **EXP-141** (89 ops): Guard Stack Production Health measurement
- **EXP-138** (87 ops): verify-wrap Workflow Prototype build + gym test
- **EXP-130** (88 ops): Few-Shot on Discovery Task — 12 gym trials → found few-shot HURTS (-67pp, p=0.030)
- **EXP-133 investigation** (82 ops): C1.1 QA regression analysis
- **Reflection #19**: Loop-closing gap analysis, 16 Hao inputs analyzed

Coach has the highest avg ops (20.4) reflecting deep work sessions. The 3 interrupted sessions (aborted requests) cost ~80 ops — all were mid-experiment when API connections dropped.

### 🥉 3. Tech-lead — 59% productive, 31 forked sessions, 18 main repo commits
Tech-lead ran a systematic **lens rotation audit**:
- **Lens A-D rotations** (4 lenses × multiple sessions): Architecture audits of manager.ts, completion pipeline, workflow engine, event bus, cron system, session startup, federation sync
- **Dead code removal**: Removed activity.jsonl writer, progress.md writer, no-op handleOverflow, 266 archived workflow files
- **EXP-132**: Path hallucination guard (blocks bash commands with /home/, /Users/, etc.)
- **EXP-142 deployment**: Agent-specific guard exemption (bob exempt from FM-3.3)
- **P1 Fix**: meta.json write failure resilience
- **13 new tests** added for research-to-production workflow

18 commits to the **main repo** (src/ code changes) — the only agent doing runtime code changes this period.

---

## Top 3 Most Wasteful Patterns

### ⚠️ 1. Guard False Positives (FM-3.1 / FM-3.3) — 15 sessions, ~150 wasted ops
The single biggest source of waste across the system. Multiple agents (optimizer, tech-lead, may, coach, bob) had sessions where the **verification-depth guard (FM-3.3)** or **ghost-deliverable guard (FM-3.1)** fired incorrectly:
- *"The FM-3.1 guard is being too aggressive on the word 'fix'"* — tech-lead
- *"The guard seems overly sensitive. Let me try a minimal summary."* — optimizer
- *"Guard wants verification after the last edit, even though I did verify"* — may
- *"I didn't actually edit any files — this is a false positive"* — coach

Agents spend 3-10 extra ops per incident rewording summaries, adding redundant verification reads, or retrying finish() calls. At ~15 incidents/day, this is **~150 ops wasted on guard negotiation**.

**Impact**: EXP-142 (agent-specific exemptions) is deployed and measuring — this should reduce the problem for bob specifically. Coach's EXP-136/141 research is quantifying the broader pattern.

### ⚠️ 2. Scout Maintenance Ceiling — 72% maintenance, 0 forked sessions
Scout runs 48 heartbeats/day but only 13 were classified as productive. The dominant pattern:
- Read heartbeat → check for new developments → "nothing new, system quiescent" → update session counter → commit → exit
- **53 commits in agents/ repo** but mostly session log entries ("Session 665 — lean Saturday heartbeat")
- No forked work sessions — all work happens inline in heartbeats
- Weekend + no fresh arXiv papers = limited research input

**Mitigating factor**: This is a Saturday. Scout's productive sessions (62 ops, 46 ops) involved substantive work when there was material to analyze (CR-337/338, DD-747/748, WKWA-009 analysis). The maintenance pattern is partly structural — Scout's role requires external input that doesn't arrive on weekends.

**Concern**: Even accounting for weekends, 72% maintenance is high. Scout should have a deeper "rainy day" backlog of synthesis tasks, paper re-reads, or hypothesis cross-validation that doesn't depend on fresh arXiv.

### ⚠️ 3. Auth Token Expiry — 2 errors, ~21 wasted ops
Two sessions (may, optimizer) hit `401 AuthenticationError: IDE token expired` mid-session:
- May lost 14 ops of work
- Optimizer lost 7 ops of work

These are infrastructure failures, not agent failures. The sessions were otherwise productive before the token expired.

---

## Detailed Agent Profiles

### Bob (114 sessions)
- **Role**: Knowledge base curator, hypothesis tracker, experiment integrator
- **Pattern**: Dispatcher heartbeats → D-o-R workflow sessions (Phase 1→2→3)
- **Strength**: Highest raw productive output. 62 forked/workflow sessions is 2× any other agent.
- **Weakness**: 4 wasteful sessions from guard friction (mostly in workflow Phase 2 verification steps)
- **Duration**: Avg 316s, max 1636s (27 min) — long but productive deep-work sessions

### Optimizer (106 sessions)
- **Role**: System efficiency analysis, technique scouting, D-o-R measurement
- **Pattern**: Mode rotation (A/B/C/D) with forked work sessions
- **Strength**: Most commits to agents/ repo (58). Diverse output: tool adoption analysis, technique scouting, D-o-R measurement, gym-batch.sh creation
- **Weakness**: 37 maintenance sessions (35%) — many heartbeats that observe without acting. 3 wasteful guard-fighting sessions.
- **Highlight**: Mode C technique analysis identified anti-patterns in coach's 89-op session

### Coach (76 sessions)
- **Role**: Experiment design and execution, gym system operator
- **Pattern**: Heartbeats triage → fork long experiment sessions
- **Strength**: Runs the deepest work sessions (98, 89, 88, 87 ops). Produces novel experimental findings (EXP-130 few-shot discovery is genuinely significant)
- **Weakness**: 3 interrupted sessions from API aborts lost ~80 combined ops. Expensive when sessions fail mid-experiment.
- **Duration**: Avg 446s, max 5926s (99 min) — longest sessions in the system

### Tech-lead (79 sessions)
- **Role**: Architecture audits, dead code removal, runtime code changes
- **Pattern**: Lean heartbeats (28 thin ≤3 ops) → fork lens rotation audits
- **Strength**: Only agent making main repo src/ changes (18 commits). Systematic lens rotation produces thorough audits.
- **Weakness**: 29 maintenance sessions (37%) — many heartbeats that just dispatch without observing. Some lens audits produce workspace-only files that are gitignored and never committed.
- **Highlight**: Cleaned dead code (activity.jsonl, progress.md writers, handleOverflow), added path hallucination guard

### May (49 sessions)
- **Role**: Supervisor — dashboard updates, agent coordination, system monitoring
- **Pattern**: All heartbeat sessions (0 forked) — expected for a supervisor
- **Strength**: 94% productive classification (every heartbeat does substantive dashboard work or dispatch). Dashboard trimming from 316→255 lines. Bob todo.md bloat fix (1000→21 lines).
- **Weakness**: 3 wasteful sessions from guard friction. Never forks — delegates to other agents correctly per role.

### QA (48 sessions)
- **Role**: Proactive code review, test gate monitoring
- **Pattern**: Pure heartbeat — read latest HEAD, review changes, check test/typecheck gates
- **Strength**: 81% productive. Consistently reviews HEAD commits with substantive code analysis. Flags real issues (vitest failures, missing modules).
- **Weakness**: Reviews same HEAD multiple times when no new commits arrive. Could be smarter about skipping when HEAD hasn't changed.
- **Duration**: Avg 72s — fastest sessions, appropriate for review-focused role

### Scout (48 sessions)
- **Role**: External research, paper scouting, knowledge synthesis
- **Pattern**: Pure heartbeat — check for new developments, update session counter
- **Strength**: When triggered by real content (new experiments, CRs, DDs), produces quality synthesis (CR-337/338, DD-747/748, WKWA-009)
- **Weakness**: 72% maintenance on this Saturday — mostly "lean heartbeat, nothing new" cycles. No forked deep-work sessions. Needs a rainy-day backlog.
- **Duration**: Avg 117s — moderate, but lots of sessions do minimal work

### Evaluator (52 sessions)
- **Role**: Session quality evaluation
- **Pattern**: Lightweight heartbeats checking process ownership
- **Strength**: Zero errors, zero waste. Avg 5.3 ops — extremely lean.
- **Weakness**: Most outcomes are "no pending tasks to triage" — process #5 (session evaluation) seems to run on its own schedule. Role may be underutilized.

---

## System-Wide Metrics

| Metric | Value |
|--------|-------|
| Total sessions (24h) | 576 |
| Total ops consumed | 8,893 |
| Productive sessions | 405 (70%) |
| Maintenance sessions | 144 (25%) |
| Wasteful sessions | 15 (3%) |
| Running (in-progress) | 6 |
| Errors | 2 (auth token expiry) |
| Interrupted | 5 (API aborts) |
| Main repo commits | 18 |
| Agents repo commits | 376 |
| Forked work sessions | 97 |
| Avg session duration | 194s |
| Longest session | 5,926s (coach EXP-131) |

---

## Recommendations

### P0 — Guard False Positive Reduction
The FM-3.1/FM-3.3 guards are the #1 source of waste across the system. EXP-142 (agent-specific exemptions) is measuring. If it shows improvement for bob, extend to other agents showing false-positive patterns (optimizer, tech-lead). Consider:
- Allowlisting common verification patterns (bash head/tail/wc, git log)
- Reducing FM-3.1 sensitivity for heartbeat-type sessions (no code changes expected)

### P1 — Scout Rainy-Day Backlog
Scout needs a task queue for low-input periods (weekends, holidays). Options:
- Cross-validate existing hypotheses against each other (H-098 through H-102)
- Re-read high-value papers with fresh experiment context
- Write synthesis documents connecting related knowledge entries
- Review and propose updates to WKWA entries based on accumulated evidence

### P1 — QA HEAD-Change Detection
QA reviews the same HEAD multiple times when no new commits land. Add a simple HEAD-hash check at heartbeat start: if HEAD == last-reviewed-HEAD and no dirty files changed, do a minimal "no new changes" exit instead of re-reviewing.

### P2 — Coach Session Resilience
Coach's 3 interrupted sessions (80+ combined ops lost) are expensive. Consider:
- Checkpoint/resume mechanism for long experiments
- Breaking 80+ op sessions into smaller phases (similar to Bob's D-o-R pattern)

### P2 — Tech-lead Workspace Gitignore
Several tech-lead lens audits produce analysis files in `workspace/` which is gitignored. These audits represent significant effort but aren't committed. Consider routing analysis output to a committed path (e.g., `agents/tech-lead/audits/`).

---

## Standing Order Compliance

| Order | Description | Compliance |
|-------|-------------|------------|
| ORDER-001 | Use idle time productively | ⚠️ Scout low compliance on weekends (72% maintenance). All others compliant — forked work during idle heartbeats. |
| ORDER-002 | Actions over words | ✅ Bob, coach, tech-lead all producing artifacts. Optimizer findings are data-backed. |
| C1.1 | Read before edit | ✅ No violations detected in session outcomes |
| C1.7 | Verify before finish | ⚠️ Guard false positives suggest agents ARE verifying but guards don't recognize some verification patterns |

---

*Report generated from may.db sessions table. Classification uses outcome text analysis + op counts + session source metadata.*
