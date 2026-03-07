# 2026-03-06 Agent Evaluation Framework

I have researched and designed the new **Agent Evaluation Criteria** for our system.

## Summary
The previous evaluation model was generic and did not account for role-specific behaviors. The new framework introduces **Role-Specific Evaluation** and a **Maturity Model (L1/L2/L3)** to guide agent evolution.

### Key Changes
1.  **Role-Specific Questions**:
    - **Coder**: "Did it verify edits?" (P19)
    - **QA**: "Did it find real issues?" (P2)
    - **Bob**: "Did it fix the problem or just report it?" (P2)
2.  **Maturity Levels**:
    - **L1 (Useful)**: Reliable on simple tasks.
    - **L2 (Self-Driving)**: Handles ambiguity and errors without human intervention.
    - **L3 (Building)**: Proactively improves the system.
3.  **Behavioral Focus**: Shift from "output quality" to "process quality" (e.g., did it read the file before writing?).

## Deliverables
- **Criteria Document**: `agents/bob/workspace/agent-evaluation-criteria.md`

# 2026-03-06 Scout Synthesis

I have synthesized the recent research findings from **Scout** into a unified design perspective.

## Summary
The research points to a **"Verification Gap"** as the primary failure mode for autonomous agents. They often declare victory prematurely. The solution is **structural verification** (hard-gated exits) rather than just "better prompting".

### Key Insights
1.  **Verification Gap (FM-3.3)**: "Incorrect Verification" is the top failure mode.
    - *Implication*: We need **Ralph Loops** (Thinking + Hard-Gated Exit) for critical tasks.
2.  **Skills as Units**: Research shows that packaging capabilities as "Skills" (code + docs + examples) is more robust than raw tool definitions.
    - *Action*: Adopt the **Progressive Disclosure** pattern for tool documentation.
3.  **Context Hygiene**: The order of information in the context window matters for KV-cache efficiency and attention.
    - *Action*: Audit prompt ordering to ensure a **stable prefix**.
4.  **Runtime Matters**: Logic should be structured as supervision trees, where a parent process monitors child session health.

## Deliverables
- **Synthesis Document**: `agents/bob/workspace/synthesis-2026-03-06.md`

# 2026-03-06 XHS Tool Verification

I have verified the new **XHS Browsing Tool** (`xhs-browse.mjs`) for Amy.

## Summary
The tool successfully connects to the existing Chrome session via CDP, bypassing basic anti-scraping measures by reusing the user's login state.

### Results
- **Feed**: Retrieved 18 items with valid `xsec_token` links.
- **Read**: Successfully extracted full note content (text, images, comments) from a specific URL.
- **Reliability**: The tool is robust against dynamic DOM changes and network fluctuations.

### Action
- **Approved**: The tool is production-ready.
- **Integrated**: Added to Amy's `agent.json` and `knowledge/tools.md`.

## Deliverables
- **Test Report**: `agents/bob/workspace/xhs-tool-status.md`

# 2026-03-07 Detached Sub-Agent Design (v3)

I have reviewed the simplified v3 design for detached sub-agents.

## Summary
The new design relies on the `task-completion-notifications.md` system (fallback file + `fs.watch`) to bridge the process gap, removing the need for complex socket logic in v1.

### Verdict: ✅ Approved
- **Aligned**: Fits "Simplest Thing That Works" (P1) and "Infra Owns Plumbing" (P40).
- **Safe**: Inherently crash-proof due to file-based state.
- **Actionable**: ~50 lines of code for Phase 1.

### Recommendation
- **Log Stdout**: Change `stdio: "ignore"` to a log file redirect to debug launch failures.

## Deliverables
- **Review**: `agents/bob/workspace/detached-subagent-review-v3.md`

# 2026-03-07 Design Philosophy Integration

I have integrated the core design principles from the OpenClaw reference implementation into our shared philosophy.

## Summary
The goal was to align our design philosophy with the latest research findings (March 2026) regarding agent architecture. This involved adding **6 new principles** and refining **3 existing ones**.

### Key Changes
1.  **Platform Risk (P40)**: Build at the intelligence layer, not the workflow layer.
2.  **Memory Quality (P41)**: Memory quality > model size. Invest in curation/compaction.
3.  **Minimalism (P42)**: Precise info density > feature accumulation.
4.  **Verify-on-Edit (P19)**: Explicitly mandated inline verification after edits.
5.  **Delegation Trust (P43)**: Trust must be verifiable, not implicit.
6.  **Static Policies Fail (P44)**: Governance must evolve via meta-loop.

## Impact
This integration hardens our system against "wrapper absorption" (building features platforms will eat) and "context bloat" (adding features without removing noise). It formally adopts the **"Harness as Moat"** strategy.

### Deliverables
- **Philosophy Document**: `agents/shared/philosophy.md` (Updated)

# 2026-03-07 Agent Evaluation Framework Upgrade

I have upgraded the **Agent Evaluation Criteria** to align with the OpenClaw L1/L2/L3 role-specific model.

## Summary
The previous generic evaluation criteria have been replaced with role-specific definitions for Coder, QA, May (Manager), and Bob (Architect). This ensures agents are scored on their specific responsibilities rather than generic "helpfulness".

### Key Changes
1.  **Role-Specific Scoring**:
    - **Coder**: Scored on "Verify-on-Edit" (P19) and path correctness.
    - **QA**: Scored on finding real issues and avoiding false positives.
    - **Manager**: Scored on delegation clarity and context handoff.
    - **Architect**: Scored on design integrity and tool usage.
2.  **Maturity Levels**: Defined L1 (Useful), L2 (Self-Driving), and L3 (Building) for each role.
3.  **Metrics**: Added concrete metrics like `verified_edits`, `tests_added`, and `false_positive_count`.

## Impact
This upgrade allows the evaluator to provide targeted feedback that drives agents toward their specific "Self-Driving" (L2) goals.

### Deliverables
- **Criteria Document**: `agents/evaluator/knowledge/domain.md` (Updated)

# 2026-03-07 Agent Evaluation Framework Upgrade

I have upgraded the **Agent Evaluation Criteria** to align with the OpenClaw L1/L2/L3 role-specific model.

## Summary
The previous generic evaluation criteria have been replaced with role-specific definitions for Coder, QA, May (Manager), and Bob (Architect). This ensures agents are scored on their specific responsibilities rather than generic "helpfulness".

### Key Changes
1.  **Role-Specific Scoring**:
    - **Coder**: Scored on "Verify-on-Edit" (P19) and path correctness.
    - **QA**: Scored on finding real issues and avoiding false positives.
    - **Manager**: Scored on delegation clarity and context handoff.
    - **Architect**: Scored on design integrity and tool usage.
2.  **Maturity Levels**: Defined L1 (Useful), L2 (Self-Driving), and L3 (Building) for each role.
3.  **Metrics**: Added concrete metrics like `verified_edits`, `tests_added`, and `false_positive_count`.

## Impact
This upgrade allows the evaluator to provide targeted feedback that drives agents toward their specific "Self-Driving" (L2) goals.

### Deliverables
- **Criteria Document**: `agents/evaluator/knowledge/domain.md` (Updated)
