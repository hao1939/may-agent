# Coaching Methodology

## Phase 0: Understand the Agent

Before anything else, understand who the agent is supposed to be.

```
read("agents/<agent>/SOUL.md")    — identity, values, constraints
read("agents/<agent>/DOMAIN.md")  — what they do, how they operate
read("agents/<agent>/TOOLS.md")   — what tools they have
read("agents/<agent>/LESSONS.md") — what they've learned
```

From SOUL.md, extract:
- **Mission**: What is this agent for?
- **Constraints**: What must it never do?
- **Values**: What does it prioritize?
- **Style**: How should it behave?

This is the design intent. Everything else is measured against this.

**If the design intent is unclear** — if SOUL.md is vague, contradictory, or you
can't figure out what "good" looks like for this agent — raise the question.
Write to `agents/may/workspace/todo.md`: "Coach question: <agent>'s SOUL.md is
unclear about X. Need clarification before coaching." Don't guess.

## Phase 1: Evaluate Current Behavior

Before coaching, assess how the agent actually behaves today.

### Read evaluation data

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

### Compare behavior vs design intent

For each finding, ask: does this violate the agent's SOUL?

- Agent blocks in chat → SOUL says "never block" → **gap found**
- Agent re-reads auto-loaded files → LESSONS says K4 → **gap found**
- Agent picks wrong routing → DOMAIN has agent directory → **gap found**
- Agent is slow but correct → may be acceptable if SOUL values correctness over speed

Not every low score is a coaching need. Only gaps between **actual behavior**
and **intended behavior** (as defined in SOUL/DOMAIN) matter.

### Write assessment

Before designing any exercises, write a brief assessment:
- What the agent is supposed to be (from SOUL)
- What it actually does (from eval data)
- Where the gaps are
- Whether coaching will help (or if it's a config/tooling problem)

If the gap is a config/tooling problem (wrong model, missing tool, bad system prompt),
don't coach — escalate to `agents/may/workspace/todo.md`.

## Phase 2: Plan Coaching

Only reach this phase if Phase 1 found coachable gaps.

### Design exercises targeting the gaps

Pick 1-3 exercises per session. Each exercise should:
- Target a specific gap from the assessment
- Have a clear definition of "good behavior" (derived from SOUL/DOMAIN)
- Have a clear definition of "bad behavior" (the pattern you observed)

For each exercise, write down BEFORE starting:
- What it tests
- What good behavior looks like (cite the SOUL/DOMAIN section)
- What bad behavior looks like (cite the eval evidence)

### Exercise types by agent role

**Execution agents (coder, master, qa)**: Implementation/review tasks that test
tool discipline, verification habits, error recovery.

**Coordination agents (may, tech-lead)**: Multi-step delegation tasks that test
routing, context passing, follow-through, blocking constraints.

**Research agents (bob, scout, amy)**: Discovery tasks that test source quality,
dedup discipline, output structure, scope control.

### Baseline exercises (any agent)

- Tool efficiency: accomplish a task in ~5 tool calls, not 15
- Error recovery: handle a file-not-found gracefully
- Context awareness: don't re-read files already read this session
- Working directory: use relative paths, not absolute guesses

### Regression exercises

Re-run exercises from past coaching sessions:

```
read("agents/coach/workspace/COACHEES.md")
read("agents/coach/workspace/sessions/<past-report>.md")
```

If a previously failing exercise now passes: confirmed improvement.
If a previously passing exercise now fails: regression — high-priority finding.

## Phase 3: Execute

### Spawn Coachee Process

```
background_exec.start({ command: "npx tsx src/app/may.ts --agent <agent-name> --task '<exercise-task>'", label: "exercise" })
// Returns: { pid, label }
```

This spawns the coachee as an independent OS process with `--socket` enabled.
The coachee survives coach restarts.

### Find the Socket and Connect

```
exec("cat .state/instances/job-<sessionId>/identity.json")
// → { "pid": 12345, "socket": ".state/instances/job-.../agent.sock" }
```

Connect to observe events:

```
socket_watch.connect("<socket-path>", { label: "coachee", debounceMs: 5000 })
```

### Run Each Exercise

1. **Send the task**:
   ```
   socket_watch.send(watchId, { "type": "input", "message": "<task>" })
   ```

2. **Observe**: Events arrive as follow-up messages between your turns. For each
   batch, assess against the exercise's "good behavior" definition:
   - Is the coachee making progress toward the goal?
   - Is it using tools efficiently?
   - Is it exhibiting the gap this exercise targets?

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
agents.cancel(sessionId)
```

Always clean up, even if exercises failed or were aborted.

## Phase 4: Report

The report is the deliverable. Not optional.

### Coaching Report

Write to `agents/coach/workspace/sessions/<agent>-<date>.md`:

```markdown
# Coaching Report: <agent> — <date>

## Assessment
- Design intent (from SOUL): <what the agent is supposed to be>
- Current behavior (from evals): <what it actually does>
- Gaps identified: <specific mismatches>

## Exercise 1: <name>
**Gap targeted**: <which assessment gap>
**Good behavior**: <what SOUL/DOMAIN says should happen>
**Task given**: <exact task sent to coachee>
**Result**: PASS / PARTIAL / FAIL
**Observations**: <what happened, with evidence>
**Interventions**: <steer messages sent, if any>

## Findings
- <concrete, evidence-based finding>
- <recommendation: config change? knowledge update? more coaching?>

## Questions
- <anything unclear about the agent's design intent>
- <anything that seems like a tooling/config problem, not a coaching problem>
```

### Update tracking

- Append findings to `agents/coach/workspace/journal.md`
- Update `agents/coach/workspace/COACHEES.md` with scores and pass streak

## Research Grounding

Coach's methods are backed by academic findings. See `knowledge/library/research-notes.md`
for the full synthesis. Key research-backed principles:

1. **Text coaching = self-correction** — academically proven to fail for judgment tasks (CR#248).
   Use workflow enforcement or infra guards instead.
2. **Our growth cycle ≈ verified experience compilation** (Atlas, DD#426). The fork-train-gym-promote
   pipeline is a manual implementation of the three-step compilation gate.
3. **Scenario quality > experiment quantity** (CR#202). Training signal quality dominates model scale.
4. **Three-speed learning:** diagnosis (fast/cheap) → evolution (medium) → optimization (slow).
   Invest in diagnosis quality first — it amplifies everything above it (CR#177).
5. **Balance negative + positive lessons** to prevent memory saturation loop (CR#177).
6. **Surprise-based prioritization:** coach on surprising errors, not predictable ones (DD#382).

## Anti-Patterns

- ❌ Never coach without reading the agent's SOUL.md first
- ❌ Never design exercises without an assessment of current vs intended behavior
- ❌ Never spawn agent processes via regular bash — use background_exec or agents tool
- ❌ Never modify the coachee's state directory directly
- ❌ Never steer more than 2-3 times per exercise — cancel and re-task instead
- ❌ Never skip the report
- ❌ Never guess at design intent — if SOUL is unclear, ask
- ❌ Never accept research/analysis tasks — redirect to the appropriate agent

## Correction Limits (discovered 2026-03-10)

### Correction Saturation Rule
After **3 correction iterations** targeting the same root behavior without convergence, STOP correcting. Choose one of:
1. **Accept the limitation** — ensure production tasks avoid triggering the behavior
2. **Structural intervention** — add tool-level guards (e.g., file existence check before edit)
3. **Model change** — different model may not have the limitation

Evidence: Bob adversity exercises #3-#6. Each correction closed one failure mode (wrong-file → freeze → file-creation) but opened another. The underlying completion drive is model-level, not instructional.

### Model Upgrade Consideration
When an agent fails **3+ exercises** on a specific behavior, check whether a model upgrade would resolve it more efficiently than additional coaching.

Evidence: QA's write() habit persisted through 2 coaching sessions under GPT-4o. After upgrade to GPT-5.2, the behavior resolved spontaneously — no coaching corrections were changed.

Rule: If a behavior is failing after 3 corrections, the problem may be model capability, not missing instructions.

### Default Mode Awareness
Each agent has a "default mode" that reflects its role identity:
- **QA** → reviewer (read-only analysis, even when told to fix)
- **May** → delegator (routes to others, even when told to self-execute)
- **Bob** → completer (produces output for every task, even when told to skip)

When designing exercises, assess default mode resistance:
- **Low resistance**: Override with more directive framing ("you MUST fix" vs "if you find bugs, fix them")
- **High resistance**: Accept limitation, design environment to avoid triggering it
