#!/usr/bin/env python3
"""
EXP-201 Gym Trial Runner — Verification Remasking (H-185)
Treatment arm only — baseline reused from EXP-195 (1/10 pass)
"""
import subprocess, json, sys, time, os, uuid

SCENARIO = "cascading-fix-trap-v2-exp200-remask"
TRIALS = 10
AGENT = "coder"
RUN_TAG = "EXP-201"
BATCH_ID = f"exp201-{uuid.uuid4().hex[:8]}"
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
        return {"error": "no JSON", "stdout": stdout[-500:], "stderr": result.stderr[-500:]}
    except subprocess.TimeoutExpired:
        return {"error": "timeout"}
    except Exception as e:
        return {"error": str(e)}

def main():
    results = []
    print(f"=== EXP-201: {SCENARIO} x{TRIALS} ===")
    for i in range(1, TRIALS+1):
        print(f"\n--- Trial {i}/{TRIALS} ---")
        r = run_trial(SCENARIO, AGENT)
        results.append(r)
        passed = r.get("passed", False)
        duration = r.get("duration", "?")
        print(f"  passed={passed}, duration={duration}s")
    
    # Summary
    passes = sum(1 for r in results if r.get("passed"))
    print(f"\n=== SUMMARY: {passes}/{TRIALS} passed ({100*passes/TRIALS:.0f}%) ===")
    
    # Save
    outpath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exp201-results.json")
    with open(outpath, "w") as f:
        json.dump({"batch_id": BATCH_ID, "scenario": SCENARIO, "agent": AGENT, "trials": results, "summary": f"{passes}/{TRIALS}"}, f, indent=2)
    print(f"Results saved to {outpath}")

if __name__ == "__main__":
    main()
