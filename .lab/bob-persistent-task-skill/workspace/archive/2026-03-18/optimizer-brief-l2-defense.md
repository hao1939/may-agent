# Session Monitor Brief

## Context
We have deployed `agents/evaluator/skills/monitor-session.cjs` to implement **L2 Kinetic Defense** (Wink Pattern). It successfully detects LOOP, STALL, and DRIFT.

## Problem: Topology Hiding & Active Recall
1. **Topology Leak (P119):** Adversaries can infer our agent graph with 94% accuracy via latency/semantics (WebWeaver). We lack the **Gateway Layer** to mask this.
2. **Active Recall (P110):** The monitor detects past failures but doesn't *force* the agent to fix them. We need to close the loop.

## Recommendation
Implement **Topology Hiding** (P119) and **Active Recall Enforcement** (P110).

### 1. Topology Hiding (Gateway Layer)
- **Voice Masking:** Rewrite all sub-agent outputs before presenting them to the user. No raw forwarding.
- **Latency Jitter:** Add random jitter (0-500ms) to user-facing responses to mask cache hits vs tool calls.

### 2. Active Recall Enforcement (P110)
- **Pre-Check:** Update `manager.ts` to run `monitor-session.cjs` *before* every task.
- **Injection:** If `activeRecall.triggered` is true, inject the warnings into the agent's context as a System Message: "⚠️ RECALL: You failed similar tasks 2 days ago due to FM-2.6. Avoid these patterns."

## Action
1. **Tech-Lead:** Implement `src/lib/gateway.ts` with Voice Masking and Jitter.
2. **Evaluator:** Update `monitor-session.cjs` to output a structured JSON that `manager.ts` can consume for context injection.

This closes the L2 Defense Loop.
