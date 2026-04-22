#!/usr/bin/env python3
"""
EXP-198 Gym Trial Runner
Runs 3 arms × 10 trials each, records to .state/may.db
"""
import subprocess, json, sqlite3, sys, time, os, uuid

SCENARIOS = {
    "A": "cascading-fix-trap-v2",
    "B": "cascading-fix-trap-v2-exp198-proc",
    "C": "cascading-fix-trap-v2-exp198-example",
}
TRIALS_PER_ARM = 10
AGENT = "tech-lead"
RUN_TAG = "EXP-198"
BATCH_ID = f"exp198-{uuid.uuid4().hex[:8]}"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".state", "may.db")
GYM_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "test", "gym", "run-gym.sh")
PROJECT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")

def run_trial(scenario, agent, timeout=5):
    env = os.environ.copy()
    env["GYM_AGENT_BIN"] = "/usr/local/bin/may-agent"
    cmd = ["bash", GYM_SCRIPT, scenario, "--agent", agent, "--timeout", str(timeout)]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout*60+60, env=env, cwd=PROJECT_ROOT)
        stdout = result.stdout.strip()
        # Find last JSON object
        for i in range(len(stdout)-1, -1, -1):
            if stdout[i] == '}':
                # find matching {
                depth = 0
                for j in range(i, -1, -1):
                    if stdout[j] == '}': depth += 1
                    elif stdout[j] == '{': depth -= 1
                    if depth == 0:
                        return json.loads(stdout[j:i+1])
                break
        return {"passed": False, "checks": [], "summary": f"No JSON output: {stdout[:200]}", "agent_status": "error", "duration": "0s"}
    except Exception as e:
        return {"passed": False, "checks": [], "summary": f"Error: {str(e)[:200]}", "agent_status": "error", "duration": "0s"}

def parse_duration(dur):
    if not dur: return None
    try: return int(float(dur))
    except: pass
    ms = 0
    import re
    m = re.search(r'([\d.]+)\s*m', dur)
    if m: ms += float(m.group(1)) * 60000
    s = re.search(r'([\d.]+)\s*s', dur)
    if s: ms += float(s.group(1)) * 1000
    return int(ms) if ms > 0 else None

def record(result, arm):
    db = sqlite3.connect(DB_PATH)
    dur_ms = parse_duration(result.get("duration", "0s"))
    cur = db.execute("""INSERT INTO gym_runs 
        (agent_name, lab_fork, scenario, passed, duration_ms, score_summary, 
         session_id, method, run_tag, batch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (AGENT, None, result.get("scenario", SCENARIOS[arm]), 
         1 if result.get("passed") else 0, dur_ms,
         result.get("summary", ""), result.get("session_id"),
         "oneshot", RUN_TAG, BATCH_ID))
    run_id = cur.lastrowid
    for check in result.get("checks", []):
        db.execute("""INSERT INTO gym_checks (run_id, check_name, passed, detail)
            VALUES (?, ?, ?, ?)""",
            (run_id, check.get("name",""), 1 if check.get("passed") else 0,
             check.get("message") or check.get("detail")))
    db.commit()
    db.close()
    return run_id

def main():
    # Check for resume: see how many runs already exist for this tag
    db = sqlite3.connect(DB_PATH)
    existing = {}
    for arm, scenario in SCENARIOS.items():
        count = db.execute("SELECT COUNT(*) FROM gym_runs WHERE run_tag=? AND scenario=?", 
                          (RUN_TAG, scenario)).fetchone()[0]
        existing[arm] = count
    db.close()
    
    total = sum(TRIALS_PER_ARM - existing[arm] for arm in SCENARIOS)
    done = sum(existing.values())
    print(f"EXP-198 Batch Runner | batch_id={BATCH_ID}")
    print(f"Existing runs: {existing} | Remaining: {total}")
    print(f"{'='*60}")
    
    for arm, scenario in SCENARIOS.items():
        remaining = TRIALS_PER_ARM - existing[arm]
        if remaining <= 0:
            print(f"Arm {arm} ({scenario}): already has {existing[arm]} runs, skipping")
            continue
        for trial in range(remaining):
            trial_num = existing[arm] + trial + 1
            print(f"\n[Arm {arm} trial {trial_num}/{TRIALS_PER_ARM}] {scenario}")
            t0 = time.time()
            result = run_trial(scenario, AGENT)
            elapsed = time.time() - t0
            passed = result.get("passed", False)
            status = result.get("agent_status", "unknown")
            mark = "✓" if passed else "✗"
            
            run_id = record(result, arm)
            
            # Show per-check results
            checks = result.get("checks", [])
            check_pass = sum(1 for c in checks if c.get("passed"))
            print(f"  {mark} passed={passed} status={status} checks={check_pass}/{len(checks)} dur={elapsed:.0f}s db_id={run_id}")
            
            # Show key check: pipeline-order-fixed
            for c in checks:
                if c.get("name") == "pipeline-order-fixed":
                    print(f"  → pipeline-order-fixed: {'PASS' if c.get('passed') else 'FAIL'}")
            
            sys.stdout.flush()
    
    # Final summary
    print(f"\n{'='*60}")
    print("FINAL SUMMARY")
    db = sqlite3.connect(DB_PATH)
    for arm, scenario in SCENARIOS.items():
        rows = db.execute("SELECT passed FROM gym_runs WHERE run_tag=? AND scenario=?",
                         (RUN_TAG, scenario)).fetchall()
        passes = sum(r[0] for r in rows)
        total_arm = len(rows)
        
        # pipeline-order-fixed rate
        order_rows = db.execute("""
            SELECT gc.passed FROM gym_checks gc 
            JOIN gym_runs gr ON gc.run_id = gr.id
            WHERE gr.run_tag=? AND gr.scenario=? AND gc.check_name='pipeline-order-fixed'
        """, (RUN_TAG, scenario)).fetchall()
        order_pass = sum(r[0] for r in order_rows)
        
        print(f"  Arm {arm} ({scenario}): {passes}/{total_arm} full pass, {order_pass}/{len(order_rows)} pipeline-order-fixed")
    db.close()

if __name__ == "__main__":
    main()
