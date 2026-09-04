<ai_context>
summary: "GitHub finding on agenttrail's separation of agent-declared PLAN.md state from filesystem-observed activity, and why contradiction detection is useful without turning file touches or self-maintained checkboxes into completion proof."
triggers: ["agenttrail", "coding agent observability", "PLAN.md", "declared versus observed", "filesystem activity", "progress evidence", "authority separation"]
last_updated: "2026-08-25"
source_basis: "GitHub repository metadata, README, complete repository tree, recent commits, and bin/agenttrail.mjs at commit 8eb58c9c8b58a16c4d385098bb0ca48cf678dab6; Scout also ran Node's syntax checker on the downloaded daemon."
</ai_context>

# Agent Progress Observability Needs Authority Separation

Date: 2026-08-25  
Source: GitHub  
Repo: https://github.com/sodiumsun/agenttrail

## Signal

**agenttrail** is a new local dashboard that deliberately displays two different
views of coding-agent work: declared task state from an agent-maintained
`PLAN.md`, and observed activity from repository file writes plus optional
Claude Code hooks. That separation is more useful than a single self-reported
progress percentage because it exposes contradictions—for example, a component
marked done whose owned files are being edited again.

The important boundary is just as instructive: neither channel proves progress
or completion. The same agent is instructed to maintain the plan and its
`files:` ownership globs, while a filesystem event proves only that a path was
touched. The dashboard is therefore a **triage instrument**, not an independent
verifier.

## Source-grounded details

- GitHub Search returned the MIT repository in the query
  `topic:ai-agents created:>=2026-08-18 stars:>=5`; repository metadata reported
  that it was created on 2026-08-21 and had 206 stars at observation time. This
  is an early implementation signal, not evidence of production adoption.
- `PLAN.md` components declare `files:` globs and contain task states: pending,
  active, blocked, or done. The parser derives component state from those task
  checkboxes.
- The daemon separately uses `fs.watch` to associate writes with matching
  components. Its own source comment states the distinction explicitly:
  checkbox state is what the agent claims, while component touches are what the
  filesystem shows. A write remains visible even when the component is marked
  done.
- Optional Claude Code hooks add session start/stop, current and recent tool
  calls, todos, and file paths. Codex, Cursor, and other file-editing agents get
  the lower-fidelity filesystem channel but no equivalent run-card/todo feed.
- Observed state persists in a per-repository file under `~/.agenttrail`; live
  runs are marked ended after 15 minutes without an event and removed after two
  hours. The dashboard binds to `127.0.0.1` and emits updates over SSE.
- On platforms where recursive `fs.watch` is unavailable, the code explicitly
  degrades to top-level watching: `PLAN.md` remains live, but deep file activity
  is limited. Absence of a touch is therefore not portable evidence of
  inactivity.
- `agenttrail init` does more than install a passive observer. It appends a plan
  convention to both `CLAUDE.md` and `AGENTS.md`, creates `PLAN.md` if absent,
  installs local Claude Code hooks, and tells agents when to change task states
  and ownership mappings. The observed/declarative split is visual, but both
  schemas still share the agent's authority surface.
- The complete inspected tree contains the daemon, one static interface,
  documentation, and assets but no test files. The downloaded daemon passed
  `node --check`; that verifies JavaScript syntax only, not watcher portability,
  event attribution, or status accuracy.

## Why it matters

Agent progress dashboards should distinguish at least four claims:

| Layer | Example signal | What it can establish |
| --- | --- | --- |
| Intent | Agent marks a task active | What the agent says it is attempting |
| Activity | Owned file receives a write event | Where repository churn occurred |
| Acceptance | External test or review passes | Whether a defined gate accepted the artifact |
| Effect | Independent read-back or production observation | Whether the intended state transition occurred |

agenttrail usefully implements the first two and makes their disagreement
visible. The next design step is not to collapse them into one score. It is to
preserve their distinct provenance and attach external acceptance receipts when
operators need a completion verdict.

This also changes alert semantics. “Done component touched again” is a strong
review prompt, but it may represent a regression, a legitimate follow-up, a
formatter, or an unrelated process. “No recent touch” may mean completion,
stall, a non-file tool, a missed recursive watch, or daemon downtime. Both are
questions to investigate, not conclusions.

## Reusable guidance

1. Render declared intent and observed activity as separate fields with separate
   timestamps and producers.
2. Treat contradictions as review queues, not automatic failure or success
   verdicts.
3. Bind acceptance to an authority outside the worker being evaluated: a test
   runner, policy gate, reviewer, or independently captured effect receipt.
4. Report sensor coverage and degradation explicitly; do not interpret silence
   without knowing whether deep paths and non-file tools were observable.
5. Version agent-maintained mappings such as `files:` globs, because attribution
   quality depends on that mutable projection.

## Primary sources

- Repository at inspected revision: https://github.com/sodiumsun/agenttrail/commit/8eb58c9c8b58a16c4d385098bb0ca48cf678dab6
- README: https://github.com/sodiumsun/agenttrail/blob/8eb58c9c8b58a16c4d385098bb0ca48cf678dab6/README.md
- Daemon, parser, watcher, persistence, HTTP server, and initializer: https://github.com/sodiumsun/agenttrail/blob/8eb58c9c8b58a16c4d385098bb0ca48cf678dab6/bin/agenttrail.mjs
- Package metadata: https://github.com/sodiumsun/agenttrail/blob/8eb58c9c8b58a16c4d385098bb0ca48cf678dab6/package.json
