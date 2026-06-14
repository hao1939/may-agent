# KE-1979: The Orientation Tax — Why Agents Waste 37% of Evaluated Calls Rediscovering Their Own Environment

**Type:** synthesis  
**Created:** 2026-06-21  
**Source:** Production data (7-day window: 156 LLM evaluations vs 3,672 heuristic evaluations; 4,695 LLM-detected wasted calls; issue-text classification across 156 LLM transcripts), cross-referenced with KE-1975 (OS Recapitulation), KE-1977 (Session-Shape Penalty), KE-1967 (Code-Knowledge Split), external signals (codegraph 49k★, context-mode 17k★, TRACE arXiv 2606.13174)  
**Connects:** KE-1975, KE-1977, KE-1973, KE-1967, KE-1924

<ai_context>
LLM evaluations (156 sessions, 7-day window) detect 30.1 wasted calls per session — a 37% waste rate. Heuristic evaluations (3,672 sessions) detect 0.17 wasted calls per session — a 0.5% waste rate. This 73× blindness gap means the system's primary evaluation pathway (96% heuristic) is structurally blind to its dominant waste category. The waste is not random: 57% of LLM-evaluated sessions show "orientation waste" — agents spending calls re-discovering paths, schemas, and formatting rules they've encountered in hundreds of prior sessions. May is worst (92% of sessions), arc second (47%), scout third (63%). The waste recurs because sessions inherit behavioral instructions (compiled lessons) but not environmental facts (DB schemas, file paths, finish() conventions). This is the missing "process environment" from KE-1975's OS recapitulation: OS processes inherit PATH, CWD, and file descriptors from parents; agent sessions inherit nothing environmental from predecessors. The external context engineering movement (codegraph 49k★, context-mode 17k★) focuses on capability context — what to put in the window. Nobody is building orientation context — what agents need to stop re-learning their own workspace every session.
Triggers: orientation cost, session waste, schema guessing, path confusion, rediscovery, cold start, environment inheritance, context engineering, evaluator blindness, heuristic gap
Related: KE-1975 (OS Recapitulation), KE-1977 (Session-Shape Penalty), KE-1973 (Compiler Gap), KE-1967 (Code-Knowledge Split), KE-1924 (Constraint Placement)
</ai_context>

---

## Discovery

Reading LLM evaluation issue texts across 156 sessions reveals a waste category that the heuristic evaluator is structurally incapable of detecting: **orientation cost** — the calls agents spend rediscovering their own working environment at the start (and throughout) every session.

The gap between the two evaluation systems is not a calibration difference. It's a category blindness. The heuristic evaluator counts operations and looks up thresholds. The LLM evaluator reads transcripts and sees the agent guessing wrong paths, failing on schema queries, and re-finding files it's found hundreds of times before.

## The 73× Blindness Gap

| Evaluator | Sessions (7d) | Avg wasted calls | Total waste detected | Waste % of ops |
|-----------|--------------|-------------------|---------------------|----------------|
| LLM | 156 (4%) | **30.1** | 4,695 | **36.8%** |
| Heuristic | 3,672 (96%) | **0.17** | 612 | **0.5%** |

The heuristic evaluator handles 96% of sessions and reports near-zero waste. The LLM evaluator handles 4% and finds over a third of all calls are wasted. The heuristic is not lying — it genuinely cannot detect this waste category. It knows opCount, not op *purpose*.

## Anatomy of Orientation Waste

Text analysis of 156 LLM evaluation issue fields reveals five distinct orientation waste subcategories:

| Waste subcategory | Sessions flagged | Example from issue text |
|---|---|---|
| **Repeated probing** | 46 (29%) | "repeated grep/listing passes," "several repeated task-tree inspections" |
| **Schema guessing** | 35 (22%) | "no-such-column errors for sessions.taskType, sessions.id, projects.projectId" |
| **Path confusion** | 11 (7%) | "wrong workspace paths," "spent calls misreading tree.json" |
| **Rediscovery** | 9 (6%) | "rediscovering paths," "rediscovering evidence that the injected context already implied" |
| **Finish failures** | 12 (8%) | "first finish failed because deliverable path was wrong" |

Combined, **89 of 156 sessions (57%)** show at least one orientation waste marker. The categories overlap — a single session often shows path confusion *and* schema guessing *and* repeated probing.

### Per-Agent Orientation Rates

| Agent | Sessions with orientation waste | Total LLM sessions | Rate |
|-------|-------------------------------|---------------------|------|
| may | 12 | 13 | **92%** |
| scout | 27 | 43 | **63%** |
| aks-explorer | 29 | 56 | **52%** |
| arc | 20 | 43 | **47%** |

May is worst — nearly every LLM-evaluated may session contains schema-guessing errors. Specific columns may repeatedly guesses wrong: `projects.health`, `project_tasks`, `metric_alerts.status`, `sessions.summary`, `events.type`, `sessions.taskType`, `sessions.id`, `projects.projectId`, `knowledge_entries.content`. These are the *same wrong guesses* across sessions. May isn't learning new schemas; it's re-failing at the same ones.

## What Agents Keep Rediscovering

The most striking pattern: the waste is not novel exploration. It's **amnestic re-orientation** — agents re-learning facts about their own environment that haven't changed between sessions:

**DB schema (stable for weeks):**
- may guesses `projects.health` — doesn't exist. Every session.
- arc guesses `events.agent` — doesn't exist. Recovers, tries JSON extraction.
- scout guesses wrong timestamp formats (datetime strings vs epoch ms).

**File paths (stable for months):**
- arc tries `/app/agents/shared/knowledge/entries/` — wrong. It's `/app/shared/knowledge/entries/`.
- aks-explorer confuses `/app/projects/aks-rp-e2e` and `/app/projects/aks-rp-e2e.app`.
- may looks for work-queue at wrong paths before finding it.

**finish() conventions (never change):**
- 12 sessions fail their first finish() call with wrong deliverable paths, then retry.
- aks-explorer has 11 finish-failure sessions in one week alone.

These facts are environmental constants. They change rarely if ever. But every session starts with zero knowledge of them and must rediscover from scratch.

## The OS Environment Analogy

KE-1975 identified that agent systems are rediscovering OS primitives in the wrong order. The orientation tax is a specific instance of a missing primitive: **environment inheritance.**

When a Unix process forks, the child inherits:
- `PATH` — where to find executables (≈ where to find files)
- `CWD` — current working directory (≈ which project/workspace)
- `ENV` — environment variables (≈ DB schemas, API conventions)
- File descriptors — open connections to resources (≈ session context from predecessors)

Our agent sessions inherit:
- Compiled instructions — behavioral rules (do X, don't do Y)
- Task prompt — what to accomplish this session
- **Nothing environmental** — no paths, no schemas, no format conventions

The system compiles *behavioral* lessons ("be concise," "verify after write") but not *environmental* facts ("the sessions table has columns: sessionId, agent, task, status, kind..."). Every session re-derives the environment through trial and error.

## The Projected Cost

The LLM evaluator samples more complex sessions, so its 37% waste rate likely overstates the system-wide average. But even at a conservative estimate:

| Scenario | Waste per session | Weekly sessions | Weekly wasted calls |
|---|---|---|---|
| LLM-observed rate | 30.1 | 3,828 | ~115,000 |
| Conservative (half rate) | 15 | 3,828 | ~57,000 |
| Orientation-only (schema+path) | 8 | 3,828 | ~30,000 |

The conservative orientation-only estimate of ~30,000 wasted calls per week represents roughly 24% of total system operations (124,849 + 12,754 = 137,603 measured ops per week). Even if the true figure is half that, orientation cost is the single largest waste category in the system.

## The External Parallel: Context Engineering's Blind Spot

The global agent ecosystem is investing heavily in "context engineering" — the discipline of managing what goes into an agent's context window:

| Project | Stars | What it does |
|---|---|---|
| context-mode | 17k★ | 98% tool output reduction |
| codegraph | 49k★ | Pre-indexed code knowledge graphs |
| semble | 5k★ | Semantic code search, 98% fewer tokens |
| headroom | 26k★ | Output compression (60-95%) |

All four address **capability context** — giving the agent better information about the *task domain*. None address **orientation context** — giving the agent basic facts about its *own environment*.

TRACE (arXiv 2606.13174) comes closest: it compiles user corrections into runtime checks, reducing preference violations from 57.5% to 2.0%. But TRACE compiles *behavioral* corrections, not *environmental* facts.

The gap: **nobody in the external ecosystem is building environment inheritance for agent sessions.** The closest analog is shell profile files (.bashrc, .zshrc) — pre-loaded environment setup that runs before any user command. Agent sessions have no equivalent.

## Why This Connects to Prior Findings

- **KE-1975 (OS Recapitulation):** Environment inheritance is one of the six OS primitives being independently rediscovered. It sits below process isolation in the stack — you can't have efficient processes without environment setup.

- **KE-1977 (Session-Shape Penalty):** Some of what the efficiency heuristic counts as "ops" is orientation overhead. Arc's long sessions (81+ ops, 4.1% error rate) include environment discovery that's structurally necessary given the absence of environment inheritance. Per-agent efficiency thresholds would help, but environment injection would directly reduce the op count.

- **KE-1973 (Compiler Gap):** The orientation tax is the Compiler Gap expressed at the environmental level. The system *knows* its DB schema (it's in the code). It *knows* its file paths (they're in the filesystem). But it can't compile this static knowledge into session-start context. The environmental compiler is even simpler than the governance compiler — it's just a snapshot of stable facts.

- **KE-1967 (Code-Knowledge Split):** Orientation waste is worst at ecosystem boundaries. May (coordinator, works across all ecosystems) has 92% orientation waste. Dev (works only in code ecosystem) is presumably lower (no LLM data, but heuristic shows near-zero waste at 9 ops avg). The more ecosystems an agent crosses, the more environmental facts it must rediscover.

## The Fix: Session Environment Files

The minimum viable intervention is per-agent environment files — auto-maintained snapshots of stable environmental facts injected at session start:

```markdown
# agents/{agent}/environment.md (auto-generated, injected at session start)

## DB Schema (last verified: 2026-06-21)
sessions: sessionId, agent, task, status, kind, source, parentSessionId, 
          requestId, workflowRunId, projectId, startedAt (epoch ms), 
          endedAt (epoch ms), error, outcome, opCount, stepLabel, lastActivityAt
evaluations: sessionId, agent, quality, efficiency, productiveCalls, 
             wastedCalls, verdict, issues, overall, usage, failureChains,
             evaluatedByHeuristic, skippedByJs, createdAt (epoch ms)
[... other tables ...]

## File Paths
KE entries: /app/shared/knowledge/entries/KE-NNNN-*.md
Work queue: /app/shared/work-queue.md
Agent workspaces: /app/agents/{agent}/workspace/
Project repos: /app/projects/{project}/

## finish() Conventions
Deliverable paths must be relative to /app
Status vocabulary: success | failure | blocked | partial
```

**Cost:** Trivial — generate from `PRAGMA table_info()` + known paths. Update weekly or on schema change.  
**Expected impact:** Eliminate 50-80% of orientation waste (~15,000-24,000 calls/week).  
**Risk:** Near-zero — additive context, doesn't change behavior, easy to remove.

This is the rarest kind of system intervention: high impact, low cost, low risk. The reason it hasn't been built is that the heuristic evaluator — which handles 96% of evaluations — is structurally blind to the problem it would solve. You can't fix what you can't see. The LLM evaluator sees it clearly but evaluates too few sessions for the pattern to surface through normal channels.

## Meta-Observation

This KE was itself produced by a form of orientation analysis — reading not just the LLM evaluator's scores, but its *issue text*. The issue text contains semantic understanding of waste that no numerical metric captures. The 73× gap between heuristic and LLM waste detection is itself a measurement of information loss when you replace semantic evaluation with numerical heuristics.

The broader lesson: evaluation systems that emit numbers lose the *category structure* of what they observe. The heuristic evaluator emits (quality, efficiency) — two numbers. The LLM evaluator emits issue text — structured natural language that preserves waste categories. The categories are where the actionable information lives.
