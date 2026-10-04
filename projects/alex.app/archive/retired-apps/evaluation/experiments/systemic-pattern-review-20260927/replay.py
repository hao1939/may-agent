"""Offline evidence experiment. Read-only SQLite; no App/runtime mutations.

This is a proposal probe, not a production collector or a defect classifier.
The production boundary belongs in the Host's public reporting capability.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
import time


def millis(value):
    if value is None:
        return None
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)


def iso(value):
    return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat()


def summarize(rows, start, end):
    cohort = [r for r in rows if start <= r["startedAt"] < end]
    states, accepted = Counter(), Counter()
    patterns = defaultdict(list)
    failed_ms, invalid_durations = 0, 0
    for r in cohort:
        finished = r["finishedAt"]
        # An attempt ending later was still outstanding at this historical cut.
        if finished is None:
            state = "outstanding-at-cut" if r["state"] == "running" else "undated-outcome"
        else:
            state = r["state"] if finished < end else "outstanding-at-cut"
        states[state] += 1
        if state == "completed":
            accepted[r["acceptedState"] or "unavailable"] += 1
        if state == "failed":
            patterns[(r["handler"], r["failureReason"] or "unclassified")].append(r)
            if finished >= r["startedAt"]:
                failed_ms += finished - r["startedAt"]
            else:
                invalid_durations += 1
    settled = sum(states[s] for s in ["completed", "failed", "interrupted"])
    groups = []
    for (handler, reason), failures in sorted(patterns.items(), key=lambda x: (-len(x[1]), x[0]))[:5]:
        examples = sorted(failures, key=lambda r: r["startedAt"])
        groups.append({
            "handler": handler, "failureReason": reason, "count": len(failures),
            "affectedTasks": len({r["taskId"] for r in failures}),
            "firstStartedAt": iso(examples[0]["startedAt"]),
            "lastStartedAt": iso(examples[-1]["startedAt"]),
            "summaries": [{"text": text, "count": count} for text, count in Counter(r["summary"] for r in failures).most_common(5)],
            "examples": [{k: r[k] for k in ["appId", "taskId", "generation", "attemptId", "sessionId"]} for r in (examples[:1] + examples[-1:] if len(examples) > 1 else examples)],
        })
    return {
        "window": {"start": iso(start), "endExclusive": iso(end)},
        "cohort": "retained Task attempts started in window; outcome observed before endExclusive",
        "started": len(cohort), "settled": settled, "states": dict(states),
        "failureRate": {"numerator": states["failed"], "denominator": settled, "value": states["failed"] / settled if settled else None},
        "acceptedStates": dict(accepted),
        "failedAttemptWallMs": failed_ms,
        "invalidFailedDurations": invalid_durations,
        "patterns": groups,
        "omittedPatternCount": max(0, len(patterns) - 5),
        "limits": [
            "Retained started cohort: excludes work started before the window, including long-running work.",
            "Completed attempts and accepted states are execution facts, not independent quality judgments.",
            "Failed-attempt wall time is observed duration, not avoidable cost or total recovery latency.",
            "Later Task success does not establish recovery of a particular input.",
            "Coarse failureReason groups may contain different causes; example summaries are evidence, not instructions.",
            "Historical deployed revision, billing cost and retention completeness are unassessed.",
        ],
    }


def self_test():
    def row(start=2, end=3, state="completed", **kw):
        return dict(appId="example", taskId="a", generation=1, attemptId=str(start),
                    startedAt=start, finishedAt=end, state=state, handler="executor:conversation",
                    failureReason=None, sessionId=None, summary="", acceptedState="waiting", **kw)
    rows = [row(0, 2, "failed"), row(1, 2, "failed"), row(2, 3), row(3, 4, "interrupted"),
            row(4, 12, "failed"), row(5, None, "running"), row(10, 11, "failed")]
    x = summarize(rows, 1, 10)
    assert x["started"] == 5 and x["settled"] == 3
    assert x["failureRate"] == {"numerator": 1, "denominator": 3, "value": 1 / 3}
    assert x["states"]["interrupted"] == 1 and x["states"]["outstanding-at-cut"] == 2
    assert x["acceptedStates"] == {"waiting": 1}  # Valid wait coexists with failure.
    assert x["patterns"][0]["count"] == 1  # Later success preserves earlier failure.
    assert summarize([], 1, 10)["failureRate"]["value"] is None
    assert summarize([row(2, None)], 1, 10)["states"] == {"undated-outcome": 1}
    future = row(4, 12, "failed")
    assert not summarize([future], 1, 10)["patterns"]  # No future outcome leakage.
    print("PASS: window bounds, no-activity, interruption, historical cut, undated outcomes, recovered failure and accepted wait coexistence")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--database", type=Path)
    parser.add_argument("--app", default="may")
    parser.add_argument("--task", default="conversation_ec854e2f09f1c38566a25857_successor_2")
    parser.add_argument("--end", default="2026-09-27T08:11:43.617Z")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.database or not args.output:
        parser.error("--database and --output required for replay")
    if args.app.lower().removesuffix(".app") == "evaluation":
        parser.error("External Apps only")
    end = millis(args.end)
    start = end - 2 * 86400000
    sql = """SELECT app_id AS appId, task_id AS taskId, task_generation AS generation,
      attempt_id AS attemptId, started_at AS startedAt, state,
      json_extract(attempt_json, '$.finishedAt') AS finishedAt,
      json_extract(attempt_json, '$.handler') AS handler,
      json_extract(attempt_json, '$.failureReason') AS failureReason,
      json_extract(attempt_json, '$.summary') AS summary,
      json_extract(attempt_json, '$.sessionId') AS sessionId,
      json_extract(attempt_json, '$.acceptedResult.state') AS acceptedState
      FROM app_task_attempts WHERE app_id = ? AND started_at >= ? AND started_at < ?
      ORDER BY started_at, attempt_id LIMIT 20001"""
    db = sqlite3.connect(args.database.resolve().as_uri() + "?mode=ro", uri=True, timeout=3)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA query_only=ON")
    db.execute("BEGIN")
    plan = [dict(r) for r in db.execute("EXPLAIN QUERY PLAN " + sql, (args.app, start, end))]
    began = time.monotonic()
    rows = [dict(r) for r in db.execute(sql, (args.app, start, end))]
    elapsed = (time.monotonic() - began) * 1000
    db.close()
    if len(rows) > 20000:
        raise ValueError("Replay exceeds 20,000-row bound; no partial rate published")
    for r in rows:
        r["finishedAt"] = millis(r["finishedAt"])
    last_start = end - 86400000
    task_rows = [r for r in rows if r["taskId"] == args.task]
    result = {
        "version": 1, "purpose": "offline design evidence; not a deployed collector",
        "appId": args.app, "taskId": args.task,
        "asOf": args.end, "rowCount": len(rows), "queryMs": round(elapsed, 3), "queryPlan": plan,
        "sourceProjectionSha256": hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest(),
        "appCurrent": summarize(rows, last_start, end),
        "appPrevious": summarize(rows, start, last_start),
        "taskCurrent": summarize(task_rows, last_start, end),
        "taskPrevious": summarize(task_rows, start, last_start),
        "otherTasksCurrent": summarize([r for r in rows if r["taskId"] != args.task], last_start, end),
        "otherTasksPrevious": summarize([r for r in rows if r["taskId"] != args.task], start, last_start),
        "byHandler": {h: summarize([r for r in rows if r["handler"] == h], last_start, end) for h in sorted({r["handler"] for r in rows})},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "rows": len(rows), "queryMs": result["queryMs"],
                      "appFailureRate": result["appCurrent"]["failureRate"],
                      "taskFailureRate": result["taskCurrent"]["failureRate"]}))


if __name__ == "__main__":
    main()
