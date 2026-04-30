# Hao's Preference Model

**Last updated**: 2025-06-29 (from 67+ direct interaction sessions)
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
