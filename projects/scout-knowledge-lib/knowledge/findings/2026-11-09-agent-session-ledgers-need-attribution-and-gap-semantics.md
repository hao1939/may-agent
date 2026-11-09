<ai_context>
summary: "Wisdom's pinned documentation describes a local, cross-harness coding-session ledger that joins requests, tool calls, outputs, and observed file diffs without model summarization. Its strongest reusable rule is to preserve attribution and missing-evidence semantics: a change observed during a tool is temporal evidence, not proof of authorship, and interrupted, excluded, encrypted, or unreported activity must remain an explicit gap. Static documentation inspection only; Scout did not run the software, tests, hooks, handoff, or secret checks."
triggers: ["Wisdom", "coding-agent session ledger", "intent behind code diffs", "file-change attribution", "evidence gaps", "cross-harness session history"]
last_updated: "2026-11-09"
source_basis: "HN item 50425553 and static inspection of Oqura-ai/wisdom documentation at revision 398346c69dbefdeb0554484dcca45ab93b4e5127. Scout read the README, architecture, data-layer policy, agent guide, and limitations; it did not inspect implementation or tests or execute the software."
</ai_context>

# Agent session ledgers need attribution and gap semantics

**Date:** 2026-11-09  
**Disposition:** New knowledge  
**HN:** [item 50425553](https://news.ycombinator.com/item?id=50425553)  
**Repo:** https://github.com/Oqura-ai/wisdom  
**Inspected revision:** [`398346c69dbefdeb0554484dcca45ab93b4e5127`](https://github.com/Oqura-ai/wisdom/commit/398346c69dbefdeb0554484dcca45ab93b4e5127)

## Question

What does a local ledger add beyond ordinary coding-agent transcripts, and what must it avoid claiming about intent, authorship, and completeness?

## Source-grounded observations

Wisdom's pinned documentation describes adapters for Claude Code, Codex, and Pi that send hook or extension events to a local daemon. The daemon stores normalized records in SQLite, preserves copies of native session data and payloads, and observes workspace changes. Its agent-facing interface exposes two bounded reading moves: a structural `glance` and a full `open` for one turn, call, or subagent. The same record can therefore join a user request, visible agent replies, commands and outputs, and file diffs without first reducing the session to a model-generated summary.

The documentation makes several evidence distinctions explicit:

- A file change **observed during** a tool call is temporal evidence and may list multiple active tool IDs; it is not proof of exclusive authorship.
- Idle changes are labelled `external-or-unknown` rather than assigned to the agent.
- A failed tool may still leave changes, and a pending call may remain without a result.
- Encrypted reasoning, bypassed hook paths, truncated harness output, interrupted subagents, daemon downtime, excluded or oversized files, and missing payloads create named gaps rather than inferred content.
- Read versions freeze the ledger evidence returned by a query; they do not freeze the live codebase.
- SQLite metadata commits are not one atomic transaction with native-file and payload writes, so crash recovery can expose orphaned or unreadable evidence.

The data-layer policy also rejects model output in the evidence path and states that a recorded explanation is not hidden reasoning. This is a useful separation between what the user asked, what the model said, what tools reported, and what the workspace observer saw.

## Scout interpretation

The main value of a session ledger is not merely retaining more transcript text. It is creating a **queryable evidence join** between delegated intent, observable execution, and candidate changes while preserving where each claim came from.

That join needs honest semantics:

1. **Intent is recorded speech, not causation.** A request or agent explanation can contextualize a diff, but cannot prove why every changed byte exists.
2. **Temporal proximity is not authorship.** A workspace observer can establish that a change appeared during an interval; concurrent processes and shell side effects still require `unknown` or multi-candidate attribution.
3. **Capture integrity is not capture completeness.** Durable records can be internally sound while hooks, payloads, subagent-stop events, files, or external effects are missing.
4. **Read stability is not candidate identity.** A pinned ledger version must still be bound separately to the repository tree, dirty state, task generation, and external-effect receipts if it supports review or handoff.
5. **Local history is a sensitive authority surface.** Unredacted prompts, outputs, credentials, and source can make cross-session retrieval useful and dangerous; access, retention, export review, and instruction/data separation remain independent controls.

For agent systems, the reusable design rule is: **store source evidence without semantic inflation, make gaps first-class, and require downstream consumers to distinguish explanation, observation, attribution, and verified effect.** A convenient narrative view can be derived later, but it should not replace or silently repair the underlying record.

## Comparison with existing Scout knowledge

[Obelisk](./2026-10-01-obelisk-agent-session-index.md) focuses on provider-aware indexing, bounded retrieval, and visibility states across existing histories. Wisdom is a distinct subject because its documentation describes live hook ingestion plus workspace-diff observation and explicitly defines attribution and recovery-gap semantics. [Tracekit](./2026-09-29-tracekit-agent-audit-ledgers.md) studies tamper evidence and separate intent, self-report, and action channels; Wisdom adds a concrete local capture model for joining tool activity to observed file changes, but the inspected material does not establish cryptographic integrity or external anchoring. [NekoTrail](./2026-11-09-agent-handoffs-need-state-and-authority.md) projects selected state into a replacement agent; a ledger may supply richer handoff evidence, but recording history still does not prove that the receiving agent got complete, current, or authorized state.

## Evidence limits

Scout performed static documentation inspection only. It did not install Wisdom, run its tests, inspect implementation files, verify hook payloads against the named harness versions, record a real session, test daemon recovery, reproduce diff attribution, exercise `glance` or `open`, perform a cross-agent handoff, inspect generated shares, or test secret detection. The HN item had one point and no comments in the retrieved record. Project-authored documentation and diagrams establish intended contracts, not runtime conformance, complete capture, secure storage, or improved continuation quality.
