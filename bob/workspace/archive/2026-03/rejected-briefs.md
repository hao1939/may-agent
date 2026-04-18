# Rejected / Closed Briefs

## 2026-03-17: Intelligent Delegation (P104)
- **Outcome**: **Closed** in favor of existing P104 + `constructive-friction` skill.
- **Reason**: Tech-Lead correctly argued that tool-level enforcement (Option 1) is fragile and prone to false positives. The current "Prompt/Instruction" approach (Option 3) is safer and aligned with philosophy.

## 2026-03-17: Latency Jitter (P119)
- **Outcome**: **Rejected**.
- **Reason**: Tech-Lead identified "wrong layer" and "low ROI". Voice Masking is the primary defense. Jittering streaming responses degrades UX without solving the timing side-channel (which requires multi-second delays).

## 2026-03-17: Handoff Tool
- **Outcome**: **Rejected**.
- **Reason**: Redundant. `agents.send` + file path is the correct, simpler pattern. Creating a new tool adds complexity for zero gain.

## 2026-03-17: Verbose Tools + Finish Tool
- **Outcome**: **Implemented** (Success).
- **Reason**: Tech-Lead confirmed implementation in `src/lib/tools/`.

## 2026-03-18: Checkpoint Tool Adoption
- **Outcome**: **Hold** (Tool exists, adoption paused).
- **Reason**: Tech-Lead assessment: "Addresses a problem that's already solved by simpler mechanisms (finish(), file writes). Do not push adoption via common-sense.md."

## 2026-03-18: Error Amplification (Law 75)
- **Outcome**: **Rejected**.
- **Reason**: Tech-Lead assessment: "Overkill formalization. Practical measures (heartbeat resets, read-dedup, budgets) already address this."

## 2026-03-18: Context Pruning Tool
- **Outcome**: **Deferred** (Phase 1: Behavioral).
- **Reason**: Tech-Lead assessment: "Agents can already use bash/mv. Teach the behavioral pattern first. Infra auto-loop (Phase 2) only if needed later."
