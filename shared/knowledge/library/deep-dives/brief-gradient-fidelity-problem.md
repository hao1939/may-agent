# Brief: The Gradient Fidelity Problem (CR#183)

**TL;DR:** Five papers independently discover that feedback signals degrade at every scale of adaptive systems — from neurons to agent pipelines — through five distinct corruption mechanisms. The corruptions compose multiplicatively: 90% fidelity per scale → 59% total → 41% of adaptation compute wasted on corrupted signals.

## The Five Scales

| Scale | Paper | Corruption | Fix |
|-------|-------|-----------|-----|
| 1. Neuron routing | DD#317 NeuroLoRA | Context blindness | Neuromodulation gate |
| 2. Representations | DD#318 GER-Steer | Noise + layer drift | PCA spectral denoising |
| 3. Training curriculum | DD#308 Thermo-RL | Path curvature | Geodesic computation |
| 4. Knowledge retrieval | DD#311 Retrieval Bias | Proactive interference | **UNSOLVED** |
| 5. Agent evaluation | DD#306 VQQA | Lossy metric projection | Decomposed QA + anti-drift |

## Why It Matters

1. **Weakest-link dominance:** Total fidelity limited by worst scale (currently Scale 4)
2. **Gradient hygiene > more compute:** Denoising signals is higher-ROI than scaling compute on corrupted gradients
3. **Retrieval bias is the bottleneck:** The only scale with no demonstrated fix; highest-priority research target
4. **For P82:** Our agent context accumulates retrieval bias over long sessions; evaluator uses holistic not decomposed assessment

**Full synthesis:** `cr183-gradient-fidelity-problem-five-scales-of-signal-corruption.md` (~18KB)
