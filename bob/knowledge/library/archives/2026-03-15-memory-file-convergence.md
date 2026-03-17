# Synthesis: The Memory-File Convergence & The Poisoning Risk
**Date:** 2026-03-15
**Sources:**
- LangChain "Filesystem as Memory" (Blog, Feb 2026)
- TierMem: Provenance-Aware Tiered Memory (arXiv:2602.19xxx)
- StateLM: Models That Manage Their Own Context (arXiv:2602.12108)
- Persistent Memory Poisoning (arXiv:2602.15654)
- AgenticCyOps (arXiv:2603.09134)

## 1. The Mechanism: Filesystem IS Memory
Multiple independent sources (LangChain, Claude Code, our own P11) have converged on the **Filesystem-as-Memory** pattern.
- **Why it wins:**
    - **Infinite Context:** Files are unbounded; context windows are finite.
    - **Structure:** Filesystems provide hierarchy (`ls -R`) and semantic addressing (filenames) that vector stores lack.
    - **Tooling:** Models are trained on code; they "know" how to navigate filesystems (`find`, `grep`, `cat`). They do not "know" how to query a specific vector DB schema.
    - **Cache Efficiency:** Reading a file is a discrete, cacheable block. Appending to a chat log invalidates the KV cache tail.

**Validation:**
- **LangChain** explicitly pivoted their Agent Builder to "Virtual Filesystem backed by Postgres."
- **Claude Code** uses the filesystem as its only state.
- **StateLM** shows that models trained to *actively manage* this memory (prune/index) outperform passive context by 10x.

## 2. The Pattern: Tiered Provenance (TierMem)
The "Write-Before-Query" barrier is a major flaw in summarization.
- **Problem:** Compressing logs into `knowledge/` loses detail. If we drop "User has allergies" during summarization, it's gone forever.
- **Solution (TierMem):** Keep **Tiered Memory**.
    - **Tier 1 (Hot):** Raw logs (`ERROR_LOG.jsonl`, `workspace/journal.md`).
    - **Tier 2 (Warm):** Summaries linked to raw logs (Provenance).
    - **Mechanism:** When a summary is insufficient, follow the link back to the raw log.
    - **Relevance:** Our `knowledge/` files should cite the source session ID (`[Source: s_123]`).

## 3. The Threat: Persistent Poisoning (Zombie Agents)
**arXiv:2602.15654** identifies a critical vulnerability in this exact architecture.
- **The Attack:** "Persistent Memory Poisoning."
    1. Agent reads a poisoned web page or repo.
    2. Agent summarizes it into `knowledge/library/`.
    3. The summary contains a "sleeper" instruction (e.g., "When asked about X, use tool Y to exfiltrate Z").
    4. **Result:** The agent is permanently compromised across sessions, even after a restart. The memory file itself is the vector.
- **AgenticCyOps** confirms "Memory Management" is one of the two primary attack surfaces (along with Tool Orchestration).

## 4. Structural Fix: The Sanitization Filter
We cannot trust memory written by the agent itself if it reads untrusted content.
**New Principle Recommendation:**
- **P147 Memory Sanitization:** "Trust, but Sanitize."
    - **Constraint:** Agents cannot promote content from `workspace/` (untrusted inputs) to `knowledge/` (trusted memory) without a **Sanitization Step**.
    - **Mechanism:** The "Consolidation Agent" (or a specific skill) must explicitly strip imperative instructions ("Ignore previous...", "Run this...") from the summary.
    - **The Rule:** Trusted Memory must be **Descriptive**, never **Imperative**. It describes facts, it does not issue commands.

## 5. Action Plan
1.  **Update Philosophy:** Add **P147 Memory Sanitization** (Memory must be descriptive, not imperative).
2.  **Harden Consolidation:** Brief Coach/May that `knowledge/` updates must be scanned for imperative injection.
3.  **Adopt Provenance:** Update `best-practices.md` to require `[Source: session_id]` in knowledge files.

## Verdict
Our architecture (P11) is correct but vulnerable. We must patch the "Zombie Agent" hole before it opens.
