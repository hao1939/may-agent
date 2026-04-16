# Agent Metric Design — Role-Aligned, Tension-Aware

## Design Principles

1. **Metrics signal where agents should go** — they drive growth, not just reflect current behavior
2. **Tension pairs share concerns from different perspectives** — they don't oppose each other, they balance each other
3. **Metrics are signals, not targets** (Goodhart's Law) — they inform judgment, not replace it
4. **Start simple** — each agent gets 2-3 metrics, not 6

---

## Agent Roles (from SOUL.md)

| Agent | Role | Produces | Cares About |
|-------|------|----------|-------------|
| **May** | Supervisor/Deputy | Dispatches, coordinates, monitors | System health, request flow, nothing stuck |
| **Bob** | Architect | Designs, hypotheses, experiments → production improvements | Ideas becoming real changes |
| **Tech-lead** | Engineer | Code, infrastructure, simplification | System weight, build health, shipping features |
| **Coach** | Trainer | Skills, experiments, gym scenarios | Agent behavior improvement with evidence |
| **Optimizer** | Tool/Workflow builder | Tools, workflows, efficiency analysis | Agents having better tools, less waste |
| **Scout** | Explorer | Deep dives, papers, hypotheses, cross-references | Frontier knowledge, actionable findings |
| **Coder** | Builder | Code changes, implementations | Correct code, tests pass |
| **Evaluator** | Scorer | Quality/efficiency verdicts, failure patterns | Fair scoring, pattern detection |
| **QA** | Reviewer | Code reviews, verdicts | Code quality, nothing ships broken |

---

## Tension Pairs

### Bob ↔ Tech-lead: "What to build" vs "How to build it well"

Both care about the system getting better. Bob thinks at system/design level — what capabilities do we need? Tech-lead thinks at code level — is this implemented cleanly?

**Shared concern:** The system should gain capability without gaining complexity.

- Bob proposes designs that are too ambitious → Tech-lead pushes back with engineering reality
- Tech-lead simplifies aggressively → Bob pushes back when capabilities are lost

### Coach ↔ Optimizer: "Agent quality" vs "Agent efficiency"

Both care about agent performance. Coach focuses on behavior — are agents doing the right thing? Optimizer focuses on execution — are agents doing things efficiently?

**Shared concern:** Agents should perform well without wasting resources.

- Coach adds training that slows agents down → Optimizer flags the cost
- Optimizer removes overhead that was actually improving quality → Coach flags the regression

---

## Metrics Per Agent

### May — System Oversight
May doesn't produce output — she keeps the system flowing.

| Metric | Type | What It Measures |
|--------|------|-----------------|
| `system.request-throughput` | health | Human requests processed per day (are things getting done?) |
| `system.stuck-requests` | health | Requests older than 24h with no progress (nothing should be stuck) |
| `system.agent-utilization` | continuous | % of agents that produced meaningful work in last 24h |

**Threshold:** stuck-requests < 3, agent-utilization > 80%

### Bob — Architect
Bob's value is ideas that become real improvements. Not paper output — shipped impact.

| Metric | Type | What It Measures |
|--------|------|-----------------|
| `bob.hypotheses-resolved` | continuous | % of hypotheses with a conclusion (confirmed, rejected, or abandoned with reason) |
| `bob.designs-implemented` | continuous | % of Bob's design docs that resulted in actual code/changes |
| `bob.experiment-completion` | health | Experiments started vs completed (are experiments finishing?) |

**Why these:** Bob's SOUL says "close the loop from insight → experiment → production." These measure whether the loop is closing.

**Tension with tech-lead:** `bob.designs-implemented` only counts if tech-lead actually builds it. If Bob's designs are too complex, tech-lead won't implement them. Forces Bob to design things that are buildable.

### Tech-lead — Engineer
Tech-lead's value is a system that's simple, healthy, and shipping features.

| Metric | Type | What It Measures |
|--------|------|-----------------|
| `tech-lead.build-health` | health | TSC clean + tests passing (is the codebase healthy?) |
| `tech-lead.features-shipped` | continuous | Features/improvements merged to main per week |
| `tech-lead.codebase-weight` | continuous | src/ LOC trend — should be flat or declining despite new features |

**Why these:** Tech-lead's SOUL says "system should get smaller and simpler even as it gets more capable." These measure all three: health, delivery, and simplicity.

**Tension with Bob:** `tech-lead.features-shipped` includes implementing Bob's designs. If Bob doesn't design well, tech-lead can't ship. If tech-lead doesn't build, Bob's designs are wasted. Both need each other.

### Coach — Trainer
Coach's value is measurable improvement in agent behavior.

| Metric | Type | What It Measures |
|--------|------|-----------------|
| `coach.quality-improvement` | continuous | Avg quality score trend across trained agents (is training working?) |
| `coach.skill-effectiveness` | continuous | % of deployed skills with measured positive impact |
| `coach.gym-discrimination` | continuous | % of gym scenarios that actually test something (not ceiling/floor) |

**Why these:** Coach's SOUL says "verify which skills actually improve behavior." These measure whether training is evidence-based and effective.

**Tension with optimizer:** `coach.quality-improvement` might conflict with optimizer's efficiency goals. If coach's training makes agents better but slower, optimizer will flag it. Forces coach to find interventions that improve quality without adding overhead.

### Optimizer — Tool & Workflow Builder
Optimizer's value is agents having better tools and less waste.

| Metric | Type | What It Measures |
|--------|------|-----------------|
| `optimizer.tool-adoption` | continuous | % of optimizer-built tools/workflows actually used by agents |
| `optimizer.waste-reduction` | continuous | Reduction in avg ops for patterns optimizer identified as bloated |
| `optimizer.quality-preserved` | health | Quality score doesn't regress when efficiency improves |

**Why these:** Optimizer's SOUL says "build tools that replace unreliable LLM reasoning with reliable code." These measure whether the tools are adopted and whether efficiency gains are real.

**Tension with coach:** `optimizer.quality-preserved` ensures optimizer can't sacrifice quality for efficiency. If coach sees quality drop after an optimization, the metric catches it.

### Scout — Explorer
Scout's value is finding knowledge that the team actually uses.

| Metric | Type | What It Measures |
|--------|------|-----------------|
| `scout.discovery-rate` | health | Deep dives and cross-references produced per week |
| `scout.findings-used` | continuous | % of scout's hypotheses/findings that another agent acted on within 14 days |
| `scout.coverage` | health | Days since last source scan (arXiv, GitHub trending, etc.) |

**Why these:** Scout's SOUL says "keep the team connected to state of the art" and "synthesize." These measure discovery, usefulness, and coverage.

### Coder — Builder
Coder is a worker, not a strategist. Metrics should be about execution quality.

| Metric | Type | What It Measures |
|--------|------|-----------------|
| `coder.quality` | continuous | Avg quality score from evaluator |
| `coder.first-pass-rate` | continuous | % of tasks completed without retry/rejection |

### Evaluator — Scorer
Evaluator should be consistent and fair.

| Metric | Type | What It Measures |
|--------|------|-----------------|
| `evaluator.calibration` | health | Score variance — are similar sessions getting similar scores? |
| `evaluator.coverage` | health | % of sessions evaluated (are we scoring enough?) |

### QA — Reviewer  
QA should catch real issues without over-blocking.

| Metric | Type | What It Measures |
|--------|------|-----------------|
| `qa.review-coverage` | health | % of review branches reviewed before merge |
| `qa.false-positive-rate` | continuous | % of QA rejections that were overridden (QA was wrong) |

---

## How Tension Works in Practice

The key insight: **tension pairs don't have opposing metrics — they share concerns from different angles.**

```
Bob designs something
  → Tech-lead reviews: "Is this buildable? Is the complexity justified?"
  → If yes: tech-lead implements → both metrics improve
  → If no: tech-lead pushes back → Bob simplifies → better design

Coach deploys a skill
  → Optimizer checks: "Did this add overhead? Is the quality gain worth it?"  
  → If yes: optimizer adopts the pattern → both metrics improve
  → If no: optimizer flags it → coach refines or removes → leaner training

Scout finds a paper
  → Bob checks: "Can we use this? Does it solve a real problem?"
  → If yes: Bob designs an experiment → scout's findings-used improves
  → If no: scout adjusts search strategy → more relevant findings
```

The system self-balances because each agent's success depends partly on their counterpart's judgment.

---

## What This Replaces

Replace the "Initial Metric Set" section in metrics-system.md and the old tension-pairs.md. This becomes the authoritative metric assignment.
