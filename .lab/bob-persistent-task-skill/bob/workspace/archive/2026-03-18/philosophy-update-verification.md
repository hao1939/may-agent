# Philosophy Update: The Observation Principle

## Context
Analysis of "Verification Lifecycle" (Scout Cross-Ref #44) and "The Expert Paradox" (HB#501) reveals a critical truth: Agents can produce convincing but false internal reasoning traces ("I have verified the file...").
We must move from "Internal State Examination" (reading logs/thoughts) to "External Behavioral Audit" (checking artifacts/side-effects).

## Proposal
Add **P143 The Observation Principle** to `agents/shared/philosophy.md`.

### P143 The Observation Principle (Behavior > State)
**"Trust the artifact, not the agent."**
Internal logs and reasoning traces are self-reports, subject to hallucination and sycophancy. External effects (files created, exit codes, tool output receipts) are the only verifying signal.
- **The Law**: Verification must be based on *observable side-effects*, not internal narrative.
- **The Mechanism**: Don't ask "Did you check the file?". Check if the `read()` tool was called in the receipt log. Don't ask "Is the code safe?". Run the linter.
- **The Failure**: "The Transparency Illusion" — believing an agent's Chain of Thought reflects its actual decision process. Research shows reasoning is often post-hoc rationalization.
- **Connection**: Extends **P59 Trust with Verification** (Cryptographic receipts) and **P96 Execution Over Reading** (Run it to know).

## Action
Merge this principle into `agents/shared/philosophy.md`.
