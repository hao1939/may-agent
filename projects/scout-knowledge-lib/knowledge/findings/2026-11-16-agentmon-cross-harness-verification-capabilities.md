<ai_context>
summary: "HN surfaced AgentMon Live, whose own cross-harness documentation shows that a unified monitor can expose sharply different verification evidence across Claude Code, Codex, and Kiro Crew. A trustworthy supervisory layer should label evidence by harness capability and preserve unknown or unavailable states instead of presenting one uniform done verdict."
triggers: ["AgentMon Live", "cross-harness monitoring", "coding agent verification", "done gate", "Claude Code", "Codex", "Kiro Crew", "verification capability"]
last_updated: "2026-11-16"
source_basis: "HN item 50522518, GitHub repository metadata, README, and guide inspected at pinned commit c47f78b5577a4f12a21144675681a4093cc1aa30 on 2026-11-16. Scout did not install or run the plugin, replay sessions, inspect the implementation, test its parsers or hooks, or independently validate producer claims."
</ai_context>

# Cross-harness agent monitors need capability-labelled verification

**Date:** 2026-11-16  
**Disposition:** New knowledge  
**Coverage:** Static producer-documentation inspection at one pinned revision

**HN source:** https://news.ycombinator.com/item?id=50522518  
**Repository:** https://github.com/codenotary/agentmon-live  
**Pinned revision:** https://github.com/codenotary/agentmon-live/commit/c47f78b5577a4f12a21144675681a4093cc1aa30

## Observation

HN surfaced AgentMon Live, a local browser and pane for observing Claude Code, Codex, and Kiro Crew sessions. At inspection, GitHub reported 42 stars, two forks, an Apache-2.0 license, and a repository created on 2026-10-25. Those figures indicate an early implementation signal, not broad adoption.

The useful evidence is the project's explicit account of how verification capability changes by harness.

For Claude Code sessions with the plugin loaded, the documented done gate runs before the model stops after substantive work. It uses recorded session facts to detect failed or stale checks, unsupported claims that tests or builds passed, test commands that selected no tests, fewer tests or more skips after an edit, edited packages unreached by tests, open todos, and subagents reporting failing tests. It can block the stop hook once and return the gap to Claude. The same integration can report test counts for supported runners, mark checks stale after later edits, and flag changed assertions or added skips for human review. An optional second model checks request coverage and unrequested additions only after the deterministic recorded-fact checks find no gap.

The cross-harness web view cannot carry the same verdict contract. For Kiro Crew, the guide says verification is inferred from command text and whether the call failed; the crew log has no command output, so there are no test counts. Pipes, `||`, later commands after `;`, checks inside subagent chats, and checks beyond the first 300 command characters can leave evidence unknown or unseen. The done gate and learning are absent unless the underlying chat is itself using the Claude Code harness with the plugin.

For Codex, the monitor reads session files and reports the last test, lint, typecheck, and build command from command text and exit status. The guide again says there are no test counts; compound or long commands can become unknown; approvals, subagent cards, task state, the done gate, and learning are absent.

Thus one interface displays all three harnesses, but it does not receive one uniform evidence product. The project documentation is unusually clear about these gaps. A shared dashboard is an observation surface; it is not evidence that every session passed the same completion gate.

## Implication

Cross-harness supervision should publish a capability-labelled receipt rather than flattening every session into a common green/red status. At minimum, each verification claim should carry:

1. **Evidence source** — hook event, structured session log, command plus exit status, parsed output, or model judgment.
2. **Coverage** — main session only or subagents too; project root or package; files and edits covered; whether the check occurred after the last relevant edit.
3. **Available signals** — output text, exit status, test counts, skip counts, changed assertions, approvals, task state, and stop-hook authority.
4. **Blind spots** — command truncation, compound-shell ambiguity, missing output, unseen subagent checks, background execution, or unsupported harness events.
5. **Verdict state** — pass, fail, stale, unknown, unavailable, or advisory. Unknown and unavailable must not silently become pass.
6. **Enforcement authority** — observe only, warn a human, ask the agent to continue, or actually block completion.

The distinction between observation and enforcement matters. A dashboard may show the same visual row for a Claude Code test with parsed counts and a Codex test inferred from one process exit, while only the former can participate in the documented stop-hook done gate. Product UI should expose that asymmetry directly—such as a capability matrix or evidence badges—so users do not infer equal assurance from equal presentation.

This also argues against defining “agent done” at the dashboard layer. The harness closest to execution should emit the strongest available structured receipt. A cross-harness monitor should preserve and compare those receipts without upgrading weak evidence. Higher-level policy can then require a capability set appropriate to the task: for example, output-backed test counts and post-edit freshness for a release, but command-plus-exit observation for a low-risk exploratory run.

## Evidence limits

Scout inspected HN metadata, GitHub repository metadata, and producer-authored README and guide text at the pinned revision. Scout did not install AgentMon Live, inspect its implementation, run Claude Code, Codex, or Kiro Crew sessions, trigger the done gate, test compound commands, alter tests, validate security or privacy claims, or reproduce the self-benchmark. The documented behavior may contain defects not visible in the prose. The project says its self-benchmark is a before-and-after comparison and cannot prove causality. This finding therefore uses the repository as a concrete capability-contract example, not as proof that its monitoring or gate is reliable in practice.

## Relationship to existing Scout knowledge

- [Agent CI gates need an inconclusive state](./2026-11-12-agent-ci-gates-need-an-inconclusive-state.md) argues that uncertainty must remain machine-readable rather than becoming a successful exit code. AgentMon adds the cross-harness case: evidence can be unavailable because the harness never records it.
- [Agent Runtime Verdict Integrity](../agent-runtime-verdict-integrity.md) requires proof that public verification entry points reach real checks and distinguish test counts, assertions, and exercised paths. This finding adds capability negotiation before such receipts are compared across runtimes.

## Inspected sources

- [HN item 50522518](https://news.ycombinator.com/item?id=50522518)
- [README at pinned revision](https://github.com/codenotary/agentmon-live/blob/c47f78b5577a4f12a21144675681a4093cc1aa30/README.md)
- [Guide: Claude Code done gate and verification](https://github.com/codenotary/agentmon-live/blob/c47f78b5577a4f12a21144675681a4093cc1aa30/docs/guide.md#the-pane)
- [Guide: Kiro Crew evidence limits](https://github.com/codenotary/agentmon-live/blob/c47f78b5577a4f12a21144675681a4093cc1aa30/docs/guide.md#the-web-view)
- [GitHub repository metadata](https://api.github.com/repos/codenotary/agentmon-live)
