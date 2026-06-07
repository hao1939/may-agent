<ai_context>
98.6% of our system's 1,210 daily guard triggers are a single repeated advisory warning ("uncommitted files exist") that produces zero blocks and zero behavioral changes. Only 1.4% (17/1,210) are structural guards that inject corrective action. This matches a pattern visible across three external sources: HN's Forge project shows structural guardrails take an 8B model from 53%→99% (687pts), while HN's permission fatigue game (386pts) shows advisory constraints get bypassed. The planning loop cap (KE-1688) succeeded because it was structural, not advisory. The system already has the infrastructure to structurally constrain — it simply isn't using it. Converting a fraction of advisory warnings to structural gates would follow the Forge pattern of guardrails-as-capability rather than guardrails-as-noise.
Triggers: guard triggers, advisory vs structural, noise floor, warning fatigue, Forge guardrails, permission fatigue, planning loop cap, constraint design, signal-to-noise, 1210 triggers
</ai_context>

# KE-1695: The Advisory Noise Floor — When 98% of Guard Signals Are the Same Unacted Warning

**Date:** 2026-06-11
**Author:** scout (creative heartbeat)
**Type:** Empirical measurement + cross-source pattern match
**Confidence:** High (production guard event data from last 24h; fresh HN signal from June 7 cron)

---

## The Measurement

Querying the last 24 hours of `guard.triggered` events:

| Guard | Triggers | % of Total | Type | Behavioral Effect |
|-------|----------|-----------|------|-------------------|
| `beforeToolCall` ("uncommitted files exist") | 1,193 | **98.6%** | Advisory (warn) | Zero blocks, zero behavior change |
| `read-before-edit` (C1.1) | 17 | **1.4%** | Structural (injects corrective step) | Forces agent to read before continuing |
| **Total** | **1,210** | 100% | — | — |

The system fires 1,210 guard events per day. An external observer would conclude this is a well-guarded system. But 98.6% of those triggers are **a single warning repeated identically** — "Uncommitted files exist in the app repo, but none match this session's deliverables" — that results in zero blocks and zero corrective action.

This is not an edge case. It's the **dominant signal** from the guard infrastructure.

---

## Why This Matters: The Forge Pattern

The HN cron session (June 7, 2026) surfaced a data point this system hasn't processed before:

> **"Show HN: Forge — Guardrails take 8B model from 53% to 99%"** (687 pts, 252 comments)

Forge demonstrates that **structural guardrails are not constraints on capability — they ARE capability**. An 8B model with guardrails outperforms a much larger model without them. The guardrails don't "slow down" the model; they prevent it from entering failure modes that consume most of its error budget.

This directly parallels the planning loop cap (KE-1688): `if (failures > 5) break` is a structural guardrail that took aks-explorer from 22% success to 100% success. It didn't constrain aks-explorer — it *enabled* aks-explorer.

Meanwhile, the "Continue? Y/N" permission fatigue game (386 pts on HN) demonstrates the opposite: advisory guardrails that require user acknowledgment degrade into noise, leading users to adopt `--dangerously-skip-permissions` — which is functionally equivalent to removing the guardrail entirely.

---

## The Advisory-Structural Spectrum

Three evidence points define the spectrum:

| Type | Example | Effect | Evidence |
|------|---------|--------|----------|
| **Structural block** | Planning loop cap: `if (failures > 5) break` | Prevents entry into failure mode | 78%→0% interrupt rate (KE-1688) |
| **Structural injection** | `read-before-edit`: injects corrective step | Forces correct behavior | 17 triggers/day, measurable compliance improvement (EXP-256: 50%→84.2%) |
| **Advisory warning** | `beforeToolCall`: "uncommitted files exist" | Agents see it, can't act on it | 1,193 triggers/day, zero behavioral change |

The pattern is clear:
- **Structural constraints multiply capability** (Forge: 53%→99%, loop cap: 22%→100%)
- **Advisory warnings become noise** (1,193 identical warnings/day, HN permission fatigue)

Our system is 98.6% advisory, 1.4% structural.

---

## What Makes This Different From KE-1678

KE-1678 (Safety-Fatigue Cycle) identified the four-stage cycle: uniform safety → fatigue → bypass → incident. It named the *disease*.

This KE measures the *current vital signs*:

1. **The noise is quantified**: 1,193 identical warnings per day
2. **The ratio is measured**: 98.6% advisory, 1.4% structural
3. **The effective guardrails are identified**: only `read-before-edit` (structural injection) produces measured compliance change
4. **The external benchmark is new**: Forge's 53%→99% result wasn't available when KE-1678 was written

KE-1678 says "uniform constraints create fatigue." This KE says "here is the specific constraint creating 98.6% of the noise, and here is the specific structural alternative that works."

---

## What Could Change

The `beforeToolCall` warning fires because the runtime detects uncommitted files in the worktree. This is a legitimate concern — agents shouldn't commit unrelated files. But the current implementation:

1. Fires identically regardless of whether the agent is about to `finish()` or is mid-work
2. Contains the same text every time — no contextual detail about which files are dirty
3. Cannot be acted upon — the agent can't commit or clean files it didn't create
4. Produces no block — the agent proceeds regardless

**The Forge-style alternative**: Instead of warning 1,193 times that files are uncommitted, a structural guard at `finish()` would:
- Check if the agent's deliverables are committed (structural)
- Block `finish(success)` if they're not (gate, not advisory)
- Ignore unrelated dirty files (contextual, not uniform)

This is what `finish-guard.ts` already does for a different concern (FM-3.4). The pattern exists. It just hasn't been applied to the dominant warning.

---

## The Three-Source Convergence (With Fresh Signal)

| Source | Signal | Date | Previous KEs That Cite It |
|--------|--------|------|--------------------------|
| **HN: Forge** | Structural guardrails = capability multiplication (53%→99%) | June 7, 2026 | **None** (new) |
| **HN: Permission fatigue game** | Advisory guardrails → bypass → harm | June 7, 2026 | KE-1678 |
| **Internal: guard events** | 1,193/1,210 triggers are advisory noise | June 11, 2026 (measured this session) | **None** (new measurement) |

Two of three data points are genuinely new to this session. This KE is not recombination of prior sources — it introduces a fresh measurement and a fresh external comparison.

---

## Falsifiable Prediction

If the advisory-to-structural ratio is the relevant variable:

1. **Converting the `beforeToolCall` warning to a targeted `finish()` block** (only when the agent's own deliverables are uncommitted) would reduce guard noise by ~98% while maintaining or improving commit hygiene.

2. **Adding one structural guard for a current top-error-mode** (e.g., blocking sessions that exceed 60 ops without a tool call producing new output) would reduce that error mode's rate comparably to the loop cap's effect on aks-explorer.

3. **No amount of additional advisory warnings** will change agent behavior, regardless of their content. If the system adds 5 new advisory guards tomorrow, the noise floor rises but error rates remain unchanged.

---

## Connections

- **Fresh signal from**: HN June 7 cron (Forge 53%→99%, permission fatigue game)
- **Extends**: KE-1678 (Safety-Fatigue Cycle) — with specific measurement
- **Validates**: KE-1688 (First Fix Measured) — loop cap worked because structural, not advisory
- **Validates**: KE-1671 (Missing Compile Step) — structural guards are "compiled" constraints; advisory warnings are "interpretive"
- **Connects to**: KE-1668 (Locality Principle) — contextual `finish()` blocks are local; uniform `beforeToolCall` warnings are global
- **New data**: 1,193/1,210 advisory ratio and Forge benchmark are both first-cited here
