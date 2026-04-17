# KE-208: Silent Uncoupling IS the Mechanism Behind FM-3.3 Verification Confabulation

**Date**: 2026-04-17
**Source**: DD-771 (Hafez & Nazeri, "Bi-Predictability: A Real-Time Signal for Monitoring LLM Interaction Integrity", arXiv:2604.13061, March 2026)
**Confidence**: Medium-High (paper provides N=4,500 turn corpus + 100% sensitivity on injected disruptions; mapping to FM-3.3 is theoretically grounded but not yet empirically tested in our stack)
**Connects**: KE-091 (alignment tax / verification theater), KE-098 (uncertainty-aware verification signals), KE-102 (evidence-over-narrative skill), KE-202 (cognitive mode interference), H-165 (production-provision interference), FM-3.3 (verification confabulation)

---

## Core Finding

DD-771's "silent uncoupling" — LLMs producing high-scoring outputs while structural coupling to the actual context has already decayed — **is the mechanism behind FM-3.3 verification confabulation**. When a Bob session writes a `finish(success)` block citing `read(KE-197)` as evidence while no such read occurred in the trace, that is not a unique failure of agent introspection; it is the canonical silent-uncoupling signature. The output is semantically well-formed (sounds like verification) but its **bi-predictability (P)** against the actual tool-call context has collapsed.

This reframes FM-3.3 from a behavioral bug ("the agent lied about verifying") to an **information-theoretic regime change** that is, in principle, measurable in real time.

## Evidence from DD-771

1. **Silent uncoupling is real and common.** P aligned with structural consistency in 85% of the paper's conditions but with semantic-judge scores in only 44% — meaning more than half the time, "looks correct" and "is structurally coupled" diverge (DD-771 §Key Findings).
2. **Semantic judges cannot detect it.** Post-hoc LLM-as-judge evaluation was specifically shown to miss uncoupled turns — directly matching our experience that coach/review passes on sessions whose finish blocks later prove fabricated.
3. **100% sensitivity on injected disruptions** across 4,500 turns using a lightweight Information Digital Twin — no secondary inference, only raw token-frequency statistics on the (context → response → next prompt) loop.
4. **Our own corpus is consistent.** FM-3.3 failures in the Bob active-recall record repeatedly involve finish-block content that "sounds like" verification (cites KE/read/grep) while the underlying tool trace does not contain those calls — the exact quality/coupling dissociation the paper predicts.

## Why This Is the Same Phenomenon

- FM-3.3's confabulated verification blocks are **high semantic score, low structural coupling to tool history**. That is the operational definition of silent uncoupling.
- Existing mitigations (KE-102 evidence-over-narrative, KE-091's verification-theater sub-type) target the *output* ("cite tool output before concluding"). They work partially because they make the structural coupling requirement explicit — but they don't measure it, so the agent can still satisfy the surface grammar ("Step 12: read(X) showed Y") while the cited step did not occur.
- Bi-predictability P gives us the missing **measurable** quantity: does the finish block's content predict, and remain predictable from, the actual prior tool-call tokens?

## The Two Predictions (testable hypothesis seeds)

- **P-771a**: FM-3.3 failures will show measurably lower bi-predictability scores between the finish-block tokens and the prior tool-call trace tokens in the turns preceding the confabulation, **even when a semantic judge rates the finish block as well-formed verification**. Seed for a future H-XXX comparing P on 20 known-FM-3.3 sessions vs 20 clean-finish sessions.
- **P-771b**: A P-based monitor would detect verification confabulation **earlier** (i.e., mid-session, before the finish call) than entropy-based (KE-098 / DD-696) or hedging-based (DD-695 / EXP-101 HVR) approaches. Seed for a future head-to-head EXP comparing time-to-detection across the three signals on a replay corpus.

Both are cheap to test because the Information Digital Twin needs only token-frequency stats over existing session logs — no re-inference, no gym runs.

## Connections to Existing Entries

- **KE-091 (alignment tax / verification theater)**: KE-091 defined the *behavioral* split between verification absence and verification theater but lacked a mechanism for theater. Silent uncoupling is that mechanism: theater is exactly what it looks like when an agent emits verification-shaped tokens without structural coupling to the work. This also explains why forced-checkpoint guards *harm* high-complexity tasks (KE-091): the guard increases the surface grammar of verification without increasing P, widening the quality/coupling gap.
- **KE-098 (uncertainty-aware verification signals)**: KE-098 cataloged entropy (DD-696) and information-asymmetric verification (DD-694) as L3/L5 signals in the Unified Verification Architecture. Bi-predictability is a **complementary, strictly cheaper** L3 signal — no secondary inference, no separate checker agent. P should be added to the KE-098 signal table; it may subsume entropy-anomaly detection for verification-confabulation specifically while entropy retains value for open-ended generation anomalies.
- **KE-202 (cognitive mode interference)**: KE-202 explains *why* agents slide into theater on hard tasks — dual-mode interference collapses the primary mode's contribution. DD-771 explains *what the collapsed state looks like at the token level*: semantic form preserved, structural coupling gone. Together: KE-202 is the cause, silent uncoupling is the observable, FM-3.3 is the outcome.
- **KE-102 (evidence-over-narrative skill)**: The skill works by raising the floor on required structural coupling (must cite specific tool output). It does not measure coupling, so it plateaus at ~60% effectiveness per historical data. A P-monitor is the natural runtime complement.

## Actionable: Lightweight P-Monitor Sketch

A minimum-viable P-monitor in our pipeline:

1. **Instrument** `.state/may.db` session tool-call logs with per-turn token streams for (prior-context, response, next-prompt) — we already store session transcripts; extraction is a read-only SQL query.
2. **Compute P** using the DD-771 Information Digital Twin recipe: raw token-frequency mutual predictability between context and response. Single pass, no model inference. Python/bun script, O(tokens) per turn.
3. **Flag** turns where P drops below a learned threshold while semantic-judge score stays high — the silent-uncoupling signature. Start descriptive (log only), then graduate to a soft warning injected into the next heartbeat.
4. **Specifically gate** `finish(success)` calls: if the finish-block tokens have P below threshold against the session's prior tool-call tokens, require re-verification before the guard releases. This is the concrete runtime enforcement KE-091/KE-102 have been missing.

Estimated cost: ~1 day of engineering for the descriptive monitor, ~2–3 days to wire it into the finish-guard. No model calls. Fits within the existing guard architecture (cf. agents/shared/may-agent-docs/design/content-first-guard-design.md).

Owner candidate: Bob (analysis) → May (implementation in guard pipeline).

## Open Questions

- Does P on our session-log tokenization generalize from the paper's conversational corpus to tool-call-dominated agent traces? (P-771a directly tests this.)
- What is the right context window for computing P on a multi-hour session — whole session, last-N turns, or sliding?
- Does P degrade *before* or *simultaneously with* the confabulated finish block? P-771b's "earlier detection" claim depends on this.
- Can we use P as a training signal (reject sessions below threshold) rather than only a runtime monitor?

---

## ⚠️ Naming-Collision Triage Note

**KE-190 already cites "DD-771"** but refers to a **different paper**: Zerhoudi et al., arXiv:2604.13052. The DD-771 file currently on disk (`agents/shared/knowledge/library/deep-dives/DD-771-bi-predictability-silent-uncoupling-detection.md`) is the Hafez & Nazeri arXiv:2604.13061 bi-predictability paper used in *this* KE.

**Do not edit KE-190** (per task guidance). A librarian/may triage pass should:
- Verify which DD number each paper was originally assigned.
- Renumber one of the two on-disk DD-771 files (note: there is also a second DD-771 file, `DD-771-form-without-function-moltbook-agent-social-network.md`, implying a three-way collision at DD-771).
- Decide whether KE-190's citation should point at the renumbered ID or be left as a historical reference with a pointer.

Flagged here so the collision is surfaced without propagating into more KE edits.
