# Revised Metric Design — Incorporating Agent Feedback + Speed

## Updates from Agent Feedback

### Metric Corrections (from agents' own suggestions)

**Tech-lead:** `features-shipped` → `tech-lead.meaningful-changes` — refactors, simplifications, and capability additions all count, not just "features." Add `tech-lead.delegation-quality` — coder first-pass rate on tasks tech-lead delegates (pushes better specs).

**Coach:** `quality-improvement` → `coach.intervention-hit-rate` — % of deployed interventions where the target failure mode decreased post-deployment. More specific, more actionable. Replace `gym-discrimination` with `coach.knowledge-to-action-latency` — how quickly experimental findings lead to deployed interventions.

**Optimizer:** `waste-reduction` → needs concrete baseline. Add `optimizer.analysis-accuracy` — % of optimizer recommendations that held up under scrutiny. Pushes toward careful analysis over fast-but-wrong.

**Scout:** `discovery-rate` → weight by quality (did it generate a hypothesis? connect to our system?). Add `scout.hypotheses-generated` — synthesis metric, not volume. Requires connecting research to the system.

**Bob:** Metrics are mostly right. `experiment-completion` is most useful for frequent checking. `designs-implemented` is slow-moving and depends on tech-lead.

## Speed: Different Metrics Move at Different Speeds

Hao's concern: weekly/daily is too slow. Agents run 24/7 — they should act on signals faster.

**The fix: match measurement cadence to the metric's natural feedback loop.**

### Fast Metrics (check every heartbeat — actionable in hours)

| Metric | Owner | Why fast |
|--------|-------|---------|
| `bob.experiment-completion` | bob | Stalled experiment = wasted cycles NOW |
| `tech-lead.build-health` | tech-lead | Broken build blocks everything |
| `system.stuck-requests` | may | Nothing should be stuck for hours |
| `scout.coverage` | scout | Did I scan today? |
| `coach.intervention-hit-rate` | coach | After deploying a skill, check gym results same day |

Agents check these every heartbeat. If the signal is bad, act THIS cycle.

### Medium Metrics (check daily — actionable in 24h)

| Metric | Owner | Why daily |
|--------|-------|----------|
| `optimizer.tool-adoption` | optimizer | Need a day of sessions to see if agents use new tools |
| `coder.first-pass-rate` | coder | Need several tasks to see a pattern |
| `tech-lead.delegation-quality` | tech-lead | Need several delegated tasks |
| `coach.knowledge-to-action-latency` | coach | Track how long findings sit before action |
| `system.agent-utilization` | may | Which agents produced work today? |

### Slow Metrics (check weekly — strategic direction)

| Metric | Owner | Why slow |
|--------|-------|---------|
| `bob.hypotheses-resolved` | bob | Research takes time |
| `bob.designs-implemented` | bob | Depends on build queue |
| `tech-lead.codebase-weight` | tech-lead | LOC trend only meaningful over weeks |
| `scout.findings-used` | scout | 14-day action window |
| `optimizer.quality-preserved` | optimizer | Need weeks of data to see trends |

### The Gym as Fast Feedback

**Key speed-up mechanism:** The gym gives fast signal for metrics that would otherwise be slow.

- Coach deploys a skill → runs 10 gym trials in 20 minutes → knows if it works TODAY
- Instead of waiting days for production `quality-improvement` data
- Gym is the fast loop, production metrics are the slow confirmation

Push agents to use gym more for rapid iteration. This is how coach's `intervention-hit-rate` becomes a fast metric instead of a slow one.

## How Agents Use Metrics (Signal + Judgment)

From the feedback, the right pattern is:

1. **Every heartbeat:** Glance at fast metrics. If something is red, it's this cycle's priority.
2. **End of day:** Review medium metrics. Adjust tomorrow's approach.
3. **Weekly:** Review slow metrics. Adjust strategy and priorities for the week.
4. **Always:** Combine metric signals with context. The metric says what; judgment says why and whether to act.

**One action per heartbeat, not three.** (From coach's feedback.) Even if multiple metrics signal problems, pick the most important one. Thrashing between metrics is worse than focusing.

## Tension Pairs (unchanged from previous version)

Bob ↔ Tech-lead: "What to build" vs "How to build it well"
Coach ↔ Optimizer: "Agent quality" vs "Agent efficiency"

The tension works through interdependent metrics — Bob's success depends partly on tech-lead building his designs, optimizer's efficiency gains must preserve coach's quality improvements.

## Updated Full Metric Set

### May — System Oversight
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `system.request-throughput` | health | daily | Are human requests getting done? |
| `system.stuck-requests` | health | fast | Is anything blocked right now? |
| `system.agent-utilization` | continuous | daily | Is every agent producing? |

### Bob — Architect  
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `bob.experiment-completion` | health | fast | Am I finishing what I start? |
| `bob.hypotheses-resolved` | continuous | slow | Is the research loop closing? |
| `bob.designs-implemented` | continuous | slow | Are my designs becoming real? |

### Tech-lead — Engineer
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `tech-lead.build-health` | health | fast | Is the codebase healthy right now? |
| `tech-lead.meaningful-changes` | continuous | daily | Am I shipping impactful work? |
| `tech-lead.codebase-weight` | continuous | slow | Is the system getting simpler? |
| `tech-lead.delegation-quality` | continuous | daily | Am I scoping tasks well for coder? |

### Coach — Trainer
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `coach.intervention-hit-rate` | continuous | fast (via gym) | Do my interventions actually work? |
| `coach.skill-effectiveness` | continuous | daily | Are deployed skills having impact? |
| `coach.knowledge-to-action-latency` | continuous | daily | How fast do I act on findings? |

### Optimizer — Tool & Workflow Builder
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `optimizer.tool-adoption` | continuous | daily | Are agents using what I build? |
| `optimizer.analysis-accuracy` | continuous | daily | Are my diagnoses correct? |
| `optimizer.quality-preserved` | health | slow | Am I preserving quality while optimizing? |

### Scout — Explorer
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `scout.hypotheses-generated` | continuous | daily | Am I synthesizing, not just summarizing? |
| `scout.findings-used` | continuous | slow | Is my research actionable? |
| `scout.coverage` | health | fast | Am I scanning regularly? |

### Coder, Evaluator, QA (unchanged)
| Agent | Metrics |
|-------|---------|
| Coder | `quality`, `first-pass-rate` |
| Evaluator | `calibration`, `coverage` |
| QA | `review-coverage`, `false-positive-rate` |

## Submit for Hao's review. Replace the current metric-tension-pairs.md.
