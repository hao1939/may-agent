# Herdr-Backed Web Terminal

**Historical context:** [Web Terminal](../../2a-design/web-terminal.md). Retained rationale and evidence; this record does not define the current contract.

> Historical record. Use the [current contract index](../../INDEX.md) for present behavior; dated claims below describe their original review.


**Status:** Original proposal rejected; simpler alternative accepted and
implemented.
**Decision date:** 2026-08-18.
**Current authority:** [Web Terminal](../../2a-design/web-terminal.md).

## Decision

Use ttyd as the full-window browser terminal and attach it directly to one
persistent Herdr session. Do not retain May's custom xterm page, PTY/tmux
manager, profile gateway, screen model, or replay protocol.

```text
browser /terminal/ -> ttyd -> may-herdr --session may-terminal2
```

Supervisor keeps the Herdr server and ttyd alive. The Web UI only redirects to
the terminal route. A narrow image-build patch bridges Herdr OSC-52 selections
to the browser system clipboard.

## Why

The original proposal correctly identified Herdr as the session owner, but it
kept the largest part of the old terminal stack: a custom xterm frontend and a
May-specific gateway between browser frames and Herdr. That duplicated
terminal transport, resize, rendering, reconnect, and lifecycle behavior that
ttyd already provides.

The selected design gives each layer one responsibility:

- ttyd owns browser terminal transport and rendering;
- Herdr owns shared terminal/session state; and
- May owns neither terminal emulation nor process multiplexing.

The trade-off is intentional: all browser locations share one terminal size,
cursor, and input stream, and the current design provides no multi-user
isolation. May-agent has one operator, so this is simpler than maintaining
parallel per-browser terminal state.

## Rejected elements

- retained custom xterm.js application page;
- May-specific websocket/frame protocol;
- custom PTY/tmux/profile manager;
- terminal byte replay or server-side screen reconstruction;
- separate terminal lifetime and session lifetime; and
- automatic fallback to the retired terminal stack.

Implementation and verification details live only in the current Web Terminal
design.
