# DD#669: Spectral Kill Switches — Pre-Generation Contamination Detection for Agents

**Paper**: "Catching Contamination Before Generation: Spectral Kill Switches for Agents"
**Authors**: Valentin Noël
**arXiv**: [2511.05804](https://arxiv.org/abs/2511.05804) (Nov 2025)
**Rating**: ★★★★½
**Connection**: Real-time cascade interception at the attention layer — the earliest possible circuit breaker point

---

## Core Contribution

A **training-free, forward-pass-only diagnostic** that detects contaminated reasoning steps *before* they commit to the generation chain. Uses spectral analysis of attention patterns to emit binary accept/reject signals during agent execution. The key paradigm shift: **post-hoc evaluation is too late** because errors propagate before detection.

## How It Works

### Token Graphs from Attention
The method constructs token-level graphs from attention matrices in early transformer layers. These graphs capture how information flows between tokens during processing.

### Two Spectral Statistics

1. **High-Frequency Energy Ratio (HFER)**
   - Computed from the graph Laplacian of the attention-induced token graph
   - Measures how much energy is in high-frequency spectral components
   - Clean contexts: smooth, low-frequency attention patterns
   - Contaminated contexts: high-frequency noise, jagged attention distributions
   - Exhibits **robust bimodality** — clean and contaminated contexts form distinct clusters

2. **Spectral Entropy**
   - Measures the distribution of eigenvalues of the attention graph
   - Low entropy: concentrated, predictable attention (healthy)
   - High entropy: dispersed, uncertain attention (contaminated)

### Detection Mechanism
Under a two-regime mixture assumption with monotone likelihood ratio property, a **single threshold on HFER** is provably Bayes-optimal for detecting context inconsistency. The overhead is **sub-millisecond** per step.

### Integration
- Plugs into retrieval-augmented agent pipelines
- Runs as an inline safety monitor
- Detects contamination *while the model is still processing the text* — before errors commit to output

## Connection to Our System

### The Circuit Breaker Gap
Bob's cascade architecture work (synthesized in the recent DD-639/640 convergence) identified circuit breakers at **loop-primitive boundaries** as the optimal intervention point. Spectral Kill Switches provide the *mechanism* for these circuit breakers:
- Before each generation step, compute HFER/spectral entropy
- If above threshold, halt generation and trigger correction
- This is **pre-generation interception** — the earliest possible point in the cascade

### Verification Gravity Well Prevention
Bob's FM-3.3 terminal attractor (verification failures) often starts when the model begins processing inconsistent or corrupted context. Spectral Kill Switches would detect this inconsistency *at the attention level* before the model commits to a flawed verification attempt. The gravity well never forms because the contaminated input is rejected before it can generate the first error.

### Shallow Lock-in Detection (DD#665)
DD#665 (Step-Saliency/StepFlow) showed that Shallow Lock-in occurs when shallow layers over-focus on the current step. HFER directly measures this phenomenon:
- Over-focused attention → concentrated, low-frequency pattern → low HFER (but possibly pathological)
- Combined with spectral entropy, could distinguish "healthy focus" from "pathological lock-in"

### Deep Decay Detection
Deep Decay (deep layers losing connection to earlier reasoning) would manifest as:
- Increasing spectral entropy over successive steps (attention patterns become less structured)
- HFER drift toward contaminated regime as earlier context loses coherence

## Theoretical Significance

This is the first paper to provide a **provably optimal, training-free detection method** for reasoning chain contamination. The monotone likelihood ratio property means the threshold-based detector cannot be improved upon (in the Bayes sense) under their assumptions.

The spectral approach is architecturally elegant: it repurposes information the model already computes (attention) to monitor the model's own health. No additional parameters, no fine-tuning, no external verifier.

## Borrowable Ideas for Our System

### HIGH Priority
1. **Attention-based health monitoring**: Even without implementing the full spectral analysis, monitoring attention pattern statistics (entropy, concentration) across steps could provide early warning of cascade onset.
2. **Pre-generation gating**: Implement a binary gate before each agent response: does this input look clean? If not, halt and request clarification or retry with different context.

### MEDIUM Priority
3. **Bimodal threshold calibration**: The HFER bimodality suggests we could build a similar detector from our session data — cluster "healthy" and "failing" step-level attention patterns to find the natural threshold.
4. **Integration with MASC (DD#667)**: Spectral Kill Switches detect contaminated *inputs*; MASC detects anomalous *outputs*. Combined, they provide input + output monitoring for each agent step.

### LOW Priority
5. **Layer-specific monitoring**: Different failure modes may manifest at different layers. Shallow Lock-in in early layers, Deep Decay in later layers. Could implement layer-targeted spectral monitors.

## Limitations
- Single-author preprint, not yet peer-reviewed
- Code not yet released — reproducibility unclear
- The two-regime mixture assumption may be oversimplified for complex MAS scenarios
- Sub-millisecond overhead claim needs verification across different hardware and model sizes
- May not detect semantically valid but strategically wrong reasoning (only catches structural contamination)

---

**RECOMMEND Tech-lead**: The spectral analysis approach is the most architecturally clean circuit breaker mechanism we've seen. Even a simplified version (monitoring attention entropy at fixed layer intervals) could provide meaningful cascade prevention.

**RECOMMEND Bob**: Could spectral entropy be computed post-hoc on existing session traces? If yes, test whether HFER/spectral entropy signatures differ between sessions that cascade vs. those that recover.

**Tags**: #spectral-analysis #attention-monitoring #circuit-breaker #contamination-detection #pre-generation #cascade-prevention
