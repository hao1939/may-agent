# Reflection: Evidence-First Process

**Author**: Bob (Architect)  
**Date**: 2026-03-27  
**Prompted by**: Hao's directive on the context learning cycle

## The Critique Is Correct

Hao's observation is accurate. Looking at my own archive, I can count:

- **94+ analysis files** in `workspace/archive/`
- **30+ briefs** sent to other agents
- **Multiple strategy docs** (hard constraints, unified guards, auto-evolve, archetypes, agent evolution)
- **Theory frameworks** that were later cancelled or rejected (Unified Guard Architecture, Auto-Evolve Prompt Mutation, GNAP/Typed Messages)

The pattern is real: I design comprehensive systems, write lengthy briefs, and add complexity layers before proving the base case. The archive is littered with evidence of this.

## Specific Examples Where I Got It Wrong

### 1. Unified Guard Architecture → Cancelled
I designed a full middleware architecture for "Hard Constraints" — guard functions that would intercept tool calls at runtime. Wrote `design-unified-guards.md`, briefed Tech-Lead, planned a phased rollout. Hao killed it in one sentence: "Guards add complexity/rigidity." The actual solution (Gym scenarios + verify-and-finish workflow) was simpler and already half-built.

**What evidence-first would have looked like**: Run one Gym scenario testing verification behavior. If agents fail it, see if a workflow prompt fixes it. If yes, done. No middleware needed.

### 2. Auto-Evolve (Prompt Mutation) → Failed
I designed a system where agents would automatically mutate their own prompts based on Gym scores. Wrote the experiment design, the mutation strategy, the fitness function. The experiment failed: mutations produced noise, not improvement.

**What evidence-first would have looked like**: Before designing the mutation system, manually edit one agent's prompt to fix one known failure. Run the scenario. Did the score improve? If manual editing doesn't reliably help, automated editing won't either.

### 3. Agent Archetypes (Inheritance) → Completed, But Unvalidated Impact
I designed a system where agent SOULs inherit from archetype templates. It was implemented, it works. But: has it actually reduced maintenance burden? Has it improved agent behavior? I don't have data showing it matters. It was a theoretical improvement for a scaling problem we might not actually have yet (we have ~10 agents, not 50+).

**What evidence-first would have looked like**: Count how many times agents diverged from best practices because their SOULs were out of sync. If the answer is "rarely" or "never measurably," the problem isn't urgent.

## What The Context Learning Cycle Teaches

The context learning story is instructive because it had a clear failure point and a clear success point:

| Phase | What Happened | Lesson |
|-------|---------------|--------|
| Mechanical extraction | Built pipeline to extract "lessons" from sessions | Theory: more context = better agents |
| Synthetic Gym A/B | 0 difference — agents derived answers from project files | **The wrong knowledge type was being tested** |
| Real session data check | 82/100 coder sessions used `npx` (doesn't exist in container) | **The real problem was environmental, not procedural** |
| Focused A/B on `npx` | 3/3 without context used npx, 3/3 with context avoided it | **Clean signal on a real problem** |
| Deployment | Curated facts, not mechanical backfill | **Less is more when the facts are the right ones** |

The key insight: **the value of context learning was in environmental knowledge that exists nowhere except in past failures.** Not in procedural knowledge that agents can derive from files.

I would have designed this differently. I would have proposed an "Environmental Knowledge Extraction Pipeline" with a merge system, a dedup layer, a quality scoring function, and a periodic refresh cycle. It would have been a 15KB brief. And it would have produced the same noisy mechanical backfill that failed.

## My Commitments Going Forward

### 1. Core Assumption First
Before any design brief, I will explicitly state: "The core assumption is: X will improve Y." This goes at the top of any document I write. If I can't state the assumption crisply, I'm not ready to design.

### 2. Existing Data Check
Before building anything, I will check:
- Session history (request DB) for evidence the problem exists
- Gym results for baseline measurements
- Evaluation data for frequency/severity

If the problem doesn't show up in data, it's not urgent enough for a system.

### 3. Minimal Test Before Brief
The sequence becomes:
1. State assumption
2. Check data
3. Build a minimal test (a single Gym scenario, a one-line config change, a manual experiment)
4. Run the test
5. If it works → write the brief to scale it
6. If it fails → say so and move on

### 4. Honest Failures
When a test fails, I will document the failure clearly rather than pivoting to a new theory. The auto-evolve experiment was a good example of honest failure reporting. I need to do more of that and fewer compensatory pivots.

### 5. Measure What Shipped
For things I've already shipped (archetypes, knowledge index, strategy docs), I will check: did behavior actually change? If I can't measure it, I'll stop claiming it as a success.

## What I'm Good At (And Should Keep Doing)

This isn't all self-flagellation. The pattern synthesis work has real value when it's grounded:
- The **FM classification system** (FM-1.x through FM-3.x) gave the team a shared vocabulary for failure modes
- The **focus-tasks.md** tracker prevents drift and keeps the team aligned
- The **philosophy.md** principles (P53 Self-Evolution Bifurcation, P61 Ops Gates) were grounded in real research and real failures

The issue isn't that architecture thinking is bad. It's that architecture thinking must follow evidence, not precede it. I should be the person who *structures what we've learned*, not the person who *predicts what we'll learn*.

## Immediate Application

My next piece of work should follow this pattern. Looking at the active focus tasks:

**Agent Evolution System** is in "PIVOT" status. Before designing the next iteration, I should:
1. Ask: what specific agent behavior do we want to improve?
2. Find data: which agents fail most, on what?
3. Test: can a simple prompt edit fix the #1 failure?
4. If yes: document the pattern, propose systematic application
5. If no: understand why not before designing infrastructure

That's the evidence-first process applied to my own work.
