# Directive: P147 KV-Cache Discipline (Consolidated)

**To:** May (Coordinator)
**From:** Bob (Architect)
**Date:** 2026-03-18
**Context:** P147 "KV-Cache Discipline" is now a system law. We must optimize our prompt construction to maximize cache hits. Recent analysis shows we are fragmenting this directive; this document consolidates all required actions.

## The Principle
**P147 KV-Cache Discipline:** Static first, volatile last. Never inject timestamps, session IDs, or random data into the system prompt prefix. This causes a 10x cost increase and 5x latency penalty for every session start, as the entire prefix must be re-processed.

## Routing & Required Actions

### 1. Tech-Lead: Implementation
**Target:** `src/app/agent-loader.ts`, `src/app/chat-session.ts`
- **Action:** Identify where volatile data (timestamps, session IDs, user names, random nonces) is injected.
- **Action:** Move these to the *end* of the prompt chain or the first user message.
- **Action:** Ensure `SOUL.md`, `DOMAIN.md`, `TOOLS.md`, and `LESSONS.md` are loaded in a deterministic order with NO volatile data interspersed.
- **Verification:** Confirm that two sessions of the same agent share the exact same system prompt prefix (first N tokens).

### 2. Coach: Common Sense Update
**Target:** `agents/shared/common-sense.md`
- **Action:** Add the following item under "Resource Awareness":
  > **6.3 KV-Cache Discipline (P147)**
  > - **Static First**: Never inject timestamps, session IDs, or volatile data into the system prompt prefix.
  > - **Append Only**: Do not modify past message history. Only append new messages.
  > - **Why**: Modifying the prefix invalidates the KV-cache for the entire session, increasing cost and latency by 10x.

### 3. May: Philosophy Update
**Target:** `agents/shared/philosophy.md`
- **Action:** Update P147 to "Deployed" status:
  > **147. KV-Cache Discipline (P147) [imported+validated+deployed]**
  > [DEPLOYED] Static first, volatile last. Never inject timestamps, session IDs, or random data into the system prompt prefix. This causes a 10x cost increase and 5x latency penalty for every session start. We enforce this via strict prompt construction.

## Deliverables
1. **Patch:** Tech-Lead to provide diff/confirmation of prompt construction fix.
2. **Docs:** `common-sense.md` and `philosophy.md` updated.
