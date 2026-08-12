---
title: "Codex DeepSeek Subagent — Cross-Provider Delegation Is Becoming a Transport Problem"
source: github
date: 2026-08-05
last_updated: 2026-08-05
type: finding
tags: [github, coding-agents, subagents, multi-provider, transport, delegation, hooks, data-boundaries]
relevance: high
---

# Codex DeepSeek Subagent

## Overview

- **Repo:** [Utopia-V/codex-deepseek-subagent](https://github.com/Utopia-V/codex-deepseek-subagent) (77★, created 2026-08-04, pushed 2026-08-05)
- **Author:** Utopia-V
- **Language:** Python
- **License:** MIT
- **What:** A configuration package that keeps the parent Codex task on OpenAI while spawning a native `v4_flash_worker` child on DeepSeek V4 Flash, using a trusted one-shot handoff Hook instead of switching the whole session provider.

## Core Signal

**Heterogeneous subagents are turning into a transport-and-identity problem, not just a model-routing problem.**

The notable move in this repo is not merely “use a cheaper model for side work.” The repo argues that current cross-provider subagent delivery in Codex V2 can fail at the task-carrier layer: the right child is spawned, but the assignment may arrive as provider-internal ciphertext that the external child cannot actually consume.

Its answer is deliberately narrow:

1. Keep the parent on its original OpenAI model/provider.
2. Stage one self-contained child assignment into a local one-slot state file.
3. Spawn the exact child role with `fork_turns="none"`.
4. Use a trusted `SubagentStart` Hook to inject the assignment as plaintext developer context only for that role.

That is a useful signal because it reframes multi-model delegation. The hard part is not choosing a cheaper child model; it is preserving **truthful child identity, correct task delivery, bounded data exposure, and native callback semantics across provider boundaries**.

## Concrete Design Details

1. **The repo refuses the usual “just switch providers” shortcut.**
   The README and advanced notes repeatedly say the main Codex task keeps its current OpenAI model, provider, and ChatGPT login. DeepSeek exists only inside the standalone `v4_flash_worker` child configuration; the package explicitly says it is not an MCP server, wrapper, daemon, second Codex CLI, or a global provider switch.

2. **The compatibility layer exists because the native task carrier is unreliable across providers.**
   `docs/advanced.en.md` says the current OpenAI-parent → non-OpenAI-child V2 route can place the assignment into `encrypted_content`, leaving the child's visible payload empty. The doc cites upstream Codex issues and frames the problem as a representation failure at the cross-provider boundary, not a DeepSeek model failure.

3. **Delegation is one-shot and self-contained by design.**
   The worker skill requires the parent to build one complete assignment, stage it through stdin, then immediately spawn `v4_flash_worker` with `fork_turns="none"`. The docs explicitly warn that V2 `send_message` and `followup_task` may hit the same boundary, so a Flash child should receive one bounded job rather than an evolving conversation.

4. **The handoff path is intentionally narrow and mechanically checkable.**
   `hooks/plaintext_handoff.py` hardcodes `AGENT_TYPE = "v4_flash_worker"`, stores exactly one pending handoff file, rejects malformed or still-live replacements, defaults to a 300-second TTL, atomically claims the file on `SubagentStart`, and injects the assignment via `hookSpecificOutput.additionalContext`.

5. **The repo treats task transport as separate from confidentiality.**
   `SECURITY.md` is unusually explicit that the handoff is a transport workaround, not an encryption boundary: the assignment briefly exists as plaintext in local user state and is then sent to DeepSeek. It also warns that a read-only sandbox limits mutation, not disclosure.

6. **The worker role is framed as a lane for bounded high-volume text work, not final judgment.**
   The worker skill says Flash fits search, enumeration, logs, extraction, and high-volume reading where raw material greatly exceeds final evidence. Tightly coupled reasoning, verification, consequential decisions, and final synthesis stay in the parent.

7. **Provider heterogeneity is treated as a qualification problem, not a simple config swap.**
   The advanced notes say another provider/model pair must pass a real check on spawn, delivery, tools, callback, cancellation, and accepted data boundary. Merely changing `model` or `base_url` is explicitly called insufficient.

## Why This Matters

1. **Cross-provider multi-agent stacks need transport semantics, not only price routing.**
   This repo makes visible a layer many agent demos skip: the assignment format itself can break when parent and child do not share a provider-native collaboration path.

2. **Model mixing is maturing from “pick the cheapest model for sub-tasks” to “qualify the delegation boundary.”**
   Identity, callback truth, cancellation semantics, and data custody all become first-class when parent and child providers diverge.

3. **One-shot child jobs may be more robust than chatty subagent conversations in heterogeneous fleets.**
   If follow-up messages can cross the same boundary, then the safer pattern is a self-contained child contract plus a native callback, not a long-running inter-agent dialogue.

4. **Read-only is no longer accepted as a full safety story.**
   The security docs sharpen a recurring library theme: containment for mutation and containment for disclosure are different problems.

## Connections to Library Themes

- **Delegation surface:** this is a concrete example of the subagent boundary becoming its own engineering object.
- **Governance by transport design:** the system constrains what crosses the provider boundary, when it crosses, and for which exact role.
- **Thin wrapper, thick compatibility layer:** the visible feature is “use DeepSeek as a child,” but the real artifact is the handoff protocol.
- **Verification over narrative:** the repo distinguishes between a child that merely exists and a child that actually received the intended assignment.

## Sources

- **Repo:** https://github.com/Utopia-V/codex-deepseek-subagent
- **README:** https://raw.githubusercontent.com/Utopia-V/codex-deepseek-subagent/main/README.en.md
- **Advanced notes:** https://raw.githubusercontent.com/Utopia-V/codex-deepseek-subagent/main/docs/advanced.en.md
- **Security:** https://raw.githubusercontent.com/Utopia-V/codex-deepseek-subagent/main/SECURITY.md
- **Hook script:** https://raw.githubusercontent.com/Utopia-V/codex-deepseek-subagent/main/hooks/plaintext_handoff.py
- **Worker skill:** https://raw.githubusercontent.com/Utopia-V/codex-deepseek-subagent/main/skills/use-v4-flash-worker/SKILL.md
- **GitHub API metadata:** https://api.github.com/repos/Utopia-V/codex-deepseek-subagent
