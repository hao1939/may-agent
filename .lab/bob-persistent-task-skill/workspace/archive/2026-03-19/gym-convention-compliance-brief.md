# Design Task: Agent Gym — Convention & Common-Sense Testing

## The Problem

We have an Agent Gym that tests agents against coding scenarios. It measures whether agents can fix bugs, follow instructions, resist manipulation. But it doesn't test whether agents can function as may-agent team members.

An agent that scores 100% on bug-fixing but never calls `finish()`, overwrites files with `write()` instead of `edit()`, ignores its heartbeat, hallucinates tool arguments, burns its entire budget reading files it doesn't need, or claims "tests pass" without running them — that agent is useless in our system.

Two gaps:

1. **Convention compliance**: Do agents follow the mandatory protocols (CONVENTIONS.md, LESSONS.md) when doing real work? Read before edit, verify after acting, finish clearly, escalate when stuck, etc.

2. **Common sense**: Do agents behave like competent team members (common-sense.md)? Acknowledge tasks, plan before acting, handle failures gracefully, manage resources, maintain integrity.

These aren't separate concerns — they're the same thing at different levels. Conventions are the rules; common sense is the judgment to apply them correctly in ambiguous situations.

The documents exist:
- `agents/shared/CONVENTIONS.md` — mandatory protocols (C1-C7)
- `agents/shared/LESSONS.md` — learned rules (C22-C40)
- `agents/shared/common-sense.md` — behavioral fundamentals (7 sections)
- `agents/shared/best-practices.md` — operational patterns

But there's no systematic way to test whether agents actually follow them.

## What We Want

**Design gym scenarios that test convention compliance and common sense together.** Give agents real tasks where success requires not just producing correct output, but working correctly — following protocols, verifying actions, managing resources, escalating appropriately, reporting honestly.

Examples of what this looks like in practice:

- **C1 + 2.3 (Read/verify)**: Agent receives a file to fix. Does it read before editing? Does it verify the edit took effect?
- **C5 + 7.1 (Evidence + honesty)**: Agent is asked to verify something works. Does it actually run the command, or claim "tests pass" without evidence?
- **C30 (Safe appending)**: Agent needs to append to a journal. Does it use `edit()` or `cat >>`, or `write()` and destroy existing content?
- **C40 (Promise-Deliver-Report)**: Agent gets a multi-step task. Does it promise, deliver, then report? Or just start working and trail off?
- **1.5 + 3.3 (Escalation)**: Agent gets an impossible task. Does it recognize and escalate within budget, or spin for 20 turns?
- **6.1 (Budget awareness)**: Agent has limited ops. Does it converge when low, or keep exploring until cutoff?
- **Common sense under pressure**: Agent is told to "fix everything" in a large codebase. Does it scope correctly, or try to refactor the world?

## Design Constraints

### Scoring model
The current scorer (`success_criteria.js`) only receives the work directory path. It checks files on disk. It cannot see the session transcript — it doesn't know *how* the agent worked, only what files resulted.

Convention compliance and common sense are about *process*, not just *product*. Some things can be tested via file state (C30: did the journal get destroyed?). Others require transcript access (C5: did the agent actually run the test? C40: did it state promises before working?).

You need to decide: extend the scorer to receive the transcript? Separate scoring mechanism for behavioral tests? LLM-as-judge? Something else?

### Nondeterminism
LLM agents are noisy. Same agent, same scenario, different behavior each run. Some conventions will be followed 4 out of 5 times. The design needs to handle this — statistical scoring, partial credit, confidence intervals, whatever makes sense.

### Actionable signal
The output must tell us specifically *which* conventions an agent violates and how often. "Agent failed common-sense test" is useless. "Agent violated C30 (safe appending) in 3/5 runs, C5 (evidence) in 2/5 runs" is actionable — Coach can target training, or infra can add guardrails.

### Incremental
Must not require rewriting the existing 30 scenarios. New convention/common-sense scenarios extend the gym; they don't replace what's there.

### Agent runtime scope
Convention compliance only makes sense for may-agent (other runtimes don't have our conventions). But the scenario format should still be clean within the existing adapter pattern.

## What Already Exists

- 30 scenarios in `agents/gym/scenarios/` — bug-fixing, integrity, judgment, reading comprehension
- Runner at `src/gym/runner.ts` with adapter pattern, filtering, batch execution
- Metadata via `scenario.json` (categories, tags, tiers)
- Result recording in `test/gym/stats.db` (via `scripts/gym-record.ts`)
- Gym README at `agents/gym/README.md`

## What I'm NOT Prescribing

Scenarios, schema, scoring architecture — that's your job. Start from the requirement: "test that agents follow conventions and have common sense when doing real work." Design it properly. If the scenario format needs extending, extend it. If the scoring model needs to change, propose that. If some conventions can't be tested via scenarios and need a different mechanism, say so.

Hard constraints:
1. Implementable incrementally — extend the gym, don't rewrite it
2. Actionable per-convention signal — not just pass/fail
3. Concrete enough for tech-lead/coder to implement from your doc

## Deliverable

Write your design to `agents/bob/workspace/gym-convention-compliance-design.md`.

Read these files before designing:
- `agents/shared/CONVENTIONS.md`
- `agents/shared/LESSONS.md`  
- `agents/shared/common-sense.md`
- `agents/shared/best-practices.md`
- `agents/gym/README.md`
- `src/gym/runner.ts`
- `agents/gym/scenarios/phantom-fix/` (example scenario)
