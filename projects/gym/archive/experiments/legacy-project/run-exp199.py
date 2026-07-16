#!/usr/bin/env python3
"""
EXP-199 Gym Trial Runner — Tool-Assisted Relational Bug Discovery
Runs 3 arms × 10 trials each
"""
import subprocess, json, sys, time, os, uuid

SCENARIOS = {
    "A": "cascading-fix-trap-v2",
    "B": "cascading-fix-trap-v2-tool",
    "C": "cascading-fix-trap-v2-tool-guided",
}
TRIALS_PER_ARM = 10
AGENT = "coder"
RUN_TAG = "EXP-199"
BATCH_ID = f"exp199-{uuid.uuid4().hex[:8]}"
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
                        return json.loads(stdout[j:i+1])
                break
        return {"passed": False, "checks": [], "summary": f"No JSON: {stdout[:200]}", "agent_status": "error"}
    except Exception as e:
        return {"passed": False, "checks": [], "summary": str(e), "agent_status": "error"}

def main():
    results = {}
    for arm, scenario in SCENARIOS.items():
        results[arm] = []
        print(f"\n=== ARM {arm}: {scenario} ===")
        for i in range(TRIALS_PER_ARM):
            print(f"  Trial {i+1}/{TRIALS_PER_ARM}...", end=" ", flush=True)
            r = run_trial(scenario, AGENT)
            passed = r.get("passed", False)
            results[arm].append(r)
            print("✅" if passed else "❌")
            time.sleep(2)
    
    # Summary
    print(f"\n{'='*50}")
    print(f"EXP-199 RESULTS ({BATCH_ID})")
    print(f"{'='*50}")
    for arm, trials in results.items():
        passes = sum(1 for t in trials if t.get("passed"))
        print(f"Arm {arm} ({SCENARIOS[arm]}): {passes}/{len(trials)} ({100*passes/len(trials):.0f}%)")
    
    # Save raw results
    outpath = os.path.join(PROJECT_ROOT, "agents", "gym", "experiments", f"exp199-results-{BATCH_ID}.json")
    with open(outpath, "w") as f:
        json.dump({"batch_id": BATCH_ID, "tag": RUN_TAG, "results": results}, f, indent=2)
    print(f"\nRaw results saved to {outpath}")

if __name__ == "__main__":
    main()
