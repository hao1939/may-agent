# Project Workflow Improvement — Journal

## 2026-04-22 — Project Created
- Meta-project: improve the project workflow by experimenting on live projects
- Cycle: observe metrics → design experiment → test on live project → measure → adopt
- First positive signal: rich Current State improved breadcrumb-gap worker quality (1 focused iteration vs 6 confused ones)
- Feature backlog: rich context, reviewer-as-problem-solver, milestone auto-scope, evaluator tuning
- Hook: `## Process Notes` section in project.md for per-project experimental instructions
### Iteration 2 (comment) — 2026-04-23T19:08:28.008Z
**Comment**: - [2026-04-22 hao] Don't just experiment from our own ideas. Ask scout to research how other agent systems handle project orchestration, context management, and reviewer/evaluator patterns. Ask amy-kimi to collect practical tips from Chinese developer communities. External ideas may be better than what we invent ourselves.
- [2026-04-22 hao] When a project gets blocked, that's the BEST time to test a new feature. Zero downside — project is already stuck. If the feature unblocks it, we learned something valuable. If not, no worse than before. Always look for blocked projects as experiment candidates.
**Reviewer**: CONTINUE — The worker echoed comments but didn't act. Time to produce concrete artifacts.

**(a) Concrete output:** Two files:
1. `.state/metrics-analysis.md` — Analysis of current workflow metrics (identify the worst one)
2. `.state/experiments/experiment-002-plan.md` — Experiment plan targeting the worst metric, incorporating external research

**(b) What's different:** First attempt — no previous guidance given.

**(c) First step:** Read `project.md` and `.state/` directory to understand current metrics, targets, and any existing experiment results. Then fork scout to research "how other AI agent systems handle project orchestration and context management" and fork amy-kimi for "practical tips from Chinese developer communities on AI agent workflow optimization." While waiting, analyze existing metrics data to identify the worst-performing metric and draft the experiment plan.

### Iteration 3 — 2026-04-23T19:10:44.530Z
**Worker**: Research agents are working. The deliverables are created. Let me finish.
**Reviewer**: CONTINUE — Good — both files exist with substantive content. The metrics analysis correctly identifies stall-rate as the worst metric and experiment-002 has a concrete plan. These deliverables fulfill the requested output from iteration 2.

Now I need to check: does "Identify worst metric → create experiment project for it" milestone get satisfied?

CONTINUE — Deliverables exist and are substantive. Now convert the plan into an actual running experiment.

**(a) Concrete output:** 
1. `.state/experiments/experiment-002-status.md` — with status changed to ACTIVE, recording the specific blocked projects being used as test subjects
2. Update `.state/metrics-analysis.md` with a "Next Steps" section documenting that stall-rate was identified as worst and experiment-002 targets it

The milestone **"Identify worst metric → create experiment project for it"** is complete — metrics-analysis.md identifies stall-rate (30% vs 20% target) as worst, and experiment-002-plan.md targets it.

**(b) What's different:** Previous iteration produced the analysis and plan. This iteration activates the experiment — find a currently blocked/stalled project, apply the auto-scope intervention to it, and record the before/after.

**(c) First step:** Run `ls .state/experiments/` to see all experiment files, then check for any currently stalled projects by reading the project tracker state (look at `agents/bob/workspace/projects/` for projects with high iteration counts or blocked status) to pick a test subject for experiment-002.

### Iteration 4 — 2026-04-23T19:11:01.864Z
**Worker**: 
