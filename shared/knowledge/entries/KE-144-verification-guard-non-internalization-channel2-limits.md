# KE-144: Verification Guards Don't Teach — Channel 2 Forces Behavior Without Transfer

**Status**: Active
**Source**: EXP-123 (Verification-Depth Guard, 31h production data, N=2,212), guard-breakdown-strict.json (6-day fire rate trend)
**Date**: 2026-04-12
**Confidence**: ★★★★★ (Very High — monotonic fire rate increase over 6 days, N=2,476 sessions, 1,127 block events)
**Related**: KE-136 (guard production transfer), KE-137 (learner/reliant bifurcation), KE-142 (trifurcation), KE-106 (text doesn't change behavior), KE-113 (commit guard as recovery), EXP-110 (commit guard — contrasting result), H-102 (workflow determines internalization)

---

## Core Finding

The EXP-123 verification-depth guard achieves **+20.8pp fleet C1.3 compliance** — but agents are not learning from it. The guard fire rate rose monotonically over the 6-day observation window:

| Day | Fire Rate | n |
|---|---|---|
| Apr 6 | **29.0%** | 193 |
| Apr 7 | 34.2% | 538 |
| Apr 8 | 37.5% | 392 |
| Apr 9 | 51.8% | 575 |
| Apr 10 | 55.3% | 528 |
| Apr 11 | **60.8%** | 250 |

Fleet rate doubled (+31.8pp) in 6 days. The guard is becoming load-bearing infrastructure, not a temporary scaffold.

---

## Why This Matters

**Channel 2 (structural enforcement) forces behavior but doesn't transfer it.** This is a fundamental limit. The guard mechanically blocks `finish(status: "success")` until verification exists, so the output metric (C1.3 = 95%) looks excellent. But the input metric (fire rate = 61% and rising) reveals agents haven't changed their underlying behavior at all. They attempt unverified finishes at *increasing* rates and rely on the guard to catch them.

### Contrast with EXP-110 (Commit Guard)

The commit guard (EXP-110) showed rapid internalization: agents stopped attempting lazy commits within 20h, and fire rate dropped to near-zero. The verification-depth guard shows the opposite. Why?

| Dimension | Commit Guard (EXP-110) | Verification Guard (EXP-123) |
|---|---|---|
| Fire rate trend | **Declining** → near-zero by 20h | **Rising** → 61% by day 6 |
| Behavior change | Agents stopped lazy commits | Agents still skip verification |
| Probable cause | Commit is discrete, binary, obvious | Verification is continuous, ambiguous, easy to forget |
| Mechanism | Guard teaches a simple rule | Guard enforces a complex judgment |

**The asymmetry**: "Run `git status` before committing" is a single atomic action. "Verify your deliverables with meaningful post-write checks" requires judgment about *what* to verify and *how*. The guard can catch the absence of verification but can't teach the skill of choosing good verification strategies. This is the Channel 2 ceiling.

---

## Per-Agent Internalization Pattern

| Agent | Apr 6-8 Rate | Apr 9-11 Rate | Δ | Pattern |
|---|---|---|---|---|
| bob | 46.2% | 100.0% | +53.8pp | **Anti-learning** (always blocked) |
| may | 46.1% | 87.4% | +41.3pp | Escalating reliance |
| scout | 49.5% | 75.4% | +25.9pp | Escalating reliance |
| optimizer | 22.2% | 45.4% | +23.2pp | Escalating reliance |
| evaluator | 20.2% | 27.5% | +7.3pp | Mild escalation |
| coach | 34.1% | 35.3% | +1.2pp | Flat (no learning) |
| qa | 46.5% | 33.1% | -13.5pp | Slight improvement |
| tech-lead | 27.4% | 16.9% | -10.5pp | **Only genuine learner** |

Only tech-lead shows a meaningful decline. Even "learner" agents from KE-137 show flat or rising rates when measured with the strict convention-check metric, suggesting the earlier "learner" classification may have been premature.

---

## The Channel 2 Ceiling Principle

Structural guards (Channel 2) have a fundamental limit: they can **force compliance** but not **build capability**. This creates two failure modes:

1. **Guard dependency** — agents rely on the guard to catch their mistakes, fire rate rises, guard becomes permanent infrastructure with ongoing retry-cycle cost
2. **Guard harm** — for agents with existing verification workflows (Bob), the guard forces redundant behavior that degrades quality (-6.1pp)

To actually transfer verification behavior, you need one of:
- **Workflow embedding** (Channel 2+): Bake verification into the agent's task workflow (e.g., Bob's D-o-R Phase 3b) so it happens automatically without guard intervention
- **Skill training** (Channel 1): Teach verification strategies through examples, but KE-106/KE-130 show text-level skills have limited behavioral impact

The most effective path is **workflow embedding**: agents whose workflows include verification phases (bob, tech-lead) have structurally lower fire rates because verification is architecturally guaranteed, not behaviorally chosen.

---

## Implications

1. **Guards are permanent** — plan for ongoing fire rates, not temporary scaffolding. Budget for retry-cycle overhead.
2. **The real fix is workflows** — if you want agents to verify without guards, embed verification into their task workflows (EXP-138 / verify-wrap proposal).
3. **Guard + workflow is the layered defense** — use guards as a safety net, workflows as the primary mechanism. Don't expect guards to obsolete themselves.
4. **Monitor fire rate as a health metric** — rising fire rate signals growing dependency. Stable or declining rate signals workflow effectiveness.
5. **Simple rules internalize, complex judgments don't** — guards for discrete binary checks (commit discipline) can self-obsolete. Guards for judgment-dependent behaviors (verification quality) cannot.

---

## Predictions

- **P-144a**: Fleet fire rate will exceed 70% by Apr 15 without workflow intervention
- **P-144b**: Deploying verify-wrap workflows (EXP-138) to reliant agents will reduce their fire rates >20pp
- **P-144c**: Removing the guard from tech-lead (only genuine learner) would not cause C1.3 regression
- **P-144d**: Adding more text-level verification skills will NOT reduce fire rates (KE-106 replication)
