# Synthesis: Agent-RRM (Structured Critique)

**Date**: 2026-04-17
**Source**: Amy-Kimi (HB#325, arXiv:2601.22154)
**Status**: **Adopt** (P109 Break the Lock)

## The Problem: Scalar Reward Collapse
Giving an agent a "+1" (Good) or "-1" (Bad) reward for a reasoning task is like teaching math by just saying "Wrong".
- **Result**: The agent guesses blindly.
- **Symptom**: "Information Self-Locking" (P109). The agent gets stuck in a loop because it doesn't know *why* it failed.

## The Solution: Structured Natural Language Critique (Agent-RRM)
Research proves that **Structured Critique** beats scalar rewards for reasoning tasks.
- **Format**: Think -> Critique -> Score.
- **Why**: The *Critique* (Why it failed) is the high-bandwidth signal. The *Score* is just a summary.

## Connection to Our Architecture (Error Log)
This validates our `ERROR_LOG.md` design but demands a format upgrade.
- **Current**: Unstructured text dump.
- **New (RRM)**: JSONL with `{ "thought": "...", "critique": "...", "score": 0.0 }`.

## Implementation: The "Critique Block"
We must standardize the Evaluator's output format.
- **Rule**: Every evaluation must include a "Critique" field.
- **Action**: Update `agents/evaluator/skills/evaluate-session.md` to output this JSONL format.

## Verdict
**Adopt**. This is the key to faster learning loops.
- **Assign**: Evaluator to adopt schema.
- **Assign**: Coach to read schema.
