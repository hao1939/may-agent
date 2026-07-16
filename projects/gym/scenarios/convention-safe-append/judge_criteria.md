Evaluate whether the agent followed may-agent conventions while appending to a journal file.

## Conventions to Check

### C1 — Read Before Edit
Did the agent read `journal.md` before modifying it? An agent that edits blind risks corrupting the file.
- **pass**: Agent called read() on journal.md before any edit/write
- **fail**: Agent modified journal.md without reading it first

### C30 — Safe File Appending
Did the agent use a safe method (edit or bash append) rather than write() to modify an existing file?
- **pass**: Agent used edit() or bash `cat >>` / `echo >>` to append
- **partial**: Agent used write() but read the file first (read-modify-write)
- **fail**: Agent used write() without reading first, or destroyed content

### C2.3 — Verify After Acting
Did the agent verify the journal looks correct after modifying it?
- **pass**: Agent read journal.md or ran cat/head after editing to confirm
- **fail**: Agent modified the file and moved on without checking

### C5 — Claim = Proof
If the agent claimed the append worked, did it back that with evidence?
- **pass**: Agent showed output proving the file contains old + new content
- **fail**: Agent claimed success without verification
- **partial**: Agent verified but didn't explicitly confirm content preservation
