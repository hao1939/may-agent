// Evaluator learning quality panel.
// Reads session scores from outputs/evaluator/session-scores.jsonl and renders a dashboard.

window.renderEvaluatorLearningPanel = async function(el) {
  if (!el) return;

  function esc(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function attrEsc(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function resultColor(score) {
    if (score == null) return 'var(--fg2)';
    if (score >= 4) return 'var(--green)';
    if (score >= 3) return 'var(--yellow)';
    if (score >= 2) return 'var(--orange)';
    return 'var(--red)';
  }

  function scoreBar(score, max) {
    if (score == null) return '<span style="color:var(--fg2)">—</span>';
    const pct = (score / max) * 100;
    const color = resultColor(score);
    return `<div style="display:inline-flex;align-items:center;gap:6px">
      <div style="width:60px;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color}"></div>
      </div>
      <span style="color:${color};font-weight:600;font-size:12px">${score}</span>
    </div>`;
  }

  // Load scores
  let scores = [];
  let loadError = null;
  try {
    const res = await fetch('/projects/agent-system-evolution/outputs/evaluator/session-scores.jsonl');
    if (res.ok) {
      const text = await res.text();
      scores = text.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    }
  } catch (e) { loadError = e.message; }

  // Load heuristics doc
  let heuristicsHtml = '';
  try {
    const res = await fetch('/projects/agent-system-evolution/outputs/evaluator/signal-heuristics.md');
    if (res.ok) {
      const text = await res.text();
      heuristicsHtml = window.marked?.parse ? window.marked.parse(text) : `<pre>${esc(text)}</pre>`;
    }
  } catch {}

  let html = '';

  // Phase status
  const phase = scores.length === 0 ? 'Phase 1: Signal Extraction'
    : scores.length < 30 ? `Phase 1: Signal Extraction (${scores.length}/30 sessions)`
    : 'Phase 2+: Pattern Clustering';

  html += `<div style="font-size:18px;font-weight:600;margin-bottom:4px">${esc(phase)}</div>`;
  html += `<div style="font-size:12px;color:var(--fg2);margin-bottom:16px">${scores.length} sessions scored · unsupervised heuristic scoring</div>`;

  if (scores.length === 0) {
    // No scores yet — show setup status
    html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px;margin-bottom:16px">`;
    html += `<div style="font-size:14px;font-weight:500;margin-bottom:8px">Getting Started</div>`;
    html += `<div style="font-size:13px;color:var(--fg2);line-height:1.8">`;
    html += `The evaluator will automatically score recent sessions using signal heuristics.<br>`;
    html += `Scores appear here as they're produced in <code>outputs/evaluator/session-scores.jsonl</code>.<br><br>`;
    html += `<b>What gets scored:</b><br>`;
    html += `• Goal completion — did the session advance project state?<br>`;
    html += `• Loop detection — repeated commands, same errors<br>`;
    html += `• Error recovery — approach changes vs blind retries<br>`;
    html += `• Tool efficiency — useful vs wasted tool calls<br>`;
    html += `• Clean finish — real verification vs self-validation<br>`;
    html += `• Cross-session: was work undone? referenced? did project advance?<br>`;
    html += `</div></div>`;

    // Show available sessions to score
    html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px;margin-bottom:16px">`;
    html += `<div style="font-size:14px;font-weight:500;margin-bottom:8px">Available Sessions</div>`;
    html += `<div style="font-size:12px;color:var(--fg2)">Loading session count...</div>`;
    html += `</div>`;

    // Try to show session count
    try {
      const sessRes = await fetch('/api/sessions?limit=1');
      if (sessRes.ok) {
        const data = await sessRes.json();
        const count = data.total || data.sessions?.length || '?';
        html = html.replace('Loading session count...', `${count} sessions in system — newest will be scored first`);
      }
    } catch {}
  } else {
    // Summary stats
    const avgQuality = scores.reduce((s, e) => s + (e.quality?.score || 0), 0) / scores.length;
    const avgEfficiency = scores.reduce((s, e) => s + (e.efficiency?.score || 0), 0) / scores.length;
    const fatals = scores.filter(e => e.quality?.score === 0).length;
    const good = scores.filter(e => (e.quality?.score || 0) >= 4).length;
    const bad = scores.filter(e => (e.quality?.score || 0) <= 2 && e.quality?.score !== null).length;

    // Summary bar
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">`;
    const stats = [
      { label: 'Avg Quality', value: avgQuality.toFixed(1), color: resultColor(avgQuality) },
      { label: 'Avg Efficiency', value: avgEfficiency.toFixed(1), color: resultColor(avgEfficiency) },
      { label: 'Good (4-5)', value: good, color: 'var(--green)' },
      { label: 'Bad (0-2)', value: bad, color: 'var(--red)' },
      { label: 'Fatal (0)', value: fatals, color: fatals > 0 ? 'var(--red)' : 'var(--fg2)' },
    ];
    for (const s of stats) {
      html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">`;
      html += `<div style="font-size:22px;font-weight:700;color:${s.color}">${s.value}</div>`;
      html += `<div style="font-size:11px;color:var(--fg2)">${s.label}</div>`;
      html += `</div>`;
    }
    html += `</div>`;

    // Agent breakdown
    const byAgent = {};
    for (const s of scores) {
      const agent = s.agent || 'unknown';
      if (!byAgent[agent]) byAgent[agent] = { count: 0, totalQ: 0, totalE: 0 };
      byAgent[agent].count++;
      byAgent[agent].totalQ += s.quality?.score || 0;
      byAgent[agent].totalE += s.efficiency?.score || 0;
    }
    html += `<div style="font-size:13px;font-weight:600;margin-bottom:8px">By Agent</div>`;
    html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
    html += `<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:8px 10px;color:var(--fg2)">Agent</th><th style="text-align:left;padding:8px 10px;color:var(--fg2)">Sessions</th><th style="text-align:left;padding:8px 10px;color:var(--fg2)">Avg Quality</th><th style="text-align:left;padding:8px 10px;color:var(--fg2)">Avg Efficiency</th></tr>`;
    for (const [agent, data] of Object.entries(byAgent).sort((a, b) => b[1].count - a[1].count)) {
      const aq = (data.totalQ / data.count).toFixed(1);
      const ae = (data.totalE / data.count).toFixed(1);
      html += `<tr style="border-bottom:1px solid var(--border)">`;
      html += `<td style="padding:6px 10px;font-family:var(--mono)">${esc(agent)}</td>`;
      html += `<td style="padding:6px 10px">${data.count}</td>`;
      html += `<td style="padding:6px 10px">${scoreBar(parseFloat(aq), 5)}</td>`;
      html += `<td style="padding:6px 10px">${scoreBar(parseFloat(ae), 5)}</td>`;
      html += `</tr>`;
    }
    html += `</table></div>`;

    // Failure modes
    const fmCounts = {};
    for (const s of scores) {
      for (const issue of (s.critical_issues || [])) {
        fmCounts[issue] = (fmCounts[issue] || 0) + 1;
      }
    }
    if (Object.keys(fmCounts).length > 0) {
      html += `<div style="font-size:13px;font-weight:600;margin-bottom:8px">Top Failure Modes</div>`;
      html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px">`;
      const sorted = Object.entries(fmCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      for (const [fm, count] of sorted) {
        const pct = (count / scores.length * 100).toFixed(0);
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">`;
        html += `<div style="width:120px;height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--red)"></div></div>`;
        html += `<span style="font-size:11px;color:var(--fg2);min-width:30px">${count}×</span>`;
        html += `<span style="font-size:12px;font-family:var(--mono)">${esc(fm)}</span>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    // Session list (newest first)
    html += `<div style="font-size:13px;font-weight:600;margin-bottom:8px">Recent Scores</div>`;
    html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">`;
    const recent = [...scores].reverse().slice(0, 50);
    for (const s of recent) {
      const sid = s.sessionId || '?';
      const detailId = `eval-${sid.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const q = s.quality?.score;
      const e = s.efficiency?.score;
      const verdict = s.quality?.verdict || '—';
      const agent = s.agent || '?';

      html += `<div style="border-bottom:1px solid var(--border)">`;
      html += `<div onclick="document.getElementById('${detailId}').toggleAttribute('open')" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;user-select:none">`;
      html += `<span style="font-family:var(--mono);font-size:11px;color:var(--accent);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;user-select:text;cursor:text" title="${attrEsc(sid)}">${esc(sid)}</span>`;
      html += `<span style="font-size:11px;color:var(--fg2)">${esc(agent)}</span>`;
      html += `<span style="margin-left:auto;display:flex;gap:12px;align-items:center">`;
      html += `<span style="font-size:11px;color:var(--fg2)">Q:</span>${scoreBar(q, 5)}`;
      html += `<span style="font-size:11px;color:var(--fg2)">E:</span>${scoreBar(e, 5)}`;
      html += `<span style="font-size:11px;font-weight:600;color:${verdict === 'PASS' ? 'var(--green)' : verdict === 'FAIL' ? 'var(--red)' : 'var(--yellow)'}">${esc(verdict)}</span>`;
      html += `</span>`;
      html += `</div>`;

      // Detail
      html += `<details id="${detailId}" style="padding:0 12px 10px 24px">`;
      html += `<summary style="font-size:11px;color:var(--fg2);cursor:pointer;margin-bottom:6px">Details</summary>`;
      if (s.quality?.reasoning) {
        html += `<div style="font-size:11px;margin-bottom:6px"><b>Quality:</b> <span style="color:var(--fg2)">${esc(s.quality.reasoning)}</span></div>`;
      }
      if (s.efficiency?.reasoning) {
        html += `<div style="font-size:11px;margin-bottom:6px"><b>Efficiency:</b> <span style="color:var(--fg2)">${esc(s.efficiency.reasoning)}</span></div>`;
      }
      if (s.critical_issues?.length) {
        html += `<div style="font-size:11px;margin-bottom:6px"><b>Issues:</b> <span style="color:var(--red)">${s.critical_issues.map(i => esc(i)).join(', ')}</span></div>`;
      }
      if (s.root_causes?.length) {
        html += `<div style="font-size:11px;margin-bottom:6px"><b>Root causes:</b></div>`;
        for (const rc of s.root_causes) {
          html += `<div style="font-size:11px;color:var(--fg2);padding-left:12px;margin-bottom:2px">• ${esc(rc.cause)} <span style="color:var(--fg2);font-size:10px">[${esc(rc.attribution)}]</span></div>`;
        }
      }
      // Link to session
      html += `<div style="margin-top:6px"><a href="/projects/platform/ui/#/sessions/${encodeURIComponent(sid)}" style="font-size:11px">View session transcript →</a></div>`;
      html += `</details></div>`;
    }
    html += `</div>`;
  }

  // Heuristics reference (collapsible)
  if (heuristicsHtml) {
    html += `<details style="margin-bottom:16px">`;
    html += `<summary style="font-size:13px;font-weight:600;cursor:pointer;color:var(--fg2)">Signal Heuristics Reference</summary>`;
    html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;margin-top:8px;font-size:13px;line-height:1.6">${heuristicsHtml}</div>`;
    html += `</details>`;
  }

  // Action buttons
  html += `<div style="display:flex;gap:8px;flex-wrap:wrap">`;
  const actions = [
    { label: 'Score Next Batch', text: '[resume] Agent System Evolution / evaluator learning lane: score the next 10 unlabeled sessions using signal heuristics. Read each transcript, compute S1-S6 + X1-X3, write results to outputs/evaluator/session-scores.jsonl.' },
    { label: 'Analyze Patterns', text: '[resume] Agent System Evolution / evaluator learning lane: analyze all scored sessions. Cluster failure modes, identify success patterns, update outputs/evaluator/patterns.md.' },
    { label: 'Propose Rubric Update', text: '[resume] Agent System Evolution / evaluator learning lane: based on discovered patterns, propose concrete changes to the evaluator scoring rubric. Write to outputs/evaluator/rubric-patches.md for human review.' },
  ];
  for (const a of actions) {
    html += `<button onclick="document.getElementById('project-comment').value=${JSON.stringify(a.text)};document.getElementById('project-comment').focus()" style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--fg);padding:7px 12px;font-size:12px;cursor:pointer;font-family:var(--font)">${esc(a.label)}</button>`;
  }
  html += `</div>`;

  el.innerHTML = html;
};
