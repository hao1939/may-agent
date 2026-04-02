# Synthesis: Threat Landscape (Scout Research)

**Date:** 2026-03-14
**Source:** Scout (Grand Unified Synthesis, Arbiter, AgentOS)
**Theme:** The 8-Layer Agent Construction Stack

This synthesis maps Scout's massive "Grand Unified Synthesis" (GUS) to our current `agents/shared/philosophy.md` and `agents/shared/best-practices.md`.

## 1. The Arbiter Finding (arXiv:2603.08993)
**Finding:** "Prompt Architecture predicts failure class." Monolithic prompts (like `SOUL.md`) generate "Growth-Level Bugs" (conflicting directives) that the LLM cannot detect (Observer's Paradox).
**Our Gap:** Our `SOUL.md` files are untested monolithic software.
**Action (P109):** We must treat `SOUL.md` as code.
- **Immediate:** Run a "CowAgent" interference test on Bob (done previously, effective).
- **Structural:** Split `SOUL.md` into distinct, non-overlapping modules (Identity vs. Tools vs. Protocols). *This is partially done with `skills/`.*

## 2. Memory as Attack Surface (arXiv:2603.10062)
**Finding:** Shared memory pools (`SIGNALS.md`) are vulnerable to "Information Cascades" (0.3% poison rate → 100% corruption).
**Our Gap:** `SIGNALS.md` is wide open. Any compromised agent can write a fake signal.
**Action (P53/P69):**
- **Provenance:** Every signal needs a `[SIG: <agent>:<hash>]`.
- **Skepticism:** Agents must verify critical signals before acting.
- **Isolation:** `SIGNALS.md` should be append-only and periodically pruned by a trusted authority (May), not mutable by everyone.

## 3. The Co-Evolution Trap (Molt Dynamics)
**Finding:** Agents cluster by model family ("Tribes") and exhibit "Echo Chambers". Identical agents degrade performance (Intelligence Worsens Outcomes).
**Our Gap:** We use homogeneous models (mostly Opus/GPT-4) for similar roles.
**Action (P64):** Enforce **Heterogeneous Collaboration**.
- **Rule:** If Coder is Opus, QA *must* be GPT-5 or Gemini.
- **Why:** To break the echo chamber. Different models have different blind spots.

## 4. The Agent Construction Stack (L1-L8)
Scout identifies 8 layers. We are strong on L1 (Identity) and L2 (Tools), but weak on:
- **L3 (Behavioral Spec):** No tests for agent behavior.
- **L5 (Policy Externalization):** Policies are in prompts, not code.
- **L7 (State Machine):** Implicit state only.

**Conclusion:** Our "Consolidation Mode" fits perfectly. We need to fill L3/L5/L7 gaps before adding new L8 (Self-Improvement) capabilities.
