# Agent Evolution System — Design Brief for Bob

**Status: DRAFT — needs Bob's architectural review and system design**

## The Problem

How do agents get better over time? Today we have pieces — coach runs growth cycles, optimizer trims waste, evaluator scores sessions — but no coherent system. Agents accumulate rules (SOUL.md grew to 15KB), nobody removes dead weight, nobody knows which improvements actually worked, and there's no way to measure "is this agent better than last week?"

## What "better" means

An agent is better when it:
- **Succeeds more often** at its tasks (gym pass rates, evaluation scores)
- **Fails less often** in known ways (error log patterns, convention violations)
- **Costs less** per unit of useful work (tokens per successful session)
- **Handles new situations** it couldn't before (new scenarios passing)

All four are measurable. The gym tests behavior. Evaluations score quality. Cost data shows efficiency. The question is: how to systematically improve all four.

## What we learned from the coder prototype

We slimmed coder's SOUL.md from 7.8KB to 2.4KB. Gym baseline before and after: identical (10/13 pass). This taught us:

1. **Measure first, change second.** Without the baseline, we'd have no idea if the slim caused regressions. The gym baseline is the foundation.

2. **One change at a time.** We only changed SOUL.md. If we'd also changed the prompt loader and common-sense.md simultaneously, we couldn't attribute effects.

3. **The gym is CI for agents.** Same principle as code tests — change something, run the suite, ship if green.

4. **Agents can self-apply.** Scout read the design doc and started slimming its own SOUL.md. The process documentation IS the instruction.

5. **Most accumulated rules are redundant.** Coder lost 69% of its SOUL.md with zero behavioral regression. The rules were duplicated or unenforced.

## The evolution loop

Every agent improvement follows:

```
Detect → Hypothesize → Baseline → Apply → Measure → Compare → Ship or Revert
```

This is the same loop for ANY kind of improvement:
- Coach adding a skill
- Optimizer removing dead rules
- Human redesigning an agent's role
- Automated prompt pruning
- Configuration tuning (opBudget, intervals, thresholds)

## What needs to be designed

### 1. The measurement system

We have pieces: gym scenarios, evaluations, cost tracking. They need to be unified into a coherent picture of "how good is this agent?"

**Questions for Bob:**
- What's the agent health metric? A single score combining gym pass rate + eval quality + cost efficiency?
- How do we track improvement over time? (Today: stats.db for gym, evaluations table for quality. Not connected.)
- What's "good enough"? When does an agent stop needing improvement?

### 2. The scenario system

81 scenarios exist but coverage is uneven (75 test coder only). Scenarios are the test suite for agent behavior.

**Questions for Bob:**
- How do we map scenarios to behaviors? (Which scenarios test C1.1 read-before-edit? Which test delegation?)
- How do we know when coverage is sufficient?
- Who creates regression scenarios vs improvement scenarios?
- How do we maintain scenario quality? (Criteria bugs, flaky tests, too-easy/too-hard)
- Should each agent have a required scenario suite that must pass before any change ships?

### 3. The improvement pipeline

Today: coach detects gap → growth cycle → promote. This works for behavioral fixes. But there's no equivalent for:
- Prompt optimization (removing bloat, restructuring)
- Configuration tuning (opBudget, intervals)
- Skill curation (which skills are worth keeping in the prompt?)
- Role evolution (agent's responsibilities change over time)

**Questions for Bob:**
- Should there be one pipeline or separate pipelines for different improvement types?
- How do coach and optimizer coordinate? (Today they sometimes step on each other)
- What's the handoff between "human has an idea" and "agent implements and verifies it"?
- How does the system handle competing improvements? (Coach wants to add a rule, optimizer wants to remove one)

### 4. The prompt as a living document

The prompt is the agent's "mind." Today it accumulates cruft because there's no pruning discipline. The slim process showed 69% of rules were dead weight.

**Questions for Bob:**
- What's the governance model for common-sense.md? (Gym-gated? Human-approved? Both?)
- How does SOUL.md stay slim over time? (Coach adds skills, someone needs to prune)
- Should there be a "prompt health" metric? (Size, duplication ratio, rule coverage)
- How do we prevent re-accumulation after cleanup?

### 5. Agent-specific evolution

Each agent has different improvement needs:
- **Coder**: Needs better at edge cases, error recovery
- **Scout**: Needs to handle empty data gracefully, manage research scope
- **Coach**: Needs to verify its improvements actually work (meta-improvement)
- **Optimizer**: Needs to avoid over-optimizing (removing things that matter)
- **Bob**: Needs to keep designs practical (not over-abstract)

**Questions for Bob:**
- Should each agent have an "evolution plan" — specific areas to improve?
- How does the gym scenario suite grow with the agent's capabilities?
- What's the feedback loop from production (real sessions) back to the gym (test scenarios)?

## Design docs to review

All in `agents/shared/may-agent-docs/design/`:

| Doc | What it covers |
|-----|---------------|
| `prompt-simplification.md` | 10 files → 3, gym as gate for rule changes |
| `agent-improvement-workflow.md` | The universal detect → baseline → apply → measure loop |
| `agent-improvement-details.md` | Coverage gaps, cost tiers, scenario quality, human override |
| `gym-benchmarks.md` | Per-agent scenario selection, baseline procedure |
| `agent-evolution-process.md` | Step-by-step recipe (used for coder prototype) |

## What Bob should deliver

1. **Architecture doc**: The agent evolution system design — measurement, scenarios, pipeline, prompt governance, per-agent evolution. How all the pieces fit together.

2. **Scenario system design**: Coverage model, categories, quality gates, per-agent suites, design process. This is the foundation — without good scenarios, the gym is meaningless.

3. **Coordination plan**: How coach, optimizer, and human interact in the evolution loop. Who does what, when, handoff protocol.

4. **Brief to coach and optimizer**: What changes in their workflow. What they should start doing differently. Reference the design docs.

## Constraints

- **Gym cost**: ~$1.50 per smoke run, ~$7 per standard. Budget for systematic evolution.
- **Agent self-modification**: Agents can read these docs and self-apply (scout already did). Design for that.
- **Human bandwidth**: Hao reviews periodically, not continuously. The system must be mostly autonomous with human oversight via daily digest and Benchmarks tab.
