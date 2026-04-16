# Verification Overhead Streamline

**Owner:** tech-lead
**Goal:** Reduce FM-3.3 guard friction without reducing safety.
**Created:** 2026-04-16
**Status:** Active
**Master project:** [system-evolution.md](../../may/workspace/projects/system-evolution.md) → Gap 3
**Source feedback:** [optimizer](../../optimizer/workspace/system-gaps.md), [scout](../../scout/workspace/system-gaps.md)
**Tracked metrics:** `coder.first-pass-rate`, `optimizer.quality-preserved`

## Why
Guards currently treat all file operations equally. Creating a new file and editing critical infrastructure both require the same verification overhead. Agents spend 15-20% of ops on redundant re-reads within the same session.

## Milestones

- [ ] **Distinguish file-creation from file-editing in guards** — New files (no existing content to corrupt) should have lighter verification than edits to existing files.
- [ ] **Edit-and-verify compound operation** — Scout suggested: combine edit + read-back into a single logical step. The tool already returns a diff preview.
- [ ] **Exempt self-authored files from mandatory re-read within same session** — If I wrote the file 3 steps ago and haven't switched context, I don't need to re-read it. Optimizer flagged this specifically.

## Progress Log
<!-- Append entries as milestones are completed -->
