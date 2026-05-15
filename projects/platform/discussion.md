# platform — Discussion

Comment inbox for the platform project. The project handler watches this file
for unread content and resumes the project when new comments appear.

Append format (use `### <author> - YYYY-MM-DD` per entry — this is what
`appendProjectComment` and `appendDiscussionComment` write):

```
### alice - 2026-05-15
Body of the comment goes here.
Multiple lines are fine.
```

The project workflow appends a `---read @iter<N>---` sentinel line after each
iteration; anything **below the last** such line is considered unread.

---read @iter0---

### hao - 2026-05-15
smoke test: comment from curl after fix

---read @iter3---
