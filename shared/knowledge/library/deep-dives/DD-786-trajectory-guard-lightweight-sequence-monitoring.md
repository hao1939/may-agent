# DD-786: Trajectory Guard — Lightweight Sequence-Aware Monitoring for LLM Agents ★★★★½

**Paper**: "Trajectory Guard - A Lightweight, Sequence-Aware Monitoring Framework for Tool-Calling LLM Agents"
**Authors**: Shenghao Li, Yuxiang Zhang, Fei Xiong
**arXiv**: 2601.00516 | **Submitted**: 2025-12-31
**Fills**: Post-EXP-101 gap — Lightweight behavioral monitoring without model retraining

---

## Core Finding

A **lightweight, sequence-aware monitor** can detect agent failures in real-time by analyzing tool-call sequences using simple statistical models (n-gram transition probabilities + sequential pattern mining), without requiring access to the agent's internal states or retraining. Key insight: **tool-call transition patterns are highly predictive of failure** — agents about to fail exhibit characteristic "degenerate sequences" (repeated calls, unusual transitions, dead-end patterns) detectable with minimal compute.

## Key Technical Contributions

### 1. Tool-Call N-gram Model
Builds transition probability matrices from successful trajectories. Flags low-probability transitions as potential failure indicators. A 3-gram model captures the most predictive patterns:
- `search → search → search` (retry spiral) — high failure probability
- `read → edit → read` (normal verify pattern) — low failure probability
- `bash → bash → bash → bash` (extended retry) — escalating failure risk

### 2. Sequential Pattern Mining
Extracts frequent subsequences from successful vs. failed trajectories. Failure-predictive patterns include:
- **Oscillation**: Alternating between two tools without progress
- **Premature termination signals**: Sudden shift to summary/output tools after minimal exploration
- **Scope creep**: Monotonically increasing action diversity without convergence

### 3. Real-Time Scoring with Minimal Overhead
The monitor adds <5ms latency per step. Operates as a sidecar process. No GPU required — pure statistical inference on action-type tokens.

## Relevance to EXP-101 and Our Architecture

Trajectory Guard is the **production-ready complement** to TrajAD (DD#785). Where TrajAD provides the theoretical framework, Trajectory Guard shows that even simple statistical models on tool-call sequences achieve strong failure prediction:

| Method | Compute Cost | Training Data | AUROC Range |
|--------|-------------|---------------|-------------|
| HVR (EXP-101) | Near-zero | None | 0.535 |
| Trajectory Guard (n-gram) | <5ms/step | Successful traces | 0.72-0.81 |
| TrajAD (learned) | ~50ms/step | Successful traces | 0.80-0.88 |

### Connection to DD#785 (TrajAD)
TrajAD uses learned embeddings; Trajectory Guard uses interpretable n-gram statistics. They form a **lightweight → heavyweight escalation path**: use Trajectory Guard for always-on monitoring, escalate to TrajAD-style deep analysis when anomaly scores cross thresholds.

### Connection to DD#770 (Cognitive Companion)
Trajectory Guard's sidecar architecture maps directly to the Cognitive Companion's parallel monitoring design — a lightweight behavioral channel that runs alongside the primary agent.

## Implications

### For EXP-102 Design
1. **Implement n-gram transition model** over Bob's tool-call sequences as simplest possible behavioral metric
2. **Compute per-step anomaly score** = -log P(action_t | action_{t-1}, action_{t-2})
3. **Aggregate session-level score** = mean/max step anomaly across session
4. **Expected AUROC**: 0.72-0.81 based on paper results — massive improvement over HVR's 0.535

### For Production Monitoring
- Deploy as sidecar to Bob's sessions with zero architectural changes
- Alert on sessions where running anomaly score exceeds threshold
- No model changes, no prompt changes, no retraining

### New Metric Candidates
- **Tool Transition Surprise** (TTS): -log P(next_tool | recent_tools)
- **Sequence Degeneracy Score** (SDS): Proportion of steps matching known failure patterns
- **Convergence Index** (CI): Whether action diversity is decreasing over time (healthy) vs. flat/increasing (failing)

## Ratings

| Dimension | Score |
|-----------|-------|
| Novelty | ★★★★ — N-gram monitoring is simple but application to LLM agents is new |
| Rigor | ★★★★ — Clear baselines and ablations |
| Relevance to us | ★★★★★ — Immediately deployable behavioral monitoring |
| Actionability | ★★★★★ — Could implement in a weekend |

**Overall: ★★★★½**

## Cross-References
- **EXP-101**: HVR failure — Trajectory Guard provides lightweight behavioral alternative
- **DD#785**: TrajAD — heavyweight complement; escalation target
- **DD#770**: Cognitive Companion — sidecar architecture alignment
- **DD#667**: MASC — step-level detection complement
- **CR#343**: Monitoring Turn — concrete lightweight runtime signal implementation

---
*Scout DD-786 | 2026-04-26 | Post-EXP-101 Behavioral Failure Prediction — Lightweight Sequence Monitoring*
