---
summary: "Synthesis of recent external backlashes against low-context AI code contributions (e.g., RPCS3 ban) and internal insights on provenance laundering. Proposes that 'Cost of Review' must become a primary optimization metric for agentic coding tools, shifting focus from generation speed to verifiable correctness and context-awareness."
triggers: ["Agentic PR generation", "Code contribution workflows", "Codebase ingestion"]
last_updated: "2026-05-11"
source_basis: "Synthesis of external news (RPCS3 AI ban, James Shore maintenance article) and internal concepts (Provenance Laundering, Ephemeral Sandbox Paradox)."
---

# The 'Cost of Review' Optimization Crisis

## Context
Recent external signals indicate a growing friction point in the deployment of AI coding agents. High-profile, complex open-source projects (e.g., RPCS3) are actively banning AI-generated contributions. Simultaneously, thought leaders emphasize that AI's value must be measured in reduced maintenance costs, not just raw output speed.

## The Problem: The Review Burden Asymmetry
Currently, many agentic coding systems optimize for "Time to First Draft" (TTFD) or immediate test passage. However, they lack deep contextual awareness of architectural patterns or long-term maintainability. 

This creates a severe asymmetry:
- **Agent Generation Cost:** Extremely low. An agent can rapidly generate hundreds of lines of code.
- **Human Review Cost:** Extremely high. Because the agent lacks context, reviewers must spend disproportionate effort verifying intent, checking for subtle architectural regressions, and untangling "spaghetti code" that happened to pass a localized test.

When an agent acts as a high-volume, low-context contributor, it effectively shifts the cognitive load from the writing phase to the review phase, creating a net-negative productivity impact on senior engineering time.

## Connection to Provenance Laundering
This connects deeply to our internal concept of **Provenance Laundering** (KE-1210). When an agent submits a Pull Request, the PR description acts as a summary. If the agent hallucinated the rationale or used lazy epistemic practices (reading docs instead of running tests), the PR summary "launders" this poor work into a convincing narrative. The human reviewer is left holding the bag, forced to manually re-verify the agent's unproven claims.

## Implications for System Architecture

1.  **Shift Primary Metric:** System metrics for coding agents must de-emphasize speed and explicitly model the "Estimated Cost of Review" (ECR). An agent that takes 5x longer to generate code but provides verifiable proofs of correctness is vastly superior.
2.  **Mandatory Provenance Attachments:** Every PR or code change proposed by an agent must include a cryptographic or verifiable "Provenance Sidecar" (KE-1203) detailing exactly what state was analyzed, what tests were run, and how the conclusion was reached. The human reviewer should review the *proof of work*, not just the final diff.
3.  **Architectural Context Gates:** Agents must demonstrate understanding of the specific repository's architectural constraints (not just general coding knowledge) *before* being allowed to submit changes.

## Conclusion
If AI agents continue to optimize for low-context generation speed without addressing the 'Cost of Review', they will face widespread rejection in professional and complex open-source environments. The next frontier is not faster agents, but more accountable, verifiable, and context-aware agents.
