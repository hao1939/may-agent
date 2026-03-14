# MAST Failure Taxonomy Cheat Sheet
*Source: arXiv:2503.13657 (IBM Research / UC Berkeley)*

Use these codes to tag agent failures in `ERROR_LOG.jsonl`.

## FC1: System Design (Capability Failures)
- **FM-1.1 Disobey Task Spec**: Agent ignores explicit constraints (e.g., "Do not use Python").
- **FM-1.2 Hallucination**: Agent invents facts or files that do not exist.
- **FM-1.3 Step Repetition (Looping)**: Agent repeats the same tool call >3 times with same result.
- **FM-1.4 Context Loss**: Agent forgets instructions from earlier in the session.
- **FM-1.5 Unaware of Termination**: Agent keeps working after the task is done.

## FC2: Inter-Agent Misalignment (Communication Failures)
- **FM-2.1 Ambiguous Delegation**: Delegating agent gives vague instructions.
- **FM-2.2 Fail to Ask Clarification**: Executing agent guesses instead of asking.
- **FM-2.3 Task Derailment**: Agent gets distracted by a sub-problem and forgets the main goal.
- **FM-2.6 Reasoning-Action Mismatch**: The "Thought" says one thing, but the "Tool Call" does another. (Most common).

## FC3: Task Verification (Quality Control Failures)
- **FM-3.1 Premature Termination**: Agent says "Done" before requirements are met.
- **FM-3.2 False Negative**: Agent thinks it failed when it actually succeeded.
- **FM-3.3 Incorrect Verification**: Agent checks the wrong thing and declares success (e.g., checks exit code 0 but ignores "Error" in stdout).

## Usage
When logging an error:
1. Identify the *primary* cause.
2. Tag with the code (e.g., `[FM-2.6]`).
3. Describe the specific instance.
