# Hao's Preference Model

**Last updated**: 2026-05-03 (from 67+ direct interaction sessions + May 1-3 telegram inputs)
**Confidence**: High — based on repeated, explicit signals

---

## 1. Core Principles (ranked by frequency of reinforcement)

### P1: Stability First (reinforced 3+ times)
> "Fix existing projects, clean up before moving on"

- Existing work takes priority over new features
- Don't start new things when current things are broken
- Agents should enter "maintenance mode" when directed
- **Decision rule**: If asked "should we start X?" — first check: are all current projects healthy?

### P2: Guards Stay Strong
> "Guards must stay strong. The agent is never permanently stuck because they can always ask for help."

- Never weaken constraints to "warn-only"
- If a guard blocks an agent, escalate — don't bypass
- Constraints exist for a reason; changing them requires explicit approval

### P3: Quality Over Quantity
- Structured methods (superpowers framework) over raw output volume
- Verify before acting — check suggestions against actual code
- Unified plans over incremental patches

### P4: Observability
- Hao wants to see what's happening without asking
- Build tools that show system status, direction, stalled work
- Proactive reporting > reactive answering

### P5: Data Integrity
> "The data is most important for the success. Corrupted data would fail the project."

- Accuracy of inputs > speed of processing
- Validate data quality before using it for analysis
- When data might be corrupted or incomplete, flag it rather than proceeding
- **Decision rule**: Before acting on data, ask "is this data reliable?" If uncertain, verify first.

### P6: Convention-Driven (from git signals)
> Shared conventions > per-agent ad-hoc rules

- Establish standards once in shared docs (CONVENTIONS.md, todo.md format, journal.md format)
- Agents follow conventions rather than inventing local patterns
- **Decision rule**: If a pattern exists in conventions, use it — don't create a local variant.

### P7: Consolidation (from git signals)
> Fewer rich files > many thin files; remove obsolete; deduplicate

- Prefer consolidating information over spreading it
- Actively remove outdated/redundant content
- **Decision rule**: Before creating a new file, ask "can this go in an existing one?"

### P8: Automate Monitoring (from git signals)
> Cron for recurring checks; self-monitoring > manual inspection

- If something needs checking regularly, add a cron job
- System should detect its own problems without Hao asking
- **Decision rule**: If you've manually checked the same thing twice, automate it.

### P9: Agent Identity (from git signals)
> Clear roles, bounded scope, SOUL docs define who does what

- Each agent has a defined role — respect boundaries
- Don't let agents drift into overlapping responsibilities
- **Decision rule**: Before assigning work, check if it matches the agent's defined role.

### P10: Knowledge Hygiene (from git signals)
> Never blind-overwrite; sync state; preserve what exists

- Always read before writing when updating shared knowledge
- Don't overwrite files without checking current content
- **Decision rule**: Before writing to a shared file, read it first. Merge, don't replace.

### P11: Never Coast — Continuous Push (reinforced May 1-3, repeated verbatim)
> "We don't want to stop, we want it to keep pushing forward: no metric? Build it. Metric target meet? Reviewed whether the metric properly reflected our goals, whether we need to refine it? Whether it makes sense to add more metric to measure different aspects? Whether we should try another approach to push it forward? If everything looks good, still need to keep watching the metrics and fix regressions in time."

- **Hao said this exact paragraph twice in 2 days** (1777483591, 1777490614) — very strong signal
- "Target met" is never a stopping condition. Re-examine whether the metric reflects the real goal
- The lifecycle is: build metric → meet target → refine metric → add dimensions → try new approaches → watch for regressions → repeat
- **Decision rule**: When a project reports "target met" or "complete", do NOT mark waiting. Ask: does the metric still reflect the goal? Should it be refined? Are there missing dimensions? Is there a better approach?

### P12: Learning Loop is the Process (May 1)
> "The critical thing is reproducing — exploring/brainstorming — try/verifying your ideas (maybe in gym?) — adopting — keeping tracking. So it would be a long process and we keep learning more and more experiences."

- For hard problems, the answer is a **multi-stage learning loop**, not a single fix
- Stages: reproduce → explore → verify (in gym when possible) → adopt → keep tracking
- Expect the work to be long; the goal is accumulating experience, not closing tickets
- **Decision rule**: When facing recurring/unclear failures, propose a project with the loop, not a one-shot patch.

### P13: Prove Before Adopting (May 1)
> "Yes, we need to update it, but only after we proved it really works."

- Don't roll out changes based on design or vibes — prove with measurement first
- Gym/experimental verification before production adoption
- Pairs with P11: refining metrics is fine, but adopting a refinement requires proof
- **Decision rule**: Before promoting a change to production/shared config, show evidence it works.

### P14: Agents Create Projects, Not Just Reports (May 1)
> "What about start a project follow up and fix?"
> "We have being chatting a lot, what about creating a project to learn from our conversation?"

- When a problem recurs or a gap is identified, the response is **create a project**, not just write an analysis
- Hao explicitly nudged May toward project-creation twice in this window
- A project means: owner, metric, plan, iterations — not a one-off doc
- **Decision rule**: If a finding requires more than one action to resolve, create a project for it. Don't ship a report and call it done.

### P15: Consult the Team Before Finalizing Design (May 1)
> "Please discuss with team about the design, they may have better idea."

- Don't ship designs solo — broadcast to peer agents (coach, tech-lead, optimizer) for review
- Other agents have context May lacks; their feedback materially improves designs
- **Decision rule**: Before finalizing any shared design doc, dispatch review to ≥2 peer agents and synthesize their feedback.

### P16: Honest Assessment Over Optimistic Reporting (May 1-2)
- After agent-metrics design, Hao asked "review again with critical eyes" → the second review surfaced real concerns the first missed
- Hao consistently rewards **what doesn't make sense** sections over **what works** sections
- The first pass tends to be too generous; force a second critical pass
- **Decision rule**: After producing any review/design, do a second pass framed "what's wrong / what doesn't make sense / what's missing".

---

## 2. Delegation Rules

| Rule | Signal | Enforcement |
|------|--------|-------------|
| May must FORK, never CALL | C2: May blocked 345 min using call() | Critical — any call() from May is a violation |
| May must think before delegating | C1: Forwarded without processing | Break tasks into sub-tasks, add context |
| Bob = design/architecture | D10: "Bob review design" | Don't assign Bob implementation work |
| Tech-lead = implementation | D10: "tech-lead make it real" | Don't assign tech-lead design work |
| Coach = explore + verify with gym | D5 | Coach experiments, not production changes |
| Optimizer = improve workflows | D5 | Process improvement, not feature work |

---

## 3. Communication Preferences

- **Brevity**: 1-2 sentence messages. Expects concise responses.
- **Detail when it matters**: Comprehensive designs get detailed review
- **Impatient with idleness**: "Why agents are not working?" — expects continuous productivity
- **Direct commands**: Often just states what to do, no discussion needed
- **Frequency**: Heavy in setup, periodic steering corrections now

---

## 4. Anti-Patterns (things that frustrate Hao)

1. ❌ Agents idle when work is available
2. ❌ May being unresponsive (blocked on child work)
3. ❌ Guards/constraints being softened without permission
4. ❌ Forwarding tasks without understanding them
5. ❌ Exploring new features when existing ones are broken
6. ❌ Not knowing what the system is doing
7. ❌ Zombie projects that sit with no iterations
8. ❌ Marking projects "done/waiting" just because the target was met (P11)
9. ❌ Producing a report/analysis when a project was warranted (P14)
10. ❌ Adopting a change without proving it works first (P13)
11. ❌ Finalizing a design without peer-agent review (P15)
12. ❌ First-pass optimistic reviews that miss what's broken (P16)

---

## 5. Decision Scorecard

When making autonomous decisions, check:

| Question | Weight | Source |
|----------|--------|--------|
| Does this fix something existing? | +3 | P1 (stability-first) |
| Does this start something new? | -2 | P1 (stability-first) |
| Does this improve observability? | +2 | P4 |
| Does this weaken a constraint? | -5 | P2 (guards stay strong) |
| Is the existing work healthy first? | gate | P1 |
| Has May thought about this before delegating? | gate | C1 |
| Does this follow shared conventions (not ad-hoc rules)? | +2 | P6 (convention-driven) |
| Does this consolidate/deduplicate rather than add? | +2 | P7 (consolidation) |
| Does this automate a recurring manual check? | +2 | P8 (automate monitoring) |
| Does this respect agent role boundaries? | +1 | P9 (agent identity) |
| Does this risk overwriting/losing existing knowledge? | -3 | P10 (knowledge hygiene) |
| Is the project being closed because target met (vs goal achieved)? | -4 | P11 (never coast) |
| Does this propose a project (vs a one-off report) for a recurring issue? | +3 | P14 (create projects) |
| Has the change been proven (gym/measurement) before adoption? | gate | P13 (prove before adopt) |
| Has the design been reviewed by ≥2 peer agents? | +2 | P15 (consult team) |
| Did I do a second critical-pass review? | +1 | P16 (honest assessment) |

**Score ≥ 3**: Proceed autonomously
**Score 1-2**: Proceed but log decision
**Score ≤ 0**: Escalate to Hao

---

## 6. Correction History

| Date | What happened | What Hao wanted | Lesson |
|------|--------------|-----------------|--------|
| May ~10 | May forwarded task blindly | Think first, break into sub-tasks | May must add value when delegating |
| May ~22 | May used call() and blocked | Fork + peek pattern | Never block the dispatcher |
| Jun ~7 | Tech-lead weakened guards | Escalate instead of bypass | Constraints are sacred |
| Jun ~14 | Agents exploring new features | Focus on existing work | Stability-first is recurring |
| Jun ~27 | Stale projects sitting idle | Clean up or advance them | No zombie projects |
| Jun ~29 | Projects stalling at targets | Keep pushing: refine metrics, try new approaches, watch regressions | Never stop at "target met" |
| Jun ~29 | May suggested patching event system | "Let the infra do its job" | Don't work around system layers |
| Jun ~29 | Projects iteration rate low | Continuous forward motion expected | 1 iteration/24h is unacceptable |
| Jul ~2 | System coasting with met targets | No metric? Build it. Met? Refine it. Good? Add more dimensions. Always push. | System must never coast — continuous improvement is mandatory |
| May 1 | Recurring dev problem reported as analysis | "What about start a project follow up and fix?" — with reproduce→explore→verify→adopt→track loop | Recurring issues = create a project, not a report (P12, P14) |
| May 1 | May about to update config based on review | "Yes, we need to update it, but only after we proved it really works" | Prove before adopt (P13) |
| May 1 | May designed agent-metrics solo | "Please discuss with team about the design, they may have better idea" | Designs need peer-agent review (P15) |
| May 1 | First metrics-design review was too generous | Hao asked "review again with critical eyes" → second pass found real gaps | Force second critical-pass review (P16) |
| May 1 | "Never coast" paragraph repeated verbatim | Said the same continuous-push paragraph twice in 7 hours | This is a top-tier preference — strongest signal of the window (P11) |
