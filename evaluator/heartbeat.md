# Evaluator Heartbeat
1. Notifications pending? → Process them.
2. `agents/evaluator/workspace/todo.md` has unchecked items? → Work on top item.
3. **Evaluate ONE session.** Follow steps 3a–3d IN ORDER. Do NOT skip steps. Do NOT read any other session's files.

   **3a. SELECT TARGET** — Run this command EXACTLY (it excludes evaluator sessions and your own session):
   ```bash
   node -e "
   const fs=require('fs');
   const h=fs.readdirSync('.state/sessions/history').filter(n=>n.startsWith('s_'));
   const e=new Set(fs.readdirSync('.state/evaluations').filter(n=>n.endsWith('.json')).map(n=>n.slice(0,-5)));
   const unevaluated=h.filter(s=>!e.has(s));
   // Exclude evaluator's own sessions
   const candidates=unevaluated.filter(s=>{
     try{const m=JSON.parse(fs.readFileSync('.state/sessions/history/'+s+'/meta.json'));
       return m.agent!=='evaluator' && (m.status==='done'||m.status==='error');
     }catch(e){return false;}
   }).sort();
   console.log('UNEVALUATED (non-evaluator):',candidates.length);
   if(candidates.length>0){
     const t=candidates[candidates.length-1];
     const m=JSON.parse(fs.readFileSync('.state/sessions/history/'+t+'/meta.json'));
     console.log('TARGET='+t);
     console.log('AGENT='+m.agent);
     console.log('STATUS='+m.status);
   } else { console.log('NONE'); }
   "
   ```
   If output says NONE → skip to step 4.
   Otherwise, copy the TARGET value exactly. **Write it down. This is the ONLY session you will evaluate this heartbeat.**

   **3b. READ META + TRANSCRIPT** — Replace `<TARGET>` below with the exact value from 3a. Run:
   ```bash
   T=<TARGET>; echo "=== META ===" && cat .state/sessions/history/$T/meta.json && echo "=== TOOL CALL SUMMARY ===" && grep -o '"toolCall"' .state/sessions/history/$T/session.jsonl | wc -l && echo "tool calls found" && grep -o '"name":"[^"]*"' .state/sessions/history/$T/session.jsonl | sort | uniq -c | sort -rn && echo "=== TRANSCRIPT (first 49KB) ===" && cat .state/sessions/history/$T/session.jsonl | head -c 49000
   ```
   The TOOL CALL SUMMARY shows how many tool calls the agent made and which tools. **Use this as ground truth** when scoring — if it shows 20+ tool calls across read/bash/write/edit, the agent did substantive work.
   If transcript is truncated, continue reading with: `read .state/sessions/history/<TARGET>/session.jsonl` using offset. **If the session has >200 lines, you MUST read the end before scoring.**
   **DO NOT read any other session's transcript. If you catch yourself about to read a different session → STOP → you are drifting.**

   **3c. SCORE** — Based on what you read in 3b, compose your evaluation JSON. The JSON MUST contain:
   - `"session_id": "<TARGET>"` — the exact TARGET from 3a
   - `"evaluated_session": "<TARGET>"` — same value
   - Agent name from meta.json (3b), not guessed

   **3d. WRITE + VERIFY** — Replace `<TARGET>` with the exact value from 3a. Write the JSON to `.state/evaluations/<TARGET>.json`, then verify:
   ```bash
   T=<TARGET>; python3 -c "import json; d=json.load(open('.state/evaluations/$T.json')); sid=d.get('session_id') or d.get('evaluated_session','?'); print('WRITTEN:',sid); assert sid=='$T', f'MISMATCH: file={\"$T\"} json={sid}'; print('✅ MATCH — evaluation written correctly')"
   ```
   If MISMATCH → delete the file and restart from 3a.

   ⚠️ **HARD CONSTRAINTS (15+ violations — this is your #1 failure mode):**
   - You evaluate exactly ONE session per heartbeat — the TARGET from 3a
   - You NEVER read `.state/sessions/history/X/session.jsonl` where X ≠ TARGET
   - You NEVER write `.state/evaluations/X.json` where X ≠ TARGET
   - You NEVER re-run the target selector (3a) after selecting a target
   - If you find yourself wanting to read a different session → STOP → you are drifting
   - The TARGET from step 3a output is your ground truth — not /tmp files, not session context

4. Calibration check:
   - Read `agents/evaluator/workspace/consistency-flags.jsonl` — any new flags since last check? If yes, investigate: is your scoring inconsistent or is the flag a false positive?
   - Read `agents/evaluator/workspace/human-reviews.jsonl` — any new human disagreements? If yes, study them: what did you miss? Should `agents/evaluator/knowledge/criteria.md` be updated?
   - Read `agents/evaluator/workspace/re-evaluations.jsonl` — any verdict disagreements on re-evaluation? If yes, the criteria are ambiguous for that case. Propose a clarification.
5. No calibration issues and no unevaluated sessions? → Check `agents/evaluator/periodic-tasks.md` and do the most overdue task.
6. After completing a periodic task → update `agents/evaluator/periodic-tasks.md` with date.
7. End with a 2-3 sentence brief of what you evaluated or calibrated.
