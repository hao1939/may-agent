---
title: "Sol Advisor — Fresh-Context Review Lanes and Explicit Task-Lane Authorization"
source: github
date: 2026-08-05
last_updated: 2026-08-05
type: finding
tags: [github, coding-agents, orchestration, governance, verification, review-independence, task-routing]
relevance: high
---

# Sol Advisor

## Overview

- **Repo:** [DannyMac180/sol-advisor](https://github.com/DannyMac180/sol-advisor) (1,368★, created 2026-08-01, pushed 2026-08-04)
- **Author:** DannyMac180
- **Language:** Shell
- **What:** A Codex-native orchestration plugin that keeps architecture and acceptance in a primary Sol session, routes implementation through a Terra lane by default, and requires fresh review or explicit user authorization before switching into a user-visible Luna task lane.

## Core Signal

Sol Advisor is noteworthy because it treats **review independence and delegation authority as separate runtime contracts**.

Most coding-agent workflows say some version of "plan, delegate, review." Sol Advisor gets more specific about where those boundaries come from:

1. **Fresh review is a context boundary, not just another checklist.** The native implementation lane always routes through a separate `sol_advisor_sol_reviewer` role pinned to `gpt-5.6-sol` / high, with a read-only sandbox request and an exact `ship | fix-first | rethink` verdict contract.
2. **A stronger worker is not allowed to appear implicitly.** The Luna lane is opt-in only, requires the user's *current* request to authorize creation of a user-visible task, and forbids fallback to another model, agent, or lane when the required app-task capabilities are unavailable.
3. **Routing evidence is itself part of acceptance.** The repo requires exact companion-agent file checks, role-name checks, public spawn metadata, and when needed a local rollout inspector that emits only allowlisted routing fields.

That combination shifts the problem from "did the agent review itself?" to **"what exactly proves this work passed through the intended authority and review path?"**

## Concrete Design Details

1. **Dual lanes with asymmetric authority.** `plugins/sol-advisor/skills/orchestration/SKILL.md` makes Terra / High the default native implementation lane, while Luna / Max is a separate user-visible task lane outside native subagent V2. The primary Sol session keeps architecture, decomposition, verification, correction decisions, PR authorization, and final acceptance in both cases.

2. **Fresh reviewer is a shipped role, not a prompt suggestion.** `plugins/sol-advisor/agents/sol-advisor-sol-reviewer.toml` pins the review lane to `gpt-5.6-sol`, `high` reasoning, and `sandbox_mode = "read-only"`, and instructs the reviewer to return only `ship`, `fix-first`, or `rethink`.

3. **Install-time exactness is part of trust.** `plugins/sol-advisor/scripts/install-agents.sh` does byte-exact checks for the Terra and Sol companion files, migrates only recognized legacy files, and refuses modified, symlinked, or ambiguous destinations. The skill then requires `--check` before every native delegation.

4. **Runtime evidence is constrained to safe metadata.** `plugins/sol-advisor/scripts/inspect-agent-runtime.sh` searches only rollout filenames matching the exact thread id and emits a compact JSON object with allowlisted routing fields like role, model, effort, sandbox policy type, permission profile type, and cwd. It explicitly refuses absent or conflicting metadata rather than guessing.

5. **User-visible task creation is treated as a governance event.** `plugins/sol-advisor/skills/orchestration/references/luna-task-lane.md` requires `list_projects`, `create_thread`, `wait_threads`, `read_thread`, and `send_message_to_thread`; forbids use of `spawn_agent`; requires a complete task packet; and says a child task may not create or push a PR until the primary sends explicit authorization after inspecting the actual diff.

## Why This Matters

1. **"Independent review" is becoming operationalized.** Sol Advisor treats independence as fresh context + pinned role + observed routing metadata, not as a vague claim that the same session reviewed its own work carefully.

2. **Delegation authority is being narrowed to present-tense consent.** Requiring explicit authorization in the current request before opening a stronger Luna task lane is a meaningful counter-pattern to ambient escalation.

3. **Agent workflow quality is moving from behavioral instructions to verifiable routing.** The repo cares not only what the worker was told, but whether exact files, exact role names, and exact runtime metadata prove the intended lane actually ran.

4. **Read-only review is being treated as a first-class product surface.** The reviewer lane's whole point is that a model can inspect and veto without silently fixing. That is a stronger separation between implementation and judgment than many coding-agent repos currently enforce.

## Connections to Library Themes

- **Governance compilation:** authority boundaries are compiled into role files, installer checks, and task-lane contracts rather than left as prose-only operator norms.
- **Verification over narration:** worker claims are insufficient; routing evidence, diffs, and rerun checks remain acceptance gates.
- **Orchestration design:** the repo distinguishes native delegation from user-visible task orchestration instead of collapsing both into "subagents."
- **Containment by default:** the system is notable for what it refuses to do automatically—implicit lane switching, reviewer self-fixing, or unauthorized PR creation.

## Sources

- **Repo:** https://github.com/DannyMac180/sol-advisor
- **README:** https://raw.githubusercontent.com/DannyMac180/sol-advisor/main/README.md
- **Orchestration skill:** https://raw.githubusercontent.com/DannyMac180/sol-advisor/main/plugins/sol-advisor/skills/orchestration/SKILL.md
- **Luna task-lane contract:** https://raw.githubusercontent.com/DannyMac180/sol-advisor/main/plugins/sol-advisor/skills/orchestration/references/luna-task-lane.md
- **Installer:** https://raw.githubusercontent.com/DannyMac180/sol-advisor/main/plugins/sol-advisor/scripts/install-agents.sh
- **Runtime inspector:** https://raw.githubusercontent.com/DannyMac180/sol-advisor/main/plugins/sol-advisor/scripts/inspect-agent-runtime.sh
- **Reviewer role:** https://raw.githubusercontent.com/DannyMac180/sol-advisor/main/plugins/sol-advisor/agents/sol-advisor-sol-reviewer.toml
- **GitHub API metadata:** https://api.github.com/repos/DannyMac180/sol-advisor
