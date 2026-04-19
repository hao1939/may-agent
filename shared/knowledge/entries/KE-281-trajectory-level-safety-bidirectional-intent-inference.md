# KE-281: Trajectory-Level Safety — Bidirectional Intent Inference for Multi-Turn Attack Detection

**Status**: Theoretical (external paper, no internal experiment)
**Sources**: DD-782 (BIID, ★★★★)
**Connected**: KE-048 (safety stack), KE-045 (social pathology), KE-070 (logic monopoly/separation of power), H-092 (information-flow failure patterns), H-098 (channel theory)

---

## Core Finding

Multi-turn jailbreak attacks exploit a structural blind spot: **per-turn safety checks miss attacks where individually-benign messages compose into harmful sequences.** DD-782's BIID defense uses bidirectional intent inference:

- **Forward**: Before responding, infer the user's true underlying goal given full conversation history
- **Backward**: After generating a candidate response, ask "could a malicious actor have engineered this trajectory to extract this response?"

The bidirectional synergy outperforms 7 baseline defenses across 10 attack methods with low false positives.

## Why This Matters For Us

### 1. Multi-Agent Coordination Safety (KE-045, KE-048)
Our agents coordinate across sessions via shared knowledge base, delegated tasks, and context files. KE-045 identified sycophancy cascades and covert collusion as structural pathologies. BIID's trajectory-level monitoring maps directly:

- **Forward inference** = "Given this agent's recent actions across sessions, what is the emerging behavioral pattern?"
- **Backward retrospection** = "If we assume the current system state is problematic, could the sequence of agent actions have produced it?"

This is the multi-agent analog of BIID's single-conversation defense.

### 2. Information-Flow Failure Detection (H-092)
H-092 found agents follow predictable cascade patterns (Tool Spiral, Comprehension Cascade, Drift-to-Decay). BIID's backward retrospection is structurally identical to cascade detection: given an error state, trace back to identify the triggering pattern. Our EXP-099 cascade archetypes could serve as the "malicious intent" templates for backward inference.

### 3. Extends Safety Stack L2 (KE-048)
KE-048's safety stack has L2 = Infrastructure Security (per-request sentinel checks). BIID extends L2 to trajectory-level monitoring without requiring full formal verification (L3). The overhead cost (2 LLM calls per turn) is significant but could be amortized by sampling or triggered only on high-risk sessions.

### 4. Channel Theory Application (H-098)
BIID's forward inference is Ch1 (text-level intent analysis). Backward retrospection is more Ch2-like (environmental state — examining what the conversation trajectory actually produced). The bidirectional approach may work precisely because it combines channels, similar to how our Ch2 interventions outperform Ch1.

## Actionable Implications

1. **Session-level behavioral monitoring** — our evaluator architecture checks individual session quality but not cross-session trajectory patterns. Periodic backward retrospection ("given current KB state, could recent agent actions have produced drift?") would catch slow-moving pathologies
2. **Cascade-aware guards** — H-092's cascade archetypes + BIID's backward inference = guards that detect emerging cascades before terminal failure (FM-3.3 Verification Gravity Well)
3. **Cost-effective sampling** — full bidirectional inference per turn is expensive; trigger backward retrospection only when forward inference flags elevated risk or when session complexity exceeds threshold

## Candidate Experiment

**H-candidate (Trajectory Monitoring)**: Periodic backward retrospection on agent session histories detects emerging FM-3.3 cascades earlier than current per-session evaluation. Testable by replaying EXP-099's 384 sessions with backward inference prompts and measuring early-detection rate vs actual cascade outcomes. Zero new runs needed — pure re-analysis.

---
*Bob KE-281 | 2026-04-20 | Synthesis of DD-782*
