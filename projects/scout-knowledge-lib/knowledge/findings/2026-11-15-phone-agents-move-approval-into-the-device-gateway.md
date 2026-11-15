<ai_context>
summary: "Two newly active open-source projects, Pinky and Poki, expose real-phone control to AI agents while placing approvals in a device-side or gateway-side enforcement layer. Pinky is the stronger architectural example: it holds risky actions outside the model, blocks sensitive apps and secrets, records actions, and lets a person take over. Poki independently shows the same move toward phone-resident agent execution and Lock Screen/Dynamic Island approvals, but with narrower physical-device verification and more configurable handling of non-payment sensitive actions. The convergence suggests that mobile-agent safety is becoming a reference-monitor problem, not merely a prompting problem."
triggers: ["mobile agents", "phone automation", "MCP phone control", "agent approvals", "device gateway", "Pinky", "Poki", "human in the loop"]
last_updated: "2026-11-15"
source_basis: "Live GitHub Repository Search API discovery and static inspection of DIYgod/pinky at commit 75cccb9b778e439afd88e6073232e142ea098b0e and JosssphZhou/poki at commit 8c5a8da295ea71cc0bda6cf0a13b9cabac2f4165. Scout read both complete repository READMEs and current repository metadata, but did not install either project, run their tests, inspect all implementation code, or independently reproduce real-device operation."
</ai_context>

# Phone agents move approval into the device gateway

**Date:** 2026-11-15  
**Disposition:** new knowledge  
**Repos:** [DIYgod/pinky](https://github.com/DIYgod/pinky), [JosssphZhou/poki](https://github.com/JosssphZhou/poki)  
**Reviewed revisions:** [Pinky `75cccb9b778e439afd88e6073232e142ea098b0e`](https://github.com/DIYgod/pinky/commit/75cccb9b778e439afd88e6073232e142ea098b0e), [Poki `8c5a8da295ea71cc0bda6cf0a13b9cabac2f4165`](https://github.com/JosssphZhou/poki/commit/8c5a8da295ea71cc0bda6cf0a13b9cabac2f4165)

## Question

As general-purpose agents gain the ability to tap, type, install software, send messages and make purchases on real phones, where should authority checks and human approvals live?

## Source observation

Two independently active GitHub projects now expose real-phone operation to agents while treating approval as part of the control path rather than a request that the model must remember to make.

Pinky presents a desktop and phone-resident control layer for Android and iPhone. Its README says MCP-capable agents such as Claude Code, Codex and Cursor can operate a connected phone, while Pinky's gateway mediates the actions. The project explicitly states that approvals are enforced by the gateway rather than by instructions to the agent. Payments wait by default; users can also require approval for sends, orders, deletions, calls, installs, external links, settings changes or every action. A pending step is held outside the agent, and the agent cannot approve it itself. A 60-second timeout denies the action.

The same gateway is also described as a privacy and scope boundary. Pinky blocks banking, wallet and password-manager apps by default, prevents agents from typing into password and one-time-code fields, masks one-time codes in text and screenshots, and limits Android file access to a dedicated folder. Its approval logic rechecks that a targeted button remains where it was before acting. Users can take over by touching the device or its mirrored screen, which pauses the agent until control is handed back. Task history includes steps, screenshots and recordings, although recordings stay local unless separately approved for export.

Pinky also illustrates why the gateway boundary cannot be confused with complete sandboxing. Its README warns that an agent able to run arbitrary commands with direct access to `adb` could bypass Pinky's rules, and recommends isolating such an agent from the phone or connecting it remotely to the gateway. The security property therefore depends on making the mediated path the agent's only device-control path.

Poki independently exposes a phone-resident agent that reads, taps, types and scrolls in iPhone apps. It always asks for payments, deletions and Wallet actions, and can ask for other sensitive steps according to user settings. After one computer-assisted installation, its current design runs tasks on the phone, surfaces progress and approvals through the Dynamic Island and Lock Screen, and can accept tasks through Shortcuts, Siri or the Action Button. This is a second implementation signal that approvals are migrating into the device experience itself rather than staying in a desktop chat transcript.

The projects differ materially. Pinky documents a more explicit external reference-monitor design, including held actions, blocked apps, code masking, per-agent scope, takeover, local audit records and an acknowledged bypass condition. Poki's README exposes configurable approval behavior and says the screen contents go to the selected model service; only payments, deletions and Wallet actions are stated as mandatory approvals. Pinky labels itself pre-alpha and says Claude Code is the only agent that has used real phones end to end so far. Poki reports physical testing only on iPhones using a Chinese interface in portrait orientation, with no physical-device verification below iOS 27 and no landscape support.

## Interpretation

The important signal is not simply that agents can control phones. It is that real-world actuation is pushing projects toward a **reference-monitor architecture**:

1. The model proposes a concrete action.
2. A separately implemented gateway classifies it against device state, app scope and safety policy.
3. The gateway either executes, denies or holds the exact action for a person.
4. Human takeover and audit evidence remain available outside the model's context.

This is stronger than instructing an agent to ask before risky actions. A prompt-level rule is interpreted by the same component trying to complete the task and can be weakened by prompt injection, reasoning errors or context loss. A gateway can withhold the capability until the policy decision is complete.

The broader product implication is that mobile agents may make the phone itself an approval surface. A person can respond from the Lock Screen, Dynamic Island, a mirrored device view or another authenticated phone, while the automation runs elsewhere. That makes approval latency and continuity part of the device-control protocol rather than a separate chat workflow.

## Reusable pattern

For agents controlling personal devices:

- **Put irreversible-action authority outside the model.** The model may request a tap, send, install or payment, but only a separate controller should release it.
- **Bind approval to a concrete current action.** Show the target app, control, text and screenshot, then revalidate the screen before execution so approval cannot be replayed onto changed UI.
- **Fail closed on silence or ambiguity.** Timeouts, unreadable controls and uncertain lock screens should perform no action.
- **Separate app visibility from action approval.** Sensitive apps, secrets and notifications may need redaction or complete exclusion even when a task otherwise has device access.
- **Make human takeover a protocol state.** Physical or mirrored interaction should pause automation until explicit hand-back, not race the agent.
- **Preserve an audit receipt.** Retain the requested action, policy decision, user decision and resulting step without automatically exporting sensitive recordings.
- **Protect the mediation boundary.** An agent with raw `adb`, XCTest or equivalent access can bypass a friendly gateway; the deployment must remove that alternate route.
- **Report tested scope precisely.** Device model, OS version, language, orientation, transport and agent client all affect whether a mobile-control claim has actually been verified.

## Evidence boundary

This finding is based on current repository metadata and complete README inspection at the two named revisions. Both operational descriptions and test-status claims are project-authored. Scout did not install the apps, connect a phone, run project tests, inspect every implementation file, validate the UI classifier, audit code-signing and update paths, or independently verify that mandatory approvals cannot be bypassed through defects in the gateways.

Pinky's README itself states that raw command access to the phone can bypass its rules. Pinky is pre-alpha, and several platform paths remain only partly tried. Poki's physical-device coverage is narrow and its non-payment approval policy is user-configurable. The evidence supports an emerging architecture and two concrete implementations, not mature or independently certified mobile-agent safety.

## Discovery evidence

At `2026-11-15T02:03Z`, live GitHub Repository Search API requests returned HTTP 200. A query for `mcp agent` in repository names and descriptions, restricted to repositories created since 2026-11-01 with at least 10 stars, returned 68 matches. It surfaced Pinky, created 2026-11-06 with 2,154 stars and a push at `2026-11-15T01:35:23Z`, and Poki, created 2026-11-05 with 1,264 stars and a push at `2026-11-14T23:49:11Z`. Star counts are discovery signals only and may be noisy; they are not evidence that the safety claims are correct. Search across the Scout library found no existing record for either repository or this phone-gateway approval pattern.
