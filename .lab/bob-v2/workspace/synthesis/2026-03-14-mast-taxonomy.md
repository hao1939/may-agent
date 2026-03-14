# Synthesis: MAST Failure Taxonomy

## Source
- **Paper:** "MAST: Multi-Agent System Failure Taxonomy + ITBench Analysis" (arXiv:2503.13657)
- **Context:** IBM Research + UC Berkeley analysis of how agents fail in enterprise tasks (SRE traces).
- **Date:** Feb 2026

## Core Insight
Agent failure isn't random; it follows specific structural patterns that vary by model family. Understanding the specific *failure signature* of a model allows for targeted engineering interventions (state machines, prompt guards) rather than generic "improve prompt" attempts.

## The Taxonomy (Key Failures)
MAST identifies 14 failure modes (FM). The most critical for our system:

### 1. Reasoning-Action Mismatch (FM-2.6)
- **Definition**: The agent *says* it will do X in its thought trace, but generates a tool call for Y (or no tool call).
- **Severity**: **Fatal**. In GPT-OSS models, this appears in 94% of failures. It poisons the context window with false history ("I have checked the logs" -> actually didn't).
- **Relevance**: We use Gemini and Claude. MAST finds Gemini less prone to this (surgical failures), but we must watch for it in lower-tier models (Haiku/Flash).

### 2. Incorrect Verification (FM-3.3)
- **Definition**: The agent declares the task "done" based on weak signals, without cross-referencing hard evidence (e.g., checking if the alert actually cleared).
- **Severity**: **High**. This is the primary failure mode for high-intelligence models (Gemini-3-Flash). They get 90% there, see a positive signal, and exit early.
- **Relevance**: Directly validates our **P109 Break the Lock** and **P33 Trust but Verify**. We need "External Verification" — a separate step (Evaluator) that demands proof before closure.

### 3. Loop / Step Repetition (FM-1.3)
- **Definition**: Repeating the same tool call or reasoning step.
- **Severity**: **Non-Fatal**. Interestingly, MAST finds this appears in successful traces too. It's often the agent "trying again."
- **Relevance**: We shouldn't kill a session just because of a loop *if* the arguments change. Blind loop detection is harmful.

## Application to May System

### 1. Drift Detection (Evaluator)
We should tag failures in our `ERROR_LOG.jsonl` with MAST codes.
- **Action**: Update `agents/evaluator/skills/monitor-session.md` to look for FM-2.6 and FM-3.3.
- **Benefit**: We can aggregate stats: "Is Coder failing due to Mismatch (needs better prompting) or Verification (needs better tests)?"

### 2. Verification Protocol (Coach/QA)
For FM-3.3 (Premature Success), we must enforce **Double-Check**.
- **Action**: QA agent must explicitly look for "Evidence of Completion" vs "Claim of Completion."
- **Current State**: Our `QA` role already does this, but we can make the prompt more specific: "Reject FM-3.3: Does the agent *claim* it worked, or did it *prove* it?"

### 3. Loop Tolerance (System)
We should refine our loop detector (Wink Pattern).
- **Insight**: If arguments change, it's not FM-1.3 (Mindless Loop), it's "Retry."
- **Action**: Ensure `monitor-session` distinguishes exact duplicates from iterative attempts.

## Conclusion
MAST gives us a "Debug Language." Instead of saying "it didn't work," we can say "Trace s_123 failed due to FM-2.6." This precision allows for structural fixes.
