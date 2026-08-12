---
title: "Celln — Borrowed Tool Isolation for Agent Runtime Security"
source: github
date: 2026-08-05
last_updated: 2026-08-05
type: finding
tags: [github, agent-security, sandboxing, tool-governance, isolation, coding-agents]
relevance: high
---

# Celln

## Overview

- **Repo:** [sympozium-ai/celln](https://github.com/sympozium-ai/celln) (17★, created 2026-08-02, pushed 2026-08-02)
- **Author:** sympozium-ai
- **Language:** Rust
- **License:** Apache-2.0
- **What:** A microVM-based runtime that treats tools as host-verified bytes temporarily loaned into an isolated cell, instead of giving the agent a general-purpose machine to configure.

## Core Signal

Celln makes a sharper security split than most agent sandboxes: **the agent does not really own the environment**.

The repo's model page describes the inversion explicitly:

| Typical sandbox | Celln |
|---|---|
| Agent receives a general-purpose image | Cell receives a stripped substrate plus only specific tool pages |
| Agent fetches and builds its environment | Host verifies a tool once, then lends the same bytes read-only |
| Revocation means stopping or rebuilding machines | Host can unmap a tool from a running cell |

That matters because many "sandboxed" agent systems still let the agent accumulate effective authority by installing packages, rewriting the environment, or laundering agent-authored code through trusted interpreters. Celln is trying to close that gap at the execution boundary.

## Concrete Design Details

1. **Tool bytes are lent, not installed.** The host-side "assay" keeps verified tool bytes and maps them read-only into a short-lived cell. The cell itself is deliberately minimal rather than a full mutable Linux workstation.

2. **Authority only shrinks during execution.** The security docs say the warden enforces an authority ratchet: rights can shrink but never expand once materialization closes.

3. **Interpreters are treated as laundering risks.** In the spec model, a declared interpreter such as Python is demoted to the **agent lane** when it is fed agent-authored input. The repo is explicit that `python` running model-written code should not inherit full tool-lane authority just because the binary itself is verified.

4. **Agent-authored code never becomes a trusted host tool.** The README and security docs both say generated programs always run in the agent lane with only their executable plus writable workspace. Landlock blocks broader filesystem access, seccomp blocks network and privileged syscalls, and compiling model-written source does not promote it into tool authority.

5. **Network is brokered, not ambient.** Cells have no in-kernel network stack. Named destinations must be declared, then fetched through a bounded broker path; private addresses and out-of-scope redirects are refused.

6. **The repo exposes host-verifiable security checks.** `celln verify` is presented as an actual proof path for two claims: a guest cannot write lent tool code even with its own page tables, and revoking a mapped tool stops it in an already-running cell.

## Why This Matters

1. **It reframes sandboxing from machine ownership to tool custody.** The important object is not the VM image but the authority attached to specific executable bytes.

2. **It separates trusted tools from agent-authored code more cleanly than most coding-agent runtimes.** Many systems isolate processes but still blur the line between a verified interpreter and unverified code passed into it.

3. **It turns revocation into a live runtime primitive.** If a host can unmap a tool from a running cell, then containment is no longer just a pre-launch policy check.

4. **It suggests a broader design direction for agent security:** host-managed, content-addressed, revocable capability loans may be a more robust primitive than giving agents a disposable but still general-purpose machine.

## Connections to Library Themes

- **Credential and authority containment:** Celln extends the trend toward keeping dangerous authority outside the agent's visible reasoning space.
- **Structural rather than prompt-level governance:** the main control surface is page mapping, lane assignment, and brokered egress, not behavioral instructions.
- **Verification-first runtime claims:** the repo tries to make isolation properties checkable on the host rather than leaving them as architectural prose.
- **Execution-lane separation:** trusted tool execution and agent-authored execution are treated as different security classes even when they share the same binary entrypoint.

## Sources

- **Repo:** https://github.com/sympozium-ai/celln
- **README:** https://raw.githubusercontent.com/sympozium-ai/celln/main/README.md
- **Model docs:** https://raw.githubusercontent.com/sympozium-ai/celln/main/docs/model.html
- **Security docs:** https://raw.githubusercontent.com/sympozium-ai/celln/main/docs/security.html
- **Try-it guide:** https://raw.githubusercontent.com/sympozium-ai/celln/main/docs/TRY_IT.md
- **GitHub API metadata:** https://api.github.com/repos/sympozium-ai/celln
