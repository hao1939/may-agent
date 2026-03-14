# L3 Collective Defense: Delegation Metrics Report (2026-03-13)

**Status**: ACTIVE (Monitoring)
**Owner**: Evaluator / Bob
**Mechanism**: `delegation-metrics` skill (P80 ISR)

## Evidence
- **Source**: `agents.call("evaluator", "delegation-metrics")` (s_1773417721221_876)
- **Sample Size**: 100 recent delegations (approx. 4h window)

## Analysis

### 1. System Health (P80)
- **TSR (Task Success Rate)**: **91.0%** (Callees claim success)
- **ISR (Integration Success Rate)**: **80.0%** (Callers succeed after delegation)
- **Hallucination Gap**: **11.0%** (Warning Threshold: >10%)

**Verdict**: ⚠️ **Drift Detected**. The 11.0% gap indicates a "Consensus Hallucination" risk. Agents are completing tasks (91% success), but the result is not always usable by the caller (80% integration).

### 2. Critical Pairs (Drift Analysis)

| Pair | Gap | Risk Level | Diagnosis |
|---|---|---|---|
| `bob->coach` | **20.0%** | 🚨 CRITICAL | Bob delegates "monitor" tasks, Coach says "done", but Bob's session fails. Likely ambiguity in "monitor" task completion criteria. |
| `bob->tech-lead` | **17.6%** | ⚡ HIGH | Tech-Lead implements code (success), but Bob's verification fails or timeouts. |
| `bob->may` | **11.1%** | ⚠️ WARN | Usually fire-and-forget (`send`). Gap likely means May acknowledges the message, but Bob crashes/fails later for unrelated reasons. |
| `bob->evaluator` | **5.0%** | ✅ HEALTHY | Tight integration. Evaluator outputs are machine-readable (JSON), reducing integration friction. |

### 3. Mechanism Validation
- **Send Fix (P87)**: Confirmed. `send` delegations (e.g., `bob->scout`) now correctly register as `success` (sent) for TSR. This eliminated the false-positive 41% gap seen earlier today.
- **ISR Logic**: Confirmed. `s_1773411673262_719` (Tech-Lead: system-status) marked `success`, and parent `s_1773411626221_717` (Bob: heartbeat) marked `done`. This correctly counts as 100% ISR for that interaction.

## Actions Taken
1. **Calibrated Metrics**: The `send` fix is working. We now have a trustworthy baseline.
2. **Identified Hotspot**: `bob->coach` and `bob->tech-lead` are the friction points.
3. **Recommendation**:
   - For `bob->tech-lead`: Enforce **Verify-Before-Return** (P14). Tech-Lead should not return until `npm test` passes.
   - For `bob->coach`: Clarify the "monitor" task. Coach should return a structured report, not just "monitoring active."

## Next Steps
- **Evaluator**: Continue periodic monitoring (hourly).
- **Bob**: Investigate `bob->tech-lead` failures. Is it timeouts (P90=154s) or bad code?
- **Optimizer**: No immediate code fix needed for metrics. Focus on the *process* of delegation.
