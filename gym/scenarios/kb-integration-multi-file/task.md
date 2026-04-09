Integrate the findings from experiment EXP-142 into the knowledge base. The experiment results are in `experiment-results/EXP-142/results.md`.

You must update these 6 files:

1. **knowledge/hypotheses/H-042.md** — Update the probability P(H) from 0.35 to 0.72 based on the strong positive evidence in EXP-142. Add a "## Supporting Evidence" section referencing EXP-142.
2. **knowledge/entries/KE-017.md** — Append a new "## EXP-142 Evidence" section with the key finding: "Cache-first retrieval reduces latency by 62% (p<0.01)".
3. **knowledge/entries/KE-023.md** — Change the status from "TESTING" to "VALIDATED". Add the validation date "2026-04-09".
4. **knowledge/INDEX.md** — Add a new row to the entries table: `| KE-071 | Cache-first retrieval validated | EXP-142 | 2026-04-09 |`
5. **knowledge/PRIORITY-TRACKER.md** — Move H-042 from the "Medium Priority" section to the "High Priority" section (it was validated, so priority increases).
6. **todo.md** — Mark the item "Run EXP-142 and integrate results" as complete by changing `- [ ]` to `- [x]`.

Each file already exists with initial content. Read the experiment results first, then update all 6 files.
