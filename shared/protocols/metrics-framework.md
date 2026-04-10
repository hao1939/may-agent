# Metrics Framework — System vs Agents

**Principle**: May owns **system metrics** (is the machine producing?). Coach and Optimizer **share** agent metrics from different angles — Coach owns **behavioral quality** (are agents doing the right things?) and Optimizer owns **operational efficiency** (are agents doing things cheaply?). They share the same database but ask different questions.

---

## May's System Metrics (the machine)

May answers: **"Is the system producing value and staying healthy?"**

### Tier 1: Output Metrics (what the system produces)
| Metric | Source | Query | Cadence |
|--------|--------|-------|---------|
| **Knowledge entries created** | `knowledge_entries.synced_at` | New KEs per day/week | Weekly |
| **Experiments completed** | `experiments.status` | Completed per week, pipeline velocity (designed→completed) | Weekly |
| **Hypotheses advanced** | `hypotheses.status` | Status transitions per week | Weekly |
| **Research project progress** | `agents/shared/research-projects/*.md` | Projects advanced, milestones hit | Weekly |
| **Requests fulfilled** | `requests.status` | COMPLETED vs FAILED, completion rate | Daily |
| **Request throughput** | `requests.durationMs` | Avg time from created→completed | Daily |

### Tier 2: Cost Metrics (how much the machine costs)
| Metric | Source | Query | Cadence |
|--------|--------|-------|---------|
| **Total daily cost** | `evaluations.usage→cost` | Sum of all session costs per day | Daily |
| **Cost per knowledge entry** | Derived: weekly_cost / new_KEs | Are we getting cheaper per unit of output? | Weekly |
| **Cost per experiment** | Derived | Pipeline cost for each completed experiment | Weekly |

### Tier 3: Health Metrics (is the machine running?)
| Metric | Source | Query | Cadence |
|--------|--------|-------|---------|
| **Agent uptime** | `sessions.startedAt` | Gaps > 2× cron interval = downtime | Daily |
| **Error rate** | `sessions.status` | error + interrupted / total | Daily |
| **Request backlog** | `requests.status='CREATED'` | Unstarted requests | Every heartbeat |
| **Session error patterns** | `sessions.error` | Recurring error types | Daily |

### May's Alert Thresholds
- Error rate > 5% for any agent → investigate
- Request backlog > 10 → dispatch or cancel stale
- Daily cost > 2× 7-day average → investigate
- Agent downtime > 2 hours → re-enable or escalate
- 0 KEs in a week → output stalled

### May's Weekly System Report
```
SYSTEM REPORT — Week of YYYY-MM-DD
────────────────────────────────────
OUTPUT
  Knowledge entries:  +N this week (total: NNN)
  Experiments:        N completed, N in pipeline
  Hypotheses:         N advanced, N archived
  Requests:           NN.N% completion rate

COST
  Total cost:         $NNN.NN (Δ from last week)
  Cost per KE:        $NN.NN (Δ)

HEALTH
  Agent uptime:       N/N agents at 100%
  Error rate:         N.N%
  Backlog:            N unstarted requests
```

---

## Coach's Agent Metrics (behavioral quality)

Coach answers: **"Are agents doing the right things? Are they getting better?"**

Coach focuses on **what agents do wrong** (failure modes), **what helps them improve** (skills, training), and **whether improvements stick** (longitudinal tracking).

### Tier 1: Quality Metrics
| Metric | Source | Query | Cadence |
|--------|--------|-------|---------|
| **Eval quality score** | `evaluations.quality` | Avg per agent, 7-day rolling | Per sprint |
| **Verdict distribution** | `evaluations.verdict` | % good / acceptable / needs_improvement per agent | Per sprint |
| **Convention compliance** | `convention_checks.passed` | Pass rate per agent per convention | Per sprint |
| **Failure mode frequency** | `evaluations.issues` | Specific FM codes per agent, trend over time | Per sprint |
| **Recovery rate** | `evaluations.failureChains` | When error occurs: recovered vs spiraled? | Per sprint |

### Tier 2: Growth Metrics (are they improving?)
| Metric | Source | Query | Cadence |
|--------|--------|-------|---------|
| **Quality trend** | `evaluations.quality` | Sprint-over-sprint Δ per agent | Per sprint |
| **FM reduction after intervention** | Derived | After deploying a skill, does that FM rate drop? | Per experiment |
| **Gym score trend** | `gym_runs` + `gym_checks` | Agent scores on gym scenarios over time | Per sprint |
| **Skill deployment yield** | Coach workspace | % of deployed skills that measurably help | Monthly |
| **Experiment hit rate** | `experiments` | % of coach experiments that produce actionable results | Monthly |

### Tier 3: Behavioral Patterns
| Metric | Source | Query | Cadence |
|--------|--------|-------|---------|
| **Judgment failure rate** | `evaluations.issues` | FM codes related to wrong decisions (sycophancy, phantom fixes) | Per sprint |
| **Process failure rate** | `evaluations.issues` | FM codes related to missing steps (no verify, no baseline) | Per sprint |
| **Busywork detection** | Verdicts + digests | "acceptable" sessions that produce no lasting output | Per sprint |

### Coach's Agent Scorecard (per sprint)
```
AGENT SCORECARD — [agent] — Sprint N
────────────────────────────────────
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
  - [agent] quality dropped 0.3 — investigating
```

### Coach's Alert Thresholds
- Quality score drop > 0.5 in one sprint → investigate
- FM rate increase after skill deployment → revert/redesign
- needs_improvement rate > 5% for any agent → intervention needed
- Convention pass rate < 80% → training needed

---

## Optimizer's Agent Metrics (operational efficiency)

Optimizer answers: **"Are agents doing things cheaply? Where is the waste?"**

Optimizer focuses on **how many calls it takes** (efficiency), **what's deterministic but done by LLM** (tool opportunities), and **whether infrastructure changes help** (workflow/tool impact).

### Tier 1: Efficiency Metrics
| Metric | Source | Query | Cadence |
|--------|--------|-------|---------|
| **Eval efficiency score** | `evaluations.efficiency` | Avg per agent, 7-day rolling | Per sprint |
| **Wasted call rate** | `evaluations.wastedCalls` | wastedCalls / totalCalls per agent | Per sprint |
| **Ops per session** | Sessions/evaluations | Avg tool calls per session type, per agent | Per sprint |
| **Cost per session** | `evaluations.usage→cost` | Avg cost per agent, by session type (heartbeat vs work) | Per sprint |
| **Heartbeat overhead** | `sessions.task` | Heartbeat sessions cost / total cost, per agent | Daily |

### Tier 2: Infrastructure Impact
| Metric | Source | Query | Cadence |
|--------|--------|-------|---------|
| **Work session ratio** | `sessions.task` | Non-heartbeat / total sessions, per agent | Daily |
| **Workflow effectiveness** | Evaluations + workflow usage | Sessions using workflows: avg quality/efficiency vs without | Per sprint |
| **Tool usage patterns** | Session transcripts | Which tools used most? Which cause errors? | Monthly |
| **Tool error rate** | `evaluations.failureChains` | Errors by tool type — schema problems, wrong-tool usage | Per sprint |
| **Request duration by type** | `requests.durationMs` | Avg time per task type — find slow patterns | Per sprint |

### Tier 3: Waste Identification
| Metric | Source | Query | Cadence |
|--------|--------|-------|---------|
| **Repeated patterns** | Session digests | Same bash/read sequences across sessions (→ tool candidate) | Monthly |
| **Escalation waste** | Workflow escalations | Tasks that escalate but shouldn't (→ better default) | Per sprint |
| **Retry waste** | `evaluations.failureChains` | Retries that don't recover (→ tool/schema fix) | Per sprint |
| **Cost hotspots** | `evaluations.usage→cost` | Which agents/task-types cost disproportionately | Weekly |

### Optimizer's Efficiency Report (per sprint)
```
EFFICIENCY REPORT — Sprint N
────────────────────────────────────
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
```

### Optimizer's Alert Thresholds
- Efficiency score drop > 0.5 → investigate
- Wasted call rate > 15% for any agent → tool/schema fix needed
- Heartbeat overhead > 30% of total cost → cron interval review
- Any tool with > 10% error rate → schema redesign

---

## How They Interact

```
                    ┌─────────────────┐
                    │    may.db        │
                    │  (shared data)   │
                    └───┬───┬───┬─────┘
                        │   │   │
            ┌───────────┘   │   └───────────┐
            ▼               ▼               ▼
    ┌───────────────┐ ┌──────────┐ ┌──────────────────┐
    │     May       │ │  Coach   │ │    Optimizer      │
    │ System Output │ │ Behavior │ │   Efficiency      │
    │ System Cost   │ │ Quality  │ │   Waste           │
    │ System Health │ │ Growth   │ │   Infrastructure  │
    └───────────────┘ └──────────┘ └──────────────────┘
         │                  │               │
         ▼                  ▼               ▼
    "Is the system     "Are agents      "Are agents doing
     producing?"       doing the right   it cheaply?"
                       things?"
```

### Handoff Points
| Signal | From | To | Action |
|--------|------|----|--------|
| Agent output drops | May | Coach | "Bob's request completion dropped — is quality the cause?" |
| Agent cost spikes | May | Optimizer | "Scout's cost doubled — investigate efficiency" |
| FM rate high | Coach | Optimizer | "FM-3.3 is a missing-verification pattern — could a tool enforce it?" |
| Wasted calls pattern | Optimizer | Coach | "Bob wastes calls on X — is this a skill gap or tool gap?" |
| Tool error rate high | Optimizer | Coach | "Agents misuse tool X — need training or schema fix?" |
| Quality drops after tool change | Coach | Optimizer | "New tool made quality worse — revert or redesign" |

---

## Implementation Plan

### Phase 1: Dashboard Scripts (this week)
1. **`scripts/system-metrics.ts`** — May runs weekly, produces `agents/may/workspace/system-report.md`
2. **`scripts/agent-scorecard.ts`** — Coach runs per sprint, produces scorecard per agent
3. **`scripts/efficiency-report.ts`** — Optimizer runs per sprint, produces efficiency report

### Phase 2: Heartbeat Integration (next week)
4. May's heartbeat: daily quick check (error rate, uptime, backlog, cost)
5. Coach's heartbeat: check for quality drops, new FM spikes
6. Optimizer's heartbeat: check for efficiency drops, wasted call spikes

### Phase 3: Trend Analysis (week 3)
7. Week-over-week and sprint-over-sprint comparisons
8. Automated alert generation when thresholds crossed
9. Cross-agent handoff triggers (the table above)
