---
name: brainstorm-before-build
description: >
  Use when doing any creative work — designing features, choosing approaches,
  creating new components, modifying system behavior. Forces exploration of the
  design space before committing to an approach. Prevents the most common agent
  failure: jumping to the first solution without considering alternatives.
version: 1.0.0
owner: coach
inspired_by: obra/superpowers brainstorming skill
---

# Brainstorm Before Build: Explore Design Space First

## When to Apply

Apply this skill **before any creative or design work**:
- Designing a new feature or component
- Choosing an architecture or approach
- Modifying existing system behavior
- Creating a plan that involves non-trivial decisions
- Writing a design doc

**Even "simple" tasks benefit.** The most wasted work comes from unexamined
assumptions on tasks that seemed straightforward.

## The Iron Law

```
NO IMPLEMENTATION WITHOUT EXPLORING AT LEAST 3 APPROACHES FIRST
```

If you've only considered one approach, you haven't designed — you've guessed.

## Steps

### Step 1: UNDERSTAND (gather context before brainstorming)

Before generating ideas, understand what exists:

```
1. Read relevant existing code/docs (use grep-first-reading)
2. Identify constraints: what MUST be true? what CANNOT change?
3. Identify goals: what problem are we solving? for whom?
4. Note patterns: how does the existing system do similar things?
```

Don't brainstorm in a vacuum. Solutions that ignore existing patterns create
integration nightmares.

**Why**: Agents routinely propose designs that conflict with existing architecture
because they didn't read the codebase first. 5 minutes of reading saves hours
of rework.

### Step 2: DIVERGE (generate 3+ approaches)

Generate **at least 3** meaningfully different approaches:

```
Approach A: [description]
  Pros: ...
  Cons: ...
  Risk: ...

Approach B: [description]
  Pros: ...
  Cons: ...
  Risk: ...

Approach C: [description]
  Pros: ...
  Cons: ...
  Risk: ...
```

Rules for divergent thinking:
- **Quantity over quality** in this phase. Bad ideas often inspire good ones.
- **Include at least one "weird" option** — the unconventional approach you'd
  normally dismiss. Sometimes it's the best one.
- **Include "do nothing"** if applicable — sometimes the best design is not
  building the thing at all.
- **Each approach must be genuinely different**, not minor variations of the same
  idea. "Use Redis" vs "Use Memcached" is one approach with two implementations.

**Why**: The first solution an agent generates has a ~40% chance of being the best
one. By generating 3+, you dramatically increase coverage of the design space.
The best solutions often come from combining elements of different approaches.

### Step 3: EVALUATE (compare trade-offs)

For each approach, assess against these dimensions:

| Dimension | Question |
|---|---|
| Complexity | How much code/effort does this require? |
| Consistency | Does this match existing patterns in the codebase? |
| Reversibility | How hard is it to change this later? |
| Risk | What could go wrong? What's the blast radius? |
| YAGNI | Are we building more than we need right now? |

**Rank the approaches.** State your recommendation and reasoning clearly.

### Step 4: DECIDE (pick one, write it down)

Select an approach and document it:

```markdown
## Decision: [Approach X]

**Chosen because:** [1-2 sentences]
**Rejected alternatives:**
- Approach Y: rejected because [reason]
- Approach Z: rejected because [reason]
**Key risks and mitigations:** [what could go wrong, how we'll handle it]
```

If working with a human or manager, present your recommendation and reasoning.
Don't just ask "which one?" — lead with your best judgment.

### Step 5: VERIFY (design sanity check)

Before implementing, verify the design:

1. **Constraint check**: Does the design satisfy all identified constraints?
2. **Consistency check**: Does it follow existing patterns?
3. **Scope check**: Is it focused enough for a single implementation?
4. **Ambiguity check**: Could any part be interpreted two ways? Make it explicit.

## Anti-Patterns

### AP-1: Jumping to Implementation
**Pattern**: Agent reads the task, immediately starts coding the first solution
that comes to mind. No alternatives considered.
**Fix**: Force yourself through Steps 1-4 before writing any code. Write the
approaches down — thinking "I considered alternatives" without writing them
doesn't count.

### AP-2: Fake Alternatives
**Pattern**: Agent generates 3 "approaches" that are really the same idea with
trivial variations. "Use a Map" vs "Use an Object" vs "Use a dictionary" — these
are the same approach in different syntax.
**Fix**: Each approach should have different trade-offs. If the pros/cons of two
approaches are identical, they're not different approaches.

### AP-3: Analysis Paralysis
**Pattern**: Agent generates 5+ approaches, spends excessive time comparing them,
never commits. The brainstorming phase consumes the whole session budget.
**Fix**: Brainstorming should be 10-20% of total session time. Set a mental
timebox. 3 approaches is usually enough. If no clear winner after evaluation,
pick the simplest one — you can always iterate.

### AP-4: Ignoring Existing Patterns
**Pattern**: Agent brainstorms in isolation without reading the codebase, proposes
a design that contradicts existing architecture.
**Fix**: Step 1 (UNDERSTAND) is not optional. Read the relevant code before
generating approaches. Your approaches should build on existing patterns, not
ignore them.

## Assertions

1. Before any implementation work, the agent generates at least 3 meaningfully different approaches with trade-offs.
2. The agent reads relevant existing code/docs before brainstorming (Step 1).
3. Each generated approach has distinct pros, cons, and risks — not trivial variations of the same idea.
4. The agent explicitly selects an approach with documented reasoning before proceeding to implementation.
5. The brainstorming phase does not exceed 20% of the session's total tool calls (preventing analysis paralysis).

## When to Skip

This skill can be abbreviated (but not skipped entirely) when:
- The task is purely mechanical (e.g., "rename X to Y everywhere")
- The approach is dictated by an existing design doc or plan
- You're following a pre-approved implementation plan

Even in these cases, briefly consider: "Is there a better way?" If yes,
brainstorm. If genuinely no, proceed.
