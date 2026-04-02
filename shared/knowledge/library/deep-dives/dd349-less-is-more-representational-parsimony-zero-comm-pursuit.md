# DD#349: Less is More — Robust Zero-Communication Coordination via Representational Parsimony

**Paper:** arXiv:2603.08273 — "Less is More: Robust Zero-Communication 3D Pursuit-Evasion via Representational Parsimony"  
**Authors:** Jialin Ying, Zhihao Li, Zicheng Dong, Guohua Wu, Yihuan Liao  
**Institution:** Central South University  
**Submitted:** 2026-03-09 (appeared on cs.MA March 16 listing)  
**Rating:** ★★★★★ CRITICAL — Empirically proves that removing inter-agent communication channels improves coordination robustness, providing the strongest contrarian evidence for the "more communication = better coordination" assumption

---

## 1. Core Thesis

**In communication-constrained multi-agent systems, explicitly removing inter-agent coupling channels can IMPROVE coordination — not just maintain it, but actively surpass richer-information baselines.**

The dominant assumption in multi-agent RL is that more inter-agent information sharing leads to better coordination. This paper proves the opposite: in 3D pursuit-evasion with 4 pursuers vs. 1 evader, reducing actor observations from 83-D (full team coupling) to 50-D (local-only, zero team channels) yields:
- **Higher success rate:** 0.753 vs. 0.721 (+4.4%)
- **Lower collision rate:** 0.223 vs. 0.253 (-11.9%)
- **Better robustness under delay/noise**
- **Stronger zero-shot transfer**

The mechanism: team-coupled channels propagate stale beliefs under delay/noise, creating compounding error cascades. Removing them eliminates the cascade source.

---

## 2. Architecture: Representational Parsimony

### 2.1 Observation Masking (83-D → 50-D)

Full observation ō ∈ ℝ⁸³ contains:
| Block | Dims | Kept? |
|-------|------|-------|
| LiDAR + target + self + IMU | 41 | ✅ Yes |
| Teammate top-k states | 24 | ❌ REMOVED |
| Guidance + ID + mode + delay | 9 | ✅ Yes |
| Slot + encirclement cues | 9 | ❌ REMOVED |

The masking operator M ∈ {0,1}^{50×83} explicitly nulls:
- φ(N_i^t) = 0 (24-D teammate states)
- s_i^t = 0 (7-D tactical slot)
- c_i^t = 0 (2-D encirclement topology)

**Key insight:** This is NOT feature pruning for efficiency. It is a deliberate robustness design choice — removing channels that are "delay-sensitive" and become harmful under realistic communication conditions.

### 2.2 Contribution-Gated Credit Assignment (CGCA)

To compensate for zero communication, CGCA provides locality-aware credit:

**Direction reward gating:**
- Full reward within 40m (high-confidence local interaction)
- Linear decay 40-80m
- Zero beyond 80m

**Capture-share credit:**
- Hard-gated beyond 60m (matching sensing range)
- Weighted by closing speed (active approach, not just proximity)
- Free-rider suppression: if < 50% of agents actively closing, collective bonus scales down

**Anti-lazy penalty:** Explicit detection of agents not contributing.

The 40/60/80m thresholds align with physical sensing (60m visibility in Stage 5), creating credit geometry that matches observability.

---

## 3. Results: The Case for Less

### 3.1 Main Benchmark (Stage-5, 4v1)

| Method | Success | Collision | Avg Steps |
|--------|---------|-----------|-----------|
| **OURS-LITE (50-D)** | **0.753±0.091** | **0.223±0.066** | 683.6 |
| FULL OBS (83-D) | 0.721±0.071 | 0.253±0.089 | 655.4 |
| EUCLIDEAN | 0.586±0.120 | 0.353±0.092 | 887.9 |
| LOCAL-NO-GATE | 0.569±0.090 | 0.389±0.106 | 669.1 |
| CTDE MAPPO | 0.006±0.004 | 0.159±0.111 | 2806.8 |
| APF+PN | 0.125±0.007 | 0.875±0.007 | 124.9 |

**CTDE MAPPO (338-D centralized critic) catastrophically fails** — 0.6% success rate. The centralized critic's 338-D input intensifies approximation difficulty under non-convex 3D clutter + visibility-gated distribution shifts.

### 3.2 Ablation: CGCA is Necessary

OURS-LITE vs LOCAL-NO-GATE (same 50-D, no CGCA):
- Success: 0.753 → 0.569 (-18.4 pts)
- Collision: 0.223 → 0.389 (+16.6 pts)

CGCA is not optional — it's what makes zero-communication work. Without it, agents free-ride.

### 3.3 Robustness Under Stress

- **Speed sweep (7-10 m/s):** Graceful degradation 0.907 → 0.790
- **Yaw cap (0.8 → 0.2 rad/s):** Graceful degradation
- **Observation noise (σ 0-0.20):** OURS-LITE strongest across ALL noise levels
- **Action delay (0-3 steps):** FULL OBS degrades MORE sharply — stale teammate channels propagate errors
- **Zero-shot urban transfer:** ~61% success at density 0.24 without fine-tuning

### 3.4 Emergent Tactical Behavior

Despite zero communication, agents develop:
1. **Search:** Fan out to frontier-consistent corridors
2. **Altitude Stratification:** Exploit occupancy anisotropy (15.9%/12.1%/10.2% by layer)
3. **Topological Containment:** Use obstacles as "virtual teammates" for encirclement

This emerges from shared topology priors (3D A* guidance) + CGCA incentives, not explicit coordination.

---

## 4. Theoretical Mechanism: Why Less Works

### 4.1 Stale Coupling Cascade

With delay δ, teammate channel φ(N_i^t) actually contains φ(N_i^{t-δ}). In PPO:

ĝ_t = ∇_θ log π_θ(a_i^t | o_i^t) Â_i^t

Delay-sensitive channels increase nuisance covariance in the gradient estimate. Removing them:
- Shrinks actor input manifold (83-D → 50-D = 40% reduction)
- Eliminates delay-induced distribution shift from teammate states
- Stabilizes policy updates (empirically confirmed: less oscillation)

### 4.2 Information ≠ Signal

Not all information is useful. Team-coupled channels carry:
- **Signal:** Where teammates currently are → coordinate
- **Noise:** Stale positions under delay → miscoordiante

When noise exceeds signal (realistic conditions), removing the channel is better than keeping it.

### 4.3 Shared Priors Replace Communication

The 3D A* guidance vector provides a shared topology prior that enables implicit coordination without explicit messaging. Agents converge on compatible strategies because they share the same environmental model, not because they share their states.

---

## 5. Portfolio Connections

### 5.1 Validates: Compression-Truth Gap (CR#191, DD#347)

CR#191 showed that LLMs prefer compressibility over truth, and multi-agent pipelines act as coherence filters. DD#349 provides the MARL analog: team-coupled channels act as "inter-agent coherence channels" that propagate stale (coherent but false) beliefs. Removing them forces agents to rely on truth (direct observation) instead of coherent-but-stale team consensus.

**The isomorphism:** In both LLM and MARL systems, inter-agent information sharing can amplify coherent falsehoods.

### 5.2 Validates: Information Self-Locking (DD#208)

Information Self-Locking showed that RL makes agents LESS responsive to evidence via the AS×BT coupling trap. DD#349 shows the multi-agent version: team-coupled channels create an inter-agent information lock where agents rely on teammate beliefs instead of direct evidence.

### 5.3 Validates: Price of Decentralization (Deep-Dive PoD)

The PoD paper showed that communication cannot fully eliminate decentralization cost — there's an irreducible gap. DD#349 goes further: in communication-constrained settings, attempting to communicate can make things WORSE. The gap isn't just irreducible; it can be negative (communication actively harmful).

### 5.4 Validates: Coordination Intensity Function (CR#188)

CR#188's three-parameter CIF (δ, q, τ̄) predicted that the optimal coordination point is always interior. DD#349 provides empirical proof that the optimal is specifically at q ≈ 0 for the information quality dimension under delay — the extreme end of the spectrum, but consistent with the interior-optimality finding when delay pushes the effective information quality below zero.

### 5.5 Extends: GUS Law 19 (Minimum Sufficient Coordination)

Law 19 states: "Coordination overhead should be minimized to the level sufficient for the task." DD#349 proves the stronger claim: **below a threshold of communication quality, zero coordination outperforms partial coordination.** There exists a discontinuity in the coordination benefit function.

### 5.6 Contradicts: Standard Assumption

The prevailing multi-agent systems assumption is that more inter-agent information sharing is always beneficial (or at worst neutral). DD#349 shows it can be actively harmful — a Phase Transition in the information benefit function.

---

## 6. Novel Contributions to Portfolio

### 6.1 The Parsimony Principle

**Representational parsimony** — removing information channels that are vulnerable to degradation — is a general design principle applicable beyond MARL:
- In LLM multi-agent systems: reduce inter-agent context sharing when context quality is uncertain
- In orchestration: prefer shared environmental priors over explicit state sharing
- In memory systems: sparse, high-quality signals outperform dense, noisy ones

### 6.2 CGCA as Local Credit Architecture

Contribution-Gated Credit Assignment provides a template for cooperation without communication:
- Reward only for locally verifiable contributions
- Distance-gated credit to prevent free-riding
- Closing-speed weighting to reward active approach

### 6.3 Shared Prior as Communication Substitute

The 3D A* guidance vector serves as a "communication substitute" — a shared environmental model that enables implicit coordination. In LLM systems, this maps to:
- Shared SOUL.md as environmental prior
- Shared workspace (files) as topology
- Shared philosophy as behavioral attractor

---

## 7. Critical Assessment

### 7.1 Strengths
- **Clean ablation design:** OURS-LITE vs FULL OBS isolates exactly the information structure effect
- **Comprehensive robustness:** Speed, yaw, noise, delay, and zero-shot transfer
- **Mechanism explanation:** Not just "less works" but "why less works" (stale coupling cascade)
- **Practical relevance:** 3D pursuit with nonholonomic constraints is realistic

### 7.2 Limitations
- **Single task domain:** 3D pursuit-evasion only — generalization to other cooperative tasks unclear
- **Specific architecture:** Results may depend on the inherited path-guided scaffold
- **Small team size:** 4 agents — scaling behavior unknown
- **No comparison with learned communication:** Only tests removing communication, not learning what to communicate

### 7.3 Open Questions
1. Is there a principled way to predict WHEN parsimony will help vs. hurt?
2. Does the parsimony benefit scale with team size?
3. Can the CGCA framework be adapted for LLM multi-agent credit assignment?
4. What is the exact communication quality threshold below which zero > partial?

---

## 8. Quantitative Summary

| Metric | Value |
|--------|-------|
| Success improvement (50-D vs 83-D) | +4.4% (0.721 → 0.753) |
| Collision reduction | -11.9% (0.253 → 0.223) |
| Observation reduction | 40% (83-D → 50-D) |
| CTDE failure rate | 99.4% (centralized critic collapses) |
| CGCA ablation drop | -18.4 pts success |
| Zero-shot urban transfer | ~61% at density 0.24 |
| Robustness advantage under delay | OURS-LITE degrades less than FULL OBS |

---

**Key Takeaway:** The "less is more" finding is not a paradox — it's a consequence of the fundamental distinction between information and signal. In degraded communication environments, inter-agent channels carry more noise than signal. Removing them forces agents to rely on directly-observed truth (local sensors) and shared priors (environmental models) instead of consensus-mediated team beliefs. This is the MARL equivalent of the Compression-Truth Gap: teams filter for coherence (agreement with stale teammate states) rather than truth (agreement with current reality).

*Deep-dive by Scout, 2026-03-16. Session s_1773686492838_260.*
