# Project Workflow Improvement — Journal

## 2026-04-22 — Project Created
- Meta-project: improve the project workflow by experimenting on live projects
- Cycle: observe metrics → design experiment → test on live project → measure → adopt
- First positive signal: rich Current State improved breadcrumb-gap worker quality (1 focused iteration vs 6 confused ones)
- Feature backlog: rich context, reviewer-as-problem-solver, milestone auto-scope, evaluator tuning
- Hook: `## Process Notes` section in project.md for per-project experimental instructions
### Iteration 2 (comment) — 2026-04-22T15:42:03.140Z
**Comment**: - [2026-04-22 hao] Don't just experiment from our own ideas. Ask scout to research how other agent systems handle project orchestration, context management, and reviewer/evaluator patterns. Ask amy-kimi to collect practical tips from Chinese developer communities. External ideas may be better than what we invent ourselves.
- [2026-04-22 hao] When a project gets blocked, that's the BEST time to test a new feature. Zero downside — project is already stuck. If the feature unblocks it, we learned something valuable. If not, no worse than before. Always look for blocked projects as experiment candidates.
**Reviewer**: CONTINUE — Let me first understand the current state of the project.

**(a) Concrete output:** The next iteration should produce:
1. A research request to scout about how other agent systems handle project orchestration, context management, and reviewer/evaluator patterns
2. A research request to amy-kimi for practical tips from Chinese developer communities
3. Identify the worst-performing metric and create an experiment project for it
4. A scan of blocked projects to find experiment candidates

**(b) What's different:** First attempt.

**(c) First step:** Read `.state/metrics.md` and `.state/projects/` directory to understand current metrics and find the worst one, then check for any blocked projects. Specifically: `bash("cat .state/metrics.md 2>/dev/null; echo '---'; ls .state/projects/ 2>/dev/null; echo '---'; cat .state/journal.md 2>/dev/null | tail -50")` — then fork scout and amy-kimi with the research requests from hao's comments, and identify blocked projects as experiment candidates.

