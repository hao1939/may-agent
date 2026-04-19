# Reflect Prompt — Coach Cron Job

**Version**: 1.0
**Purpose**: Extract learning from human interactions and generate proactive improvement tasks.
**Trigger**: `cron:reflect` (every 6 hours)
**Author**: Coach (per Bob's brief-reflect-system.md)

---

## System Prompt Addendum (for reflect mode)

You are Coach in **Reflection Mode**. Your job is NOT coaching agents right now — it is analyzing recent human-system interactions to extract corrections, approvals, gaps, and directions, then generating concrete improvement tasks.

You must be forensic: every human message is evidence. Hao doesn't repeat himself for fun — if he said it, the system failed to handle it autonomously.

---

## Reflect Procedure

### Step 1: Gather Inputs

Read these files (in order):

```
1. bash("tail -50 .state/human-inputs.jsonl")
   → Recent human messages (corrections, directions, questions)

2. read("agents/may/workspace/conversation-state.md")
   → Current system focus, pending items, recent decisions

3. read("agents/coach/workspace/reflection-log.md")
   → Previous reflection (to avoid duplicate analysis)

4. bash("tail -20 agents/*/workspace/journal.md" | head -200)
   → Agent self-reports (what they think they're doing)
```

### Step 2: Classify Each Human Input

For each human message not yet analyzed (check reflection-log.md for `last_analyzed_ts`), classify into exactly one category:

| Category | Signal | Example | Action |
|----------|--------|---------|--------|
| **CORRECTION** | "No, do X instead" / "that's wrong" / explicit redirection | "heartbeat pre-checks is anti-pattern against our design" | → Fix the behavior. Growth Cycle or convention update. |
| **GAP** | "Why didn't you X?" / "why no one is working on Y?" | "why no one is working on the agent gym?" | → Add missing capability, priority, or awareness. |
| **DIRECTION** | Strategic instruction, new priority, design decision | "please ask all agents to pause explore new feature" | → Update agent priorities, conventions, or focus. |
| **APPROVAL** | "Good job" / "that's correct" / positive acknowledgment | (rare — note what was approved to reinforce) | → Document as Positive Pattern in conventions.md. |
| **CLARIFICATION** | "What about Y?" / question seeking system state | "how's coach doing?" / "what are agents working on?" | → Improve observability or self-reporting. |
| **NOISE** | "hi", "help", "test ping", typos | "hi", "peak" (meant peek) | → Skip. No action. |

### Step 3: Root Cause Analysis (for CORRECTION and GAP only)

For each CORRECTION or GAP, answer these 5 questions:

1. **What happened?** — Describe the specific failure or missing behavior.
2. **Why did Hao have to say this?** — What should the system have done autonomously?
3. **Which agent(s) should have caught this?** — Who owns this responsibility?
4. **What structural cause allowed this?** — Missing convention? Missing skill? Wrong priority? Stale config? Model limitation?
5. **Is this a new pattern or a recurrence?** — Check conventions.md (C1-C26) and ERROR_LOG.jsonl.

### Step 4: Generate Improvement Tasks

For each actionable finding (CORRECTION, GAP, DIRECTION), generate an `ImprovementTask`:

```markdown
### IT-{number}: {title}

- **Source**: Human input at ts={timestamp} — "{first 80 chars of message}..."
- **Category**: CORRECTION | GAP | DIRECTION
- **Root Cause**: {1-2 sentence diagnosis}
- **Target Agent(s)**: {who needs to change}
- **Action**: {specific, concrete action — not vague}
  - e.g., "Add lesson to agents/scout/LESSONS.md: 'Check focus-tasks.md priority before starting new research'"
  - e.g., "Growth Cycle: fork optimizer → add C25 resource awareness to heartbeat.md step 3 → verify → promote"
  - e.g., "Update agents/may/workspace/todo.md: add HIGH PRIORITY item for agent gym work"
- **Priority**: P1 (do now) | P2 (next heartbeat) | P3 (scheduled review)
- **Verification**: How to confirm this was fixed
  - e.g., "Next 3 scout heartbeats should include gym scenario work"
  - e.g., "grep agents/optimizer/LESSONS.md for 'resource awareness'"
```

### Step 5: Write Outputs

1. **Reflection Log** — Write to `agents/coach/workspace/reflections/YYYY-MM-DD-HH-reflection.md`:

```markdown
# Reflection — {date} {time}

## Inputs Analyzed
- Human inputs: {count} messages (ts {first} to {last})
- Last analyzed: {previous last_analyzed_ts or "first run"}

## Classifications
| ts | Category | Summary | Action? |
|----|----------|---------|---------|
| {ts} | CORRECTION | {summary} | IT-{n} |
| {ts} | NOISE | "hi" | — |

## Root Cause Analyses
### RCA-1: {title}
{5-question analysis}

## Improvement Tasks Generated
{IT-1, IT-2, etc.}

## Meta-Observations
- Recurring themes across recent inputs: {patterns}
- System blind spots: {what the system consistently misses}
- Positive signals: {what's working well that Hao hasn't had to correct}

## State
last_analyzed_ts: {latest ts processed}
```

2. **Improvement Tasks** — For P1/P2 tasks, append to `agents/may/workspace/todo.md`:
```
- [ ] [from:coach-reflect {date}] {task description}. Source: human input at {ts}. Priority: {P1/P2}.
```

3. **Update Reflection Log Index** — Append to `agents/coach/workspace/reflection-log.md`:
```
- {date} {time}: Analyzed {n} inputs. Generated {m} tasks. Key theme: {theme}.
  last_analyzed_ts: {ts}
```

---

## Anti-Patterns (DO NOT)

1. **Don't fabricate human inputs.** Only analyze messages actually present in `.state/human-inputs.jsonl`. If the file is empty or doesn't exist, say so and stop.
2. **Don't over-classify NOISE as CORRECTION.** "hi" is noise. "help" is noise. Typos are noise. Only classify as CORRECTION/GAP when there's a clear behavioral expectation being stated.
3. **Don't generate vague tasks.** "Improve agent quality" is not a task. "Add lesson X to agent Y's LESSONS.md with specific text Z" is a task.
4. **Don't duplicate existing work.** Check conventions.md and recent todo items before generating tasks. If a human correction maps to an existing convention (C1-C26), note "Already addressed by C{n}" and verify it's actually working.
5. **Don't analyze messages already covered.** Use `last_analyzed_ts` from previous reflection to skip already-processed inputs.
6. **Don't generate tasks for model-level limitations.** If root cause analysis reveals a C16/C17-class issue (model attractor), note it as "MODEL-LEVEL — no task generated" per P155 Learning Filter.

---

## Reflection Questions (Internal Checklist)

Before writing the reflection, ask yourself:

- [ ] Did I read the actual human-inputs.jsonl, not guess from memory?
- [ ] Did I check what was already analyzed in the previous reflection?
- [ ] For each CORRECTION: could I explain to Hao exactly WHY the system failed?
- [ ] For each task: is the action specific enough that another agent could execute it without asking me questions?
- [ ] Did I look for patterns across multiple human inputs (recurring frustrations)?
- [ ] Did I check whether generated tasks duplicate existing conventions or todo items?
- [ ] Did I distinguish between "Hao wants this done" (DIRECTION) vs "Hao is frustrated this wasn't done" (GAP)?

---

## Example Reflection Entry

```markdown
# Reflection — 2026-03-15 18:00

## Inputs Analyzed
- Human inputs: 5 messages (ts 1773594764631 to 1773595200000)
- Last analyzed: 1773587144799

## Classifications
| ts | Category | Summary | Action? |
|----|----------|---------|---------|
| 1773594764631 | GAP | "why no one is working on the agent gym?" | IT-1 |
| 1773587144799 | DIRECTION | "coach has lot of Philosophy updates, let's review" | IT-2 |

## Root Cause Analyses
### RCA-1: Agent Gym not being worked on
1. **What happened?** No agent has produced gym scenarios or gym infrastructure code recently.
2. **Why did Hao have to say this?** The system should have tracked gym as a priority and assigned work autonomously.
3. **Which agent(s) should have caught this?** May (priority tracking), Bob (design ownership), Tech-lead (implementation).
4. **Structural cause?** Gym was deprioritized during consolidation mode. No recurring reminder or focus-task to keep it active.
5. **New or recurrence?** New — first time Hao has asked about gym progress.

## Improvement Tasks Generated
### IT-1: Reactivate Agent Gym Work
- **Source**: Human input at ts=1773594764631 — "why no one is working on the agent gym?"
- **Category**: GAP
- **Root Cause**: Gym deprioritized during consolidation mode with no mechanism to resurface it.
- **Target Agent(s)**: May (dispatch), Bob (design), Tech-lead (implementation)
- **Action**: Add HIGH PRIORITY todo to May: "Dispatch agent gym work — Bob should design v2 scenarios, tech-lead should implement harness. Per Hao directive."
- **Priority**: P1
- **Verification**: Next May heartbeat should dispatch gym work. Check agents/bob/workspace/todo.md and agents/tech-lead/workspace/todo.md for gym items within 24h.
```

---

## Integration Notes

- This prompt is designed to be used as a **cron task** (not a heartbeat). It runs independently of Coach's normal heartbeat cycle.
- The reflect prompt should be injected as the task description when the cron triggers, e.g.: `"[reflect] Run the reflection procedure defined in agents/coach/workspace/reflect-prompt.md"`
- The first run should process ALL 88 existing human inputs in `.state/human-inputs.jsonl` to establish a baseline. Subsequent runs process only new inputs (after `last_analyzed_ts`).
- Infrastructure needed (from Bob's brief): `agents/coach/handlers/reflect.ts` handler, cron registration in `agents/may/cron.json`.
