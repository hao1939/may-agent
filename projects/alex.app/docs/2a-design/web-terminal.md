# Web Terminal

**Supports:** [Human Control Surfaces](human-control-surfaces.md). Provides browser access to an existing operator session without another work model.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#simple-first).

**Design status:** Accepted.
**Implementation status:** Implemented with ttyd and one persistent Herdr
session.
**Aligned with:** [webui.md](webui.md) and [may-console.md](may-console.md).

## Purpose

The Web Terminal gives the operator a full-window browser terminal at
`/terminal/`. It is infrastructure for interactive shells and agent CLIs; it
does not implement Conversation, App work, or a second May UI.

## Mental model

```text
browser /terminal/
  -> ttyd (terminal transport and browser xterm)
  -> may-herdr --session may-terminal2
  -> one Herdr-owned terminal session
```

The Web UI redirects its terminal route to ttyd. ttyd owns browser transport,
terminal input, resize, and rendering. Herdr owns persistent terminal state and
the CLI processes inside that state. May does not maintain a custom PTY,
terminal screen, profile manager, or replay buffer.

## Process ownership

Supervisor starts two independent programs:

- `terminal-herdr` runs `may-herdr --session may-terminal2 server` so the
  configured session exists independently of a browser; and
- `terminal-ttyd` serves `/terminal/` and attaches each browser connection to
  that same Herdr session.

A browser refresh or ttyd restart therefore reattaches to Herdr rather than
creating a new shell. A whole-container restart recreates the configured
Herdr session. An interactive agent CLI may still require its own native resume
operation; Herdr preserves the terminal session and process state while it
exists, not provider-side conversation history after a process is gone.

Herdr state and configuration use the persistent May state root through the
`may-herdr` wrapper. The wrapper isolates `XDG_CONFIG_HOME`, `XDG_STATE_HOME`,
and `XDG_RUNTIME_DIR` under that root so container-user defaults do not make
session discovery depend on a transient home directory.

## Browser behavior

ttyd's bundled xterm client is the terminal emulator. The server does not
parse ANSI output or keep a parallel screen model. Normal terminal rules apply:

- the active browser controls the shared terminal dimensions;
- simultaneous browsers see the same Herdr state and may affect one another's
  cursor, input, and size;
- this is intentional because this installation has one operator, possibly
  using several browser locations; and
- the terminal is a whole-window route, not an embedded application tab.

## Clipboard

Herdr needs mouse input for its UI, so browser drag selection is not always an
xterm-owned selection. The image build patches the checksum-pinned ttyd index
with a narrow OSC-52 clipboard bridge:

```text
Herdr selection
  -> OSC-52 payload
  -> browser bridge
  -> navigator.clipboard when allowed
  -> explicit browser copy fallback when direct clipboard access is unavailable
```

The build asserts the patch anchor and installed bridge. A ttyd upgrade that
changes the minified page must fail the image build instead of silently losing
system-clipboard behavior. Clipboard text is decoded as terminal data; the
bridge does not add ANSI framing or wildcard characters to the copied content.

Browser security policy still applies. Direct OS clipboard writes normally
require a secure context and browser permission. When unavailable, the UI must
offer an explicit “Copy to system clipboard” action rather than claim success.

## Agent CLI integration

Container startup installs Herdr integration hooks for Codex and Claude and
keeps their configuration under persistent state. These hooks let Herdr
observe agent state; they do not grant model/tool permissions or replace the
CLI's own resume and approval policy.

Use Herdr commands inside the shared terminal to create or select panes and
start the desired CLI. Session layout belongs to Herdr configuration, not to a
May terminal profile registry.

## Boundaries

This is a trusted-operator surface. The installation operator owns user and
network access controls; the repository configuration does not by itself prove
an external authentication proxy or firewall. See [Installation access
responsibility](http-boundary.md#installation-access-responsibility). `/terminal/`
uses ttyd through nginx and its Unix socket; published port 6080 is the separate
noVNC/websockify surface, not the terminal route.

The terminal path deliberately does not own:

- authentication or multi-user isolation;
- Conversation synchronization;
- durable App requests or task progress;
- agent-provider session persistence;
- command authorization; or
- terminal output as an audit record.

Use Conversation/App state for human interaction and work tracking. Use native
session transcripts or explicit artifacts when terminal output must be
reviewed durably.

## Implementation references

- `projects/may-agent/container/supervisord.conf`
- `projects/may-agent/container/may-herdr.sh`
- `projects/may-agent/container/setup-herdr-integrations.sh`
- `projects/may-agent/container/ttyd-clipboard-bridge.js`
- `projects/may-agent/container/patch-ttyd-index.cjs`
- `projects/may-agent/test/integration/herdr-terminal.test.ts`

## Verification contract

Tests and image checks must prove:

- `/terminal/` redirects to the full-window ttyd service;
- supervisor starts both Herdr server and ttyd against `may-terminal2`;
- persistent state paths are used;
- the clipboard bridge is installed exactly once; and
- the retired custom xterm/node-pty/tmux terminal stack is absent.
