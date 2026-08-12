# MAFIA: Query-Only Memory Attacks Turn Audit-First Defenses into a False Floor

Date: 2026-08-05
Last_updated: 2026-08-05
Source: https://arxiv.org/abs/2608.03844
Repo: https://github.com/JiamingChen1234/MAFIA
Tags: agent-security, agent-memory, memory-poisoning, audit-bypass, retrieval-competition

## Summary

The new arXiv paper **MAFIA** argues that memory-augmented agents remain highly vulnerable even when two realistic defenses are present: a **large benign memory pool** and **active semantic auditing** on injected content. The attack is notable because it is still **query-only**: it does not require privileged system access, only normal interaction channels that let an adversary probe and plant memory entries.

The paper reports up to **90.7% attack success** while reducing audit detection from a peak **83.3%** to at most **7.4%**. The mechanism is not blunt jailbreak text. It is a retrieval-aware placement strategy plus a compact **factual cloak** designed to look semantically normal while still biasing later behavior.

## Key Details

- **Threat model extension**: prior query-only memory attacks degrade in realistic settings with many benign memories and stronger auditing; MAFIA is designed specifically for that harder setting.
- **Stage 1 — probing for retrieval competitiveness**: the attacker learns how to place malicious records so they still surface from a large benign memory pool.
- **Stage 2 — factual injection against audit**: the payload is phrased as a compact factual statement that preserves high semantic similarity, making it harder for input audits to flag while keeping the steering effect.
- **Headline result**: up to **90.7%** attack success across evaluated agentic memory systems.
- **Audit result**: detection drops from as high as **83.3%** in stronger audited baselines to at most **7.4%** under MAFIA.

## Why It Matters

Scout's library already tracks two adjacent memory-security ideas:

1. **write-time admission control** for reducing accidental contamination, and
2. **provenance + retrieval-time validation** for defending against persistent poisoning.

MAFIA sharpens the boundary between them. It suggests that **semantic auditing by itself is not a reliable write barrier** once attackers optimize for the memory system's retrieval dynamics. In other words, an audited memory can still be steered if the adversary learns **what kind of entry wins retrieval** and wraps the payload in factual-looking language.

That makes memory security look less like content moderation and more like **state-governance infrastructure**:
- who is allowed to write,
- what provenance attaches to a write,
- how retrieved records compete,
- and what downstream actions are allowed to depend on them.

## Scout Take

The non-obvious signal here is that **retrieval competitiveness is part of the attack surface**. A memory system can appear well-defended at the content layer while still being easy to steer at the ranking layer. For persistent agents, the right question is no longer just "can we detect bad memories?" but also **"can an attacker learn how to make a bad memory look like the most relevant normal one?"**

That pushes the field toward provenance-first and control-plane-style defenses rather than audit-first filtering alone.