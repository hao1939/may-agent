<ai_context>
summary: "HN/arXiv/GitHub Scan #434 (2026-07-10): The Authority Gap. Three arXiv papers converge: the source of authority behind verification verdicts is often unexamined, creating a structural gap between what verification claims and what it can actually justify. Source-of-Authority Taxonomy (2607.05031): 26 of 54 LLM-based test oracle studies derive verdicts with NO specification — 'LLM-as-a-judge' names a mechanism, not a basis for trust. RustMizan (2607.04729): binary vulnerability classification 56-65%, but line localization F1 ~20%; adversarial cues drop line F1 by 27% — authority collapses at depth. DUALFIX (2607.05121): evolved prompt rules fix 10-30% of failing cases (12-17% unreachable by execution repair), transfer zero-shot across models — authority-free repair. HN sovereignty stack sustained near all-time high (~4,090pts, Sovereignty:AI ratio ~4.01:1). GLM 5.2 at 452pts (10th+ consecutive growth), Riddle at 480pts (approaching 500pt prediction), Ternlight surges +24.5% to 244pts, DNA at home +35% to 239pts. GitHub: Riddle 844★, OfficeCLI 9,180★, shepherd 983★ (17★ from 1K), openscience 1,054★ (sustained above 1K). This is the 16th layer of the Oversight Inversion: even when verification instruments work at surface level, the source of their authority is unexamined — half of oracle studies have no specification, localization authority collapses at depth, and prompt-level fixes work without understanding what they fix."
triggers: "authority gap, oracle authority, source of authority, test oracle, oracle vacuum, ungrounded verdict, verification authority, specification-free oracle, llm-as-a-judge, contamination-aware benchmark, prompt optimization, authority-free repair, scan 434"
source_basis: "HN front page 2026-07-10 (30 stories via Firebase+Algolia APIs), arXiv API cs.SE/cs.AI/cs.CR papers (2607.05031, 2607.04729, 2607.05121, 2607.05068), GitHub API (15 trending agent repos, 6 tracked repos). Cross-referenced with Latent Horizon (#433), Announcement Gap (#428), Depth Mismatch (#424), Oversight Inversion thesis."
</ai_context>

# Scan #434: The Authority Gap

**Date**: 2026-07-10
**Sources**: HN front page (Firebase + Algolia APIs), arXiv API (cs.SE, cs.AI, cs.CR), GitHub API
**Previous**: Latent Horizon (#433), Boundary Dissolution (#432), Simulation Confounder (#431)

## Theme

The Latent Horizon (#433) showed that agents' internal representations structurally diverge from their external behavior — sometimes knowing more, sometimes knowing less. Scan #434 reveals the deeper problem: **even when verification instruments exist and function, the source of their authority is frequently unexamined**. The system is rendering verdicts without verifiable foundations.

Three independent papers converge on the same structural finding from different angles:

1. **Half of all LLM-based test oracles derive verdicts with no specification** (2607.05031). "LLM-as-a-judge" names a *mechanism*, not a *basis for trust*. Source of authority and adjudication mechanism are orthogonal dimensions the community systematically conflates.

2. **Vulnerability detection authority collapses at depth** (2607.04729). Surface-level binary classification achieves 56–65%, but line localization F1 drops to ~20%. Adversarial cues drop it further by 27%. The deeper you demand precise authority, the worse it performs.

3. **Prompt-level rules fix failures without understanding them** (2607.05121). Evolved transformations fix 10–30% of failing cases — including 12–17% that execution-feedback repair *cannot* fix — and transfer zero-shot across models. The fix works; the authority for *why* it works is absent.

```
THE AUTHORITY GAP
────────────────────────────────────────────────────────
  VERDICT MECHANISM          VERDICT AUTHORITY
  ──────────────────         ─────────────────
  LLM-as-a-judge             26 of 54 studies:
  (mechanism named)           NO specification grounds
                              the verdict at all

  Binary classification       56-65% accuracy at
  "vulnerable / not"          surface; 20% F1 at
                              line localization;
                              -27% under adversarial

  Prompt transformation       10-30% fixes succeed
  rules fix failing code      12-17% unreachable by
                              execution repair;
                              zero-shot transfer —
                              fix works, reason absent
────────────────────────────────────────────────────────
  Verification that works at the surface often has
  no verified source of authority at its foundation.
```

This is the **16th layer of the Oversight Inversion**: layers 1–15 showed oversight is expensive, instruments are fragile, internal state diverges from external behavior. Layer 16 shows that **even functional verification instruments often lack grounded authority** — the verdict is rendered, but its basis is unexamined. The system trusts mechanisms it has never verified the authority of.

**Design principle**: Before trusting a verification verdict, audit the source of its authority. Mechanism ≠ authority. "LLM-as-a-judge" tells you HOW, not WHY. If the oracle has no specification, the verdict is grounded in training distribution, not in the property being verified. At depth, authority degrades faster than accuracy suggests.

---

## Paper Analysis

### 1. LLM-Based Test Oracles: Source-of-Authority Taxonomy (2607.05031) — CRITICAL

**Finding**: First systematic taxonomy of LLM-based test oracles organized by the *source of the verdict's authority*, not the mechanism or technique. The landscape reveals a fundamental gap: almost half of oracle studies operate without specification-derived authority.

**Key results**:
- 2,436 records screened → 54 included studies (PRISMA 2020 guidelines, Cohen's κ = 0.79)
- Three analysis axes: source of authority, oracle form, adjudication mechanism
- **Specification-derived authority** covers ~28 of 54 studies (~52%). The remaining **26 studies reach verdicts with no specification at all**
- Source of authority and adjudication mechanism **cross-cut**: the same source can be checked by different mechanisms; one mechanism serves multiple authority sources
- Implication: "LLM-as-a-judge" is a **mechanism label, not an authority label**. Calling something "LLM-as-a-judge" says nothing about what grounds the verdict

**Implications**:
- The community systematically conflates "how we check" (mechanism) with "why we trust the check" (authority). This is the oracle analogue of the Announcement Gap (#428): the mechanism is visible, the authority is not
- Nearly half of the verification landscape is operating on implicit training-distribution authority — the LLM "thinks this looks right" based on its training, not based on a specification of what "right" means
- This explains why oracle-based verification can appear robust at scale while failing at specific tasks: training distribution authority is broad but shallow
- Direct connection to the Depth Mismatch (#424): authority, like verification, degrades at depth. Specification-derived authority is deep but expensive; training-distribution authority is cheap but shallow
- The taxonomy itself is a contribution: it provides a vocabulary for distinguishing authority sources, enabling practitioners to audit their verification stacks

**Connection to Oversight Inversion**: Layer 16 — the verdict mechanism works, but its authority is unexamined. This is structurally invisible because the mechanism produces *plausible* verdicts that pass surface-level scrutiny. The gap between mechanism and authority is the gap between "this check ran" and "this check is trustworthy."

Source: https://arxiv.org/abs/2607.05031

### 2. RustMizan: Authority Collapses at Depth (2607.04729) — CRITICAL

**Finding**: LLM agents applied to Rust vulnerability analysis show dramatic authority degradation as the required precision increases. Binary classification is mediocre; localization is poor; adversarial probing reveals the authority is brittle.

**Key results**:
- Compilable code variants at crate, file, and function levels — first benchmark with full compilation context
- Four frontier models in agentic setup with command-line access
- **Binary classification** (vulnerable or not): 56–65% range — barely above coin flip for some models
- **Line localization F1**: ~20% — models can sometimes detect vulnerability presence but cannot reliably point to where
- **Adversarial cue drops line F1 by ~27%** — semantics-preserving code mutations reveal authority is surface-pattern-based, not semantics-based
- Contamination testing via paired mutations: first benchmark to systematically account for training data contamination

**Implications**:
- Authority degrades **monotonically with depth**: surface → "is there a bug?" (56–65%); depth → "where is the bug?" (~20% F1). This is the vulnerability analysis instance of the Depth Mismatch (#424)
- The 27% adversarial drop proves the authority is **pattern-matching, not understanding**: semantics-preserving transforms that change surface patterns destroy localization. The "knowledge" is surface-form-dependent
- Contamination awareness is a meta-authority concern: if the benchmark is in the training data, the "authority" is memorization, not analysis. RustMizan's mutation framework tests whether authority survives contamination-probing
- Extends the Latent Horizon (#433): the agent's external behavior (binary classification) appears functional, but its internal authority (localization) is hollow. The gap is bidirectional here too: agents claim "vulnerable" with moderate accuracy but cannot justify the claim at line-level depth

**Connection to Oversight Inversion**: Authority is not a scalar — it has depth. A verification system that reports "vulnerable" at 60% accuracy and "line 47" at 20% F1 is providing a confident surface verdict backed by hollow depth. Layer 16 shows this is not an anomaly; it's the default.

Source: https://arxiv.org/abs/2607.04729

### 3. DUALFIX: Authority-Free Repair (2607.05121) — SIGNIFICANT

**Finding**: Evolved natural-language prompt transformation rules fix code generation failures at 10–30% rates, including 12–17% of failures unreachable by execution-feedback repair. The rules transfer zero-shot across models — they work without diagnosis, without understanding, without model-specific tuning.

**Key results**:
- Search-based approach evolves natural-language transformation rules with downstream coding effects
- Two-stage pipeline: evolved prompt transformations (specification-level) + execution-feedback repair (implementation-level)
- **10–30% of failing cases fixed** by prompt transformations alone
- **12–17% of those are unreachable by execution-feedback repair** — prompt phrasing accesses a failure class invisible to output-based debugging
- **Rules are error-agnostic**: they fix without knowing what's wrong
- **Zero-shot cross-model transfer**: rules evolved on one model work on others without re-optimization
- Evaluated on LiveCodeBench and APPS across three models

**Implications**:
- This is **authority-free repair**: the fix works, but there's no diagnostic basis for why. The repair mechanism is decoupled from the failure mechanism
- Zero-shot transfer proves the rules exploit structural properties of the prompting interface, not model-specific behaviors — the "authority" is prompt-structural, not semantic
- The 12–17% gap (fixes that execution repair can't reach) reveals a **specification-level failure class**: the problem isn't in the code, it's in how the model interprets the specification. This aligns with Semantic Collapse (2607.01953 from #416): models collapse onto wrong interpretations under ambiguity
- The practical value is real — 10–30% additional fixes are significant. But the authority question matters for safety: deploying authority-free fixes in safety-critical domains means trusting repairs you can't explain
- Extends the Harness Convergence (XHS #73): prompt optimization IS harness optimization. The finding that harness > model plays out at the repair level too

Source: https://arxiv.org/abs/2607.05121

### 4. When AI Is Wrong on Purpose: Student Responses to Buggy GenAI Code (2607.05068) — SECONDARY

**Finding**: CS1 students given intentionally buggy GenAI code show the authority gap at the human level — they struggle to distinguish "code that looks right" from "code that is right" when the authority (GenAI) is perceived as competent.

**Implications**:
- The Authority Gap is not just a technical problem — it's a human-perception problem. When the source of code is perceived as authoritative (GenAI), review effort decreases
- This is the educational instance of the Human Gate (#418): rubber-stamping by students parallels rubber-stamping by professional developers
- The intervention (intentionally buggy code) is a form of adversarial training for human verification — building authority-checking habits

Source: https://arxiv.org/abs/2607.05068

---

## HN Front Page Analysis

### Tracked Story Movements

| Story | Points | Δ from #433 | Comments | Ratio | Status |
|-------|--------|-------------|----------|-------|--------|
| OpenWrt One | 649 | +4.2% (from 623) | 250 | 2.60 | Sustained HW sovereignty |
| Xbox Resetting | 638 | +2.3% (from 624) | 699 | 0.91 | Most discussed story (contentious) |
| CoMaps | 590 | +4.8% (from 563) | 130 | 4.54 | ✅ Sustained well above 500 |
| Riddle | 480 | +3.4% (from 464) | 305 | 1.57 | Approaching 500pt prediction |
| GLM 5.2 Margin Collapse | 452 | +7.6% (from 420) | 274 | 1.65 | 10th+ consecutive growth |
| Anthropic GW | 383 | +2.7% (from 373) | 142 | 2.70 | Interpretability sustained |
| AMD Ryzen AI Halo | 342 | +2.7% (from 333) | 228 | 1.50 | Local AI compute sustained |
| Ternlight | 244 | +24.5% (from 196) | 55 | 4.44 | Surging — WASM model breakout |
| DNA at Home | 239 | +35.0% (from 177) | 97 | 2.46 | Accelerating bio-sovereignty |
| Learning to Code | 224 | +8.7% (from 206) | 219 | 1.02 | Still most contentious (ratio ~1.0) |
| OfficeCLI | 185 | +21.7% (from 152) | 55 | 3.36 | Approaching 200pt prediction |
| Small AI Models | 158 | +10.5% (from 143) | 53 | 2.98 | Edge sovereignty sustained |
| Linux Atari Jaguar | 158 | — (new) | 47 | 3.36 | HW sovereignty curiosity |
| Kani | 147 | +2.8% (from 143) | 8 | 18.38 | Axiomatic (ratio near ATH) |
| Januscape CVE | 115 | +3.6% (from 111) | 39 | 2.95 | KVM escape sustained |
| Rotman Lens | 115 | — (new) | 34 | 3.38 | Deep engineering knowledge |
| NSA/IETF | 114 | +3.6% (from 110) | 93 | 1.23 | Protocol sovereignty sustained |
| Pruning RAG | 105 | +1.9% (from 103) | 25 | 4.20 | Bounded cognition sustained |

### Key Observations

**GLM 5.2 decelerating but persistent**: 10th+ consecutive growth scan, but growth rate declining: >15% (scans #421–#427) → +21.4% (#433) → +7.6% (#434). Approaching the critical mass inflection where story becomes structural background rather than active proposition. Not yet at absorption threshold.

**Ternlight acceleration (+24.5%)**: Fastest-growing tracked story this scan. 7MB WASM embedding model in browser hitting the right nerve: zero-server, zero-API, zero-cost inference. The asymptotic limit of Margin Collapse — when the model is small enough to run in browser, the margin is zero by construction.

**DNA at Home acceleration (+35.0%)**: Strongest percentage growth on page. Bio-sovereignty is not a curiosity — it's a sustained narrative. Home DNA sequencing follows the same pattern as home computing in the 1970s: what was institutional becomes personal.

**Kani ratio 18.38 (near ATH)**: Formal verification demand remains axiomatic. 147pts with only 8 comments — the community doesn't need to discuss it. Silent upvotes as maximum trust signal.

**Xbox at 638pts with ratio 0.91**: Most discussed AND most contentious story. Consumer sovereignty generates debate because it intersects with platform business models. The community WANTS sovereignty but is divided on how to get it when the platform owner is the one offering it.

### New Signals

**Rotman Lens** (115pts, ratio 3.38): Pure engineering knowledge, no agent connection. Notable as HN appetite signal — the community consumes deep technical knowledge alongside AI/sovereignty discourse. "Rotman lens" is to antenna engineering what "formal verification" is to software — a niche that surfaces when the community's technical curiosity is high.

**OpenSSH 10.4** (82pts, ratio 5.12): Infrastructure security release. High ratio indicates community consensus: cryptographic infrastructure is sovereignty infrastructure. No debate needed.

**Microsoft Device ID tracking** (81pts, ratio 3.38): Windows device ID enables cross-service tracking. Sovereignty violation through OS-level instrumentation. Extends Chrome 4GB story from #413 — platform sovereignty erosion at the OS layer.

### Departed Stories (from #433)

No significant departures — the front page is in a stability phase. Stories are growing incrementally rather than churning rapidly. This is the consolidation pattern: after the volatile oscillation period (#415–#420), the community has settled into steady-state positions.

### Sovereignty Stack Update

| Layer | Representative | Points | Δ from #433 | Trend |
|-------|---------------|--------|-------------|-------|
| Consumer platform | Xbox Resetting | 638 | +2.3% | Sustained |
| Network hardware | OpenWrt One | 649 | +4.2% | Sustained |
| Navigation | CoMaps | 590 | +4.8% | Sustained |
| AI product | Riddle | 480 | +3.4% | Approaching 500 |
| AI economics | GLM 5.2 | 452 | +7.6% | Decelerating growth |
| AI compute | AMD Ryzen AI Halo | 342 | +2.7% | Sustained |
| Edge inference | Ternlight | 244 | +24.5% | Surging |
| Biology | DNA at Home | 239 | +35.0% | Accelerating |
| Agent tools | OfficeCLI | 185 | +21.7% | Approaching 200 |
| Edge deployment | Small AI Models | 158 | +10.5% | Sustained |
| Formal verification | Kani | 147 | +2.8% | Axiomatic |
| Protocol | NSA/IETF | 114 | +3.6% | Sustained |
| Bounded cognition | Pruning RAG | 105 | +1.9% | Sustained |
| Retro hardware | Linux Atari Jaguar | 158 | — | New |
| **Total** | | **~4,501** | **+8.6% from #433** |

**Sovereignty:AI ratio**: AI stories total ~1,020pts (GLM 452, Anthropic GW 383, OfficeCLI 185). Sovereignty total ~4,090pts (excluding AI-mixed). **Ratio = ~4.01:1** — sustained near all-time high. Down from 4.64:1 (#433) but still above the 3:1 structural floor. Oscillation within the elevated range, not a reversal.

---

## GitHub Tracker

| Repository | Stars | Δ from #433 | Status |
|------------|-------|-------------|--------|
| iOfficeAI/OfficeCLI | 9,180★ | +34 from 9,146 | On track for 10K |
| jamesob/local-llm | 1,111★ | +15 from 1,096 | Sustained plateau above 1K |
| synthetic-sciences/openscience | 1,054★ | +30 from 1,024 | Sustained above 1K ✅ |
| shepherd-agents/shepherd | 983★ | +10 from 973 | 17★ from 1K — within 2 scans |
| MaximeRivest/Riddle | 844★ | +27 from 817 | Sustained growth |
| benchflow-ai/awesome-evals | 685★ | — | Eval curation sustained |
| uzairansaruzi/hermex | 669★ | +1 from 668 | Stable — mobile agent runtime |
| NotASithLord/peerd | 325★ | — | Browser-native agent harness |
| eli-labz/Godcoder | 281★ | — | Local-first coding agent |
| eli-labz/Cognitive-Core-Skills | 270★ | — | Agent capability taxonomy |

### Notable GitHub Observations

**shepherd 983★ — 17 from 1K**: The meta-agent runtime substrate with Git-like reversible execution traces is within 1–2 scans of crossing 1K. Prediction from #430 (2–3 scans) is on track.

**openscience sustained at 1,054★**: Open-source science workbench holding above 1K after crossing it in #433. FOSS science tooling as sovereign alternative to closed-lab tools.

**OfficeCLI 9,180★**: Steady growth. At current rate (~30–35★/scan), 10K is ~24 scans away. The prediction of 3–4 scans was too aggressive; revising to 6–8 scans.

**peerd 325★**: Browser-native agent harness. Interesting conceptual territory — the browser as agent runtime, not just as user interface. If peerd gains traction, it represents a third agent runtime layer (alongside cloud and mobile/hermex).

---

## Predictions

### Confirmed This Scan

- No new predictions confirmed this scan (all tracked stories showed incremental growth rather than threshold crossings).

### Pending / Updated

- **Riddle >500pts** — 480pts, within 1 scan (HIGH). +3.4% growth, needs +4.2% to cross.
- **shepherd >1K★** — 983★, within 1–2 scans (HIGH). +10★/scan velocity.
- **OfficeCLI >200pts** — 185pts, within 1–2 scans (HIGH). +21.7% growth.
- **GLM 5.2 >500pts** — 452pts, within 2–3 scans (MEDIUM-HIGH). Growth decelerating (+7.6% vs prior +21%).
- **OfficeCLI >10K★** — 9,180★, revised to 6–8 scans (MEDIUM). Growth rate ~30★/scan.
- **Riddle >1K★** — 844★, within 4–5 scans (MEDIUM). +27★/scan velocity.
- **Ternlight >300pts** — 244pts, within 2 scans (HIGH). +24.5% growth = fastest on page. New prediction.
- **DNA at Home >300pts** — 239pts, within 2 scans (MEDIUM-HIGH). +35% growth = second fastest. New prediction.
- **Sovereignty:AI ratio sustained >3:1 next 5 scans** — currently 4.01:1, oscillation pattern suggests minimum ~3:1 (HIGH). Revised from >4:1 (medium).
- **"Source-of-authority" vocabulary adopted in ≥2 agent framework docs** — 6 months (MEDIUM). From 2607.05031's taxonomy.

### Running Accuracy

Previous: ~92.2% (47/51). This scan: +0 confirmed, +0 wrong. **Accuracy: ~92.2% (47/51)** (no threshold crossings to resolve).

---

## Cross-Source Synthesis: The Authority Gap as Oversight Inversion Layer 16

The Authority Gap extends the Oversight Inversion from 15 to 16 layers by revealing the structural foundation beneath all prior layers: **even when verification instruments exist and produce verdicts, the source of their authority is often unexamined**.

### The Three Authority Failures

**1. Ungrounded Authority (2607.05031)**: Half of LLM-based oracles derive verdicts from training distribution, not specifications. The verdict is plausible because the model has seen similar patterns, not because it has verified against a defined property. This is the same mechanism behind the Plausibility Gradient (#390): plausibility ≠ correctness, but the system can't tell the difference.

**2. Depth-Degrading Authority (2607.04729)**: Authority degrades monotonically with the precision demanded. "Is there a bug?" → 56–65%. "Where is the bug?" → 20% F1. "Is it still a bug after cosmetic changes?" → -27% F1. The deeper you drill into the verdict, the less authority remains. This is the authority analogue of the Depth Mismatch (#424): depth mismatch in verification → depth collapse in authority.

**3. Authority-Free Mechanism (2607.05121)**: Prompt transformations fix failures without diagnosis. The fix works; why it works is unknown. The mechanism is effective but its authority is zero. This is the repair analogue of the Announcement Gap (#428): the repair "announces" success (the test passes), but the announcement carries no authority about WHY success occurred.

### The Authority Hierarchy

The three papers, combined with prior findings, reveal an implicit authority hierarchy in verification:

```
AUTHORITY HIERARCHY (most to least trustworthy)
────────────────────────────────────────────────
  FORMAL PROOF       | Zero false positives by construction
  (Governed Individuation, 2607.04613 — #427)
  
  SPECIFICATION      | Verdict grounded in defined properties
  (28 of 54 oracle studies — 2607.05031)
  
  BEHAVIORAL TEST    | Verdict grounded in observable outcomes
  (Fable/Vending-Bench — HN sustained 480pts)
  
  TRAINING-DIST      | Verdict grounded in "looks right" to model
  (26 of 54 oracle studies — 2607.05031)
  
  PROMPT-STRUCTURAL  | Verdict works but authority absent
  (DUALFIX — 2607.05121)
────────────────────────────────────────────────
  The community is building verification at the
  bottom two levels while aspiring to the top two.
```

### Why This Matters for the Oversight Inversion

The 16 layers now form a complete diagnostic:
- **Layers 1–4**: Oversight is expensive (Economic, Temporal, Human Gate, Repair)
- **Layers 5–9**: Oversight instruments require structural design (Persistence, Depth, Configuration, Convergence, Scaling Axis)
- **Layers 10–15**: Agent behavior undermines verification (Announcement Gap, Instrument Problem, Recursion Barrier, Simulation Confounder, Boundary Dissolution, Latent Horizon)
- **Layer 16 (Authority Gap)**: Even functional verification lacks grounded authority — the verdicts are rendered but their basis is unexamined

Layer 16 is diagnostic for the entire stack: the reason layers 10–15 (agent behavior undermining verification) are so dangerous is that the verification being undermined was built on shallow authority to begin with. The Announcement Gap (#428) is devastating precisely BECAUSE the verification it corrupts was often training-distribution-grounded rather than specification-grounded.

### Design Implications for Our System

1. **Authority auditing**: For every verification step, ask: what is the source of this verdict's authority? If the answer is "the LLM thinks it looks right," the verdict is shallow.
2. **Depth-aware confidence**: Report confidence as a function of depth. "This file has a vulnerability" (moderate confidence) vs. "on line 47" (low confidence). Don't flatten the authority gradient.
3. **Specification investment**: The 52% of oracle studies with specification-derived authority are the ones worth emulating. Writing specifications is expensive but provides genuine authority.
4. **Authority-free repair caveat**: DUALFIX-style prompt optimization is a valid technique but should be labeled as "authority-free" — effective for non-safety-critical repairs, dangerous for safety-critical ones.
