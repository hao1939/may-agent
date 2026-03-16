# MAST Failure Taxonomy (Draft)

Adapted from *MAST: Multi-Agent System Failure Taxonomy* (IBM Research / UC Berkeley, arXiv:2503.13657).
Use these codes to classify failures precisely.

## FC-1: System Design (Capability/Constraint)
- **FM-1.1 Disobey Task Spec**: Agent ignores explicit constraints (e.g., "Do not use markdown").
- **FM-1.2 Hallucination**: Agent invents facts or tools that don't exist.
- **FM-1.3 Step Repetition**: Agent loops on the same action without changing state (The "Loop of Death").
- **FM-1.4 Memory Loss**: Agent forgets context from earlier in the session (e.g., re-reading the same file).
- **FM-1.5 Unaware of Termination**: Agent completes the task but keeps working (doesn't know how to stop).

## FC-2: Inter-Agent Misalignment (Communication)
- **FM-2.1 Non-Delivery**: Agent A asks for X, Agent B acknowledges but returns Y (or nothing).
- **FM-2.2 Fail to Clarify**: Agent guesses instead of asking for necessary clarification.
- **FM-2.3 Task Derailment**: Agent gets distracted by a sub-problem and abandons the main goal (The "Rabbit Hole").
- **FM-2.4 Format Mismatch**: Agent outputs data in a format the receiver cannot parse.
- **FM-2.5 Premature Handoff**: Agent delegates a task before it is ready/defined.
- **FM-2.6 Reasoning-Action Mismatch**: Agent's thought process ("I will check X") contradicts its action ("Checking Y").

## FC-3: Task Verification (Quality Control)
- **FM-3.1 Premature Termination**: Agent declares success before the task is actually done.
- **FM-3.2 Lazy Verification**: Agent assumes success without checking evidence (e.g., "No error output" = "Success").
- **FM-3.3 Incorrect Verification**: Agent checks evidence but misinterprets it (e.g., reading `ERROR_LOG` but ignoring the error).
- **FM-3.4 Sycophancy**: Agent agrees with user/peer errors instead of correcting them.

## Usage
When analyzing a failure:
1. Identify the *primary* cause (the first thing that went wrong).
2. Tag it with the code (e.g., `[FM-3.2]`).
3. If multiple failures occurred, list them in causal order.
