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
