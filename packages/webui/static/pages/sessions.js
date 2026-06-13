function compactText(text, max = 140) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? value.slice(0, max - 1) + '...' : value;
}

function formatJson(value) {
  if (value == null || value === '') return '';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function normalizeUsage(usage) {
  const u = usage || {};
  const input = u.input ?? u.inputTokens ?? u.promptTokens ?? u.prompt_tokens ?? null;
  const output = u.output ?? u.outputTokens ?? u.completionTokens ?? u.completion_tokens ?? null;
  const cacheRead = u.cacheRead ?? u.cache_read ?? u.cacheReadTokens ?? null;
  const total = u.totalTokens ?? u.total_tokens ?? ((input != null || output != null) ? Number(input || 0) + Number(output || 0) : null);
  const cost = u.cost?.total ?? u.costTotal ?? u.cost_usd ?? u.totalCost ?? null;
  return { input, output, cacheRead, total, cost };
}

function usageLabel(usage) {
  const u = normalizeUsage(usage);
  if (u.input == null && u.output == null && u.total == null) return '';
  const parts = [];
  if (u.input != null || u.output != null) parts.push(`${u.input || 0} in / ${u.output || 0} out`);
  if (u.cacheRead) parts.push(`${u.cacheRead} cached`);
  if (u.total != null) parts.push(`${u.total} total`);
  return parts.join(' | ');
}

function costLabel(usage) {
  const cost = normalizeUsage(usage).cost;
  return cost != null ? `$${Number(cost).toFixed(4)}` : '';
}

function buildSessionFlow(messages) {
  const flow = [];
  let current = null;
  let messageIndex = 0;
  const finish = () => { if (current) { flow.push(current); current = null; } };
  for (const m of messages || []) {
    if (m.role === 'user') {
      finish();
      messageIndex += 1;
      flow.push({ type: 'message', role: 'user', index: messageIndex, text: m.text || '', rawLine: m.rawLine, rawSource: m.rawSource });
    } else if (m.role === 'assistant') {
      finish();
      messageIndex += 1;
      current = { type: 'message', role: 'assistant', index: messageIndex, assistant: m, toolResults: [] };
    } else if (m.role === 'tool_result') {
      if (!current) {
        messageIndex += 1;
        current = { type: 'message', role: 'assistant', index: messageIndex, assistant: { text: '', toolCalls: [] }, toolResults: [] };
      }
      current.toolResults.push(m);
    }
  }
  finish();
  return flow;
}

function flowChip(text, cls = '') {
  return text ? `<span class="flow-chip ${cls}">${esc(String(text))}</span>` : '';
}

function sourceChip(label, sessionId, rawLine, rawSource, cls = '') {
  if (!rawLine || !sessionId) return flowChip(label, cls);
  const source = rawSource || 'session.jsonl';
  const title = `Show raw JSONL record ${source}:${rawLine}`;
  return `<button type="button" class="flow-chip source-chip ${cls}" title="${esc(title)}" onclick="showRawLog(${jsStringAttr(sessionId)}, ${Number(rawLine)}, ${jsStringAttr(String(label))}, this)">${esc(String(label))}</button>`;
}

function sourceLineChip(sessionId, rawLine, rawSource, cls = '') {
  if (!rawLine) return '';
  return sourceChip(`session.jsonl:${rawLine}`, sessionId, rawLine, rawSource, cls);
}

function rawLineAttr(lines) {
  return attrEsc([...new Set((lines || []).map(Number).filter(Boolean))].join(','));
}

function renderRawBlock(label, value) {
  const text = typeof value === 'string' ? value : formatJson(value);
  if (!text) return '';
  return `<details class="raw-details"><summary title="${esc(label)}"><span class="tool-more">...</span></summary><pre class="tool-code">${esc(text)}</pre></details>`;
}

function toolRequestExcerpt(tc) {
  const args = tc?.args ?? {};
  if (args && typeof args === 'object') {
    if (typeof args.command === 'string') return args.command.trim();
    if (typeof args.cmd === 'string') return args.cmd.trim();
    if (typeof args.path === 'string') {
      const parts = [args.path];
      if (typeof args.offset === 'number') parts.push('offset ' + args.offset);
      if (typeof args.limit === 'number') parts.push('limit ' + args.limit);
      const rest = { ...args };
      delete rest.path;
      delete rest.offset;
      delete rest.limit;
      return parts.join(' | ') + (Object.keys(rest).length ? '\n' + formatJson(rest) : '');
    }
  }
  return formatJson(args);
}

function toolResultExcerpt(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  const diff = value.match(/```diff\n([\s\S]*?)```/);
  if (diff) {
    const before = value.slice(0, diff.index).trim().split('\n').filter(Boolean).slice(0, 3).join('\n');
    const diffLines = diff[1].split('\n').slice(0, 80).join('\n');
    const body = before ? before + '\n\n' + diffLines : diffLines;
    return body.length > 5000 ? body.slice(0, 5000) + '\n...' : body;
  }
  const lines = value.split('\n');
  const excerpt = lines.slice(0, 28).join('\n');
  return value.length > excerpt.length || lines.length > 28 ? excerpt.slice(0, 3000) + '\n...' : excerpt;
}

function renderToolPair(tc, result, sessionId) {
  const hasError = !!result?.isError;
  const resultText = result ? String(result.content || '') : 'No matching tool output found.';
  const requestText = toolRequestExcerpt(tc);
  const resultPreview = result ? toolResultExcerpt(resultText) : 'No matching tool output found.';
  return `<div class="tool-pair ${hasError ? 'error' : ''}">
    <div class="tool-pair-head">
      <span class="tool-pair-title">${esc(tc.tool || result?.toolName || 'tool')}</span>
      ${flowChip(hasError ? 'error' : 'ok', hasError ? 'error' : 'good')}
      ${tc.id || result?.toolCallId ? sourceChip(tc.id || result.toolCallId, sessionId, tc.rawLine || result?.rawLine, tc.rawSource || result?.rawSource) : ''}
      <span class="tool-pair-spacer"></span>
      <button type="button" class="tool-more tool-more-button" title="Full tool call and output" onclick="toggleToolDetails(this)">...</button>
    </div>
    <div class="tool-preview-grid">
      <div class="tool-preview-pane request"><div class="tool-preview-label">tool call ${sourceLineChip(sessionId, tc.rawLine, tc.rawSource)}</div><pre class="tool-preview-snippet">${esc(requestText)}</pre></div>
      <div class="tool-preview-pane result"><div class="tool-preview-label">tool output ${sourceLineChip(sessionId, result?.rawLine, result?.rawSource, hasError ? 'error' : '')}</div><pre class="tool-preview-snippet">${esc(resultPreview)}</pre></div>
    </div>
    <details class="tool-details">
      <summary>Full tool call and output</summary>
      <div class="tool-grid">
        <div class="tool-pane"><label>Tool call args</label><pre class="tool-code">${esc(formatJson(tc.args ?? {}))}</pre></div>
        <div class="tool-pane"><label>Tool output</label><pre class="tool-code">${esc(resultText)}</pre></div>
      </div>
    </details>
  </div>`;
}

function toggleToolDetails(button) {
  const details = button?.closest('.tool-pair')?.querySelector('.tool-details');
  if (!details) return;
  details.open = !details.open;
  button.classList.toggle('active', details.open);
}

function evalRowsByLine(evalData) {
  const byLine = new Map();
  for (const row of evalData?.rows || []) {
    const line = Number(row?.line || 0);
    if (!line) continue;
    if (!byLine.has(line)) byLine.set(line, []);
    byLine.get(line).push(row);
  }
  return byLine;
}

function evalRowsForLines(byLine, lines) {
  const rows = [];
  const seen = new Set();
  for (const line of [...new Set((lines || []).map(Number).filter(Boolean))]) {
    for (const row of byLine.get(line) || []) {
      const key = `${line}:${row.createdAt || ''}:${row.source || ''}:${row.comment || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows.sort((a, b) => (Number(a.line || 0) - Number(b.line || 0)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

function renderEvalExtra(row) {
  const skip = new Set(['type', 'schemaVersion', 'sessionId', 'line', 'source', 'author', 'createdAt', 'rawSource', 'rawRole', 'rawPreview', 'rawContext', 'score', 'issues', 'comment']);
  const priority = ['judgment', 'why', 'evidence', 'better', 'improvement', 'lesson', 'concern', 'checks'];
  const parts = [];
  const add = (key) => {
    if (!(key in row) || row[key] == null || row[key] === '') return;
    const value = typeof row[key] === 'string' ? row[key] : JSON.stringify(row[key], null, 2);
    parts.push(`<div class="eval-extra-item"><b>${esc(key)}</b><div>${esc(value)}</div></div>`);
  };
  priority.forEach(add);
  Object.keys(row).filter(k => !skip.has(k) && !priority.includes(k)).slice(0, 8).forEach(add);
  return parts.length ? `<div class="eval-extra">${parts.join('')}</div>` : '';
}

function renderEvalRows(rows, sessionId, idPrefix = 'eval-feedback') {
  let html = '';
  rows.forEach((row, idx) => {
    const line = Number(row.line || 0);
    const source = row.source || row.author || 'eval';
    const scoreClass = row.score === 'issue' ? 'error' : row.score === 'ok' ? 'good' : '';
    const feedbackId = `${idPrefix}-${line}-${idx}`;
    html += `<div class="eval-row" id="eval-line-${esc(line)}">
      <div class="eval-row-head">
        ${sourceLineChip(sessionId, line, row.rawSource || row.rawContext?.source)}
        ${flowChip(row.score || 'note', scoreClass)}
        ${flowChip(source)}
        ${evalIssueChips(row.issues)}
      </div>
      <div class="eval-comment">${esc(row.comment || row.judgment || row.raw || '')}</div>
      ${renderEvalExtra(row)}
      <div class="eval-feedback">
        <textarea id="${attrEsc(feedbackId)}" placeholder="Add human feedback for session.jsonl:${esc(line)}"></textarea>
        <button class="ask-btn" onclick="submitEvalFeedback(${jsStringAttr(sessionId)}, ${line}, ${jsStringAttr(feedbackId)})">Save feedback</button>
      </div>
    </div>`;
  });
  return html;
}

function renderTurnEval(rows, sessionId, turnIndex) {
  return `<aside class="turn-eval-cell">
    <div class="turn-eval-head"><b>Eval</b>${flowChip('turn ' + turnIndex)}${flowChip(`${rows.length} note${rows.length === 1 ? '' : 's'}`)}</div>
    ${rows.length ? renderEvalRows(rows, sessionId, `eval-feedback-turn-${turnIndex}`) : '<div class="turn-eval-empty">No eval trail yet for this turn.</div>'}
  </aside>`;
}

function renderTurnWithEval(messageHtml, rawLines, turnIndex, evalByLine, sessionId) {
  if (!evalByLine) return messageHtml;
  const rows = evalRowsForLines(evalByLine, rawLines);
  return `<div class="turn-eval-row" data-raw-lines="${rawLineAttr(rawLines)}"><div class="turn-cell">${messageHtml}</div>${renderTurnEval(rows, sessionId, turnIndex)}</div>`;
}

function renderEnrichedTranscript(messages, sessionId, evalData = null) {
  const flow = buildSessionFlow(messages);
  const evalByLine = evalData ? evalRowsByLine(evalData) : null;
  let html = `<div class="transcript enriched-transcript${evalData ? ' eval-transcript' : ''}">`;
  for (const item of flow) {
    if (item.role === 'user') {
      const rawLines = [item.rawLine];
      const msg = `<div class="msg user session-message" data-raw-lines="${rawLineAttr(rawLines)}"><div class="msg-header turn-header">${sourceChip('turn ' + item.index, sessionId, item.rawLine, item.rawSource)}${flowChip('user')}</div><div class="message-body"><div class="message-text">${esc(item.text || '')}</div></div></div>`;
      html += renderTurnWithEval(msg, rawLines, item.index, evalByLine, sessionId);
      continue;
    }
    const a = item.assistant || {};
    const toolCalls = a.toolCalls || [];
    const results = item.toolResults || [];
    const resultById = new Map(results.map(r => [r.toolCallId, r]));
    const unmatched = results.filter(r => !toolCalls.some(tc => tc.id === r.toolCallId));
    const errors = results.filter(r => r.isError).length;
    const usage = usageLabel(a.usage);
    const cost = costLabel(a.usage);
    const rawLines = [a.rawLine, ...toolCalls.map(tc => tc.rawLine), ...results.map(r => r.rawLine)];
    let pairs = '';
    for (const tc of toolCalls) pairs += renderToolPair(tc, resultById.get(tc.id), sessionId);
    for (const r of unmatched) pairs += renderToolPair({ tool: r.toolName || 'unmatched_result', id: r.toolCallId, args: {}, rawLine: r.rawLine, rawSource: r.rawSource }, r, sessionId);
    if (!a.text && !pairs) continue;
    const msg = `<div class="msg assistant session-message" data-raw-lines="${rawLineAttr(rawLines)}">
      <div class="msg-header turn-header">
        ${sourceChip('turn ' + item.index, sessionId, a.rawLine, a.rawSource)}
        ${flowChip('assistant')}
        ${flowChip(a.model || a.api?.model || '')}
        ${flowChip(a.provider || a.api?.provider || '')}
        ${flowChip(usage)}
        ${flowChip(cost)}
        ${flowChip(a.stopReason ? `stop: ${a.stopReason}` : '')}
        ${flowChip(toolCalls.length ? `${toolCalls.length} tools` : '')}
        ${errors ? flowChip(`${errors} errors`, 'error') : ''}
      </div>
      <div class="message-body">
        ${a.text ? `<div class="assistant-text">${esc(a.text)}</div>` : ''}
        ${pairs ? `<div class="tool-pairs">${pairs}</div>` : ''}
        ${renderRawBlock('Raw API response', a)}
      </div>
    </div>`;
    html += renderTurnWithEval(msg, rawLines, item.index, evalByLine, sessionId);
  }
  html += '</div>';
  return html;
}


function sessionConversationStats(messages) {
  const flow = buildSessionFlow(messages);
  return flow.reduce((acc, item) => {
    const a = item.assistant || {};
    acc.messages += 1;
    if (item.role === 'user') acc.users += 1;
    if (item.role === 'assistant') acc.assistants += 1;
    acc.tools += (a.toolCalls || []).length;
    acc.errors += (item.toolResults || []).filter(r => r.isError).length;
    return acc;
  }, { messages: 0, users: 0, assistants: 0, tools: 0, errors: 0 });
}

function evalIssueChips(issues) {
  return Array.isArray(issues) ? issues.map(issue => flowChip(issue, issue === 'tool_output_error' ? 'error' : '')).join('') : '';
}

function renderSessionConversation(transData, opts = {}) {
  const messages = transData.messages || [];
  if (!messages.length) return '';
  const stats = sessionConversationStats(messages);
  const sectionClass = opts.embedded
    ? 'conversation-section embedded-conversation'
    : opts.evalData
      ? 'panel conversation-section evaluated-conversation'
      : 'section conversation-section';
  const title = opts.showTitle === false ? '' : `<div class="conversation-title">
      <h4>Conversation</h4>
      ${flowChip(`${stats.messages} messages`)}
      ${flowChip(`${stats.users} user msg`)}
      ${flowChip(`${stats.assistants} assistant msg`)}
      ${flowChip(`${stats.tools} tool calls`)}
      ${stats.errors ? flowChip(`${stats.errors} tool errors`, 'error') : ''}
    </div>`;
  const conversation = `<div class="${sectionClass}">
    ${title}
    <div id="raw-log-viewer" class="raw-log-viewer"></div>
    ${renderEnrichedTranscript(messages, transData.sessionId, opts.evalData || null)}
  </div>`;
  return conversation;
}

async function openSessionEval(sessionId) {
  const btn = document.getElementById('session-eval-btn');
  if (btn) { btn.textContent = 'Evaluating...'; btn.disabled = true; }
  try {
    let r = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/eval`);
    let data = await r.json();
    if (!r.ok) throw new Error(data.error || r.statusText);
    if (!data.exists) {
      r = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/eval`, { method: 'POST' });
      data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
    }
    currentSessionEval = data;
    await loadSessionDetail(sessionId, { evalData: data, preserveScroll: true });
  } catch (e) {
    alert('Evaluation failed: ' + (e.message || String(e)));
  } finally {
    const nextBtn = document.getElementById('session-eval-btn');
    if (nextBtn) { nextBtn.textContent = 'Evaluate'; nextBtn.disabled = false; }
  }
}

async function submitEvalFeedback(sessionId, line, textareaId) {
  const el = document.getElementById(textareaId);
  const comment = (el?.value || '').trim();
  if (!comment) return;
  const r = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/eval/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ line, comment, author: 'human' })
  });
  const data = await r.json();
  if (!r.ok) { alert(data.error || r.statusText); return; }
  currentSessionEval = { sessionId, exists: true, rows: data.rows };
  await loadSessionDetail(sessionId, { evalData: currentSessionEval, preserveScroll: true });
}

async function showRawLog(sessionId, line, label, sourceEl) {
  const viewer = document.getElementById('raw-log-viewer');
  if (!viewer || !sessionId || !line) return;
  document.querySelectorAll('.source-chip.active').forEach(el => el.classList.remove('active'));
  if (sourceEl) sourceEl.classList.add('active');
  viewer.classList.add('active');
  viewer.innerHTML = `<div class="raw-log-head"><span>Loading raw JSONL record</span><code>session.jsonl:${esc(line)}</code><button title="Close" onclick="hideRawLog()">×</button></div>`;
  try {
    const r = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/raw-log?line=${encodeURIComponent(line)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.statusText);
    const body = data.parsed ? JSON.stringify(data.parsed, null, 2) : data.raw;
    viewer.innerHTML = `<div class="raw-log-head"><span>Raw JSONL record</span><code>${esc(data.source || 'session.jsonl')}:${esc(data.line)}</code><button title="Close" onclick="hideRawLog()">×</button></div><pre class="raw-log-body">${esc(body)}</pre>`;
    viewer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    viewer.innerHTML = `<div class="raw-log-head"><span style="color:var(--red)">Failed to load raw log</span><button title="Close" onclick="hideRawLog()">×</button></div><pre class="raw-log-body">${esc(e.message || String(e))}</pre>`;
  }
}

function hideRawLog() {
  const viewer = document.getElementById('raw-log-viewer');
  document.querySelectorAll('.source-chip.active').forEach(el => el.classList.remove('active'));
  if (viewer) { viewer.classList.remove('active'); viewer.innerHTML = ''; }
}

function focusSessionLine(line) {
  const targetLine = Number(line);
  if (!targetLine) return;
  document.querySelectorAll('.eval-row.active, .session-message.active').forEach(el => el.classList.remove('active'));
  const evalRow = document.getElementById(`eval-line-${targetLine}`);
  if (evalRow) evalRow.classList.add('active');
  const turn = [...document.querySelectorAll('.session-message[data-raw-lines]')].find(el =>
    String(el.dataset.rawLines || '').split(',').map(Number).includes(targetLine)
  );
  if (turn) {
    turn.classList.add('active');
    turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

const sessionHistory = [];
let currentInspectedSession = null;
let currentSessionEval = null;

function fmtTime(epoch) {
  if (!epoch) return '—';
  const d = new Date(epoch);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
         d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function scoreBar(val, color) {
  const pct = Math.round((val || 0) * 100);
  return `<span class="score-bar"><span class="fill" style="width:${pct}%;background:${color}"></span></span> ${pct}%`;
}


function verdictColor(verdict) {
  if (!verdict) return '';
  const v = verdict.toLowerCase();
  if (v === 'good') return '#4caf50';
  if (v === 'needs_improvement') return '#ff9800';
  if (v === 'poor') return '#f44336';
  return 'var(--fg2)';
}

async function loadSessionDetail(sessionId, opts = {}) {
  if (currentInspectedSession !== sessionId) currentSessionEval = null;
  currentInspectedSession = sessionId;
  const panel = getSessionDetailPanel();
  panel.innerHTML = '<div class="panel">Loading...</div>';

  try {
    const [sessRes, transRes] = await Promise.all([
      fetch(`/api/sessions/${sessionId}`),
      fetch(`/api/sessions/${sessionId}/transcript`),
    ]);
    const sessData = await sessRes.json();
    const transData = await transRes.json();

    if (sessData.error) { panel.innerHTML = `<div class="panel">${sessData.error}</div>`; return; }

    const s = sessData.session;
    const ev = sessData.evaluation;
    const durSec = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 1000) : null;
    const durStr = durSec !== null ? (durSec >= 60 ? Math.floor(durSec/60) + 'm ' + (durSec%60) + 's' : durSec + 's') : 'running...';
    const sessionIdArg = jsStringAttr(s.sessionId);
    const workflowRunIdArg = s.workflowRunId ? jsStringAttr(s.workflowRunId) : null;

    let html = `<div class="panel session-inspector">`;

    // Back button
    if (sessionHistory.length) {
      html += `<button class="back-btn" onclick="goBackSession()">← Back to previous</button>`;
    }

    // A. Session Header Card
    html += `<div class="section">
      <div class="header-row">
        <h3 style="margin:0">${esc(s.sessionId)}</h3>
        <button class="copy-btn" title="Copy session ID" onclick="navigator.clipboard.writeText('${esc(s.sessionId)}')">📋</button>
        <span class="badge ${s.status}">${s.status}</span>
      </div>
      <div class="header-row" style="margin-top:8px">
        <span style="font-size:14px"><a href="#" style="color:var(--accent);text-decoration:none" onclick="event.preventDefault();loadAgentDeepDive('${esc(s.agent)}')">${esc(s.agent)}</a></span>
        <span style="color:var(--fg2);font-size:13px">· ${durStr} · ${s.opCount || 0} ops</span>
        <button class="ask-btn" style="margin-left:auto" onclick='openLoopTrace({sessionId:${sessionIdArg}})'>trace</button>
        <button class="ask-btn" id="session-eval-btn" onclick="openSessionEval('${esc(s.sessionId)}')">Evaluate</button>
      </div>
      <div style="font-size:12px;color:var(--fg2);margin-top:6px">
        <span title="${s.startedAt || ''}">Started: ${fmtTime(s.startedAt)}</span>
        &nbsp;·&nbsp;
        <span title="${s.endedAt || ''}">Ended: ${fmtTime(s.endedAt)}</span>
      </div>
    </div>`;

    // B. Metadata stays near the session identity; it frames the conversation below.
    html += `<div class="section">
      <h4>Metadata</h4>
      <dl class="meta-grid">`;
    if (s.kind) html += `<dt>Kind</dt><dd>${esc(s.kind)}</dd>`;
    if (s.source) html += `<dt>Source</dt><dd>${esc(s.source)}</dd>`;
    if (s.projectId) {
      const parts = String(s.projectId).split('/').filter(Boolean);
      const routeId = parts[0] === 'shared' ? parts.join('/') : parts.length === 2 ? parts[1] : String(s.projectId);
      const projectRoute = `/projects/${routeId.split('/').map(encodeURIComponent).join('/')}/tasks`;
      html += `<dt>Project</dt><dd><a href="${attrEsc(projectRoute)}" style="color:var(--accent)">${esc(s.projectId)}</a></dd>`;
    }
    if (s.model) html += `<dt>Model</dt><dd>${esc(s.model)}</dd>`;
    if (s.parentSessionId) html += `<dt>Parent</dt><dd><a href="#" style="color:var(--accent)" onclick="event.preventDefault();loadSessionDetail('${esc(s.parentSessionId)}')">${esc(s.parentSessionId)}</a></dd>`;
    if (s.workflowRunId) html += `<dt>Workflow Run</dt><dd><a href="#" style="color:var(--accent)" onclick='event.preventDefault();openLoopTrace({workflowRunId:${workflowRunIdArg}})'>${esc(s.workflowRunId)}</a></dd>`;
    if (s.requestId) html += `<dt>Request</dt><dd>${esc(s.requestId)}</dd>`;
    html += `</dl></div>`;

    html += `<div id="session-followup-anchor" class="session-followup-anchor"></div>`;

    // C. Unified enriched session chat surface; evaluation/review and live mode reuse it.
    const evalData = opts.evalData || currentSessionEval;
    if (evalData) {
      html += `</div>${renderSessionConversation(transData, { evalData })}<div class="panel session-inspector session-inspector-secondary">`;
    } else {
      html += renderSessionConversation(transData);
    }

    // D. Outcome Section
    if (s.outcome) {
      html += `<div class="section">
        <h4>Outcome</h4>`;
      if (s.outcome.length > 500) {
        const shortOutcome = s.outcome.slice(0, 500);
        html += `<div class="outcome-block" id="outcome-block">${esc(shortOutcome)}…
          <div style="margin-top:8px"><a href="#" style="color:var(--accent);font-size:12px" onclick="event.preventDefault();toggleOutcome()">Show full outcome</a></div>
        </div>`;
      } else {
        html += `<div class="outcome-block">${esc(s.outcome)}</div>`;
      }
      html += `</div>`;
    }

    // F. Session Evaluation Section
    if (ev) {
      const qPct = ev.quality != null ? Math.round(ev.quality * 100) + '%' : null;
      const ePct = ev.efficiency != null ? Math.round(ev.efficiency * 100) + '%' : null;
      html += `<div class="section">
        <details class="eval-details">
          <summary><b>Session evaluation</b>${ev.verdict ? flowChip(ev.verdict) : ''}${qPct ? flowChip('quality ' + qPct) : ''}${ePct ? flowChip('efficiency ' + ePct) : ''}</summary>
          <div class="eval-card">`;
      if (ev.quality != null) {
        const qColor = ev.quality >= 0.7 ? '#4caf50' : ev.quality >= 0.4 ? '#ff9800' : '#f44336';
        html += `<div style="margin-bottom:6px"><strong>Quality:</strong> ${scoreBar(ev.quality, qColor)}</div>`;
      }
      if (ev.efficiency != null) {
        const eColor = ev.efficiency >= 0.7 ? '#4caf50' : ev.efficiency >= 0.4 ? '#ff9800' : '#f44336';
        html += `<div style="margin-bottom:6px"><strong>Efficiency:</strong> ${scoreBar(ev.efficiency, eColor)}</div>`;
      }
      if (ev.verdict) {
        html += `<div style="margin-bottom:6px"><strong>Verdict:</strong> <span style="color:${verdictColor(ev.verdict)};font-weight:600">${esc(ev.verdict)}</span></div>`;
      }
      if (ev.productiveCalls != null || ev.wastedCalls != null) {
        html += `<div style="margin-bottom:6px;font-size:13px">Productive calls: <strong>${ev.productiveCalls ?? '—'}</strong> · Wasted calls: <strong>${ev.wastedCalls ?? '—'}</strong></div>`;
      }
      // Parse issues
      if (ev.issues) {
        try {
          const issues = typeof ev.issues === 'string' ? JSON.parse(ev.issues) : ev.issues;
          if (Array.isArray(issues) && issues.length) {
            html += `<div style="margin-top:8px"><strong>Issues:</strong><ul style="margin:4px 0;padding-left:20px;font-size:13px">`;
            for (const issue of issues) {
              html += `<li>${esc(typeof issue === 'string' ? issue : JSON.stringify(issue))}</li>`;
            }
            html += `</ul></div>`;
          }
        } catch(e) { /* ignore parse errors */ }
      }
      // Parse overall
      if (ev.overall) {
        try {
          const overall = typeof ev.overall === 'string' ? JSON.parse(ev.overall) : ev.overall;
          if (overall && typeof overall === 'object') {
            html += `<div style="margin-top:8px"><strong>Summary:</strong> <span style="font-size:13px">${esc(overall.summary || overall.verdict || JSON.stringify(overall))}</span></div>`;
          }
        } catch(e) { /* ignore parse errors */ }
      }
      html += `</div></details></div>`;
    }

    // G. Delegation Tree
    if (sessData.children.length) {
      html += `<div class="section">
        <h4>Delegation Tree</h4>`;
      html += renderTree(sessData.children);
      html += `</div>`;
    }

    html += '</div>';
    panel.innerHTML = html;
    if (isSessionPageMode()) placeSessionComposer();

    // Store full outcome for expand/collapse
    if (s.outcome && s.outcome.length > 500) {
      panel._fullOutcome = s.outcome;
      panel._outcomeExpanded = false;
    }

    if (!opts.preserveScroll) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch(e) {
    panel.innerHTML = `<div class="panel">Error loading session: ${e.message}</div>`;
  }
}

function getSessionDetailPanel() {
  const routePanel = document.getElementById('session-detail-panel');
  if (currentTab === 'sessions' && routePanel) return routePanel;
  return document.getElementById('detail-panel') || routePanel;
}

function goBackSession() {
  if (sessionHistory.length) {
    const prev = sessionHistory.pop();
    loadSessionDetail(prev);
  }
}

function navigateToSession(sessionId, fromSessionId) {
  if (fromSessionId) sessionHistory.push(fromSessionId);
  loadSessionDetail(sessionId);
}

function toggleOutcome() {
  const panel = getSessionDetailPanel();
  const block = document.getElementById('outcome-block');
  if (!block || !panel._fullOutcome) return;
  panel._outcomeExpanded = !panel._outcomeExpanded;
  if (panel._outcomeExpanded) {
    block.innerHTML = esc(panel._fullOutcome) +
      `<div style="margin-top:8px"><a href="#" style="color:var(--accent);font-size:12px" onclick="event.preventDefault();toggleOutcome()">Show less</a></div>`;
  } else {
    block.innerHTML = esc(panel._fullOutcome.slice(0, 500)) + '…' +
      `<div style="margin-top:8px"><a href="#" style="color:var(--accent);font-size:12px" onclick="event.preventDefault();toggleOutcome()">Show full outcome</a></div>`;
  }
}

function renderTree(children) {
  let html = '';
  // Build a map of parentSessionId -> children
  const byParent = {};
  for (const c of children) {
    const p = c.parentSessionId || 'root';
    if (!byParent[p]) byParent[p] = [];
    byParent[p].push(c);
  }
  function renderLevel(parentId) {
    const kids = byParent[parentId] || [];
    let h = '';
    for (const c of kids) {
      const dur = c.endedAt ? Math.round((c.endedAt - c.startedAt)/1000) + 's' : '...';
      h += `<div class="tree-node" style="cursor:pointer" onclick="event.stopPropagation();navigateToSession('${esc(c.sessionId)}', currentInspectedSession)">
        <span class="agent">${c.agent}</span> <span class="badge ${c.status}">${c.status}</span> · ${dur}
        <div class="task-preview">${esc(c.task.slice(0,100))}</div>
        ${c.outcome ? `<div class="outcome-preview">${esc(c.outcome.slice(0,150))}</div>` : ''}
        ${renderLevel(c.sessionId)}
      </div>`;
    }
    return h;
  }
  // Find the roots (children of the selected session)
  const rootParents = [...new Set(children.map(c => c.parentSessionId))];
  for (const p of rootParents) {
    html += renderLevel(p);
  }
  return html;
}
