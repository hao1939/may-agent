# Disabled-alias alert lifecycle refresh — alert 3248 / canonical 3249

- Task: `ops-refresh-disabled-alert-alias-lifecycle-alert3248-repeat-20260709b`
- Reviewed at: `2026-07-09T18:00:05Z`
- Existing blocked holder: `wait-ops-disabled-alert-alias-lifecycle-alert3248-runtime-response-20260709`
- Alias metric: `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`
- Canonical metric: `aks-rp-e2e.process.blocked.overdue-unworked-count`

## Result

Alert `3248` is still the disabled compatibility-alias lifecycle for the same breach that canonical alert `3249` covered.

The strongest current truth is:

1. the alias metric is still configured with alerting disabled,
2. the design still says this alias must not own a separate breach/recovery lifecycle,
3. runtime still created a separate alert row `3248` anyway,
4. alert `3248` and canonical alert `3249` opened and recovered in lockstep for the same measurements, and
5. no controller-visible runtime-owner response or approval-dispatch send-proof is visible yet for the blocked holder.

Because both alert rows have already recovered and the blocked holder's scheduled `next_check_at` (`2026-07-09T18:30:00Z`) has **not** passed yet at review time, the existing wait can remain passive **for now**. The next truthful process move is to refresh that wait's owner-response note to say "no response yet" and keep the same short-fuse check, not to invent another blocked-work repair.

## Proof that 3248 is still the compatibility-alias row and 3249 is the canonical twin

### 1) Runtime metric config still disables alias alerting

Current `metrics` row for the alias metric:

- `id = aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`
- `current = 0`
- `updated_at = 1783584500580` (`2026-07-09T08:08:20.580Z`)
- `config = {"alert":{"mode":"disabled","disabled":true}}`

So the alias metric is still explicitly configured as disabled for alert lifecycle purposes.

### 2) Observability design still says this alias must not own a separate alert lifecycle

`design/project-observability.md` states both:

- `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count` is a **compatibility alias sample** whose snapshots remain live while alert lifecycle is intentionally disabled; and
- `process.blocked.overdue-nonhuman-unworked-count>0` consumer is `none (measurement-only alias)` and should have the **same sampled value** as the canonical metric with **no distinct breach/recovery row**.

### 3) Runtime alert rows prove duplicate lifecycle creation anyway

`metric_alerts` currently contains both rows:

- `3248` → `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`
- `3249` → `aks-rp-e2e.process.blocked.overdue-unworked-count`

For this repeat incident they have the **same** lifecycle timestamps:

- `created_at = 1783581932583` (`2026-07-09T07:25:32.583Z`)
- `resolved_at = 1783584506331` (`2026-07-09T08:08:26.331Z`)

So the alias row was not only created; it stayed open for the same interval as the canonical row.

### 4) Repeat-open event stream shows alias and canonical alerts moving in lockstep

`events` rows for `metric.breach` / `metric.recovered` show paired activity for alert ids `3248` and `3249` at the same measurements:

| measuredAt (UTC) | alert 3248 current | alert 3249 current |
| --- | ---: | ---: |
| `2026-07-09T07:25:32.583Z` | 8 | 8 |
| `2026-07-09T07:32:34.232Z` | 9 | 9 |
| `2026-07-09T07:42:21.058Z` | 2 | 2 |
| `2026-07-09T07:46:11.207Z` | 3 | 3 |
| `2026-07-09T07:52:13.676Z` | 2 | 2 |
| `2026-07-09T07:56:38.863Z` | 1 | 1 |
| `2026-07-09T08:03:03.179Z` | 4 | 4 |
| `2026-07-09T08:08:26.331Z` | recovered to 0 | recovered to 0 |

That is repeat-open evidence, not a stale one-off row. The alias is mirroring the canonical alert lifecycle instead of remaining alert-silent.

### 5) Historical pattern remains repeatable, not isolated

Prior duplicate alias incidents already exist in `metric_alerts` for the same alias metric:

- `3096` alongside canonical `3097`
- `3155` alongside canonical `3156`
- `3160`
- `3209`
- now `3248` alongside canonical `3249`

The alias metric has accumulated **15** alert rows versus **14** for the canonical metric, which is further evidence that the disabled alias is still participating in alert lifecycle generation.

## Current state of the blocked holder

`wait-ops-disabled-alert-alias-lifecycle-alert3248-runtime-response-20260709` currently says:

- blocked on runtime-owner / May decision for disabled-alert lifecycle parity,
- `resume_at = 2026-07-09T20:00:00Z`
- `next_check_at = 2026-07-09T18:30:00Z`
- `fallback_at = 2026-07-10T00:00:00Z`
- fallback action: refresh evidence and escalate again with alias/canonical rows plus disabled-config proof.

That blocked contract is still truthful.

## Whether a runtime-owner escalation was already sent

I checked app evidence/runtime surfaces for this exact wait id, alert id, and evidence path.

Visible results:

- the blocked wait exists in `.state/tasks/tree.json`;
- the original triage file exists:
  - `evidence/archive/metric-alert-overdue-nonhuman-unworked-count-20260709-alert3248-upgrade-or-escalate.md`;
- planner logs explicitly treat this as an existing blocked holder that should be refreshed rather than duplicated.

Not visible:

- no `project.approval.requested` / `approval-dispatch` / `message.created` send-proof tied to this alert 3248 wait or evidence path;
- no controller-visible runtime-owner reply, approved policy decision, or returned remediation note specific to alert `3248`.

So the ask is **represented** by the blocked wait, but it is **not visibly dispatched through an external approval/message lane** from the app evidence surfaces checked here.

## Judgment

The acceptance question splits into two possibilities:

### Should this session claim a new send/escalation happened?

No. There is no send-proof for a newly dispatched runtime-owner ask in the checked runtime/app surfaces, and this worker session does not have an allowed dispatch tool path.

### Can the existing wait remain passive?

Yes, but only narrowly and with explicit proof:

- the duplicate alias alert pair already recovered at `2026-07-09T08:08:26.331Z`;
- the alias metric row is currently back at `0` with the same disabled config still present;
- no new post-recovery alias breach is visible in the checked event window; and
- the existing blocked wait's `next_check_at` (`2026-07-09T18:30:00Z`) is still in the future at review time (`2026-07-09T18:00:05Z`).

So the truthful state is:

> no owner response yet, no external send-proof yet, defect still evidenced by the repeat-open history, but the existing blocked holder may remain passive until its already-scheduled near-term review instead of being replaced immediately.

## Exact planner/app-ops follow-up to apply to the blocked holder

Worker mode in this session does not permit direct task-tree mutation for this task, so the bounded output here is the exact update the planner/app-ops review should apply.

### Proposed wait refresh

Update `wait-ops-disabled-alert-alias-lifecycle-alert3248-runtime-response-20260709` to record:

- **owner response:** none visible as of `2026-07-09T18:00:05Z`
- **dispatch status:** no controller-visible approval-dispatch / `message.created` send-proof found for this alert-lifecycle ask
- **current evidence:** alert rows `3248` and `3249` opened and recovered in lockstep despite alias config `{"alert":{"mode":"disabled","disabled":true}}`
- **next-check state:** keep the existing near-term `next_check_at = 2026-07-09T18:30:00Z` if planner consumes this before that time

### If the planner reviews after `2026-07-09T18:30:00Z`

If there is still no owner response and still no send-proof after the scheduled check passes, the passive wait should no longer remain unchanged. The next truthful step should be one of:

1. dispatch an explicit runtime-owner / May approval packet using:
   - this refresh note,
   - `evidence/archive/metric-alert-overdue-nonhuman-unworked-count-20260709-alert3248-upgrade-or-escalate.md`, and
   - the paired `metric_alerts` / `events` evidence for alerts `3248` and `3249`; or
2. replace the passive wait with one active app-ops send/escalation task that emits that packet and returns durable send-proof.

## Bottom line

- **Yes:** alert `3248` is still the compatibility-alias row for `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`.
- **Yes:** canonical alert `3249` covered the same breach and recovery lifecycle.
- **Yes:** repeat-open evidence now shows the alias and canonical alerts reopening together multiple times within the same incident window.
- **No:** no new runtime-owner response or external dispatch proof is visible yet.
- **Therefore:** the blocked holder remains the single truthful wait surface, and it can stay passive only until its existing `2026-07-09T18:30:00Z` check. After that, absent response or send-proof, planner/app-ops should escalate explicitly rather than leaving the wait unchanged.
