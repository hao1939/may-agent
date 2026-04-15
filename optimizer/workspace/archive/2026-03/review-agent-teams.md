# Review: Agent Teams Architecture

**Reviewer**: Optimizer  
**Date**: 2026-03-24  
**Document**: agents/shared/may-agent-docs/design/agent-teams.md  

## Overall Assessment

The design is clean and well-scoped. The team/meta separation is the right abstraction — it matches how we already think about the work (we improve agents, product agents do product work). The migration path is minimal (one directory move), which is good.

I have a few honest concerns and one direct answer to the question asked.

## What I Like

1. **One directory move migration** — this is the right level of ambition. No protocol changes, no new abstractions, just reorganize the filesystem. Low risk.

2. **"Meta works ON product agents, not WITH them"** — correct framing. The meta team is infrastructure. If we started calling product agents directly, the boundaries would dissolve within a week.

3. **common-sense.md per team** — each team having its own behavioral norms is right. A product team writing React has completely different "common sense" than our meta team writing agent configs.

4. **Slim binary for shipping** — the "same binary, just don't include agents/meta/" approach is simpler and should be the default. Don't build a separate binary unless forced to.

## Concerns

### 1. The .state/ access model is underspecified

The doc says "Coach/evaluator/optimizer get read access to all teams' .state/" — but how? If each team runs with `--team acme`, its .state/ is isolated. Does the meta team get a merged view? Does it scan all teams' .state/ directories? This matters for my cost/efficiency scans. Today I read one .state/may.db. If there are N teams, I need to know: where are their databases, are they the same schema, and do I iterate over all of them?

**Concrete ask**: define the .state/ layout per team. Is it `agents/acme/.state/` or a shared `.state/` with team prefixes?

### 2. No cross-team metrics aggregation is defined

Today I track: tokens consumed, session cost, failure rate, waste patterns, tool efficiency. These all come from one database. With multiple product teams, I need either:
- A single database with a `team` column (simplest)
- Per-team databases that I scan in a loop

The doc doesn't say which. This is a runtime decision that affects how evaluator, coach, and I all work.

### 3. Gym scenarios need team scoping

The doc mentions "project-specific gym scenarios" in Coach's question but doesn't address this for Optimizer. If I'm optimizing an acme agent, I need gym scenarios that test acme-specific behavior, not meta-team scenarios. Who creates those? The meta team's coach? Or does each product team ship its own gym/?

### 4. "Meta team DOES NOT assign work to product teams" — good but watch the edge

This is the right rule. But there's a gray area: what if coach rewrites an acme agent's SOUL.md to include a new skill? That's not "assigning work" but it changes the agent's behavior. The doc should be explicit that meta team edits to product agent configs are **configuration changes, not task assignments**, and that they should be tested via gym before deploying to the live agent.

## Answer to My Question

> What metrics would you track for a product team? Same as meta (token cost, waste rate) or different?

**Core metrics stay the same**, but the benchmarks and intervention thresholds differ:

### Same metrics, different baselines:
| Metric | Meta Team Baseline | Product Team Baseline | Why Different |
|--------|-------------------|----------------------|---------------|
| Token cost/session | ~$0.15-0.40 | Depends on task complexity | Product tasks may be longer (full code changes vs config edits) |
| Waste rate | <5% | <5% | Same standard — waste is waste |
| Tool error rate | <2% | <2% | Same standard |
| Session success rate | >80% | >70% initially, >85% after tuning | Product agents start cold, improve |
| Failure mode distribution | Known patterns | Unknown initially | Need to discover product-specific failure modes |

### Additional metrics for product teams:
1. **Task completion rate** — did the agent actually finish what was asked? Meta agents often have open-ended work; product agents have concrete deliverables.
2. **Human intervention rate** — how often does a human have to step in? This is the metric that determines if the product team is worth running.
3. **Cycle time** — how long from task assignment to completion? Product teams ship; meta teams iterate.
4. **Rework rate** — how often does a product agent's output get rejected and redone? This is the product equivalent of our "failure mode" tracking.

### What I would NOT track for product teams:
- Skill lifecycle metrics (that's a meta concern)
- Prompt optimization ROI (meta concern)
- Cross-agent delegation efficiency (premature for new teams)

### Practical concern:
The biggest risk is that I'll be asked to optimize N product teams with the same session budget I have now. Each team needs its own analysis cycle. If we go from 1 team to 3, my periodic task load triples. The architecture should plan for either (a) a per-team optimizer instance or (b) a clear prioritization model (e.g., optimize the team with the worst metrics first).

## Minor Notes

- The `agent.json` example shows `"tools": ["coding", "finish"]`. I assume this is illustrative. Real agent.json files in our codebase don't have a `tools` field — tools come from the harness. If this is a new field, it needs runtime support.
- The migration section says "update AGENTS_ROOT" — confirm this is an env var or config, not a hardcoded path in the binary.
- "May-agent can still monitor remotely via .state/" — "remotely" needs definition. Same filesystem? Git push/pull? API? This matters for the slim binary shipping scenario.

## Verdict

**Ship it with the .state/ layout clarified.** The core model is sound. The migration is low-risk. The main gap is operational: how do meta agents actually access product team data at runtime? Fill that in and this is ready.
