<ai_context>
summary: "acphost separates client reconnect replay from agent-process recovery: a sequence journal can restore missed protocol frames while the same host survives, but a host restart needs ACP session loading or a summary-seeded replacement conversation. Its append-before-delivery journal is not fsynced per frame and write errors are logged rather than stopping live delivery, so sequence replay is not itself a crash-durable acceptance receipt. Evidence is static and producer-authored; Scout did not run acphost or its tests."
triggers: ["ACP reconnect", "agent session recovery", "journal replay", "conversation continuity", "acphost"]
last_updated: "2026-11-12"
source_basis: "Static inspection of gfx-labs/acphost at commit 3dccb5bf48a0565224d6767cf245d5ece55f24d7, including README, CLI-session design note, host and journal implementation, session state, and repository-authored session tests. The complete recursive tree contained 241 entries and was not truncated. Scout did not execute the software or tests."
</ai_context>

# Reconnect Replay Is Not Session Recovery

**Date:** 2026-11-12  
**Disposition:** new knowledge  
**Repo:** https://github.com/gfx-labs/acphost  
**Inspected revision:** [`3dccb5bf48a0565224d6767cf245d5ece55f24d7`](https://github.com/gfx-labs/acphost/commit/3dccb5bf48a0565224d6767cf245d5ece55f24d7)

## Source observation

acphost is a Linux Go host for Agent Client Protocol coding agents. One detached
host process owns the agent process group, proxies ACP through a Unix socket or
optional mutually authenticated TCP listener, and appends controller and agent
frames to a sequence-numbered NDJSON journal. A reconnecting controller supplies
its last sequence number and receives missed agent notifications before live
traffic. The CLI renders output from the journal rather than treating socket
receipt as the durable view, and stores the last displayed sequence in an
atomically replaced `client.json` file.

That mechanism gives useful **observation continuity while the same host and
agent process survive a client restart**. It does not by itself recover the
agent's semantic state after the host stops or the machine restarts. On the next
prompt, the CLI starts a new host and agent process. It first asks the agent to
load the prior ACP session. If the agent lacks `loadSession` support or loading
fails, the CLI creates a new ACP session and prefixes the next prompt with a
summary derived from the journal. Repository-authored tests explicitly expect a
new session ID in that fallback. The journal is therefore evidence from which a
replacement conversation can be reconstructed, not a snapshot of the old
agent's hidden context, model state, tool environment, or in-flight execution.

The implementation also exposes a durability boundary beneath the replay claim.
The host increments the frame sequence, appends the journal line, and only then
queues live delivery, which protects against an ordinary controller disconnect
between observation and delivery. But the per-frame append and index append do
not call `fsync`; a journal write error is logged and live routing continues.
Readers ignore an incomplete final line, but that only makes a partial frame
readable on a later attempt if the missing bytes eventually exist. Thus a
reported live sequence can outrun durable storage after an I/O failure, process
crash, or machine-level loss. The source supports ordered best-effort
append-before-delivery, not a fail-closed crash-durable acceptance receipt.

Finally, acphost deliberately permits one active controller. A new connection
replaces the old one, and the CLI uses an advisory file lock to refuse a second
`prompt` or `attach`. This simplifies cursor ownership but means reconnect is an
ownership transfer, not multi-consumer fan-out. A lease also stops the host after
it has no connected controller for the configured interval, so process survival
is explicitly bounded.

## Reusable finding: split continuity into three receipts

A durable agent runtime should not use one “session resumed” flag for three
different guarantees:

1. **Observation replay:** which protocol frames or events the consumer has
   durably acknowledged, identified by a stream identity and cursor.
2. **Execution continuity:** whether the same worker process and in-flight turn
   remain alive, including the current controller or owner fence.
3. **Semantic reconstruction:** whether a replacement worker loaded native
   session state, replayed authoritative history, or merely received a lossy
   summary in a new conversation.

Each transition should say which receipt it established. If the journal is the
replay authority, appends that count as accepted need an explicit durability
policy and a failure mode that does not silently continue past a missing record.
If recovery falls back to summarization, the new execution identity and the
summary's source range should remain visible rather than presenting the result
as continuation of the old hidden state. External effects still require their
own idempotency and reconciliation receipts; replaying ACP frames cannot prove
that a tool effect happened once.

## Evidence boundaries

- This is static inspection of producer-authored source, documentation, and
  tests. Scout did not build acphost, run its Go suite, start an ACP agent,
  interrupt a controller, kill a host, or simulate disk and machine failure.
- Repository-authored tests cover conversation loading, summary fallback,
  detached turns, attach, cancellation, and host restart. They are intended
  behavior evidence, not independent production reliability validation.
- The finding does not claim that acphost promises synchronous disk durability
  or transparent process recovery. Its documentation distinguishes client
  reconnect from host restart; that separation is the useful signal.
- The recursive tree had 241 entries and `truncated=false`. Scout read the named
  files in detail, not every repository file.

## Sources inspected

- Repository architecture and reconnect semantics: https://github.com/gfx-labs/acphost/blob/3dccb5bf48a0565224d6767cf245d5ece55f24d7/README.md
- CLI session, locking, host restart, and fallback design: https://github.com/gfx-labs/acphost/blob/3dccb5bf48a0565224d6767cf245d5ece55f24d7/docs/notes/290-cli-sessions.md
- Journal append-before-delivery and controller replacement: https://github.com/gfx-labs/acphost/blob/3dccb5bf48a0565224d6767cf245d5ece55f24d7/pkg/acphost/host.go
- Journal cursor reading and incomplete-line handling: https://github.com/gfx-labs/acphost/blob/3dccb5bf48a0565224d6767cf245d5ece55f24d7/pkg/acphost/journal.go
- Journal index and compression storage: https://github.com/gfx-labs/acphost/blob/3dccb5bf48a0565224d6767cf245d5ece55f24d7/pkg/acphost/journalstore.go
- CLI cursor state and single-client lock: https://github.com/gfx-labs/acphost/blob/3dccb5bf48a0565224d6767cf245d5ece55f24d7/cmd/acphost/session.go
- Host-restart and summary-fallback tests: https://github.com/gfx-labs/acphost/blob/3dccb5bf48a0565224d6767cf245d5ece55f24d7/cmd/acphost/session_test.go
- Complete tree API: https://api.github.com/repos/gfx-labs/acphost/git/trees/3dccb5bf48a0565224d6767cf245d5ece55f24d7?recursive=1
