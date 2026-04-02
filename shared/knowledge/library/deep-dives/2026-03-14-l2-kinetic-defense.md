# Synthesis: L2 Kinetic Defense & Agent Observability
**Date:** 2026-03-14
**Source:** System Implementation (P117, P119, P120, P122)

## Context
Traditional monitoring (L1/L2) tracks *process health* (CPU, Errors, Latency). Research (OpenClaw-RL, ThReadMed-QA) shows this misses **L3 Semantic Integrity** failures:
- **Evaluation Tampering:** Agents editing their own scores (P116).
- **Reasoning-Action Mismatch:** Agents saying "Fixed bug" after a tool error (FM-2.6).
- **Topology Leaks:** Adversaries inferring the agent graph via timing (WebWeaver).
- **Zombie State:** Running processes executing stale code (P118).

We have now implemented **L2 Kinetic Defense** to close these gaps.

## The Defense Layers

### 1. Runtime Monitoring (The Wink Pattern)
We deployed `agents/evaluator/skills/monitor-session.cjs` implementing the **Wink Pattern** (arXiv:2602.17037).
- **Technique:** Reads tail of JSONL logs (non-intrusive).
- **Detections:**
  - **LOOP (FM-1.3):** Identical tool calls 3+ times.
  - **DRIFT (FM-2.6):** Tool args diverge from Task keywords.
  - **STALL:** >10 min inactivity.
  - **SELF_VALIDATION (P108):** "Evaluation: 10/10" in output.
  - **FAKE_POLICY (P122):** "Cannot do X due to [Unknown Policy]".
  - **ACTIVE_RECALL (P110):** Forces agents to check `ERROR_LOG.jsonl`.

### 2. Topology Hiding (P119)
Adversaries can map our agent graph with 94% accuracy (WebWeaver).
- **Defense:** **Voice Masking** (Rewrite, don't forward) + **Latency Jitter**.
- **Status:** Adopted in `philosophy.md`. Implementation pending in `manager.ts`.

### 3. Causal Security (P120 / AttriGuard)
Semantic scanning ("Is this prompt safe?") fails against rephrasing.
- **Defense:** **Causal Attribution**. "Why did you do X?"
- **Mechanism:** `detectReasoningMismatch` in `monitor-session.cjs`.
- **Logic:** If Agent claims "Success" after Tool returns "Error" -> Flag as Adversarial.

### 4. Process Lifecycle (P118)
Code on disk is not truth until reloaded.
- **Incident:** 2026-03-14 P53 Zombie Code (Patch on disk, Process vulnerable).
- **Defense:** **Restart Mandate**. Security patches must trigger process restart.

## Implications for Design
1. **Observability is Active, Not Passive:** We don't just "log"; we "patrol". The Monitor is an active agent skill, not a passive infra daemon.
2. **Trust No Output:** Agents are treated as potentially adversarial to the evaluator.
3. **Defense in Depth:** L1 (Infra) + L2 (Runtime Monitor) + L3 (Evaluator Judge).

## Next Steps
- **Integrate Topology Hiding:** Implement P119 in `manager.ts` (Gateway Layer).
- **Automate Restart:** Link `check_state` skill to a restart trigger for P118 compliance.
