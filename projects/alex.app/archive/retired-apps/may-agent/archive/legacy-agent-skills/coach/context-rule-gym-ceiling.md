# Skill: Context-Rule Gym Ceiling (when gym cannot falsify a per-agent rule)

**TL;DR.** If the behavior you're trying to add via a per-agent `context.md` rule (C1.x) is already encoded at the framework level in `shared/common-sense.md`, the gym will show 100%/100% ceiling regardless of production effect. Gym is not a discriminating test for that class of intervention. Either (a) shadow `common-sense.md` in your lab fork (requires infra change to gym-runner), (b) design a scenario whose **shape** produces the failure without restating the norm in the task text, or (c) accept that this intervention is a **production-only measurement** and monitor via query_db tool instead of gym A/B.

## When this applies

You are deploying a per-agent context rule (adding a line to `agents/<agent>/context.md`) to reinforce a behavior like:
- "run at least one verification command before finish(success)" (C1.6)
- "do not fabricate verification strings like SYNTAX OK" (C1.7)
- "do not pivot scope on ENOENT — finish(blocked) instead" (C1.5)

## Failure pattern (why gym will ceiling)

1. `shared/common-sense.md` already contains the target norm in plain English.
2. `projects/gym/src/cli.ts` injects `common-sense.md` for every agent variant, including your lab fork (e.g. `agents/.lab/coder-no-c16/`) that only shadows `context.md`.
3. Both treatment and control therefore inherit the framework-level norm. The per-agent rule is redundant in gym even if it's load-bearing in production.
4. Result: A/B delta = 0pp, often at 100%/100% — KE-010 ceiling.

## Evidence (`prove-the-loop.md`)

| Iter | Rule | Scenario | OFF / ON | Outcome |
|------|------|----------|----------|---------|
| 4 | C1.6 (post-write verification) | post-write-no-verify | 10/10 / 10/10 | Ceiling — common-sense.md already says "run at least one verification command before finish(success)" |
| 5 | C1.7 (no fabricated verification) | fm33-fabricated-verification | 10/10 / 10/10 | Ceiling — common-sense.md:41 carries the same text |
| 6 | C1.5 (no ENOENT pivot) | fm26-scope-enoent-pivot | 10/10 / 10/10 | Ceiling — once task text forbade pivot/create, both variants handled cleanly |
| 8 | C1.6 (re-test) | — | null | Same structural reason; Iter 8 decision was to wait for production data |

Four consecutive null-signal iterations on context-rule interventions. The stop rule for prove-the-loop triggered at Iter 12 partly because gym cannot adjudicate this class of rule.

## The dilemma (Iter 6, explicit)

For context-rule interventions targeting implicit-norm failures (scope, verification honor), gym scenarios fall into a dilemma:
- **(a)** Task text explicitly states the norm → task itself carries the behavior, rule becomes redundant → ceiling.
- **(b)** Task text leaves the norm implicit → auto-grading becomes ambiguous (is the behavior "wrong" if the task didn't forbid it?) → ungradeable.

This is structural, not a bug in any specific scenario.

## What to do instead

1. **Prefer structural over textual.** Per KE-007, workflow enforcement is the only reliable behavioral intervention (5/56 experiments promoted, all structural). Guards, workflow steps, heartbeat structure, tool presence/absence — not `context.md` lines — are what change behavior durably in gym.
2. **If you must ship a context rule, measure it in production.** Deploy, wait ≥24h, use query_db tool for the target failure-mode tag (e.g. C1.6 → `T2-no-post-write-verification` blockers; C1.5 → scope_violation sessions). Treat gym = 100%/100% as "not informative", not as "shipped successfully".
3. **Or fork `common-sense.md` too.** The Gym CLI supports a `--common-sense <path>` overlay from `projects/gym/src/cli.ts`, enabling clean A/B tests for per-agent rules that duplicate framework text.
4. **Name it honestly in the experiment log.** Do NOT write "deployed successfully" on a 100%/100% gym result. Write "no gym signal — ceiling, production-only measurement" so future coaches (and active-recall) don't re-run the same untestable A/B.

## Linked
- `agents/coach/workspace/projects/prove-the-loop.md` (Iter 4/5/6/8/12)
- `projects/scout-knowledge-lib/reports/shared-ke-001-090-merge-2026-07-09.md` (legacy KE-010 gym ceiling and KE-007 structural-intervention findings)
- `shared/knowledge/entries/KE-123.md` (one change per cycle; don't stack)

## Source
IT-22 / IT-28, reflection 2026-04-18-00. Prior filings: IT-20 (2026-04-17-18 reflection). File-does-not-exist carry-forward resolved this session.
