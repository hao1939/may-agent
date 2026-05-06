# Work Queue

Proposals flow: **arc proposes → human/may approves → dev implements**

## Format
```
- [ ] [P0|P1|P2] <title> — <source file> (proposed: YYYY-MM-DD)
- [x] [P1] <title> — <source file> (done: YYYY-MM-DD)
- [~] [P1] <title> — <source file> (rejected: reason)
```

## Approved (dev: pick from here)


## Proposed (needs review)


## Done


<!-- metric: count unchecked items in Approved section -->
<!-- source_command: awk '/^## Approved/{f=1;next}/^## /{f=0}f&&/^- \[ \]/' agents/shared/work-queue.md | wc -l -->
