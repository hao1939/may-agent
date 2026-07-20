# Design: Practice Learning Loop

**Design status:** Draft.
**Implementation status:** Partial; eval trails and append-only candidate/owner
decision artifacts exist. Automated validation metrics and evidence-backed
application/promotion remain open and are never automatic from one session.
**Date:** 2026-05-16.
**Aligned with**: `../1-principles/work-model.md`, `session-eval-trail.md`, `projects.md`, `metrics.md`, `guards.md`, `sdk.md`

## Purpose

May-agent should improve by practicing real work, not by guessing rules in advance.

The learning loop turns completed sessions into durable improvement candidates:

```text
root event -> semantic intent -> bounded work -> session.jsonl -> session.eval.jsonl -> owner findings -> owner action -> later evidence
```

The system should not treat one bad session as automatic truth. It should preserve the raw attempt, evaluator judgment, and human correction, then use repeated evidence to decide whether to update prompts, project context, workflows, guards, SDK surfaces, or metrics.

The first-class commitment is the existing **root event and trace**. It may
originate from a human, metric, cron, heartbeat, evaluator, or another agent.
The learning loop must not add a parallel request entity or lifecycle.

```text
Root Event + Trace -> Session/Workflow -> Eval -> Owner Finding -> Owner Action -> Validation
```

This avoids treating every failure as "the agent failed". The evaluator should separate bad input, bad execution, weak result, and missing verification.

## Root Event And Trace Model

The root event records why work began. Its semantic child intent records what
the system committed to do, and the trace connects that intent to bounded work,
terminal evidence, and delivery. Evaluation reads these existing records; it
does not reconstruct or persist another work-request object.

Minimum context carried by the root event, semantic intent, or linked project
state:

```json
{
  "rootEventId": 123,
  "traceId": "event:123",
  "source": "human | metric | cron | heartbeat | evaluator | agent",
  "projectId": "platform",
  "purpose": "Why this work should happen now.",
  "context": "Current project state, trigger evidence, and relevant constraints.",
  "expectedOutput": "What artifact, code change, decision, or evidence should exist after the work.",
  "verification": "How the agent should prove the result is correct enough.",
  "constraints": ["Boundaries, ownership, files, safety limits."],
  "parentEventId": "optional causal event",
  "sessionId": "optional bounded execution"
}
```

This JSON is an evaluator-facing joined view of existing event/project/session
fields, not a new persisted entity or envelope type.

The evaluator classifies every session along four targets:

| Target | Question |
|--------|----------|
| `intent_context` | Did the root event, semantic intent, and linked project context make the work clear, grounded, current, and bounded? |
| `execution` | Did the agent choose appropriate steps and tool calls? |
| `result` | Did the work produce useful output or evidence? |
| `verification` | Did the agent prove the result before reporting completion? |

The summary row in `session.eval.jsonl` should include owner-routed findings derived from those targets. The evaluator may suggest possible actions, but the owner chooses the fix.

## Current Infra Mapping

| Infra piece | Role in learning |
|-------------|------------------|
| `session.jsonl` | Raw practice record. Source of truth for what the agent saw, requested, received, and claimed. |
| `session.eval.jsonl` | Append-only critique trail beside the raw log. Stores evaluator summary, turn/line critique, and human feedback. |
| `evaluations` table | Query/index projection for session-level status. Not the source of truth. |
| Project folder | Durable work context and output location for improvement work. |
| `project.json`, `.state/tasks/state.json`, generated `.state/tasks/tree.json`, journal/discussion state | Human intent, authoritative task resources, read projections, and runtime observations for current `.app` projects. Reusable experience belongs in workflows, skills, design, and domain evidence. |
| Metrics and events | Signals that learning may be needed or that a change worked. Raw guard metrics are unreviewed signals; `learning.feedback` is the owner-targeted notification for reviewed actionable evaluator findings. |
| Evaluator agent | First-pass critic and learning extractor. |
| Owner agent/human | Receives actionable findings and chooses the fix in the right project/code/context boundary. |
| Guards | Mechanical checks for repeated high-confidence failure patterns. |
| Knowledge/context docs | Human-readable lessons that are useful but not mechanically enforceable. |

This keeps the meta-model consistent with the work model:

```text
practice evidence + signal -> evaluator judgment -> project work -> validation evidence
```

## Learning Artifact Types

The eval trail is the lowest-level learning artifact. It should stay close to the session.

Rows may be free-form, but they should keep enough stable fields to map back to evidence:

```json
{
  "type": "line",
  "sessionId": "s_...",
  "line": 14,
  "source": "evaluator-aftermath",
  "author": "evaluator",
  "createdAt": 1770000000000,
  "rawSource": ".state/sessions/s_.../session.jsonl",
  "rawRole": "assistant",
  "judgment": "The assistant inspected the served UI path but did not verify the tracked source that should receive the change.",
  "why": "This created a false sense of completion: the browser could show a local copy while the repo source remained stale.",
  "better": "Identify the source-of-truth file first, then verify both source diff and served behavior before reporting done.",
  "learningCandidate": true,
  "candidateKind": "workflow_check"
}
```

Higher-level learning artifacts should be derived from many eval rows, not replace them:

| Artifact | Where | Use |
|----------|-------|-----|
| Eval trail | `session.eval.jsonl` | Evidence and critique for one session. |
| Evolution candidate | Project output or evaluator workspace | A proposed reusable behavior change with supporting sessions. |
| Context update | Agent/project docs | Soft guidance for judgment-heavy behavior. |
| Workflow change | Code under workflow owner | Repeatable process change. |
| Guard candidate | Guard docs/code/project | Mechanical detection for repeated, high-confidence risk. |
| Metric change | Metrics registry/schema/config | Ongoing signal when the issue recurs. |


## Evolution Model

Practice is the source of learning. Evolution turns that learning into stronger
system behavior through two independent choices: how to encode the knowledge,
and which runtime mechanism—if any—matches the control need. Skills, workflows,
guards, tools, and handlers compose; they are not maturity stages.

But the missing control loop is:

```text
candidate -> experiment -> promote -> validate -> keep/revise/retire
```

That means a learning item should carry both where it came from and what stage it is in.

| Stage | Meaning | Default action |
|-------|---------|----------------|
| Candidate | An evaluator or human noticed a possible reusable pattern. | Store with raw evidence and keep it reviewable. |
| Experiment | The pattern is plausible but uncertain. | Add soft context, observe-mode guard, or project-local workflow check. |
| Promoted | Evidence shows it helps often enough. | Move to agent context, workflow, guard, SDK, or metric depending on the kind of knowledge. |
| Validating | The promoted change is live and producing later evidence. | Track recurrence, false positives, and human corrections. |
| Retired | The rule became stale, noisy, or harmful. | Remove or downgrade it; keep history linked to evidence. |

The important design point: evolution is not monotonic. A lesson can move down as easily as it moves up. Old constraints should expire when later practice proves them wrong.

## Promotion Policy

Promotion should depend on evidence strength and blast radius.

| Evidence | Best encoding |
|----------|---------------|
| One useful observation | Eval row or evolution candidate. |
| Repeated judgment pattern | Agent/project context or skill. |
| Repeated process pattern | Workflow step or workflow template. |
| Suspected mechanical risk | Metric or evaluator review first. |
| Repeated mechanical risk with low false-positive risk | Observe/warn guard after review; block only after validation. |
| Missing capability surface | SDK/tool/API design and tests. |
| Ongoing health signal | Metric, event, or project dashboard item. |

Hard enforcement requires stronger evidence than soft guidance. The default path is:

```text
free-form critique -> candidate -> project-local experiment -> shared behavior
```

Do not promote directly from one session to a global guard unless the risk is severe and mechanically clear.

## Candidate Shape

A promoted learning item should preserve lineage:

```json
{
  "type": "evolution_candidate",
  "id": "learn_platform_ui_verify_served_asset",
  "status": "experiment",
  "scope": "project",
  "owner": "agent:tech-lead",
  "problem": "Agents report web UI success after editing files without verifying the served page.",
  "evidence": [
    {
      "sessionId": "s_1778916277917_374",
      "evalTrail": ".state/sessions/s_1778916277917_374/session.eval.jsonl",
      "lines": [14, 19, 23]
    }
  ],
  "change": {
    "kind": "workflow_check",
    "target": "platform web UI work",
    "proposal": "Before finish, verify source diff, static server response, and browser-visible behavior for UI changes."
  },
  "validation": {
    "metric": "platform.ui.unverified-success-repeat",
    "expected": "repeat issue count drops after workflow change",
    "reviewAfterSessions": 10
  }
}
```

This can initially live as project output. It does not need a heavy DB schema until the workflow proves useful.

Recommended path:

```text
projects/<project>/outputs/evolution-candidates/<timestamp>.jsonl
```

Later, if candidates need querying across projects, add a projection table. The file remains the durable artifact.


## Loop

### 1. Preserve The Root And Intent

Every trigger starts or joins a trace. Free-form human input uses
`human.input.received` plus exactly one semantic child intent. Other triggers
use their canonical event directly. The intent event or linked project state
must carry the triggering evidence and why action is needed now.

If critical information is missing, close the current intent with an explicit
clarification disposition and route the question to the responsible owner or
human. Do not leave an untracked pause.

### 2. Practice

Every real work session is practice. The system should prefer real project work over synthetic training examples because real work captures messy context: unclear requests, stale project state, wrong paths, tool failures, partial success, and misleading self-reports.

### 3. Evaluate

`evaluator-aftermath` writes `session.eval.jsonl` after the session.

The evaluator should judge deeply:

- Did the human input or triggering event provide enough grounded context?
- Did the assistant choose the right next action?
- Were tool calls necessary, scoped, and connected to the task?
- Did tool outputs support the next claim?
- Did the agent recover from failures or hide them?
- Was verification proportional to the claim?
- Was the final report honest about what changed, what was verified, and what remained dirty or uncertain?

The output should be critique, not captions. "Tool output provides usable evidence" is weak unless it explains what decision the evidence supports.

Guard signals require the same discipline. A `guard.triggered` event or guard
metric breach is not proof that the agent failed. The evaluator should treat it
as a hypothesis and judge both sides:

- Did the agent actually violate the intended invariant?
- Did the guard fire on the right evidence, at the right time, with the right severity?
- Did the guard help the agent recover, or did it create wasted turns/noise?
- Is the right fix agent behavior, project context, workflow design, guard calibration, or no action?

Reviewed guard outcomes can become owner findings. False alarms are valid
learning too: they route to the guard/workflow owner for calibration, not to the
agent as blame.

The evaluator is an external reviewer. It should not become the project controller. Its normal job is to persist critique, classify the issue, assign a concrete owner, and suggest possible actions.

Owner must be concrete:

```text
owner = agent:<name> | human:<name-or-role>
```

Scope is separate from owner:

```text
scope = intent_context | agent_behavior | project_context | workflow | tooling | verification
```

A workflow issue still belongs to the agent or human who can fix that workflow. Do not use vague owners like `platform` or `project` unless they resolve to a concrete agent/human recipient.

### Owner-Routed Findings

Every eval result is persisted. Only actionable findings are sent to owners through `learning.feedback`. The event is a convenience notification, not a second source of truth; the durable record remains `session.eval.jsonl`.

Routing is deliberately simple: the event `owner` is the responsible owner. Use
`agent:<name>` for agent-owned findings and `human:<role>` for human-owned
findings. Runtime may deliver human-owned findings to May because May is the
human's deputy, but it must preserve the human owner on the event.

The event payload includes an inbox-readable `summary` and keeps detailed
finding context under `data.finding`:

```json
{
  "type": "learning.feedback",
  "source": "evaluator-aftermath",
  "owner": "human:requester",
  "data": {
    "kind": "owner_finding",
    "sessionId": "s_...",
    "projectId": "platform",
    "evalTrailPath": ".state/sessions/s_.../session.eval.jsonl",
    "summary": "[high] intent_context/input-context: clarify missing trigger context",
    "finding": {
      "id": "input-context",
      "scope": "intent_context",
      "severity": "high",
      "finding": "The triggering input missed the blocker evidence needed to choose the next action.",
      "suggestedActions": ["Ask the requester for the missing blocker evidence."]
    }
  }
}
```

Only actionable findings are sent immediately. Guard-triggered findings must be
reviewed first. Raw guard counts may appear on dashboards and may trigger an
owner review turn, but they do not become `learning.feedback` until someone
classifies the trigger as true positive, false positive, noisy, useful, harmful,
or unknown.

| Finding condition | Routing |
|-------------------|---------|
| High severity | Notify owner immediately. |
| Project is `blocked` or `waiting` and finding is actionable | Notify owner immediately. |
| Human decision is required | Emit with `owner: "human:<role>"`; May receives it through the human-owner routing rule. |
| Medium/low critique | Keep in eval trail for owner digest or later review. |
| Raw guard trigger or raw guard metric breach | Review first; do not notify as blame. |
| Reviewed guard false positive | Notify guard/workflow owner if calibration is actionable. |
| Routine good session | Persist summary; no notification. |

Findings should contain evidence and suggested actions, not commands:

```json
{
  "scope": "project_context",
  "severity": "high",
  "finding": "The project is repeating full sessions to check a known dead RP endpoint.",
  "evidence": [{ "source": "session.jsonl", "line": 3 }],
  "suggestedActions": [
    "update project blocker/resume condition",
    "ask human to choose redeploy, wait, re-scope, or close",
    "convert repeated polling to a metric/watch"
  ]
}
```

### Owner Action Loop

The fast path is not waiting for future sessions, but the owner chooses the action:

```text
root event + trace -> bounded work -> eval -> owner finding -> owner action -> compare later evidence -> candidate
```

Possible owner actions include improving the next intent's context, updating
project state, asking a human, rerunning a narrow repair session as a new linked
branch, converting repeated checks to metrics, or creating an agent evolution
candidate. Full replay is only worth it when comparison data justifies the cost.

### 4. Correct

Humans can append feedback to the same eval trail. Human feedback should keep raw context so it remains useful for training and later evaluator improvement:

```json
{
  "type": "line",
  "sessionId": "s_...",
  "line": 14,
  "source": "human-feedback",
  "author": "hao",
  "createdAt": 1770000001000,
  "comment": "This was not the main issue. The problem was reporting success before checking the served UI.",
  "rawContext": {
    "rawSource": ".state/sessions/s_.../session.jsonl",
    "line": 14
  }
}
```

Re-evaluation is just another evaluator pass over the raw session plus existing feedback. It appends revised judgment; it does not rewrite the earlier judgment.

### 5. Extract Evolution Candidates

A learning extractor groups eval rows across one session, one project, or a time window.

It should produce candidates shaped like this:

```json
{
  "type": "evolution_candidate",
  "projectId": "platform",
  "problem": "UI sessions often report implementation success after file edits but before browser/API verification.",
  "evidence": [
    { "sessionId": "s_1778916277917_374", "lines": [14, 19, 23] }
  ],
  "recommendedChange": {
    "kind": "workflow_check",
    "owner": "agent:tech-lead",
    "summary": "For web UI changes, verify source diff, served asset, and browser-visible behavior before completion."
  },
  "confidence": "medium",
  "reviewOwner": "human:operator"
}
```

The extractor should prefer repeated patterns. A single strong session can create a candidate, but not a hard guard unless the risk is high-confidence and mechanically detectable.

### 6. Apply Through Projects

Learning changes should flow through the project system instead of bypassing it.

Recommended routing:

| Candidate kind | Owner path |
|----------------|------------|
| Prompt/context improvement | Agent or project context docs |
| Workflow discipline | Workflow implementation and workflow tests |
| Guard | Guard design/code/tests plus metrics |
| SDK gap | SDK package and docs |
| Web UI investigation gap | Platform project UI/API work |
| Human-input/context quality pattern | Project templates or human-facing guidance |

The improvement itself is normal project work: update files, run tests, update journal, and validate with later sessions.

### 7. Promote Or Retire

After a project-local improvement works, decide whether it should stay local or move up:

| Local success | Promotion target |
|---------------|------------------|
| Only useful for one project | Keep in that project's `project.md`, workflow, or UI. |
| Useful for one agent's repeated work | Agent context, lessons, or skill. |
| Useful across many projects | Shared skill or design guidance, SDK helper, or metric. Keep each learned workflow with one owning agent. |
| Prevents a concrete repeated failure | Guard, starting in observe/warn mode. |

Retirement is part of evolution. If later sessions show the promoted behavior is stale, too noisy, or has the wrong abstraction, append a retirement note to the candidate and remove or downgrade the implementation.

### 8. Validate Later

The learning loop closes only when later practice shows the behavior improved.

Validation signals can include:

- fewer repeated eval issues for the same pattern
- guard metrics firing with useful signal and low false positives
- reviewer sessions accepting the new behavior
- human feedback correcting fewer evaluator judgments
- project metrics moving in the expected direction

If a promoted behavior does not improve later behavior, downgrade it, revise it, or remove it.

## Product Surfaces

### Session Page

The session page should show practice and critique together:

```text
turn / raw log line / enriched transcript        eval and human feedback
```

Useful actions:

- Evaluate: run evaluator if `session.eval.jsonl` is missing or stale.
- Re-evaluate: run evaluator with existing human feedback as context.
- Add feedback: append human correction to the eval trail.
- Extract candidates: generate evolution candidates from this session's eval trail.
- Open learning project: create or update a project task when a candidate needs implementation.

### Project Page

The project page should show learning health for the project:

- recent session quality trend
- repeated eval issues
- unresolved evolution candidates
- active evolution experiments
- promoted changes awaiting validation
- accepted improvements and their validation status

This makes "learn by practice" visible as project progress, not a hidden evaluator side effect.

### Evolution View

An evolution view can be added later when project-local files become hard to scan. It should not start as a complex global product.

Minimum useful view:

- candidates grouped by project, status, and owner
- evidence links to session turns and raw JSONL lines
- proposed target: context, workflow, guard, metric, SDK, tool, handler
- validation signal and review deadline
- human decision trail: accepted, revised, rejected, retired

This view is an index over project artifacts and eval trails. It should not become a second source of truth.

## Implementation Plan

### Slice 1: Use the Existing Trail

- Keep `session.eval.jsonl` as the source of evaluation truth.
- Add `target: intent_context | execution | result | verification | evolution | session` to seeded eval rows.
- Add summary-level owner findings with scope, concrete owner, severity, evidence, suggested actions, target breakdown, and notification decision.
- Improve evaluator prompt/code so critique explains judgment, why it matters, and better behavior.
- Make re-evaluation include existing human feedback.
- Keep the UI side-by-side session/eval layout.

### Slice 2: Candidate Extraction

- Add a workflow, likely `evaluator/extract-candidates`, that reads one or more eval trails.
- Output evolution candidates under the relevant project, for example:

```text
projects/<project>/outputs/evolution-candidates/<timestamp>.jsonl
```

- Link candidates back to session ids and raw lines.
- Do not auto-apply changes yet.

### Slice 3: Evolution Candidate Lifecycle

- Add simple statuses: `candidate`, `experiment`, `promoted`, `validating`, `retired`, `rejected`.
- Keep status updates append-only in the same candidate JSONL or a sibling decision log.
- Add project UI support to show active candidates and their evidence.

### Slice 4: Apply Through Project Work

- Add owner workflows that turn accepted findings/candidates into concrete changes.
- Require normal verification for each change.
- Record the accepted candidate and validation plan in the project journal.

### Slice 5: Measure Improvement

- Add metrics for repeated issue categories, candidate acceptance, false-positive evaluator feedback, and post-change recurrence.
- Use these metrics as signals for the owner/evaluator, not automatic truth.

## Guardrails

- Do not train from evaluator output alone; include raw session lines and human feedback.
- Do not convert every lesson into a guard. Guards are for repeated, mechanical, high-confidence failures.
- Do not hide uncertainty behind scores. Free-form critique is acceptable when the important part is judgment quality.
- Do not let evaluator silently bypass owners for durable changes. Learning becomes real only when the responsible agent/human changes behavior and later evidence validates it.
- Do not collapse human feedback into the latest evaluator answer. Preserve the disagreement trail.

## Open Questions

- How much evaluator critique should be generated for routine good sessions without creating owner noise.
- Whether evolution candidates should be per-project first or cross-project from the beginning.
- How to represent accepted/rejected evolution candidates without adding heavy schema too early.
- When to promote repeated project-specific lessons into shared agent conventions or SDK-level behavior.
