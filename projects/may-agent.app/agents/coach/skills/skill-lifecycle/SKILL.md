---
name: skill-lifecycle
description: Use when discovering, creating, evaluating, refining, promoting, or retiring May-agent skills. Requires evidence lineage, correct skill scope, valid frontmatter, realistic comparison, owner review, and later behavior validation.
---

# Skill Lifecycle

Treat a skill as a compact operating guide, not a place to copy design docs or
archive research. The governing learning loop is:

```text
session evidence -> reviewed finding -> candidate -> experiment -> owner decision -> later validation -> keep, revise, or retire
```

The root event and trace remain the work commitment. Do not create a separate
skill-request lifecycle.

## Scope

Choose one owner and the narrowest useful location:

- `shared/skills/<name>/SKILL.md` for behavior reused across owners;
- `agents/<owner>/skills/<name>/SKILL.md` for a global agent;
- `projects/<id>.app/agents/<owner>/skills/<name>/SKILL.md` for app-local work.

Do not use `agents/shared/skills/`; it is not the active shared-skill path.
Archived skills are evidence only and must not be treated as deployable.

## Lifecycle

### 1. Discover

Start from raw sessions, evaluations, human corrections, repeated tool failures,
or project evidence. Record:

- the concrete behavior gap;
- affected owners and scope;
- representative session/trace/evidence references;
- why an existing design, workflow, tool, or skill does not already solve it.

Prefer a structural code/workflow fix when the behavior should not require model
judgment. Create a skill when reusable procedural knowledge is the missing piece.

### 2. Draft

Use only `name` and `description` in YAML frontmatter. Put all trigger conditions
in the description because that is what skill discovery sees.

Write the body in imperative language. Keep only:

- the core decision or protocol;
- important owner/boundary rules;
- a small number of failure patterns;
- verification criteria.

Link to canonical May-agent design docs instead of copying event schemas, task
states, tool inventories, or runtime commands that can drift. Keep `SKILL.md`
under 500 lines; target 50-150 lines. Put genuinely reusable detail in a
one-level `references/` file only when needed.

### 3. Validate Structure

Run the bundled TypeScript validator:

```bash
bun projects/may-agent.app/agents/coach/skills/skill-lifecycle/scripts/validate-skill.ts <skill-directory>
```

Fix invalid frontmatter, folder/name mismatches, and placeholder content before
behavior testing.

Prefer JavaScript/TypeScript and Bun for skill scripts in this repository.
Use another language only when an existing required tool has no maintained
JavaScript/TypeScript equivalent.

### 4. Test Behavior

Use a realistic task that can succeed or fail based on the skill. Compare a
baseline without the candidate against the candidate under the same task and
environment. Check current gym tooling before invoking it; do not copy commands
from stale notes when the referenced runner does not exist.

For important or stochastic behavior, use multiple runs. Grade against raw
artifacts or transcripts, not the author's summary. When independent subagent
testing is unavailable or disallowed, use the strongest permitted alternative
and record that limitation rather than claiming an independent result.

### 5. Review And Promote

The responsible owner decides whether evidence supports promotion. Promotion
requires:

- better task outcome or process evidence than baseline;
- no material regression in adjacent behavior;
- correct scope and no duplicate skill;
- concise content whose instructions were actually followed;
- an explicit later-validation signal.

Existence does not prove discoverability. Confirm the target runtime can find
the skill and that any agent-local routing points to the active path.

### 6. Measure

Use later session/evaluation evidence to ask:

- Was the skill discovered when its trigger occurred?
- Did the agent follow the useful steps?
- Did the targeted failure recur less often?
- Did the skill add delay, noise, false certainty, or over-constraint?

Treat metrics as signals requiring owner judgment, not automatic promotion or
retirement decisions.

### 7. Refine Or Retire

Change one behaviorally meaningful element per refinement when practical, then
re-test. Retire a skill when the failure is structurally fixed, the guidance is
unused, another skill owns the same decision, or evidence shows regression.

Move retired material under an archive with a short reason and replacement
pointer. Do not leave active discovery links pointing at retired content.

## May-Agent Alignment Checklist

- Preserve `event -> owner routing -> judgment -> evidence -> state update -> follow-up`.
- Represent human work with `human.input.received`, one semantic intent, and a
  trace—not a parallel request object.
- Use V3 app paths and the five task-tree states.
- Use canonical project events; label legacy aliases only as compatibility.
- Use the `agents` tool for call/fork and the separate `message` tool for async
  communication.
- Return local workflow blockers to the caller; emit escalation only across an
  owner boundary.
- Verify claimed closure, delivery, and later behavior with durable evidence.

## Completion Evidence

Report the skill path, motivating evidence, structural validation result,
behavior-test result, owner decision, and any untested or deferred validation.
