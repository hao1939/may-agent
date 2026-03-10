# Journal

Accumulated findings from coaching sessions. Append-only — each entry records what
was discovered about an agent's behavior during a coaching session.

<!-- Entries below this line -->

## 2026-03-10 — 🎓 May Graduation Re-test (Heartbeat 19)

**May GRADUATED — 4th agent, first supervisor.** Score: 15/15 (100%).

### What happened
Ran May graduation re-test after adding `delegate` anti-pattern to LESSONS.md. Seeded 3 todo items: self-executable health check, Scout dispatch (critical test), QA report review. May also discovered and addressed a 4th item (Bob's health tool flaw design).

### Key finding: Single LESSONS.md correction resolved persistent gap
The `delegate` vs `subagents.run` gap persisted across 2 exercises (exercise #3 and graduation attempt). A single line in LESSONS.md — "Never use `delegate` — Always use `subagents.run(agent, task)`" — completely resolved it. May used `subagents.run` for BOTH dispatches (Scout and tech-lead), then polled with `subagents.status` and `subagents.waitFor`.

**Pattern confirmed:** When an agent's behavior gap is _instructional_ (not knowing the rule) rather than _capability_ (unable to follow the rule), a single LESSONS.md entry is sufficient. This is the fastest correction path. The distinguishing signal: May had excellent performance on every OTHER criterion (5/5 on points across 4 exercises), suggesting the gap was narrow and specific.

### Graduation pipeline status
- **4/10 agents graduated**: Coder (2026-03-24), Scout (2026-03-09), QA (2026-03-10), May (2026-03-10)
- **Blocked**: Bob (model-level limitation), Amy (infra), Amy-Kimi (infra), Master (infra)
- **Not started**: Evaluator, Optimizer
- **Next regression reviews**: Coder + Scout (~2026-04-07)

### Methodology note
This graduation confirms that LESSONS.md anti-patterns are effective for narrow behavioral gaps. The correction-to-graduation path for May: identify gap → escalate design question → apply LESSONS.md correction → re-test → graduate. Total elapsed: ~1 day from correction to graduation.

