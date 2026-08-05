# Design: Web Terminal

**Design status:** Accepted.
**Implementation status:** Implemented for shared profiles, streaming UTF-8,
active-client resize ownership, bounded warm continuity, and browser xterm
rendering.
**Aligned with**: `webui.md`, `may-console.md`, `http-boundary.md`

## Purpose

The Web Terminal is a browser-hosted terminal for local daemon operation and
debugging. It exposes the same terminal infrastructure for May Console, shell,
Claude, Codex, and ops profiles.

It is not the project UI, not a custom terminal emulator, and not a profile
specific rendering layer. The browser uses xterm.js, the backend keeps a real
terminal process alive through tmux, and the bridge carries terminal bytes
between them.

For the May profile, the Web Terminal hosts May Console. Bare text therefore
always starts a bounded May turn. Watching a session changes output only;
steering or cancelling requires a command that names the session. The browser
does not implement a separate chat or selected-session model. See
`may-console.md` for that interaction contract.

## Mental Model

```text
browser container
  -> xterm.js fit calculates cols/rows
  -> websocket sends input and resize frames
  -> terminal manager owns one bridge per active/warm profile
  -> terminal bridge owns one tmux session for the same lifetime
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

### Reconnect and redraw

Browser refresh is an attach, not a process restart. The terminal manager keeps
the tmux-backed profile warm for its idle TTL.

The bridge and tmux session have the same owner and expiry:

- while at least one browser is attached, the manager keeps both alive;
- after the last browser detaches, a reconnect within the idle TTL reuses the
  same bridge and tmux session;
- when the idle TTL expires, the manager terminates both the bridge and its
  named tmux session, including the profile process tree; and
- explicit Restart applies the same full teardown immediately.

A Web process restart may rediscover and attach to a still-live tmux session.
That recovery path does not make tmux immortal: once the new manager owns it,
the normal idle-TTL rule applies. This makes tmux a bounded continuity
mechanism rather than an unbounded background process supervisor.

The manager does not replay raw terminal bytes when a browser attaches or
reattaches. Replaying an arbitrary ANSI tail can corrupt an interactive TUI
because it is not a complete screen state. The live tmux attach and the
program's subsequent redraw are the source of truth.

Browser scrollback is useful but not the durable audit source. tmux owns the
long-lived terminal session, and xterm keeps local scrollback for the attached
browser client. A profile TUI such as Codex may also render folded or compact UI
regions that are not normal shell lines. If those regions were not emitted as
plain terminal output, scrolling cannot reconstruct them. When durable review of
such content matters, use a transcript or explicit command output artifact
rather than relying on browser scrollback.

### Readiness

Websocket connection is not terminal readiness. The manager may send a
`starting` control frame while it launches the bridge, but it sends `ready`
only after the bridge has created its PTY and attached to tmux. Reattaching to
an already-ready warm bridge receives the stored bridge readiness frame.

The `ready` frame includes the profile, PTY pid, and measured `startupMs` so the
browser can distinguish transport latency from terminal startup latency.

### Page and data isolation

Opening `/terminal` initializes only the terminal surface. It must not fetch
the hidden Live dashboard, timelines, metric histories, or open the dashboard
event websocket. Navigating to Live initializes those resources on entry;
navigating away releases its realtime connection when no chat surface needs
it.

Dashboard history APIs are summaries, not bulk export endpoints. Timeline and
liveness session rows have a fixed server-side cap, return the newest rows in
chronological display order, and expose truncation metadata. Static Web UI
files use validators such as ETag so unchanged scripts and xterm assets return
`304 Not Modified` instead of being transferred again.

### Retention and resource ownership

The durable session transcript is the audit source, but it is not retained
forever by default. Database maintenance removes terminal session directories
only after their corresponding session DB row is old, non-running, and
deleted. Active markers always prevent filesystem removal. The default
retention window matches the session-row window (14 days), and every
maintenance pass is bounded.

Terminal status exposes connection count, PTY pid, and warm expiry. Operators
should use those fields, terminal startup time, state-directory size, and
session/event counts to separate terminal startup problems from general daemon
resource pressure.

## Implementation checks

- Split UTF-8 inside a JSONL frame must round-trip without replacement
  characters.
- Initial websocket `cols`/`rows` should match the fitted xterm size, not only
  the default terminal constructor size.
- A browser resize must resize tmux through the normal websocket frame path.
- CSS must give the terminal mount a stable real container; it should not hide
  fit problems with profile-specific spacing.
- Passive concurrent clients must not resize or receive synthetic replay.
- `ready` must originate from the bridge after PTY/tmux attachment; the manager
  must not synthesize premature readiness.
- Reattach inside the idle TTL must reuse the bridge; expiry and Restart must
  terminate the matching tmux session as well as the bridge.
- Direct terminal navigation must not issue Live dashboard requests.
- Dashboard history responses must remain bounded and report truncation.
- Unchanged static assets must support conditional `304` responses.
- May Console, shell, Claude, Codex, and ops use the same code path.
- May-profile quick actions do not create a sticky input target.

Focused coverage lives in
`projects/may-agent/packages/terminal/src/manager.test.ts`,
`projects/may-agent/packages/terminal/src/terminal-bridge.test.ts`, and the
browser terminal page.
