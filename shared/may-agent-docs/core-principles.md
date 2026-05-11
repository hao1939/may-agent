# Core Architecture Principles

Read this first. These principles govern every design decision in the system. Individual design docs elaborate on each — this doc is the **why** that holds them together.

---

## 1. Everything is an event

When something happens — metric breaches, project changes, session fails, agent finds something — emit an event. Events are how the system communicates. Not polling. Not direct calls. Not file watches.

The EventBus is the central nervous system. Commands go in, observations come out. Components subscribe and react.

**Elaborated in:** [events.md](events.md)

## 2. Everything has an owner — owner is the backstop, not the first responder

Every metric, handler, project, and event has an owner. The owner's role is **accountability**, not first-line handling. The system routes to the best-fit consumer first:

```
Event fires
  -> Best-fit handler registered?  -> handler runs
  -> Best-fit agent assigned?      -> agent gets forked
  -> Nobody consumed it?           -> Owner picks it up
  -> Something went wrong?         -> Owner investigates
```

Owner means: if this falls on the floor, it's your problem. Owners don't do all the work — they guarantee nothing is orphaned.

Agents exist as **accountability boundaries**. We don't have multiple agents because we need multiple workers — any LLM can do anything. We have separate agents because we need distinct owners who accumulate domain context, watch domain metrics, and are the definitive answer to "who's responsible for this?"

**Elaborated in:** [metrics.md](metrics.md), [design/agent-metrics.md](design/agent-metrics.md)

## 3. Events must be consumed

No event fires into the void. Something must consume it — a handler, a subscribed agent, a workflow. If nothing does, the owner picks it up. This is the **closed-loop guarantee**: every signal produces a response, even if that response is "owner judged it, recorded evidence, and decided no change is needed."

The escalation chain is: best-fit handler -> assigned agent -> owner -> May -> Hao.

**Elaborated in:** [projects.md](projects.md), [design/escalation.md](design/escalation.md)

## 4. Context is discovered, not dumped

System prompt = just enough to START discovering. Agents get:
- **AGENTS.md** — who you are
- **common-sense.md** — how to think, where things are
- **Tools** — what you can do
- **Runtime** — paths, workspace

Everything else — skills, knowledge, project history, metrics, design docs — is on-demand. Agents read what they need, guided by the conventions table in common-sense.md.

This is deliberately minimal. Dumping context produces agents that skim. Discovery produces agents that understand.

Continuity across sessions comes from project journals, heartbeat reads, and `last-session.md` — not from memory injection.

**Elaborated in:** [sessions.md](sessions.md), [heartbeat.md](heartbeat.md)

## 5. Evidence before systems

```
Hypothesis -> minimal test -> A/B -> honest results -> deploy or abandon
```

No multi-layer architecture before the base case is proven. No 20KB design brief before any experiment. If the simplest test shows no difference, say so — don't rationalize.

The context-learning project is the canonical case study: built infrastructure first, tested, found zero improvement on derivable knowledge, pivoted to environmental knowledge, found consistent improvement, deployed.

**Elaborated in:** [evidence-first.md](evidence-first.md)

## 6. Structure beats instructions

When agents make judgment errors, the fix is **workflow structure** — not text rules, not brittle guards.

| Problem type | Right mechanism | Wrong mechanism |
|-------------|----------------|-----------------|
| Judgment error | Workflow (two-phase, reviewer, evaluator gate) | Text rules alone (unreliable across sessions) |
| Environmental fact | context.md (data) | Code (doesn't adapt) |
| Mechanical check | Guard or code (tsc, test runner) | Text rules |
| Process enforcement | Workflow step ordering | Instructions ("remember to verify") |

Guards are mechanical detectors first. A guard trigger should emit an event or
risk signal; warning, repair, escalation, and blocking are intervention modes.
Use hard blocking only for high-confidence, high-impact risks. context.md is for
facts that change with the environment. Workflows are for everything that
requires judgment.

**Elaborated in:** [code-vs-data.md](code-vs-data.md), [evolution.md](evolution.md)

## 7. Metrics are signals, not targets

> "When a measure becomes a target, it ceases to be a good measure." — Goodhart's Law

Metrics inform decisions; they don't make them. A regression is a signal to investigate. No metric is the sole input to any decision. Agents combine metric data with their own judgment, context, and expertise.

If an agent's output quality drops while their metric improves, the metric is being gamed. The system should catch this — May watches for the pattern.

**Elaborated in:** [metrics.md](metrics.md)

## 8. Supervision is async and decoupled

Agents work independently. May reviews asynchronously. Intervention is the exception.

- **Agent-scope** (own workspace, own config, knowledge) — proceed freely
- **System-scope** (shared workflows, other agents' config, cross-agent protocols) — flag for review

Agents don't need to know they're being supervised. The gatekeeper pattern requires zero code — it's a behavioral convention that May follows during her normal observation cycle.

**Elaborated in:** [agents.md](agents.md)

## 9. Convention over configuration

When behavior can be derived from a naming convention, don't build configuration for it.

- Metric `coach.skill-effectiveness` → coach owns it. No registry needed.
- Event `metric.breach` with `data.owner: "coach"` → coach is accountable. No lookup needed.
- File under `agents/bob/` (skills/, knowledge/, workspace/) → bob owns it. No mapping needed.
- Heartbeat workflow for `scout` → scout's heartbeat. No routing table needed.

(Note: shared projects at `agents/shared/projects/<name>/` no longer encode owner in the path — ownership lives in the YAML frontmatter of `project.md`. This is the one place we accepted configuration over convention, because projects must be shareable across owners.)

Conventions are self-documenting, zero-maintenance, and enforce consistency. Configuration is a liability — it drifts, requires code to read, and creates a single point of failure.

**Corollary:** Don't invent new conventions when existing ones work. File locations are fixed (see common-sense.md conventions table). Naming follows `<domain>.<action>` for events and metrics. Status fields use the same vocabulary everywhere: active/blocked/done/paused. Check if a convention already covers your need before creating anything.

**Elaborated in:** common-sense.md Conventions section

## 10. Simple first, always

Try the simplest approach. If it works, stop.

- One handler before a framework
- One metric before a dashboard
- One experiment before a pipeline
- context.md before a guard
- A fork before a workflow (for <3-op work)

Complexity is justified only when simplicity has been tried and failed with evidence.

## 11. Debug the message, not the model

When an agent behaves unexpectedly, the cause is almost always **something misleading in what the LLM received** — not a broken model or flawed logic. LLMs respond to their input faithfully; wrong output means wrong input.

The misleading content could be anywhere in the API call:
- System prompt (stale AGENTS.md, contradictory conventions)
- User message (ambiguous task description, wrong context)
- Tool output (unexpected format, error messages treated as instructions)
- Injected docs (outdated knowledge, irrelevant context confusing the task)

**Debug order:**
1. Read the full session transcript — what did the LLM actually see?
2. Find the misleading content that caused the wrong behavior
3. Fix the source (the doc, the prompt builder, the tool output)
4. Only after ruling out input issues: consider workflow or infra changes

Most "agent bugs" are input bugs.

---

## How They Connect

These principles aren't independent. They form a system:

```
Something happens                           (Principle 1: event)
  -> Best-fit consumer handles it           (Principle 2: ownership routing)
  -> If nobody does, owner picks it up      (Principle 3: closed loop)
  -> Consumer discovers context it needs    (Principle 4: on-demand context)
  -> Acts based on evidence                 (Principle 5: evidence first)
  -> Uses structure for judgment calls      (Principle 6: structure > instructions)
  -> Checks metrics as signals              (Principle 7: Goodhart guardrail)
  -> May reviews async if system-scope      (Principle 8: decoupled supervision)
  -> Follows conventions, not configuration  (Principle 9: convention)
  -> Starts simple                          (Principle 10: simplicity)
  -> Debugs input, not model                (Principle 11: debug the message)
```

## Known Tensions

These principles sometimes pull in opposite directions. The tensions are managed, not eliminated.

| Tension | Resolution |
|---------|-----------|
| Event-driven (P1) vs current poll-based cron reality | Cron is the interim trigger. Events are persisted immutably. Handlers fire on cron ticks but emit events for lifecycle tracking. |
| Owner accountability (P2) vs May reviews everything (P8) | May supervises system-scope. Domain owners handle domain events. May is the fallback owner for unowned things, not the primary handler for everything. |
| Metrics drive work (P7) vs don't chase numbers (P7) | The Goodhart guardrail is built into the heartbeat: "Consider the metric. Apply judgment. Override if context says otherwise." |
| Evidence first (P5) vs we need to ship (pragmatism) | Evidence-first applies to system changes and new mechanisms. Known patterns (add a handler, create a metric) can proceed directly. Don't A/B test adding a database index. |
| Simple first (P10) vs structure beats instructions (P6) | Start simple (context.md, text rule). When it fails — and you have evidence it failed — escalate to structure (workflow, guard). The escalation path is: context.md -> workflow -> guard -> code. |

## Relationship to common-sense.md

common-sense.md is what agents see every session. It distills these principles into actionable thinking patterns: "Context first", "Evidence first", "Own it", "Event-driven", "Metric-oriented", "Simple first", "Convention over configuration."

This doc is the architectural source of truth. common-sense.md is the agent-facing summary. If they conflict, update common-sense.md to match this doc.
