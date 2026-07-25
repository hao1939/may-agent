# Web Terminal

## Mental Model

Each terminal profile is one shared server-side terminal session.

The session is backed by one tmux pane and one pty. A pty only has one real
`cols x rows` size, so multiple browser windows attached to the same profile
cannot have independent terminal sizes.

This is especially important for full-screen TUIs such as Codex and Claude:
they render their interface for the single pty size. If one browser window
changes that size, every other viewer is looking at the same resized session.

## Browser Client Ownership

Multiple browser windows may attach to the same terminal profile.

Only the active browser client should control the pty size:

- A passive attach may watch the terminal, but should not resize an existing
  session.
- A focused/inputting browser client becomes the active size owner.
- Resize frames from inactive clients are ignored by the server.
- When a different browser window is focused, it may become the active owner
  and resize the shared pty to fit that window.

This keeps stale localhost/tunnel tabs from fighting over the terminal size
while preserving normal multi-window viewing.

## Mouse, Clipboard, and Scrollback

The browser owns mouse selection, copy, paste, and the context menu. Tmux mouse
support is disabled for every web terminal session. Wheel scrolling is handled
separately: the browser sends an explicit scroll request and the bridge moves
the shared tmux pane through copy mode.

This keeps the interaction model simple:

- ordinary drag selects text in xterm;
- the browser context menu exposes copy and paste;
- the toolbar Copy and Paste buttons use the browser clipboard; and
- tmux does not open a second menu or capture selection.

Scrolling the wheel over the terminal enters server-side history without
enabling tmux mouse handling. Scrolling down to the bottom returns to the live
pane automatically. The toolbar **Live** button and any keyboard/paste input
also leave history view immediately. Tmux's copy-mode position label is hidden
because it would otherwise cover terminal content while scrolling.

Tmux remains the persistent server-side process boundary. Its advanced mouse
copy-mode UI is intentionally not exposed through the web terminal.

## Lifetime and Readiness

The terminal manager owns the bridge and matching tmux session as one resource.
After the last browser disconnects, both stay warm for the configured idle TTL.
A browser that returns within that window reuses them. When the TTL expires, or
when the user chooses Restart, the manager kills both so the CLI and any child
processes cannot run forever in an abandoned terminal.

Tmux may survive a Web process restart long enough for a new bridge to recover
it. After recovery it is governed by the same idle TTL.

The browser is ready only when the bridge reports that its PTY has attached to
tmux. A websocket opening or a bridge process being spawned is merely
`starting`; it must not be presented as terminal readiness. Readiness includes
the PTY pid and startup duration for troubleshooting.

## Page Isolation and Bounded Data

Direct navigation to `/terminal` initializes the terminal only. Hidden Live
dashboard requests and its event websocket must not compete with terminal
startup. Live data is loaded when Live is entered.

Dashboard timelines return a bounded newest window with truncation metadata.
Static UI files use ETag validation so unchanged xterm and application assets
can be reused by the browser.

Completed session directories follow the same default 14-day retention as
session database rows. Cleanup is bounded and never removes a running/idle
session or a directory with an active marker.

xterm keeps local scrollback as a convenience. It is per browser client and is
not durable session history. Tmux keeps the shared server-side history used by
wheel scrolling, including after a browser refresh. Because this history view
belongs to the shared tmux pane, all browser viewers see it; typing from an
active viewer returns the pane to the live application.

Codex is launched with `--no-alt-screen`, its documented inline mode for
preserving terminal scrollback. Claude has no equivalent launch flag in the
installed CLI, so the tmux history path is the common fallback.

## Expected Refresh Behavior

After web terminal code is deployed, already-open browser tabs may still be
running old JavaScript. Hard-refresh the terminal tabs after deploy so the
browser-side resize ownership logic matches the deployed server.

Refreshing a focused terminal window can resize the shared pty. That is
expected: the refreshed window becomes the active client and asks the server to
fit the terminal to its viewport.

## When Independent Sizes Are Needed

Independent sizes require independent terminal sessions. Do not try to make two
browser windows attached to the same tmux pane maintain different dimensions.

If we need side-by-side Codex sessions with different sizes, create separate
terminal profiles or session ids instead of changing the shared-profile resize
contract.

## Troubleshooting

If the input line overlaps or the terminal width looks wrong:

1. Check whether multiple browser windows are attached to the same terminal
   profile.
2. Hard-refresh the intended active window after deploy.
3. Confirm inactive clients do not resize the pane.
4. Confirm the focused/inputting client resizes the pane.
5. Check the terminal `startupMs` separately from overall daemon CPU, memory,
   state-directory size, and session/event counts.

The useful live check is:

```sh
tmux -L may-web display-message -p -t may-web-codex '#{pane_width}x#{pane_height}'
```

Use the matching tmux target for the profile being checked, such as
`may-web-shell`, `may-web-claude`, or `may-web-codex`.

If tmux and the browser both react to a mouse click, confirm the profile has
tmux mouse handling disabled:

```sh
tmux -L may-web show-options -t may-web-codex mouse
tmux -L may-web show-options -t may-web-claude mouse
tmux -L may-web show-options -t may-web-shell mouse
tmux -L may-web show-options -t may-web-ops mouse
```

Each command should report `mouse off`. Restart the affected web terminal
profile after deploying a change to the bridge, then hard-refresh the browser.
