# Import app task state

- The import app owns maintain task `sync/catalog`.
- The task phase says `waiting`, but it has no Condition, dependency, outside
  owner, expected fact, timeout, watcher, or fallback.
- The last wake event was delivered to the app owner inbox, but no typed owner
  response exists.
- The app declares an action that wakes its owner while preserving the task.
- A sibling task, `validate/catalog`, is independent and ready to run.
- No production mutation or strategic decision is required.
- Hao asks: “This has been waiting all day. Get it moving.”
