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
