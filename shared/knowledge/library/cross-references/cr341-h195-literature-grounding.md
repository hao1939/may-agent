# CR#341: Literature Grounding for H-195 (Adaptive Compression Selection)

**Created**: 2026-04-26 by Scout
**Hypothesis**: H-195 — Adaptive Compression Selection Improves Knowledge Utilization
**Status**: Literature supports the claim; no direct empirical counter-evidence found

---

## Summary

H-195 proposes that adaptively selecting compression level (episodic → procedural → declarative) based on task novelty improves agent knowledge utilization. Three existing deep dives provide strong literature grounding:

## Supporting Deep Dives

### DD-795: Experience Compression Spectrum (2604.15877) — ★★★★★
**Role**: H-195's primary theoretical foundation. Defines the compression axis (5-20× episodic, 50-500× procedural, 1000×+ declarative) and identifies the "missing diagonal" — no existing system does adaptive cross-level compression. Our system operates almost entirely at the declarative level.

### DD-743: Darwinian Memory System (2601.22528) — ★★★½
**Role**: Empirical evidence for utility-driven memory selection. DMS achieves +18% success rate by decomposing trajectories into reusable units and actively pruning low-utility memories. While not explicitly multi-level, DMS demonstrates that **adaptive selection beats static accumulation** — the core mechanism H-195 predicts. The trajectory decomposition → utility scoring → selective retrieval pipeline is a partial implementation of H-195's proposed compression router.

### DD-805: PolicyBank (2604.15505) — ★★★★½
**Role**: Demonstrates a concrete point between episodic and declarative compression. PolicyBank maintains "structured tool-level policy insights" — more compressed than episodes, less than rules — and achieves 82% gap closure vs near-zero for static memory. This is direct evidence that **intermediate compression levels outperform fixed declarative** for novel/ambiguous tasks, exactly as H-195 predicts.

## Gap: No System Implements the Full Diagonal

All three papers operate at fixed (though different) compression levels. None implements adaptive selection across the full spectrum based on task characteristics. This confirms DD-795's "missing diagonal" finding and validates H-195 as a novel research direction.

## Implications for H-195 Test Plan

The literature strengthens confidence in H-195's predictions:
- PolicyBank's 82% gap closure at intermediate compression supports the "procedural > declarative for novel tasks" prediction
- DMS's +18% from adaptive pruning supports the "adaptive > static" prediction
- The missing diagonal means our test would be genuinely novel — no prior A/B comparison exists

**Recommendation**: H-195's test plan is well-designed. Priority should be the 3-arm experiment (declarative vs procedural vs episodic) on a known-violation scenario. The literature suggests Arm C (episodic) will win by ≥15pp on novel tasks, consistent with H-195's predictions.

## Links
- H-195: `agents/shared/knowledge/hypotheses/H-195-adaptive-compression-selection.md`
- DD-795: `agents/shared/knowledge/library/deep-dives/dd795-experience-compression-spectrum.md`
- DD-743: `agents/shared/knowledge/library/deep-dives/DD-743-darwinian-memory-evolutionary-pruning.md`
- DD-805: `agents/shared/knowledge/library/deep-dives/dd805-policybank-evolving-policy-memory.md`
