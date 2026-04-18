# H-167: Typed-Contract Discriminability Modulates Ch2 Intervention Effectiveness

**Created**: 2026-04-18 by Bob
**Status**: proposed
**P(H)**: 0.70 (prior: moderate — convergent evidence across three independent deep-dives, but mechanism not yet tested in our gym under varied contract-specificity conditions)
**Source**: Cross-synthesis of DD-763 (Parallax), DD-764 (dual-trace encoding), DD-765 (cooperative paging) → KE-212, KE-213, KE-214
**Connects**: H-080 (explicit memory > passive context), H-098 (attention-channel theory / Ch2 > Ch1), H-160 (structural enforcement), H-165 (production-displacement), KE-187 (Ch2 sub-taxonomy), KE-188 (P(access) × P(applies)), KE-195/196 (content-first guards), KE-212/213/214 (DD external validations), CR-306/324 (architectural enforcement), CR-335 (context pollution)

---

## Claim

Ch2 (structural / environmental) interventions are not a binary class. **Within Ch2, effectiveness scales with the *discriminability* of the typed contract between in-context reasoning and the external state store.** A typed contract has three parts:

1. **Encoding schema** — what fields/shape each externalized item commits to at write time
2. **Discriminator surface** — the handle (bookmark, label, validator key) that reasoning-side uses to name the item it wants
3. **Retrieval/action verb** — the structural call (`recall()`, validator veto, workflow gate) that returns or enforces the stored item

Ch2 interventions whose contract is **well-typed and uniquely discriminable** on all three dimensions achieve the 87–100% effect we have measured. Ch2 interventions whose contract collapses on any one dimension (schema-less blobs, ambiguous handles, or unstructured verbs) **degrade toward Ch1 effectiveness** even though they remain "structural" by our current taxonomy.

Equivalently: *channel separation is necessary but not sufficient — the channel also has to carry a discriminable signal.*

## Mechanism

Three independent lines of evidence all localize the same sub-mechanism:

- **DD-763 (Parallax / KE-212)**: Cognitive-executive separation works because the validator is a **typed interface** (sensitivity labels, reversal-state contract, graduated-determinism policy). Parallax's 98.9% → 100% jump between default and max-security modes is a *discriminability* knob: tighter types → fewer ambiguous transitions → higher block rate. Remove the types and Parallax degenerates into a second LLM reviewer — i.e., Ch1.
- **DD-765 (Cooperative paging / KE-213)**: `recall()` fires 96% of the time but picks the correct page only 57% — **keyword-specificity alone accounts for 25pp**. Retrieval mechanism is not the bottleneck; *bookmark discriminability* is. Coarse `fixed_20` (96.7%) beats content-aware `topic_shift` (56.7%) because fixed-size pages produce more uniformly distinctive bookmarks.
- **DD-764 (Dual-trace / KE-214)**: Scene-trace encoding lifts recall 53.5% → 73.7%. The gain concentrates exactly where disambiguation is needed (temporal +40pp, knowledge-update +25pp, multi-session aggregation +30pp) and is *zero* on single-session retrieval where no disambiguation is needed. The "drawing effect" **adds discriminators at encoding time**.

Three independent benchmarks (280-case adversarial eval; 300+-turn LoCoMo; 4,575-session LongMemEval-S). Three independent mechanisms (validator, retrieval, encoding). One shared invariant: *the typed contract's ability to uniquely pick out the intended referent is the rate-limiting factor.*

This extends, but does not duplicate:
- **H-080** predicts "explicit write/retrieve > passive accumulation." True, but silent on *what makes a good write*. H-167 adds: the write's discriminator surface governs downstream effectiveness.
- **H-098** predicts "Ch2 > Ch1 on judgment tasks." True, but treats Ch2 as a monolith. H-167 decomposes Ch2 into contract-quality levels and predicts intra-Ch2 variance that H-098 cannot explain.
- **H-160** predicts "structural enforcement > behavioral signaling for interruptive steps." True, but silent on why some structural enforcements fail (e.g., soft workflow notes vs hard gates). H-167 says: a gate whose trigger condition is ambiguous is *structurally present but contractually weak* — predicts Ch1-like collapse.

## Evidence (so far — all external / convergent)

| Source | Observation | Discriminability knob |
|---|---|---|
| DD-763 / KE-212 | 98.9% default → 100% max-security; 0% under prompt guard | Sensitivity-label typing + graduated determinism |
| DD-765 / KE-213 | 96% retrieval fires, 57% correct; `fixed_20` 96.7% vs `topic_shift` 56.7% | Bookmark keyword specificity; page-boundary uniformity |
| DD-764 / KE-214 | +20.2pp overall; +40pp temporal, 0pp single-session | Scene-trace adds encoding-time discriminators |
| Our corpus — KE-007 | Hard-gate workflow 100% vs behavioral skill 0% | Workflow gate has binary schema (step complete? y/n) |
| Our corpus — KE-195/196 | Content-first guard 100% vs production-first 7% on cascading-fix | Injected content is self-labeling; produced content is not |
| Our corpus — KE-188 | GAM memory: high P(access), low P(applies) | Access without discrimination → effect collapses |

## Novel Predictions (distinct from H-080/H-098/H-160)

**P-167a — Intra-Ch2 degradation under ambiguous handles**: A Ch2 workflow gate whose trigger condition overlaps with ≥2 task states (e.g., "write FINDINGS.md" without a schema check) will perform within 20pp of a Ch1 skill on the same scenario. **Discriminator: compare a schema-checked gate vs a bare file-existence gate on cascading-fix-trap. H-098 predicts both succeed; H-167 predicts only the schema-checked version succeeds.**

**P-167b — Bookmark-style degradation in our own memory system**: Taxonomy entries (KE-###, H-###) that share keyword fingerprints will be retrieved-but-misapplied at higher rates than entries with unique keyword signatures, mirroring the 96%/57% gap in DD-765. Measurable via cross-reference error audits.

**P-167c — Encoding-time discriminability predicts cross-session retrieval**: Journal entries written in fact-only form will support worse multi-session synthesis than entries written with scene-trace form, holding retrieval mechanism constant. Mirrors DD-764; prediction is that the same benefit replicates on *our* long-horizon traces.

**P-167d — FM-3.3 is a typed-contract gap, not a verification gap** (see §Failure-mode connection below): finish() does not consume a typed verified-claims artifact. Adding one is predicted to drop FM-3.3 rate by >50% without any behavioral/skill change.

## Falsification

The convergence claim breaks if **any of the following** is observed:

1. A Ch2 intervention with a deliberately non-discriminable contract (e.g., a gate keyed on a hash of the whole context) achieves ≥80% effectiveness on a hard scenario. This would mean channel separation alone suffices, and the "typed contract" decomposition is post-hoc.
2. Scene-trace / bookmark-specificity / validator-typing each produce effects *only* on their native benchmark and *fail to transfer* to even one other domain. This would mean the three DDs' mechanisms are genuinely distinct, and the "shared pattern" is over-generalized.
3. In our gym, schema-checked vs bare file-existence gates produce <10pp difference on cascading-fix-trap. That would falsify P-167a and strongly suggest intra-Ch2 variance is not discriminability-driven.

Any one of (1)–(3) would demote H-167 from a distinct hypothesis to a restatement of H-080/H-098/H-160.

## Test Plan

- **Scenario**: cascading-fix-trap-v2 (difficulty known; KE-195/196 baselines available)
- **Arms** (N=15 each, ~$11 total):
  - A: Ch1 skill only (baseline, expect ~0–10%)
  - B: Ch2 bare file-existence gate ("FINDINGS.md must exist")
  - C: Ch2 schema-checked gate (FINDINGS.md must have {hypothesis, evidence, counter-evidence} fields verified by workflow)
  - D: Ch2 schema-checked gate + dual-trace-style scene field (adds `context_at_write` discriminator)
- **Decision rule**:
  - H-167 confirmed if **D > C ≥ 70% > B + 20pp ≥ A**
  - H-167 falsified if B ≈ C ≈ D within 10pp (intra-Ch2 variance is not discriminability-driven)
  - H-167 degraded-to-H-098 if C > A by >60pp but B also ≥60% (i.e., mere channel separation sufficed)

## Failure-Mode Connection (FM-3.3 / FM-2.6)

Our two most-frequent failure modes on Bob's side both map onto **missing typed contracts**:

- **FM-3.3 (verification discipline slip)**: finish() accepts unstructured claims. There is no typed contract between "I did the work" (in-context reasoning) and "verified evidence exists on disk" (external state). The current guard is a text reminder (Ch1). H-167 predicts: adding a typed `verification_evidence[]` contract — already partially scaffolded — that finish() *consumes* (rejecting self-reports that don't parse against a schema) will shift FM-3.3 from a 1–2/session regression into a near-zero event. This matches the Parallax "validator between reason and execute" pattern almost exactly.
- **FM-2.6 (reasoning-action mismatch)**: agent plans action X, performs action Y. There is no typed contract requiring the emitted tool call to match the stated intent. A lightweight typed plan→action binding (plan.json with action-slots that the action tool must cite by ID) is the structural analog.

Both failure modes are cases where **we already have Ch2 infrastructure (finish guard, plan artifact) but the contract is under-typed**. H-167 predicts this is the ceiling we are hitting — not lack of structural channel, but insufficient contract discriminability inside the channel we built.

## Implications if True

1. **Our Ch2 sub-taxonomy (KE-187) needs a fourth axis**: Self / Environment / World-Model / **Contract-Typing**. Current axes describe *what the gate checks*; typing describes *how discriminably it checks it*.
2. **Content-first guard design (KE-195/196 follow-on)** should prioritize *schema* of injected content over *volume*. Predicts a 20-token typed header beats a 200-token narrative preamble.
3. **Journal / KE-writing discipline** should adopt scene-trace encoding for cross-session synthesis items (direct port of DD-764). Single-session entries unchanged.
4. **Finish-guard redesign**: migrate verification_evidence from a text-matching heuristic to a typed, consumed contract (Parallax validator analog).

## Links

- Deep-dives: DD-763, DD-764, DD-765 (agents/shared/knowledge/library/deep-dives/)
- Evidence KEs: KE-212, KE-213, KE-214
- Parent hypotheses: H-080, H-098, H-160 (this hypothesis refines, does not replace)
- Tracked in: agents/bob/workspace/todo.md

## Related hypotheses

- **H-165 (production-provision interference)**: H-165 predicts self-generated analysis destroys expert information on hard tasks; H-167 reframes that failure as a typed-contract gap — self-produced artifacts lack the discriminator surface (schema/handle) that makes externalized content usable, which is why F2 alone collapses while F1's typed expert artifact succeeds.
- **H-166 (recognition threshold, revised)**: H-166-revised says "any causal pointer" crosses the threshold (0% → ~100%); H-167 predicts the *shape* of that pointer matters too — a causal pointer embedded in a typed, discriminable contract (schema-checked gate, labeled bookmark) is what sustains the effect, while lexical/unstructured pointers risk the A-LEXICAL confound that EXP-177 is designed to rule out.
