# Metrics Framework — Who Owns What

**Principle**: Metrics ownership follows role ownership. Bob and Tech-lead co-own **system metrics** from their respective angles. Coach and Optimizer co-own **agent metrics** from their respective angles. May doesn't own metrics — she **surfaces** them to Hao.

---

## The Split

```
                    ┌─────────────────┐
                    │    may.db        │
                    │  (shared data)   │
                    └─┬───┬───┬───┬───┘
                      │   │   │   │
          ┌───────────┘   │   │   └───────────┐
          ▼               ▼   ▼               ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
  │     Bob      │ │  Tech-Lead   │ │  Coach+Optimizer  │
  │   Research   │ │  Operations  │ │     Agents        │
  │   Output     │ │  Health/Cost │ │  Quality+Efficiency│
  └──────────────┘ └──────────────┘ └──────────────────┘
       │                  │                   │
       ▼                  ▼                   ▼
  "Are we            "Is the machine     "Are agents
   producing          running well?"      performing?"
   knowledge?"
                              │
                              ▼
                      ┌──────────────┐
                      │     May      │
                      │  (surfaces   │
                      │  to Hao)     │
                      └──────────────┘
```

---

## Bob's Research Output Metrics

Bob answers: **"Is the system producing intellectual value?"**

Bob already reads the knowledge base, proposes hypotheses, and synthesizes findings. Tracking whether that pipeline is *moving* is a natural extension.

### What Bob Tracks
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Knowledge entries created** | `knowledge_entries` | New KEs per week, total count | Weekly |
| **Hypotheses advanced** | `hypotheses` | Status transitions per week (PROPOSED→ACTIVE→SUPPORTED/DISCONFIRMED) | Weekly |
| **Experiments completed** | `experiments` | Completed per week, pipeline velocity (designed→running→completed) | Weekly |
| **Research project progress** | `agents/shared/research-projects/*.md` | Milestones hit, blockers | Weekly |
| **Knowledge gaps** | Derived | Hypotheses with no experiments, stale KEs, abandoned research threads | Monthly |

### Bob's Research Report (weekly)
```
RESEARCH REPORT — Week of YYYY-MM-DD
─────────────────────────────────────
KNOWLEDGE
  New entries:      +N this week (total: NNN)
  Stale (>30d):     N entries need review

HYPOTHESES
  Active:           N
  Supported:        +N this week
  Refuted:          +N this week
  Untested:         N (oldest: H-XXX, NN days)

EXPERIMENTS
  Completed:        N
  Running:          N
  Pipeline:         N designed, waiting to run

RESEARCH AGENDA
  1. [project/thread] — status, next step
  2. ...
```

### Bob's Alert Thresholds
- 0 KEs in a week → research stalled, investigate
- Hypothesis untested > 30 days → design experiment or archive
- Experiment stuck in "running" > 7 days → check on it
- Knowledge gap: hypothesis cluster with no supporting experiments

---

## Tech-Lead's System Health & Operations Metrics

Tech-lead answers: **"Is the machine running well? Where is it breaking?"**

Tech-lead already monitors production — stuck sessions, race conditions, errors. Formalizing this into metrics makes his existing instinct systematic.

### What Tech-Lead Tracks

#### Health (is it running?)
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Agent uptime** | `sessions.startedAt` | Gaps > 2× cron interval = downtime | Daily |
| **Error rate** | `sessions.status` | error + interrupted / total, per agent | Daily |
| **Request backlog** | `requests.status='CREATED'` | Unstarted requests, age | Every heartbeat |
| **Session error patterns** | `sessions.error` | Recurring error types, new error classes | Daily |
| **Stuck sessions** | `sessions` | Running > 5min, no progress | Every heartbeat |

#### Cost (is it affordable?)
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Total daily cost** | `evaluations.usage→cost` | Sum per day, 7-day rolling avg | Daily |
| **Cost by agent** | `evaluations.usage→cost` | Per-agent daily cost, trends | Daily |
| **Heartbeat overhead** | `sessions.task` | Heartbeat cost / total cost | Daily |
| **Cost per unit output** | Derived | Total cost / KEs produced (with Bob's numbers) | Weekly |

#### Flow (is work moving?)
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Request throughput** | `requests.durationMs` | Avg created→completed time, by agent | Daily |
| **Request completion rate** | `requests.status` | COMPLETED / (COMPLETED + FAILED) | Daily |
| **Dispatch latency** | `requests` | Time from CREATED to first session | Daily |

### Tech-Lead's Operations Report (weekly)
```
OPS REPORT — Week of YYYY-MM-DD
─────────────────────────────────────
HEALTH
  Agent uptime:     N/N at 100% (issues: [agent] had N gaps)
  Error rate:       N.N% (Δ from last week)
  Stuck sessions:   N this week (patterns: ...)

COST
  Total:            $NNN.NN (Δ from last week)
  By agent:         bob $NN, coach $NN, scout $NN, ...
  Heartbeat %:      NN% of total
  Cost/KE:          $NN.NN (Δ)

FLOW
  Requests:         NN.N% completion, avg NNs duration
  Backlog:          N unstarted (oldest: NNh)

INCIDENTS
  1. [what happened, root cause, fixed?]
  2. ...
```

### Tech-Lead's Alert Thresholds
- Error rate > 5% for any agent → investigate
- Request backlog > 10 → dispatch or investigate
- Daily cost > 2× 7-day average → investigate
- Agent downtime > 2 hours → fix or escalate
- Stuck session > 10 min → kill and diagnose

---

## Coach's Agent Quality Metrics

Coach answers: **"Are agents doing the right things? Are they getting better?"**

Coach improves the agent's *mind* (decisions, judgment, process). Optimizer improves the agent's *environment* (tools, workflows, infrastructure). They share the goal of better agent performance but attack different levers — Coach through training and skills, Optimizer through tools and workflows.

Coach focuses on **what agents do wrong** (failure modes), **what helps them improve** (skills, training), and **whether improvements stick** (longitudinal tracking).

### What Coach Tracks

#### Quality (how good?)
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Eval quality score** | `evaluations.quality` | Avg per agent, 7-day rolling | Per sprint |
| **Verdict distribution** | `evaluations.verdict` | % good / acceptable / needs_improvement per agent | Per sprint |
| **Convention compliance** | `convention_checks.passed` | Pass rate per agent per convention | Per sprint |
| **Failure mode frequency** | `evaluations.issues` | Specific FM codes per agent, trend over time | Per sprint |
| **Recovery rate** | `evaluations.failureChains` | Error occurred → recovered vs spiraled | Per sprint |

#### Growth (are they improving?)
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Quality trend** | `evaluations.quality` | Sprint-over-sprint Δ per agent | Per sprint |
| **FM reduction after intervention** | Derived | After deploying a skill, does that FM rate drop? | Per experiment |
| **Gym score trend** | `gym_runs` + `gym_checks` | Agent scores on gym scenarios over time | Per sprint |
| **Skill deployment yield** | Coach workspace | % of deployed skills that measurably help | Monthly |
| **Experiment hit rate** | `experiments` | % of coach experiments producing actionable results | Monthly |

#### Behavioral Patterns
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Judgment failures** | `evaluations.issues` | FM codes: wrong decisions (sycophancy, phantom fixes) | Per sprint |
| **Process failures** | `evaluations.issues` | FM codes: missing steps (no verify, no baseline) | Per sprint |
| **Busywork detection** | Verdicts + digests | "acceptable" sessions producing no lasting output | Per sprint |

### Coach's Agent Scorecard (per sprint, per agent)
```
AGENT SCORECARD — [agent] — Sprint N
─────────────────────────────────────
QUALITY
  Avg quality:    N.NN (Δ from last sprint)
  Good/Acc/Bad:   NN% / NN% / NN%
  Convention:     NN% pass rate

GROWTH
  Quality trend:  ↑/↓/→ (N.NN → N.NN)
  Top FM:         FM-X.Y at NN% (Δ)
  Skills active:  N, verified effective: N

OPEN ISSUES
  - [agent] still fails FM-X.Y at NN% (intervention pending)
  - [agent] quality dropped N.N — investigating
```

### Coach's Alert Thresholds
- Quality score drop > 0.5 in one sprint → investigate
- FM rate increase after skill deployment → revert/redesign
- needs_improvement rate > 5% for any agent → intervention needed
- Convention pass rate < 80% → training needed

---

## Optimizer's Infrastructure & Efficiency Metrics

Optimizer answers: **"Is the infrastructure serving agents well? Where is the waste?"**

Coach improves the agent's *mind* (skills, training, judgment). Optimizer improves the agent's *environment* (tools, workflows, codebase). They share the goal of better agent performance but work on completely different levers.

Optimizer focuses on **how many calls it takes** (efficiency), **what's deterministic but done by LLM** (tool opportunities), **whether infrastructure changes help** (workflow/tool impact), and **codebase health** (dead code, duplication, hygiene).

### What Optimizer Tracks

#### Efficiency (how cheap?)
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Eval efficiency score** | `evaluations.efficiency` | Avg per agent, 7-day rolling | Per sprint |
| **Wasted call rate** | `evaluations.wastedCalls` | wastedCalls / totalCalls per agent | Per sprint |
| **Ops per session** | Sessions/evaluations | Avg tool calls per session type, per agent | Per sprint |
| **Cost per session** | `evaluations.usage→cost` | Avg cost per agent, by session type | Per sprint |

#### Infrastructure Impact (are tools/workflows helping?)
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Workflow effectiveness** | Evaluations + workflow usage | Quality/efficiency with workflows vs without | Per sprint |
| **Tool usage patterns** | Session transcripts | Most-used tools, error-prone tools | Monthly |
| **Tool error rate** | `evaluations.failureChains` | Errors by tool type | Per sprint |
| **Request duration by type** | `requests.durationMs` | Avg time per task type — find slow patterns | Per sprint |

#### Waste Identification
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Repeated patterns** | Session digests | Same bash/read sequences across sessions → tool candidate | Monthly |
| **Escalation waste** | Workflow escalations | Tasks that escalate but shouldn't → better defaults | Per sprint |
| **Retry waste** | `evaluations.failureChains` | Retries that don't recover → tool/schema fix | Per sprint |
| **Cost hotspots** | `evaluations.usage→cost` | Agents/task-types that cost disproportionately | Weekly |

#### Codebase Health (Optimizer's recurring responsibility)
| Metric | Source | How | Cadence |
|--------|--------|-----|---------|
| **Dead code** | Import graph analysis | Unused functions, orphaned exports, unreferenced files | Monthly |
| **Duplication** | Grep/pattern analysis | Repeated patterns that should be helpers | Monthly |
| **Stale artifacts** | Grep (TODO/FIXME) | TODOs referencing completed work, dead comments | Monthly |
| **Type hygiene** | TypeScript compiler | Unused type definitions, dead interface fields | Monthly |

### Optimizer's Efficiency Report (per sprint)
```
EFFICIENCY REPORT — Sprint N
─────────────────────────────────────
PER AGENT
  Agent     | Eff Score | Wasted% | Avg Cost | Ops/Session
  bob       | N.NN (Δ)  | NN%     | $N.NN    | NN
  coach     | N.NN (Δ)  | NN%     | $N.NN    | NN
  ...

INFRASTRUCTURE
  Workflow impact:     +N.NN quality when used
  Tool errors/day:     NN (Δ)
  Heartbeat overhead:  NN% of total cost

WASTE HOTSPOTS
  1. [pattern] — est. $NN/day, tool candidate: [idea]
  2. [pattern] — est. $NN/day, workflow fix: [idea]

TOOL CANDIDATES
  - [description]: saves est. N calls/session for [agents]

CODEBASE HEALTH (monthly)
  Dead code removed:  N functions, N files
  Duplication:        N patterns extracted
  Stale artifacts:    N cleaned up
```

### Optimizer's Alert Thresholds
- Efficiency score drop > 0.5 → investigate
- Wasted call rate > 15% for any agent → tool/schema fix needed
- Heartbeat overhead > 30% of total cost → cron interval review
- Any tool with > 10% error rate → schema redesign

---

## May's Role: Surfacing to Hao

May doesn't own metrics. She **collects and surfaces** them.

### What May Does
1. **Weekly rollup** — pulls from Bob's research report, Tech-lead's ops report, Coach's scorecards, Optimizer's efficiency report → one summary for Hao
2. **Alert relay** — when any agent crosses an alert threshold and can't self-resolve, May escalates to Hao
3. **On-demand** — when Hao asks "how's the system doing?", May queries the relevant owners and synthesizes

### May's Weekly Rollup (for Hao)
```
WEEKLY ROLLUP — Week of YYYY-MM-DD
═══════════════════════════════════════

RESEARCH (from Bob)
  Knowledge: +N entries, N hypotheses advanced
  Status: [healthy / stalled / accelerating]

OPERATIONS (from Tech-Lead)  
  Health: N.N% error rate, $NNN cost
  Status: [healthy / degraded / incident]

AGENTS (from Coach + Optimizer)
  Quality: avg N.NN across agents (Δ)
  Efficiency: avg N.NN across agents (Δ)
  Status: [healthy / intervention needed]

ESCALATIONS
  - [any unresolved escalations]

HMMM (things that might need your attention)
  - [anything May noticed that doesn't fit above]
```

---

## Cross-Owner Handoffs

### The Coach ↔ Optimizer Pair

Coach and Optimizer are a **collaborative pair** with a shared goal (better agents) but different perspectives:

```
               "Agent is failing"
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
    ┌───────────┐           ┌───────────┐
    │   Coach   │           │ Optimizer │
    │  "Is the  │◄─────────►│  "Is the  │
    │  agent's  │  handoff   │  agent's  │
    │  behavior │  signals   │  tooling  │
    │  wrong?"  │           │  wrong?"  │
    └───────────┘           └───────────┘
    Fix: skill,             Fix: tool,
    training,               workflow,
    L5 workflow             schema, infra
```

**When they converge**: An agent has high failure-mode rate AND high wasted-call rate → both should look at it. Coach asks "does the agent know what to do?", Optimizer asks "does the agent have the right tools to do it?"

**When they hand off**: Coach identifies FM-3.3 (phantom fixes) → tries skill → skill doesn't help → "maybe this needs a tool, not training" → hands to Optimizer. Or: Optimizer finds a tool error pattern → "agents are using this tool wrong" → hands to Coach for training.

### All Cross-Owner Handoffs

| Signal | From | To | Action |
|--------|------|----|--------|
| Research output stalled | Bob | Tech-lead | "Experiments blocked — infra problem?" |
| High error rate on research agents | Tech-lead | Bob | "Scout erroring 15% — research pipeline affected" |
| Cost spike on an agent | Tech-lead | Optimizer | "Bob's cost doubled — efficiency problem?" |
| FM pattern is a tool gap | Coach | Optimizer | "FM-3.3 could be fixed by a tool, not training" |
| Wasted calls are a skill gap | Optimizer | Coach | "Bob wastes calls on X — training issue?" |
| Quality drops after tool change | Coach | Optimizer | "New tool hurt quality — revert?" |
| Efficiency drops after skill change | Optimizer | Coach | "New skill made agent slower — revert?" |
| Agent underperforming on both axes | Coach + Optimizer | May | "Bob needs attention — quality AND efficiency down" |
| System-wide issue | Tech-lead | May → Hao | "Error rate spiking system-wide — need human input" |

---

## Implementation Plan

### Phase 1: Reports (this week)
1. **Bob**: Add research metrics to weekly synthesis (he already does this informally)
2. **Tech-lead**: Add ops metrics to heartbeat (he already monitors most of this)
3. **Coach**: Formalize sprint scorecard (already does evaluations)
4. **Optimizer**: Formalize efficiency report (already tracks waste)

### Phase 2: May Integration (next week)
5. May pulls from all four during weekly rollup
6. Alert relay: agents flag thresholds → May surfaces to Hao

### Phase 3: Trend Analysis (week 3)
7. Week-over-week comparisons in each report
8. Cross-owner handoff triggers (automated when possible)
