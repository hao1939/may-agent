# Design: Web Terminal

**Design status:** Draft.
**Implementation status:** Partial.
**Date**: 2026-07-10
**Aligned with**: `webui.md`, `may-console.md`, `http-boundary.md`

## Purpose

The Web Terminal is a browser-hosted terminal for local daemon operation and
debugging. It exposes the same terminal infrastructure for May Console, shell,
Claude, Codex, and ops profiles.

It is not the project UI, not a custom terminal emulator, and not a profile
specific rendering layer. The browser uses xterm.js, the backend keeps a real
terminal process alive through tmux, and the bridge carries terminal bytes
between them.

## Mental Model

```text
browser container
  -> xterm.js fit calculates cols/rows
  -> websocket sends input and resize frames
  -> terminal manager keeps one session per profile
  -> terminal bridge attaches to tmux
  -> profile process runs inside tmux
```

The browser owns the visible terminal size. xterm.js converts that size to
terminal `cols` and `rows`. The backend follows that size by resizing the
PTY/tmux session. The server does not guess profile widths, add cosmetic
padding, or emulate a terminal screen.

## Contracts

### One Terminal Path

All profiles use the same transport, resize, replay, and browser rendering
path. Profile differences belong in the startup command only.

If Codex renders differently from Claude, the first assumption is a shared
terminal pipeline bug: bytes, ANSI sequences, resize timing, font measurement,
or replay. Add profile-specific behavior only after the shared contract is
proven correct and the profile itself requires it.

### Lossless Transport

Terminal output may contain UTF-8, ANSI escape sequences, cursor movement,
alternate-screen controls, and partial frames split across arbitrary OS buffer
boundaries.

The backend must decode bridge stdout/stderr as streams, not as independent
chunks. A multibyte character split across two chunks must arrive in the
browser unchanged.

The bridge-to-manager protocol is JSONL. Newline separates frames, but byte
chunks do not. The manager may buffer text until a newline; it must not decode
each chunk in isolation.

### xterm Owns Rendering

xterm.js is the only terminal emulator in the browser. The server sends terminal
data and control frames; it does not maintain a custom screen model.

The browser writes output directly to xterm. It should not inspect ANSI escape
sequences or rewrite terminal output for a specific CLI.

### Resize Source of Truth

The browser container is the source of truth for visible size. The sequence is:

1. Open xterm in the mounted DOM node.
2. Let the browser complete layout and font measurement.
3. Fit xterm to the container.
4. Connect the websocket with those initial `cols` and `rows`.
5. Send later resize frames only when xterm reports a size change.

This avoids starting tmux with stale default geometry and then immediately
redrawing into a different size.

Only the focused, visible browser client should drive resize frames. A terminal
profile is backed by one tmux session, so two browser windows attached to the
same profile cannot have independent server-side sizes at the same time. This is
acceptable: refreshing or focusing the window the human is using should make
that window the current size owner.

### Reconnect and Replay

Browser refresh is an attach, not a process restart. The terminal manager keeps
the tmux-backed profile warm for its idle TTL.

Bounded replay is allowed so a refresh does not leave the browser blank. Replay
is a recent-output convenience, not an authoritative terminal screen model. For
interactive TUI programs, the live tmux attach and subsequent redraw are the
source of truth.

If replay causes corruption for a TUI, prefer a simpler attach/current-stream
behavior over adding server-side terminal emulation.

Browser scrollback is useful but not the durable audit source. tmux owns the
long-lived terminal session, and xterm keeps local scrollback for the attached
browser client. A profile TUI such as Codex may also render folded or compact UI
regions that are not normal shell lines. If those regions were not emitted as
plain terminal output, scrolling cannot reconstruct them. When durable review of
such content matters, use a transcript or explicit command output artifact
rather than relying on browser scrollback.

## Implementation Checks

- Split UTF-8 inside a JSONL frame must round-trip without replacement
  characters.
- Initial websocket `cols`/`rows` should match the fitted xterm size, not only
  the default terminal constructor size.
- A browser resize must resize tmux through the normal websocket frame path.
- CSS must give the terminal mount a stable real container; it should not hide
  fit problems with profile-specific spacing.
- May Console, shell, Claude, Codex, and ops should keep using the same code
  path.
