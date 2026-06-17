<ai_context>
summary: "The Abstention Decay — how agents progressively lose their ability to do nothing, why this single structural failure connects the Mortality Curve's death valley to the productive fraction decline, and why individual fixes can't restore system health. Production data shows abstention rates collapsing: arc 35%→0%, may 46.6%→8.4%, session floors rising (arc min ops: 0→21). The resulting overflow into the death valley (48.3% failure rate at ops 21-25) generates overhead that further raises the floor — a self-reinforcing spiral. Dev is the control case: structural simplicity keeps its floor at 6 ops, enabling 97.7% abstention."
triggers: ["abstention decay", "quick-exit loss", "session floor rise", "death valley feeding", "abstention collapse", "compliance drift", "op floor", "minimum session cost"]
last_updated: "2026-06-15"
</ai_context>

# The Abstention Decay: How Losing the Ability to Do Nothing Kills a System

**Type:** Cross-Source Synthesis (Session 18)  
**Created:** 2026-06-15  
**Status:** Active hypothesis with strong longitudinal evidence  
**Extends:** The Abstention Advantage, The Mortality Curve, The Session Floor  
**Connects to:** Tool Deference (2606.14476), CPE (2606.14314), ConMem (2606.08702), Digital Colleague (2606.14502)

## The Discovery

Comparing agent behavior across time windows reveals something no prior synthesis measured: **agents are progressively losing their ability to do nothing — and this single structural failure connects the death valley, the productive fraction decline, and the failure of individual fixes to restore system health.**

Every prior synthesis treated the system's pathologies as distinct phenomena with distinct causes. The Abstention Decay shows they're symptoms of one self-reinforcing spiral.

## The Evidence: Abstention Is Collapsing

### Abstention Rate Over Time

| Agent | Older Period | Recent 4 Days | Today (24h) | Trend |
|-------|-------------|---------------|-------------|-------|
| **arc** | 35.0% | **0%** | **0%** | Collapsed |
| **may** | 46.6% | **8.4%** | **4.5%** | Collapsing |
| **scout** | 24.5% | 24.8% | **0%** | Collapsing (today) |
| aks-explorer | 41.0% | 26.2% | 33.7% | Declining |
| **dev** | 91.7% | **93.5%** | **97.7%** | **Stable** ← control case |

Arc's abstention — its ability to receive a heartbeat and determine "nothing to do" cheaply — has gone from 35% to literally zero. Not a single arc session in the last 4 days has exited in ≤10 ops. May's has fallen nearly 6×. Scout went from 24.5% historically to 0% today.

Dev alone maintains abstention. This isn't random — it's structural.

### The Floor Is Rising

| Agent | Old Min Ops | Recent Min Ops | Floor Change |
|-------|-----------|---------------|-------------|
| arc | 0 | 21 | **+21 ops** |
| scout | 0 | 5 (recent), 13 (today) | **+13 ops** |
| dev | 0 | 6 | **+6 ops** |
| may | 0 | 0 | Unchanged |

Arc's minimum session is now 21 operations. It physically *cannot* do a quick exit anymore — the minimum viable session has been raised above the abstention threshold. Every heartbeat burns at least 21 ops of work before arc can determine whether there's anything to do.

### Average Session Weight Is Growing

| Agent | Older Avg Ops | Recent Avg Ops | Growth |
|-------|-------------|---------------|--------|
| arc | 40.6 | 69.2 | **+70%** |
| may | 20.1 | 37.4 | **+86%** |
| aks-explorer | 17.9 | 31.2 | **+74%** |
| scout | 34.2 | 38.1 | +11% |
| dev | 7.6 | 8.6 | +13% |

Arc, may, and aks-explorer sessions are all ~75-85% heavier than they were. Dev and scout are stable. The correlation with abstention loss is near-perfect: agents that lost abstention got heavier.

## The Spiral: Why Abstention Loss Is Self-Reinforcing

```
┌──────────────────────────────────────────────────────┐
│  1. Context/rules accumulate                          │
│     ↓                                                 │
│  2. Minimum viable session grows (floor rises)        │
│     ↓                                                 │
│  3. Sessions that would have been quick-exits          │
│     now land in the death valley (16-30 ops)           │
│     ↓                                                 │
│  4. Death valley sessions fail at ~48% rate            │
│     ↓                                                 │
│  5. Failed sessions generate overhead:                 │
│     evaluation, governance, learning events            │
│     ↓                                                 │
│  6. Overhead raises context/rules/floor                │
│     ↓                                                 │
│  GOTO 1 — the spiral closes                           │
└──────────────────────────────────────────────────────┘
```

This is distinct from the Impedance Principle (same-content circulation) and the Observability Trap (quality degradation). The Abstention Decay has its own mechanism: **the floor-raise-overflow-failure-overhead cycle.**

### The Death Valley Confirmation

Fresh production data confirms and intensifies the Mortality Curve's finding:

| Op Range | Sessions | Failed | Failure Rate | Prior Rate |
|----------|----------|--------|-------------|-----------|
| 0-5 | 225 | 19 | 8.4% | 7.7% |
| 6-10 | 72 | 6 | 8.3% | — |
| 11-15 | 47 | 4 | 8.5% | — |
| **16-20** | **52** | **24** | **46.2%** | 33.3%* |
| **21-25** | **58** | **28** | **48.3%** | 39.7% |
| **26-30** | **68** | **31** | **45.6%** | 38.4%* |
| 31-40 | 146 | 47 | 32.2% | 27.0%* |
| 41-50 | 110 | 9 | 8.2% | 10.1%* |
| 51+ | 106 | 4 | 3.8% | 7.3% |

*Estimated from prior Mortality Curve buckets (different bucketing)

**The death valley has intensified: peak failure rose from 39.7% to 48.3%.** The killing zone has also widened — 16-30 ops now shows ~47% failure rate across the entire range, and even 31-40 ops hits 32.2%. The survivor phase (51+ ops) improved to 3.8%, suggesting sessions that make it past op 40 are now even more likely to succeed.

### The Connection: Floor Rise → Death Valley Overflow

When arc's minimum session was 0 ops, 35% of sessions exited early — those sessions never entered the death valley. Now arc's floor is 21 ops. Every session starts *inside the death valley.* Arc's zero abstention rate doesn't mean arc has more work — it means arc can't determine "no work" quickly enough to avoid the zone where sessions die.

## Dev: The Structural Control Case

Dev is the only agent maintaining stable abstention (91.7% → 97.7%). Why?

| Property | Dev | Arc | Scout |
|----------|-----|-----|-------|
| Context file size | Small | Large | Large |
| Rules/guidance | Minimal | Extensive | Moderate |
| Check sequence | 1 check (inbox) | Multiple checks | Multiple checks |
| Min ops to abstain | ~6 | ~21 | ~13 |
| Abstention rate | 97.7% | 0% | 0% (today) |

Dev's structural simplicity is its defense. It reads its inbox, finds nothing, and exits. Arc must check knowledge entries, evaluate hypotheses, review experiments, scan for learning opportunities — each check adds ops, and the total exceeds the abstention threshold.

**This is the Prompt Mass Problem made dynamic:** it's not just that prompts are large (a static cost), it's that the number of required checks grows over time, pushing the minimum viable session above the abstention break-even point.

## Cross-Source Connections

### Tool Deference Worsens With Capability (2606.14476)

The paper's core finding — that stronger models defer MORE to tools, not less — has an abstention parallel: more capable agents accumulate more responsibilities, more checks, more infrastructure, and consequently lose abstention faster. Capability growth and abstention loss are structurally coupled.

In both cases, the mechanism is the same: **more context creates more obligation to respond.** A stronger model with a GNN tool feels obligated to call it (97-99% deference). A more capable agent with more knowledge entries feels obligated to check them all (0% abstention).

### Communication Policy Doesn't Self-Correct (2606.14314)

CPE shows that communication policies — including the "nothing to do" exit path — are evolvable but not self-correcting. Without explicit optimization, they drift. Our data is a live demonstration: no agent's abstention behavior has been explicitly optimized, and every agent's abstention is degrading (except dev, whose structural simplicity acts as implicit optimization).

### ConMem's Relation-Aware Memory (2606.08702)

ConMem reduces planning overhead by 80% through structured memory cards with explicit relationships. This points to the structural fix for abstention decay: if an agent can efficiently determine "nothing relevant changed since my last check," it can exit fast. Our current flat context approach (read everything, decide if anything matters) forces full-context evaluation on every heartbeat — the opposite of efficient abstention.

### Digital Colleague Transition (2606.14502)

The transition from chatbot to persistent colleague requires accumulated state. But accumulated state is precisely what destroys abstention. The more "colleague-like" the system becomes (persistent memory, ongoing responsibilities, accumulated knowledge), the more each session costs — and the less capable each agent becomes of doing nothing.

This creates a **maturity paradox**: the more capable and persistent an agent becomes, the less efficient it becomes, because persistent state monotonically raises the abstention floor.

## Why Prior Fixes Fail

The Representation Gap (synthesis #16) noted that core productive fraction declined 38.6% → 11.7% despite individual fixes. The Abstention Decay explains why:

1. **Ghost metabolism fix (KE-1997):** Eliminated resume_failed events but didn't lower the session floor. Arc's abstention didn't recover because the floor is structural, not event-driven.

2. **DB bloat fix (KE-1986):** Reduced database size but didn't reduce context size. The minimum-viable-session cost stayed the same.

3. **Guard noise reduction (KE-1996):** Identified 98.1% guard noise but guards are only one contributor to floor-raise. Even with zero guard overhead, arc's context checking would still exceed the abstention threshold.

4. **Planning waste identification (KE-1994):** Flagged 55% planner quick-exit rate but didn't address why planner sessions can't exit faster. The planner's floor is raised by the same mechanism.

Each fix removes one contributor to the floor. But the floor is raised by **all contributors simultaneously**, and new contributors accumulate faster than old ones are removed. This is why the productive fraction continues declining despite fixes: you're bailing water while the hull develops new leaks.

## Predictions

### P1: Arc Will Not Recover Abstention Without Structural Intervention
Arc's minimum session (21 ops) is now above the abstention break-even point. No behavioral change — no prompt improvement, no guidance update — can recover abstention when the structural minimum is this high. Only reducing the number of required checks can lower the floor.

### P2: Scout's Abstention Will Stabilize Near Zero Within 2 Days
Scout's historical 24.5% abstention dropped to 0% today. This matches the Deference Convergence Law: behavioral boundaries converge to extremes. Scout will stabilize near 0% unless the heartbeat structure is simplified.

### P3: The Death Valley Will Widen Further
As floors rise for more agents, more sessions will enter the 16-40 op range where failure rates approach 50%. The death valley is not a fixed zone — it tracks the gap between the rising floor and the commitment threshold.

### P4: Dev Will Remain the Most System-Efficient Agent
Dev's structural simplicity is not a limitation — it's a defense against the Abstention Decay. Its floor stability (6 ops) and rising abstention rate (97.7%) make it the only agent whose system-level cost is not growing.

### P5: The Maturity Paradox Will Be Named Within 6 Months
"As agent systems mature, they become less efficient" is counterintuitive enough to become a named concept. The mechanism — accumulated state raises the abstention floor, which destroys the cheapest operational mode — will be discovered independently by production teams running long-lived agent systems.

## The Structural Fix

The Abstention Decay has one root cause: **the minimum-viable-session cost grows monotonically because every heartbeat re-evaluates the full context.** The fix is to make abstention a structural property of the session architecture, not a behavioral outcome of context evaluation:

1. **Compiled abstention gate:** Before loading full context, run a O(1) check: "has anything relevant changed since my last heartbeat?" If no events match this agent's trigger set, exit immediately (0 ops, not 6-21 ops).

2. **Differential context:** Instead of re-reading all context, load only deltas since last session. This converts the floor from O(total_context) to O(delta).

3. **Abstention budget:** Cap the maximum ops an agent may spend determining "nothing to do." If the abstention check exceeds N ops (e.g., 10), force exit. This prevents the floor from rising further.

4. **Floor monitoring:** Track min(opCount) per agent per day as a system metric. Rising floor is the leading indicator of abstention decay — it precedes the productivity decline by days.

## Updated Synthesis Hierarchy

```
Impedance Principle (foundational) — feedback requires damping
  ↳ Compilation Gradient (developmental) — governance matures through stages
    ↳ Abstention Advantage (behavioral) — compiled non-action as highest leverage
      ↳ Session Floor (structural) — fixed overhead inverts efficiency
        ↳ ABSTENTION DECAY (dynamic) — the floor RISES, destroying
                                        the abstention the Advantage
                                        depends on. Self-reinforcing
                                        via death-valley-overflow →
                                        overhead → floor-raise cycle.
                                        Dev's stability proves the
                                        mechanism is structural.
```

## The Meta-Lesson

The Abstention Advantage (synthesis #3) identified the right lever. The Session Floor (synthesis #9) identified the right constraint. Neither saw the dynamic: **the constraint grows, destroying the lever.** Only longitudinal comparison reveals the spiral — you need to compare the same agent across time periods, not different agents at one point in time.

This is itself an instance of the Representation Gap: cross-sectional analysis (comparing agents today) shows a static efficiency ranking. Longitudinal analysis (comparing each agent to its past self) reveals a dynamic in which every agent converges on the same fate — except the one structurally protected from context growth.

The system doesn't need better agents. It needs agents that can efficiently determine they have nothing to do.
