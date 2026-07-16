#!/usr/bin/env python3
"""
EXP-202 Gym Trial Runner — H-187 Meta-Cognitive Defect Enumeration
Arm B only (10 trials). Arm A reuses EXP-195 baseline data (1/10).
"""
import subprocess, json, sys, time, os, uuid

SCENARIO = "cascading-fix-trap-v2-exp202-enum"
TRIALS = 10
AGENT = "amy"
RUN_TAG = "EXP-202"
BATCH_ID = f"exp202-{uuid.uuid4().hex[:8]}"
PROJECT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")
GYM_SCRIPT = os.path.join(PROJECT_ROOT, "agents", "test", "gym", "run-gym.sh")

def run_trial(scenario, agent, timeout=5):
    env = os.environ.copy()
    env["GYM_AGENT_BIN"] = "/usr/local/bin/may-agent"
    cmd = ["bash", GYM_SCRIPT, scenario, "--agent", agent, "--timeout", str(timeout)]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout*60+60, env=env, cwd=PROJECT_ROOT)
        stdout = result.stdout.strip()
        for i in range(len(stdout)-1, -1, -1):
            if stdout[i] == '}':
                depth = 0
                for j in range(i, -1, -1):
                    if stdout[j] == '}': depth += 1
                    elif stdout[j] == '{': depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(stdout[j:i+1])
                        except:
                            break
                break
        return {"pass": False, "error": "no JSON in output", "stdout_tail": stdout[-500:]}
    except subprocess.TimeoutExpired:
        return {"pass": False, "error": "timeout"}
    except Exception as e:
        return {"pass": False, "error": str(e)}

results = []
print(f"=== EXP-202 Arm B: {SCENARIO} ({TRIALS} trials) ===")
for i in range(1, TRIALS+1):
    print(f"\nTrial {i}/{TRIALS}...", flush=True)
    t0 = time.time()
    r = run_trial(SCENARIO, AGENT)
    elapsed = time.time() - t0
    passed = r.get("passed", r.get("pass", False))
    checks = r.get("checks", {})
    if isinstance(checks, list):
        checks_dict = {c.get("name", f"check-{j}"): c.get("passed", c.get("pass", False)) for j, c in enumerate(checks) if isinstance(c, dict)}
    else:
        checks_dict = checks
    results.append({"trial": i, "pass": passed, "checks": checks_dict, "elapsed": round(elapsed, 1)})
    status = "✅ PASS" if passed else "❌ FAIL"
    failed = [k for k, v in checks_dict.items() if not v]
    print(f"  {status} ({elapsed:.1f}s) failed: {failed if failed else 'none'}")

passes = sum(1 for r in results if r["pass"])
print(f"\n=== RESULTS: {passes}/{TRIALS} passed ({100*passes/TRIALS:.0f}%) ===")

order_fixed = sum(1 for r in results if r.get("checks", {}).get("pipeline-order-fixed", False))
print(f"pipeline-order-fixed: {order_fixed}/{TRIALS}")

outfile = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exp202-results.json")
with open(outfile, "w") as f:
    json.dump({"tag": RUN_TAG, "batch": BATCH_ID, "scenario": SCENARIO, "results": results, "summary": {"pass": passes, "total": TRIALS}}, f, indent=2)
print(f"\nResults saved to {outfile}")
