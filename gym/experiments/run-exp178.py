#!/usr/bin/env python3
"""
EXP-178 Gym Trial Runner
Difficulty-Adaptive Content-First Guard Pilot
4 arms × 2 scenarios × 15 runs = 120 total

Arms:
  G1: No-guard baseline (existing scenarios)
  G2: Production-mode uniform (write ANALYSIS.md first, retained)
  G3: Passive-injection uniform (expert ANALYSIS.md pre-populated)
  G4: Adaptive (G2 on medium/sql-injection, G3 on hard/cascading)
"""
import subprocess, json, sqlite3, sys, time, os, uuid

# Scenario mapping: (arm, scenario_type) -> scenario directory name
SCENARIOS = {
    # G1: baseline
    ("G1", "sql-injection"): "sql-injection-in-query-builder",
    ("G1", "cascading"):     "cascading-fix-trap-v2",
    # G2: production-mode uniform
    ("G2", "sql-injection"): "sql-injection-in-query-builder-exp178-g2",
    ("G2", "cascading"):     "cascading-fix-trap-v2-exp178-g2",
    # G3: passive-injection uniform (reuse EXP-166 F1 variants)
    ("G3", "sql-injection"): "sql-injection-in-query-builder-f1",
    ("G3", "cascading"):     "cascading-fix-trap-v2-f1",
    # G4: adaptive (production on medium, passive on hard)
    ("G4", "sql-injection"): "sql-injection-in-query-builder-exp178-g2",  # = G2 behavior on medium
    ("G4", "cascading"):     "cascading-fix-trap-v2-f1",                  # = G3 behavior on hard
}

ARMS = ["G1", "G2", "G3", "G4"]
SCENARIO_TYPES = ["sql-injection", "cascading"]
TRIALS_PER_CELL = 15
AGENT = "tech-lead"  # "coder" agent was removed; tech-lead handles coding tasks
RUN_TAG = "EXP-178"
BATCH_ID = f"exp178-{uuid.uuid4().hex[:8]}"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, "..", "..", "..")
DB_PATH = os.path.join(PROJECT_ROOT, ".state", "may.db")
GYM_SCRIPT = os.path.join(SCRIPT_DIR, "..", "..", "test", "gym", "run-gym.sh")
JSONL_PATH = os.path.join(PROJECT_ROOT, "agents", "shared", "knowledge", "experiments", "EXP-178", "runs.jsonl")

def run_trial(scenario, agent, timeout=5):
    env = os.environ.copy()
    env["GYM_AGENT_BIN"] = "/usr/local/bin/may-agent"
    cmd = ["bash", GYM_SCRIPT, scenario, "--agent", agent, "--timeout", str(timeout)]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout*60+60, env=env, cwd=PROJECT_ROOT)
        stdout = result.stdout.strip()
        # Find last JSON object in output
        for i in range(len(stdout)-1, -1, -1):
            if stdout[i] == '}':
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
    import re
    ms = 0
    m = re.search(r'([\d.]+)\s*m', dur)
    if m: ms += float(m.group(1)) * 60000
    s = re.search(r'([\d.]+)\s*s', dur)
    if s: ms += float(s.group(1)) * 1000
    return int(ms) if ms > 0 else None

def record_db(result, arm, scenario_type, scenario_dir):
    """Record to .state/may.db"""
    try:
        db = sqlite3.connect(DB_PATH)
        dur_ms = parse_duration(result.get("duration", "0s"))
        cur = db.execute("""INSERT INTO gym_runs 
            (agent_name, lab_fork, scenario, passed, duration_ms, score_summary, 
             session_id, method, run_tag, batch_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (AGENT, None, scenario_dir,
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
    except Exception as e:
        print(f"  DB error: {e}")
        return None

def record_jsonl(result, arm, scenario_type, scenario_dir, trial_num):
    """Append to runs.jsonl"""
    os.makedirs(os.path.dirname(JSONL_PATH), exist_ok=True)
    entry = {
        "arm": arm,
        "scenario_type": scenario_type,
        "scenario_dir": scenario_dir,
        "trial": trial_num,
        "passed": result.get("passed", False),
        "checks": result.get("checks", []),
        "duration": result.get("duration", "0s"),
        "agent_status": result.get("agent_status", "unknown"),
        "session_id": result.get("session_id"),
        "summary": result.get("summary", ""),
        "batch_id": BATCH_ID,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    with open(JSONL_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

def count_existing(arm, scenario_type):
    """Count existing runs in JSONL for resume support"""
    if not os.path.exists(JSONL_PATH):
        return 0
    count = 0
    with open(JSONL_PATH) as f:
        for line in f:
            try:
                entry = json.loads(line.strip())
                if entry.get("arm") == arm and entry.get("scenario_type") == scenario_type:
                    count += 1
            except:
                pass
    return count

def main():
    # Parse args
    filter_arm = None
    filter_scenario = None
    for i, arg in enumerate(sys.argv[1:], 1):
        if arg.startswith("--arm="):
            filter_arm = arg.split("=")[1]
        elif arg.startswith("--scenario="):
            filter_scenario = arg.split("=")[1]
        elif arg == "--status":
            print_status()
            return

    print(f"EXP-178 Batch Runner | batch_id={BATCH_ID}")
    print(f"{'='*60}")
    
    cells = []
    for arm in ARMS:
        for st in SCENARIO_TYPES:
            if filter_arm and arm != filter_arm:
                continue
            if filter_scenario and st != filter_scenario:
                continue
            cells.append((arm, st))
    
    for arm, scenario_type in cells:
        scenario_dir = SCENARIOS[(arm, scenario_type)]
        existing = count_existing(arm, scenario_type)
        remaining = TRIALS_PER_CELL - existing
        
        if remaining <= 0:
            print(f"\n{arm} × {scenario_type} ({scenario_dir}): {existing}/{TRIALS_PER_CELL} done, skipping")
            continue
        
        print(f"\n{arm} × {scenario_type} ({scenario_dir}): {existing}/{TRIALS_PER_CELL} done, running {remaining} more")
        
        for trial in range(remaining):
            trial_num = existing + trial + 1
            print(f"\n  [{arm} × {scenario_type} trial {trial_num}/{TRIALS_PER_CELL}]")
            t0 = time.time()
            result = run_trial(scenario_dir, AGENT)
            elapsed = time.time() - t0
            passed = result.get("passed", False)
            mark = "✓" if passed else "✗"
            
            run_id = record_db(result, arm, scenario_type, scenario_dir)
            record_jsonl(result, arm, scenario_type, scenario_dir, trial_num)
            
            checks = result.get("checks", [])
            check_pass = sum(1 for c in checks if c.get("passed"))
            print(f"  {mark} passed={passed} checks={check_pass}/{len(checks)} dur={elapsed:.0f}s db_id={run_id}")
            sys.stdout.flush()
    
    print_status()

def print_status():
    print(f"\n{'='*60}")
    print("EXP-178 STATUS")
    print(f"{'='*60}")
    for arm in ARMS:
        for st in SCENARIO_TYPES:
            existing = count_existing(arm, st)
            passes = 0
            if os.path.exists(JSONL_PATH):
                with open(JSONL_PATH) as f:
                    for line in f:
                        try:
                            e = json.loads(line.strip())
                            if e.get("arm") == arm and e.get("scenario_type") == st and e.get("passed"):
                                passes += 1
                        except:
                            pass
            rate = f"{passes}/{existing}" if existing > 0 else "0/0"
            status = "✓ DONE" if existing >= TRIALS_PER_CELL else f"{existing}/{TRIALS_PER_CELL}"
            print(f"  {arm} × {st:15s}: {status:10s} pass_rate={rate}")

if __name__ == "__main__":
    main()
