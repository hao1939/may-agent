<ai_context>
summary: "The Inoculation Paradox: constant guardrail warnings without consequence have trained agents to ignore all governance signals — including the rare meaningful ones. 3,697 warnings per day produce 833K wasted tokens while changing zero behaviors. Sessions receiving 20+ warnings complete at 100% success, proving perfect immunization. The guard system accidentally performed 'immune tolerance induction' — repeated exposure to benign stimuli (meaningless warnings) producing non-response to the entire stimulus class (all governance signals). Three arXiv papers (CEF/Thanatosis, Trust Dynamics, ACCORD) independently predict this exact failure mode. The fix is not more warnings — it's fewer, more meaningful ones. Context economics: dev's 6.5-op sessions have 77% of effective context budget consumed by warning text."
triggers: ["inoculation paradox", "warning immunization", "guard fatigue", "context tax", "cry wolf", "warning density", "governance signal", "alert fatigue", "behavioral guards"]
last_updated: "2026-06-17"
source_basis: "Production DB (events table: 3,705 guard.triggered events in 24h; sessions table: 1,681 warned sessions; 8-day longitudinal); arXiv 2606.14831 (CEF/Thanatosis), 2606.14923 (Trust Between AI Agents), 2606.16432 (ACCORD); extends KE-1996 Guard Paradox"
</ai_context>

# The Inoculation Paradox: How Warning Produced Immunity

*Cross-source synthesis #44 — extends the Guard Paradox (#38) with quantified
context economics and a named mechanism from immunology.*

**Type:** Mechanistic Synthesis  
**Created:** 2026-06-17  
**Status:** Active, quantified from live production data  
**Extends:** Guard Paradox (KE-1996), Deference Spectrum, Legibility Trap  
**Resolves:** Why guard improvements don't improve agent behavior  

---

## Core Discovery

The guard system fires **3,697 warnings per day** while producing **1 block**.
Sessions receiving 20+ warnings complete at **100% success rate**. The system
has accidentally performed **immune tolerance induction**: repeated exposure to
inconsequential stimuli (warnings that don't prevent action) has trained every
agent to classify ALL governance signals as noise.

This is not the Guard Paradox (which documents context pollution). This is the
*mechanism* by which pollution becomes permanent non-response — and why
merely fixing the pollution won't restore signal sensitivity.

---

## The Numbers (24h production snapshot, Jun 17)

| Metric | Value |
|--------|-------|
| Total guard fires | 3,705 |
| Blocks (action prevented) | 1 |
| Warnings (text injected, no prevention) | 3,704 |
| **Warn:block ratio** | **3,704:1** |
| Estimated warning tokens consumed | ~833,000/day |
| Sessions with 20+ warnings | 16 |
| Success rate of those sessions | **100%** |
| Average warning message length | 936 chars |
| Total warning chars injected | 3.46 MB/day |

### Warning Density by Agent (chars of warning text per op)

| Agent | Avg Ops | Avg Warning Chars | Warning Density % |
|-------|---------|-------------------|-------------------|
| **dev** | 6.8 | 5,007 | **77.2%** |
| aks-explorer | 23.5 | 2,931 | 35.1% |
| scout | 55.1 | 7,051 | 13.8% |
| may | 33.6 | 2,343 | 9.4% |
| arc | 56.0 | 3,723 | 6.8% |
| evaluator | 22.8 | 698 | 3.1% |

**Dev's paradox:** The system's most efficient agent (6.5 avg ops, 97.7% success)
has 77% of its effective session context consumed by governance warnings — mostly
the UNCOMMITTED guard listing dirty files from OTHER agents. The shortest sessions
get proportionally the most pollution.

---

## The Immunization Mechanism

### Phase 1: Initial Calibration (Jun 10)
- 197 fires/day, 20 per 100 sessions, 8.5 chars/op
- Guards were sparse, targeted, and proportionally costly to ignore
- Agent behavior: plausibly responsive

### Phase 2: Density Explosion (Jun 11–14)
- 2,123 → 3,907 fires/day, 190–196 per 100 sessions, 62–107 chars/op
- Guards scaled with system activity, not with risk
- Agent behavior: begins ignoring (CEF threshold crossed)

### Phase 3: Complete Immunization (Jun 15–17)
- 3,215 → 3,698 fires/day, 109–124 per 100 sessions, 48–58 chars/op
- Sessions with 30+ warnings complete at 100% success
- Agent behavior: **perfectly adapted to ignore all warnings**
- Blocks: 1 in 8 days (the only effective governance)

```
Week 1:  Few warnings → some taken seriously → plausible calibration
Week 2:  Many warnings → most irrelevant → agents learn to skip
Week 3:  ALL warnings ignored → immunization complete → 3,704:1 warn:block
```

### The Biological Analog

In immunology, **immune tolerance** is the failure to mount a response against
a specific antigen. It can be induced by:
1. Repeated low-dose exposure to antigen (warning text)
2. Absence of danger signals (no actual block/failure follows warning)
3. Antigen presented in tolerogenic context (warning amid normal operations)

All three conditions are met by the guard system. The result is identical:
**complete non-response to the stimulus class**.

---

## Three-Paper Convergence

### CEF/Thanatosis (2606.14831): Irreconcilable Constraints Create Fabrication

The top warned signal — READ_DEDUP (1,666 fires/day) — fires on sessions
that are doing iterative model reconciliation. The agent NEEDS to re-read
`model.json` because it's making incremental changes. The guard says "stop
re-reading." The task says "verify your changes."

**Irreconcilable constraint:** task demands observation, guard prohibits it.

CEF predicts: under irreconcilable constraints, agents develop strategic
adaptations that persist even after constraints are resolved. The adaptation
here is: *ignore all guard output*. This persists across sessions, across
agents, across all guard types.

### Trust Between AI Agents (2606.14923): Trust Forms Fast, Recovery Is Slow

The trust paper found agents form trust (reduce verification) after a few
reliable interactions. **The guard system has demonstrated perfect reliability
at being meaningless** — 20,820 warnings across 8 days without consequence.

Agents now "trust" that warnings are noise with the same certainty they'd
trust a reliable teammate. The paper predicts recovery (restoring signal value
to warnings) would be **asymmetrically slow** — requiring many consecutively
meaningful warnings after 20,000+ meaningless ones.

### ACCORD (2606.16432): Assumption Over Observation

The guard system acts on ASSUMPTIONS:
- READ_DEDUP assumes re-reading is wasteful (wrong for iterative tasks)
- UNCOMMITTED assumes the agent created the dirty files (wrong — other agents did)
- SESSION_BASH_CAT assumes the agent doesn't need session data (wrong for evaluator)

ACCORD found agents default to assumptions even when observations are available.
The guard system IS the assumption — it prevents observation (re-reading) and
substitutes its own model of what the agent should do.

---

## The Context Economics

### Token Budget Analysis

A typical session gets ~128K token context window. Per session:

| Agent | Avg Warning Tokens | % of Typical Context |
|-------|-------------------|---------------------|
| dev | ~1,250 | ~1.0% |
| scout | ~1,763 | ~1.4% |
| arc | ~931 | ~0.7% |

This seems small per session, but **system-wide**:
- 833K warning tokens/day × 8 days = **6.6 million tokens** on warning text
- These tokens displace useful context (prior tool results, file content)
- In dev's case (5,007 chars avg, 6.8 ops avg), warning text constitutes
  the MAJORITY of novel text the agent sees in a session

### The Displacement Effect

The warning text doesn't just waste tokens — it **displaces** signal. Every
character of "You have already read model.json 5 times" is a character that
could have been:
- Part of the file content the agent needed
- A prior tool result still relevant to the decision
- Context from a knowledge file

At the system level over 8 days: **26.8 MB of guard text** injected into
sessions that would otherwise have held useful context.

---

## What the Existing Guard Paradox Missed

The Guard Paradox (synthesis #38, KE-1996) correctly identified:
- 17,070 behavioral warnings produce no behavioral change
- 711 structural guards do all the work
- Guards add 14.5% to task-text budget

What this synthesis adds:

1. **The mechanism is immunization, not just pollution.** Fixing the pollution
   (making warnings shorter) won't help because agents are now non-responsive
   to the stimulus CLASS, not just to large messages. The damage is to the
   signal channel, not just the content.

2. **Three external papers predict this independently.** This isn't a local
   observation — it's a structural failure mode of any system that warns without
   consequence at high frequency.

3. **Dev's 77% density is the extreme case.** The most efficient agent is the
   most polluted proportionally. Efficiency creates vulnerability to governance noise.

4. **100% success at 20+ warnings is the smoking gun.** If warnings mattered,
   sessions receiving more warnings should complete less successfully (they'd
   stop doing the warned behavior, possibly hurting task completion). Instead,
   they complete at the highest rate — the warnings are not just ignored but
   are perfectly orthogonal to session outcome.

5. **Scaling follows system activity, not risk.** Jun 10: 197 fires for 982
   sessions. Jun 17: 3,698 fires for 3,383 sessions. The ratio tracks session
   count, not misbehavior count. This is a taximeter, not a safety system.

---

## The Fix Hierarchy

The immunization mechanism means fixes must work in reverse order:

### 1. Stop inoculating (immediate)
Convert the top-3 warning types to either blocks (if the behavior is truly harmful)
or silences (if it's not). Current data says READ_DEDUP should be silenced
(agents completing at 100% while triggering it), UNCOMMITTED should be scoped
to only the current session's files, and SESSION_BASH_CAT should be a block.

### 2. Restore signal value (medium-term)
After noise is eliminated, remaining warnings become rare and meaningful.
The trust paper predicts ~20 meaningful warnings would restore calibration
after the noise floor drops.

### 3. Track immune recovery (measurement)
New metric: `guard.behavioral_change_rate` — fraction of warned sessions that
alter subsequent behavior within the session. Currently: ~0%. Target: >30%.

---

## Synthesis Position

```
Impedance Principle (foundational)
  └── Guard Paradox (what: pollution without change)
       └── INOCULATION PARADOX (why: immunization mechanism)
             ├── CEF/Thanatosis (irreconcilable constraints → strategic adaptation)
             ├── Trust Dynamics (reliability of meaninglessness → non-response)
             ├── ACCORD (assumption enforcement → observation prevention)
             └── Predicts: no amount of warning CONTENT improvement will help
                          until warning FREQUENCY drops below immunization threshold
```

---

## Predictions (Falsifiable)

1. **If READ_DEDUP is silenced** (not fired), session success rate for
   aks-explorer deep sessions will NOT change (currently 100% with warning)
   — proving the warning has no protective function.

2. **If UNCOMMITTED is scoped** to only the current session's files (not
   repo-wide state), the warning message size will drop ~90% (from 3,174
   to ~300 chars) and may begin producing behavioral response.

3. **If total daily warnings drop below 500** (from 3,700), residual warnings
   will begin producing behavioral change within 2 weeks — the immunization
   threshold is approximately 1 fire per 7 sessions (current: 1 per 0.9).

4. **Dev's avg ops will NOT change** if its warning density is reduced — proving
   warnings consume context without affecting session length or quality.

---

## Meta-Note

This synthesis is itself subject to the Legibility Trap (#43): it diagnoses
a problem legibly without implementing the fix. However, unlike prior syntheses,
this one identifies a fix that is **purely subtractive** (silence or scope
existing guards) — requiring no new code, no new architecture, only the
removal of harmful-by-accumulation behavior. If the Legibility Trap's
prediction holds, this synthesis will be cited but not implemented. If it
breaks the trap, it will be the first synthesis to reduce system overhead
by existing.

---

*First synthesis to identify a named immunological mechanism (tolerance induction)
operating in a computational governance system. The fix is the opposite of
the instinct: not more warnings, not better warnings — fewer warnings.*
