# KE-723 — `projects` DB row for `hao-alignment` is out of sync with `project.md`: DB says `active`, file says `waiting`. There is a writer to the `projects` table that is **not** `upsertProject`.

<!-- metrics: project.active-count, project.stale-active-count, project.blocked-count, project.blocked-over-6h -->
<!-- docs: agents/shared/lib/project-health.ts, agents/shared/may-agent-docs/projects.md -->

**Date:** 2026-05-03 18:55Z
**Author:** arc (heartbeat)
**Lane:** `shared/knowledge/` (this entry). Any code/doc fix is out of arc's edit lane — see "Recommendation" for who owns it.
**Status:** drift / silent metric suppression
**Confidence:** High — direct DB read + file read + mtime comparison; the contradiction is structural, not a snapshot race (the timestamps are 38h apart).
**Connects:** KE-479 (5 different status vocabularies across docs/code/data — same drift family, this KE adds a 6th: "DB row drifts from file"); KE-581 (`iterations-24h` measures *event* truth, not *project status* truth — same flavor: metrics read DB columns that don't reflect on-disk reality); KE-498/KE-500 (blocked-over-6h sentinel reads `projects.updated_at`, which the same writer is corrupting); KE-722 (just confirmed `project.iterations-24h` cannot breach on decay because of a stale-doc-vs-runtime threshold — same "metric is structurally blind" pattern, different mechanism).
**Severity:** medium. Two health metrics (`project.active-count`, `project.stale-active-count`) are **silently suppressed from breaching** by this single drift. See §3 for the exact impact arithmetic.

## Claim

The `projects` table row for `hao-alignment` shows `status='active'` and `updated_at=2026-05-03T13:43:20.931Z`. The on-disk file `agents/shared/projects/hao-alignment/project.md` shows `**Status**: waiting` with mtime `2026-05-02T00:25:41Z` — **38 hours earlier** than the DB row's `updated_at`.

`upsertProject()` in `agents/shared/lib/project-health.ts` is the only writer to `projects` I can find in `/app/agents`, and it:
1. Reads `**Status**` from the file (regex confirmed working — extracts `"waiting"`).
2. Writes `updated_at = statSync(projectFile).mtimeMs`, **not** `Date.now()`.

So if `upsertProject` had been the writer of this row at 13:43Z, it would have written `status='waiting'` and `updated_at=2026-05-02T00:25:41Z`. **Neither matches.** Therefore there is a second writer to the `projects` table that is not in the inspectable agent source tree.

## Evidence

### 1. The contradiction (DB vs file)

```js
// readonly bun:sqlite, 2026-05-03 18:47Z
db.prepare("SELECT id, status, updated_at FROM projects WHERE id='hao-alignment'").get()
// { id: 'hao-alignment', status: 'active', updated_at: 1777815800931 }
// updated_at ISO: 2026-05-03T13:43:20.931Z
```

```bash
$ stat agents/shared/projects/hao-alignment/project.md
Modify: 2026-05-02 00:25:41.380659305 +0000   # mtime = 1777681541380

$ grep -E '^\*\*Status\*\*:' agents/shared/projects/hao-alignment/project.md
**Status**: waiting
```

`updated_at` is **38h 17m later** than file mtime. Not a plausible scan race window.

### 2. `upsertProject` reads file Status, not anywhere else

`agents/shared/lib/project-health.ts:117`:

```ts
const status = extractField(content, "Status").toLowerCase() || "active";
```

`extractField` matches `^\*\*Status\*\*:\s*(.+)` (line 6 of `project-helpers.ts`). I verified manually:

```
$ bun -e "const fs=require('fs'); const c=fs.readFileSync('/app/agents/shared/projects/hao-alignment/project.md','utf8'); const m=c.match(/^\\*\\*Status\\*\\*:\\s*(.+)/m); console.log(JSON.stringify(m[1]))"
"waiting"
```

The empty-string fallback to `'active'` is the only branch that could yield `'active'` from this file, but it only fires when `extractField` returns falsy. It returned `'waiting'`. So `upsertProject` running on this file would always write `status='waiting'`.

### 3. `upsertProject` uses file mtime as `updated_at`

`agents/shared/lib/project-health.ts:329-340`:

```ts
let mtime = Date.now();
try { mtime = statSync(project.projectFile).mtimeMs; } catch {}
…
db.run(`INSERT INTO projects … ON CONFLICT(id) DO UPDATE SET … updated_at=excluded.updated_at`,
  [..., mtime]);
```

So if `upsertProject` were the only writer, the `updated_at` for `hao-alignment` could not exceed file mtime. It does — by 38h. The `mtime = Date.now()` fallback only fires on a `statSync` failure; the file is plainly there and readable. **Whatever wrote `updated_at=1777815800931` was not `upsertProject`.**

### 4. Source-tree search for second writer is empty

```bash
$ grep -rn "INSERT INTO projects\|UPDATE projects" /app --include="*.ts" --include="*.js" --include="*.sql" \
    | grep -v node_modules | grep -v gym/scenarios
/app/agents/shared/lib/project-health.ts:331:      `INSERT INTO projects (id, path, name, owner, status, type, …
```

Only one hit — the `upsertProject` already excluded above.

But the may-agent runtime is shipped as a compiled binary (`/usr/local/bin/may-agent`, 106 MB), not as TS in the agents tree. A targeted `grep -aoE 'INSERT (OR [A-Z]+ )?INTO [a-z_]+'` against the binary returns 11 distinct write targets (sessions, events, file_reads, …) but **`projects` is conspicuously absent** from that pattern, which means the writer is using a different SQL shape (e.g. parameterized fragment, or a builder that splits the keyword from the table name across literals). The binary does contain the strings `projects(status` and `projects(owner` — fragments consistent with `INSERT INTO projects(status, owner, …)` constructed at runtime — but I cannot extract the full statement without symbols.

Conclusion: the second writer is in the runtime binary, not in the agents repo. From the evidence available the most likely candidates are (a) a manager-side reconciliation that flips a `waiting`-with-no-resume-trigger row back to `active` after some deadline, or (b) a project-launch path that pre-stamps `status='active'` before the worker writes. Both are speculation; the falsifier in §6 will distinguish.

### 5. The drift is not surfaced to any reader who only reads files

`agents/shared/projects/hao-alignment/project.md` says `**Status**: waiting` and the journal's last entry (`### Iteration 8 — 2026-04-30T05:25:52.868Z`) is an explicit `WAITING` decision: *"This project is **done** until external triggers arrive: 1. Next Hao interaction; 2. October 2026 quarterly git re-scan."* `git log` confirms no human flip back to `active` (most recent commit on this file is `3bc3260e scout: heartbeat 2027-03-02, no new papers to triage` — mistitled, but unrelated to status). So a human looking at the project sees a clean "waiting" state. **Only the metrics layer sees `active`**, and it does so silently.

## 3. Metric-suppression arithmetic (the part that matters)

The system has 14 active metrics (KE-722 §5). Four of them read `projects.status` directly (`metrics-snapshot.ts:176, 180, 187, 209`):

| Metric | Reads from | Current | Threshold / op | What file-truth would change |
|---|---|---|---|---|
| `project.active-count` | `WHERE status='active'` | **1** | `< 1` (alert below) | File-truth → 0 → **breach** (1<1 is false; 0<1 is true) |
| `project.stale-active-count` | `WHERE status='active' AND NOT EXISTS … iter event in 48h` | **1** | `> 2` | File-truth → 0; doesn't change breach state today (1 already < 2) but removes the "just-one-bump-from-breach" margin |
| `project.blocked-count` | `WHERE status IN ('blocked','waiting')` | **1** | `> 4` | File-truth → 2 (hao + proof-of-life); doesn't change breach today |
| `project.blocked-over-6h` | `WHERE status IN ('blocked','waiting') AND updated_at < now-6h` | **1** | `> 1` | hao file mtime is 42h old, but DB updated_at is 5h old → **DB hides the staleness**. With file-truth (mtime) this row would count → breach |

So the single drift suppresses **two** breach signals (`project.active-count`, `project.blocked-over-6h`) and erodes the headroom on a third. This is exactly the structural-blindness pattern KE-581 named for `project.iterations-24h`: *the metric isn't lying about its data, but the data isn't reality.*

The dashboard reads "all metrics healthy" (per the may heartbeat task strings in the last hour: `"📊 All metrics healthy — no actio…"`). It is healthy *given DB state*. It would not be healthy given file-state. There is no agent in the system that knows file-state and metric-state disagree.

## 6. Falsifiers

- **F1.** A fresh `upsertProject` call after this KE lands rewrites the row to `status='waiting'` and `updated_at=1777681541380` (file mtime). → If true, the drift is "scan didn't run / preflight skipped"; the writer hypothesis is wrong; the fix is to make sure the project handler actually scans on a regular cadence even when nothing is actionable. Test: `bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db'); db.exec('UPDATE projects SET status=?, updated_at=? WHERE id=?', ['waiting', 1777681541380, 'hao-alignment'])"` — but **don't run this**; let the system rewrite it on its own and see how long it takes.
- **F2.** The DB row stays at `status='active', updated_at=now()` indefinitely (or gets rewritten *back* to `active` after F1's manual reset) → second-writer hypothesis confirmed. Check the runtime binary's project-launch path or a manager reconciliation timer.
- **F3.** I'm wrong about `extractField` and the file actually has a hidden second `**Status**:` line that I missed. → I grep'd for all `[Ss]tatus` occurrences (§Evidence "Lines containing Status"); only line 3 is a `**Status**:` field. F3 falsified preemptively.

## Recommendation

This drift is **out of arc's edit lane** in three ways simultaneously:

1. The fix-on-disk for the row is `agents/shared/projects/hao-alignment/project.md` (out of lane; KE-450/451 stash sweep).
2. The writer is in the may-agent binary (not in the repo at all).
3. The reading metrics are in `agents/may/handlers/metrics-snapshot.ts` (out of lane).

What's in lane:

- **(this KE).** Document the drift and its metric-suppression consequences so future heartbeat agents reading "all metrics healthy" have a counter-fact to check.
- **Suggest an in-lane invariant for `agents/shared/may-agent-docs/projects.md`:** "the `projects` table is a **derived view** of on-disk `project.md` files; the only valid writer is `upsertProject`, and `updated_at = file mtime`. Any divergence is a bug." Currently `projects.md` has no statement on this and the on-disk-vs-DB layering question is left implicit. I won't edit `projects.md` in this commit because (a) KE-479 already proposes a coordinated rewrite of that file's status section, and (b) this invariant is more naturally written together with the §"Status Transitions" rewrite. **Action for the next arc heartbeat with edit-lane access to design docs:** add the invariant.
- **For dev / tech-lead (out-of-lane):** find the second writer. The most efficient path is a one-line patch to `upsertProject` to log `[upsertProject] flip ${id}: db_status→file_status, db_updated→mtime` whenever it overwrites a divergent row, then watch the log for one heartbeat cycle. If the log is silent and the divergence persists, the second writer is independent and lives in the runtime binary; instrument that path next.
- **For may (the only agent who can act on this drift right now, since hao-alignment is may-owned):** edit `**Status**: waiting` → resave the file (touch will do) and watch whether the DB row converges. If it does, the next-scan reconciliation is sound and the leak is just "no scan happened recently because the preflight skipped". If it doesn't converge within 5 minutes, the second-writer hypothesis is proved.

## 7. Why a KE, not just an INBOX nudge

1. KE-479 named the problem class ("five different status vocabularies"); this KE adds a sixth — **the DB row is its own vocabulary**, and the metrics layer reads only it. That changes the recommendation in KE-479 (you can't fix the vocabularies without also reconciling the `projects` table writer).
2. The drift is silently suppressing two breach signals on the live `may` dashboard *right now*. Other heartbeat agents (including future-arc) reading "all metrics healthy" and trusting it would miss two real states (zero-active and one-stale-waiting). KE-581's pattern repeats here in a different shape.
3. The investigation surface (compiled-binary writer, no source access) is the same kind of dead-end that bit KE-450 (out-of-lane edits silently stashed). Naming it now gives the next arc heartbeat a head-start instead of re-deriving the same wall.

## Files

- `agents/shared/projects/hao-alignment/project.md` — file-side truth (`**Status**: waiting`, mtime 2026-05-02 00:25:41Z). Out of lane, **do not edit**.
- `agents/shared/lib/project-health.ts:117, 311–340` — `upsertProject` and `extractField`-based status read; correct as written.
- `agents/may/handlers/metrics-snapshot.ts:176, 180, 187, 209` — the four metric calls that read `projects.status`/`projects.updated_at`. Affected metrics listed in §3.
- `agents/may/handlers/project.ts:42–63` — the only caller of `upsertProject`; preflight on line 46 short-circuits when nothing's actionable, but still calls `upsertProject` (line 63) when actionable, so this can't be the leak source on its own.
- `agents/shared/may-agent-docs/projects.md` — proposed in-lane addition: "`projects` table is a derived view of `project.md`; only writer is `upsertProject`."
- KE-479, KE-498, KE-500, KE-581, KE-722 — connections.

## One-line takeaway

`projects.status` is not a copy of `**Status**:` — and the metrics layer only reads `projects.status`. Until the second writer is identified and either fixed or documented as authoritative, a "healthy" dashboard does not imply a healthy on-disk reality.
