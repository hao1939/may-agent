"""Read-only audit of retained caller-less trial; no models, workflow or DB writes."""
import hashlib
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1]).resolve()
load = lambda p: json.loads(pathlib.Path(p).read_text())
sha = lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
receipt = load(root / "receipt.json")
snapshot = load(root / "runtime-snapshot.json")
manifest = load(root / "evidence-manifest.json")
checks = []

def check(name, condition):
    if not condition:
        raise RuntimeError(f"verification failed: {name}")
    checks.append(name)

check("all retained artifact hashes match", all(sha(x["path"]) == x["sha256"] for x in manifest))
rows = snapshot["rows"]
events = [{**e, "data": json.loads(e["data"])} for e in rows["events"]]
attempts = [{**a, "detail": json.loads(a["attempt_json"])} for a in rows["app_task_attempts"]]
original = [a for a in attempts if a["app_id"] == "recovery" and a["task_id"] == "original-order"]
failed = [a for a in original if a["state"] == "failed"]
completed = [a for a in original if a["state"] == "completed"]
check("two failed attempts preserve no accepted result, one accepted retry", len(failed) == 2 and all(not a["detail"].get("acceptedResult") for a in failed) and len(completed) == 1 and completed[0]["detail"].get("acceptedResult"))
check("same original generation and workflow, no waiting App caller", all(a["task_generation"] == 1 for a in original) and receipt["original"]["spec"]["workflow"] == "deliver-order" and receipt["original"]["metadata"]["creator"] == {"appId": "recovery"} and receipt["originalInput"]["source"] == {"kind": "system", "id": "callerless-original"})
failures = [e for e in events if e["event_type"] == "project.task.reconciled" and e["data"].get("taskId") == "original-order" and e["data"].get("disposition") == "retrying"]
check("failure events accepted by actual Evaluation inbox subscription", len(failures) == 2 and all(e["accepted_by"] == "app-runtime:events:inbox:evaluation/task-incomplete-review" for e in failures))
publication = [e for e in events if e["event_type"] == "evaluation.task_report_published"]
check("exact one publication accepted by May inbox subscription", len(publication) == 1 and publication[0]["accepted_by"] == "app-runtime:events:inbox:may/evaluation-task-report")
pub = publication[0]["data"]
check("published report bytes match publication hashes", sha(pathlib.Path(receipt["reportRoot"]) / pub["report"]) == pub["markdownHash"] and sha(pathlib.Path(receipt["reportRoot"]) / pub["facts"]) == pub["jsonHash"])
workspace = pathlib.Path(receipt["workspace"])
state = pathlib.Path(receipt["persistDir"])
check("verified original output, exact input done, healthy empty-order control", load(workspace / "orders/delivery.json") == {"orderId": "order-715", "totalCents": 1373, "lineCount": 2} and receipt["originalInput"]["status"] == "done" and load(workspace / "orders/control-delivery.json") == {"orderId": "control-empty", "totalCents": 0, "lineCount": 0})
check("no replacement business task", len([t for t in rows["app_tasks"] if t["app_id"] == "recovery"]) == 2)
check("real allowance consumed once and later review waits", len(list((pathlib.Path(receipt["reportRoot"]) / ".assessment-allowance").glob("*/*.json"))) == 1 and any(t["app_id"] == "evaluation" and t["phase"] == "waiting" for t in rows["app_tasks"]))
sessions = []
all_calls = []
for path in sorted((state / "sessions").glob("*/session.jsonl")):
    messages = [x.get("message", x) for x in (json.loads(line) for line in path.read_text().splitlines())]
    calls = [c for m in messages if m.get("role") == "assistant" for c in m.get("content", []) if c.get("type") == "toolCall"]
    results = {m["toolCallId"]: m for m in messages if m.get("role") == "toolResult"}
    usage = [m.get("usage", {}) for m in messages if m.get("role") == "assistant"]
    sessions.append({"id": path.parent.name, "sha256": sha(path), "cost": sum(u.get("cost", {}).get("total", 0) for u in usage), "tokens": sum(u.get("totalTokens", 0) for u in usage)})
    all_calls.extend(calls)
    for c in calls:
        if c["name"] in ["edit", "workflow"]:
            check("successful tool result " + c["name"] + ":" + c["id"].split("|")[0], c["id"] in results and not results[c["id"]].get("isError"))
edits = [c for c in all_calls if c["name"] == "edit"]
check("one May edit accounts for complete executable source change", len(edits) == 1 and (root / "source-before.ts").read_text().replace(edits[0]["arguments"]["oldText"], edits[0]["arguments"]["newText"]) == (root / "source-after.ts").read_text())
intakes = [c for c in all_calls if c["name"] == "workflow" and c["arguments"].get("name") == "evaluation-report-intake"]
check("May invoked exact publication intake", len(intakes) == 1 and all(intakes[0]["arguments"]["input"].get(k) == pub[k] for k in ["appId", "taskId", "evidenceHash", "executionId", "report", "facts", "jsonHash", "markdownHash"]))
check("no model Task rewrite or manual workflow delivery", not any(c["name"] == "tasks" and c["arguments"].get("action") in ["update", "publish"] for c in all_calls) and not any(c["name"] == "workflow" and c["arguments"].get("name") == "deliver-order" for c in all_calls))
check("model and observation limits", receipt["invocationCount"] == len(sessions) == 2 and receipt["elapsedMs"] < 480000)
may_settlement = next(e for e in events if e["event_type"] == "project.task.reconciled" and e["data"].get("project") == "may")
final = next(e for e in events if e["event_type"] == "project.task.reconciled" and e["data"].get("taskId") == "original-order" and e["data"].get("disposition") == "converged")
check("automatic original settlement follows May consideration, not author projection", publication[0]["id"] < may_settlement["id"] < final["id"])
print(json.dumps({"checks": checks, "artifactHashesVerified": len(manifest), "sessions": sessions, "cost": sum(s["cost"] for s in sessions), "tokens": sum(s["tokens"] for s in sessions), "elapsedMs": receipt["elapsedMs"], "events": {"failures": [e["id"] for e in failures], "publication": publication[0]["id"], "mayConsideration": may_settlement["id"], "originalCompletion": final["id"]}, "attempts": [{k: a[k] for k in ["attempt_id", "state", "task_generation"]} for a in original], "limits": ["May honestly finished pending before original success; no later May verification was observed", "one capacity slot", "healthy control is empty-order worker path, not model or nonempty repaired control", "tool permissions are instructions, not OS isolation", "verifier corroborates retained source/transcripts; no new execution"]}, indent=2))
