# Evaluator Heartbeat
1. Notifications pending? → Process them.
2. `agents/evaluator/workspace/todo.md` has unchecked items? → Work on top item.
3. Unevaluated sessions exist? → Evaluate them.
   **⚠️ CRITICAL: NEVER scan `.state/sessions/`. ONLY use `.state/sessions/history/`.**
   `.state/sessions/` contains running and zombie sessions — evaluating them causes false positives.
   
   To find unevaluated sessions, run this exact command:
   ```bash
   node -e "const fs=require('fs'); const h=fs.readdirSync('.state/sessions/history').filter(n=>n.startsWith('s_')); const e=new Set(fs.readdirSync('.state/evaluations').filter(n=>n.endsWith('.json')).map(n=>n.slice(0,-5))); const m=h.filter(s=>!e.has(s)).sort(); console.log('unevaluated:',m.length); m.slice(-10).forEach(s=>console.log(s));"
   ```
   
   For EACH unevaluated session, you MUST:
   (a) Read `.state/sessions/history/<session>/meta.json` — get `agent` and `status` fields
   (b) Only evaluate if `status` is `"done"` or `"error"` — skip `"running"` or `"idle"`
   (c) Read the FULL transcript (`.state/sessions/history/<session>/session.jsonl`) before scoring
   (d) Use the `agent` field from meta.json — do NOT guess the agent from transcript content
   (e) Write ONE evaluation per session — do NOT batch-evaluate multiple sessions from reading only one
4. Calibration check:
   - Read `agents/evaluator/workspace/consistency-flags.jsonl` — any new flags since last check? If yes, investigate: is your scoring inconsistent or is the flag a false positive?
   - Read `agents/evaluator/workspace/human-reviews.jsonl` — any new human disagreements? If yes, study them: what did you miss? Should `agents/evaluator/knowledge/criteria.md` be updated?
   - Read `agents/evaluator/workspace/re-evaluations.jsonl` — any verdict disagreements on re-evaluation? If yes, the criteria are ambiguous for that case. Propose a clarification.
5. No calibration issues and no unevaluated sessions? → Check `agents/evaluator/periodic-tasks.md` and do the most overdue task.
6. After completing a periodic task → update `agents/evaluator/periodic-tasks.md` with date.
7. End with a 2-3 sentence brief of what you evaluated or calibrated.
