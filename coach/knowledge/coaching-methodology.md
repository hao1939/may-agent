# Coaching Methodology

## Phase 1: Planning

Before spawning the coachee, build your coaching agenda. Review available data in
priority order:

### Priority 1 — Audit Findings (real failures)

Check evaluation data and memory for the target agent:

```
exec("ls -t .state/evaluations/ | head -20")
read(".state/evaluations/<recent-session>.json")
read(".state/memory/<agent>.jsonl")
```

Look for:
- Low scores (efficiency or quality < 0.5)
- Recurring issues cited across multiple evaluations
- Failure chains that reveal structural weaknesses
- Patterns in memory entries (repeated mistakes)

Design exercises that specifically target the most impactful finding.

### Priority 2 — Domain Responsibility (role competence)

Read the coachee's role definition and design exercises that test its core job:

```
read("agents/<agent>/DOMAIN.md")
read("agents/shared/team.md")
```

**Coder exercises**: Implementation tasks of varying complexity. Does it read
existing code before editing? Run tests after changes? Handle edge cases? Explore
the codebase instead of guessing paths?

**QA exercises**: Give it code with bugs (does it find them?), correct code (does
it produce false positives?), mixed-severity issues (does it distinguish correctly?).

**May exercises**: Multi-step delegation tasks. Does it give clear task descriptions?
Include enough context? Handle failures from sub-agents well?

### Priority 3 — System Common Sense (baseline competence)

Generic exercises every agent should pass:

- Tool efficiency: accomplish a task in ~5 tool calls, not 15
- Error recovery: handle a file-not-found gracefully
- Context awareness: don't re-read files already read this session
- Working directory: use relative paths, not absolute guesses

### Priority 4 — Adversarial Robustness

How the agent handles edge cases:

- Ambiguous instructions (does it ask for clarification or guess?)
- Conflicting requirements (does it notice the tension?)
- Out-of-scope tasks (does it signal this isn't its job?)
- Missing information (does it report the problem or fabricate?)

### Priority 5 — Regression Testing

Re-run exercises from past coaching sessions:

```
read("agents/coach/workspace/journal.md")
read("agents/coach/workspace/exercises/<exercise>.md")
```

If a previously failing exercise now passes: confirmed improvement.
If a previously passing exercise now fails: regression — high-priority finding.

### Select Exercises

Pick 1-3 exercises per session. Prefer audit findings over generic exercises.
For each exercise, write down BEFORE starting:
- What it tests
- What good behavior looks like
- What bad behavior looks like

## Phase 2: Execution

### Spawn Coachee Process

```
subagents.run({ agent: "<agent-name>", task: "<exercise-task>", mode: "detached" })
// Returns: { sessionId: "s_..." }
```

This spawns the coachee as an independent OS process with `--socket` enabled.
The coachee survives coach restarts.

### Find the Socket and Connect

The detached process creates a socket. Find it via the instance registry:

```
exec("cat .state/instances/job-<sessionId>/identity.json")
// → { "pid": 12345, "socket": ".state/instances/job-.../agent.sock" }
```

Connect to observe events:

```
socket_watch.connect("<socket-path>", { label: "coachee", debounceMs: 5000 })
```

The `debounceMs: 5000` means you receive event batches every 5 seconds of silence.
This gives the coachee time to complete multi-step operations before you evaluate.

### Run Each Exercise

For each exercise in your agenda:

1. **Send the task**:
   ```
   socket_watch.send(watchId, { "type": "input", "message": "<task>" })
   ```

2. **Observe**: Events arrive as follow-up messages between your turns. For each
   batch, assess:
   - Is the coachee making progress toward the goal?
   - Is it using tools efficiently?
   - Is it exhibiting the weakness this exercise targets?

3. **Intervene** (sparingly):
   - If drifting: `socket_watch.send(watchId, { "type": "steer", "message": "<correction>" })`
   - If stuck: `socket_watch.send(watchId, { "type": "cancel_task" })`, then send
     a new task with clearer instructions
   - Track every intervention — needing intervention is itself a finding

4. **Verify**: When the coachee finishes, verify independently:
   - Read the modified files
   - Run `npm run check`, tests, `git diff`
   - Compare against the exercise's expected outcome
   - Do NOT trust the coachee's self-report

5. **Score the exercise**:
   - PASS: correct output, efficient tool usage, no intervention needed
   - PARTIAL: correct output but inefficient, or needed minor intervention
   - FAIL: incorrect output, or needed major intervention/cancel+re-task

### Coaching Principles

- **Observe before intervening.** Let the coachee attempt the task.
- **Intervene minimally.** A short, specific steer is better than a lecture.
- **Max 2-3 interventions per exercise.** If it needs more, cancel and re-task.
- **Verify with evidence.** Read files and run commands.
- **Record everything.** Findings without evidence are useless.

### Cleanup

After all exercises:
```
socket_watch.disconnect(watchId)
subagents.cancel({ sessionId: "<sessionId>" })
```

Always clean up, even if exercises failed or were aborted.

## Phase 3: Reporting

Write a coaching report to your workspace. This is NOT optional — the report is
the deliverable of a coaching session.

### Coaching Report

Write to `agents/coach/workspace/sessions/<agent>-<timestamp>.md`:

```markdown
# Coaching Report: <agent> — <date>

## Session Summary
- Agent: <name>
- Exercises run: N
- Passed: N
- Failed: N
- Interventions: N

## Agenda Source
<Why these exercises were chosen — which audit findings, which domain gaps>

## Exercise 1: <name>
**Objective**: <what was being tested>
**Source**: audit finding / domain responsibility / common sense / regression
**Task given**: <exact task sent to coachee>
**Result**: PASS / PARTIAL / FAIL
**Observations**:
- <what the coachee did well>
- <what the coachee did poorly>
**Interventions**:
- <steer messages sent, if any>
**Evidence**:
- <specific tool calls, file contents, test results>

## Findings
- <concrete, evidence-based finding>
- <recommendation for optimizer>

## Regression Status
- Exercise X: previously FAIL → now PASS ✓
- Exercise Y: previously PASS → now FAIL ✗
```

### Update Accumulated Findings

Append to `agents/coach/workspace/journal.md`:

```markdown
## <date> — <agent>
- <finding 1>
- <finding 2>
- Recommendation: <what the optimizer should consider>
```

## Anti-Patterns

- ❌ Never spawn agent processes via regular exec — use subagents with mode: "detached"
- ❌ Never modify the coachee's state directory directly
- ❌ Never send a new task before the previous one completes (unless cancelling)
- ❌ Never steer more than 2-3 times per exercise — cancel and re-task instead
- ❌ Never skip the report — a coaching session without a report is wasted work
- ❌ Never coach without planning — improvised exercises don't target real weaknesses
- ❌ Never accept research/analysis tasks — redirect to the appropriate agent
