<ai_context>
summary: "Audit of the future-dated Aug library-health reports and their content-equivalent earlier-path siblings. Records why they are not trustworthy as current health facts and why they were removed from `reports/health/`."
created: "2026-08-05"
source_basis: "Filesystem inventory, direct report readback, diff comparison between the Aug-named reports and their earlier-path counterparts, and existence checks for cited findings."
</ai_context>

# Future-Dated Health Reports Audit — 2026-08-05

## Scope

This audit began with these three future-dated files:

- `reports/health/library-health-2026-08-19.md`
- `reports/health/library-health-2026-08-22.md`
- `reports/health/library-health-2026-08-25.md`

During verification, the same report bodies were also found under earlier
health-report paths:

- `reports/health/library-health-2026-07-09b.md`
- `reports/health/library-health-2026-07-09c.md`
- `reports/health/library-health-2026-06-20.md`

All six files have now been moved out of `reports/health/` into triage status.

## Verified Facts

1. **All three Aug-named reports were future-dated relative to the current trusted date**
   (`2026-08-05`).
2. **All three Aug-named reports cite a chronology that cannot be trusted from current primary evidence.**
3. **Two of the three report bodies cite findings absent from the current library**:
   - the Aug 22 body cites `knowledge/findings/2026-08-22-xhs-direct-scan-51.md`,
     which does not exist;
   - the Aug 25 body cites `knowledge/findings/2026-08-24-arxiv-executable-turn-triage.md`,
     `knowledge/findings/2026-08-25-hn-scan-49.md`, and
     `knowledge/findings/2026-08-23-xhs-direct-scan-52.md`, none of which exist.
4. **The current `knowledge/INDEX.md` does not reflect those absent Aug 22 / Aug 23 /
   Aug 24 / Aug 25 findings.**
5. **Each Aug-named report has a content-equivalent earlier-path sibling in `reports/health/`**,
   differing only by the later warning banner added to the Aug-named copy:
   - `library-health-2026-08-19.md` ↔ `library-health-2026-07-09b.md`
   - `library-health-2026-08-22.md` ↔ `library-health-2026-07-09c.md`
   - `library-health-2026-08-25.md` ↔ `library-health-2026-06-20.md`
6. **Leaving the earlier-path siblings in `reports/health/` would still leave untrusted health snapshots in the authoritative folder**, even after the three Aug-named files were removed.

## Disposition

These files are preserved as **unverified artifacts**, not trusted health-state
reports.

Because exact corrected chronology is still not provable, I did **not** relabel
any of them as authoritative repaired snapshots. Instead, I moved the entire
six-file artifact set out of `reports/health/` and into `reports/triage/`:

- `reports/triage/unverified-library-health-artifact-claimed-aug19.md`
- `reports/triage/unverified-library-health-artifact-claimed-aug22.md`
- `reports/triage/unverified-library-health-artifact-claimed-aug25.md`
- `reports/triage/unverified-library-health-2026-07-09b-artifact.md`
- `reports/triage/unverified-library-health-2026-07-09c-artifact.md`
- `reports/triage/unverified-library-health-2026-06-20-artifact.md`

This preserves provenance without implying that any of the six files is a
trustworthy library-health snapshot.

## Safe Use Rule

- Do **not** treat any of the six triage artifacts as authoritative health
  snapshots.
- Do **not** use them as evidence that the cited Aug 22 / Aug 24 / Aug 25
  findings existed.
- Prefer the verified health reports through
  `reports/health/library-health-2026-08-02.md` and the current task-tree
  evidence.

## Repair Applied This Session

- Removed the six-file unverified artifact set from `reports/health/`.
- Preserved the files under explicit triage artifact paths.
- Updated navigation and disposition notes so old references no longer imply
  that the Aug reports are current authoritative health snapshots.

## Remaining Open Question

The exact intended chronology of these six artifacts is still unresolved.
That is now a provenance question, not an active `reports/health/` trust issue.