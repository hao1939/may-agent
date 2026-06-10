// AKS RP E2E Knowledge Map — project-specific UI for AKS domain modeling.
// Loaded dynamically by the platform UI when viewing the aks-rp-e2e project.
// Relies on globals from index.html: esc, attrEsc, jsStringAttr, renderMarkdownBlock,
// extractProjectSection, prefillProjectComment, loadProjectTab.

// ── Action Receipt System ──
// Every feature-page action produces a visible receipt with action name,
// feature/path context, owner, timestamp, state, and next expectation.
window._aksReceipts = window._aksReceipts || [];

function addAksReceipt(receipt) {
  const r = Object.assign({
    owner: 'aks-explorer',
    timestamp: new Date().toISOString(),
    state: 'requested',
    next: '',
    action: 'action',
    featureId: '',
    pathId: '',
    error: '',
    recovery: '',
    taskId: '',
    commentId: '',
  }, receipt);
  window._aksReceipts.unshift(r);
  if (window._aksReceipts.length > 50) window._aksReceipts.length = 50;
  renderAksReceipts();
  return r;
}

function renderAksReceipts() {
  const container = document.getElementById('aks-receipt-container');
  if (!container) return;
  const receipts = window._aksReceipts;
  if (!receipts.length) { container.innerHTML = ''; return; }
  let html = '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--fg2);margin-bottom:6px">Action Receipts <span style="font-size:9px;background:var(--bg3);padding:1px 6px;border-radius:8px;margin-left:4px">' + receipts.length + '</span></div>';
  for (const r of receipts.slice(0, 20)) {
    const sc = r.state === 'error' ? 'var(--red)' : r.state === 'in-progress' ? 'var(--yellow)' : r.state === 'done' ? 'var(--green)' : 'var(--accent)';
    html += '<div data-testid="aks-receipt" style="border-left:3px solid ' + sc + ';background:var(--bg2);border-radius:6px;padding:8px 12px;margin-bottom:6px">';
    html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
    html += '<strong style="font-size:12px">' + esc(r.action) + '</strong>';
    html += '<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:' + sc + ';color:#fff">' + esc(r.state) + '</span>';
    html += '<span style="color:var(--fg2);font-size:10px;font-family:var(--mono);margin-left:auto">' + esc(r.timestamp.replace('T', ' ').replace(/\.\d+Z$/, 'Z')) + '</span>';
    html += '</div>';
    var meta = [];
    if (r.featureId) meta.push('feature: ' + r.featureId);
    if (r.pathId) meta.push('path: ' + r.pathId);
    meta.push('owner: ' + (r.owner || 'aks-explorer'));
    html += '<div style="font-size:11px;color:var(--fg2);margin-top:2px">' + esc(meta.join(' \u00b7 ')) + '</div>';
    if (r.next) html += '<div style="font-size:11px;margin-top:3px;color:var(--fg)">\u23ed Next: ' + esc(r.next) + '</div>';
    if (r.state === 'error') {
      html += '<div style="font-size:11px;margin-top:3px;color:var(--red)">\u2717 ' + esc(r.error || 'Unknown error') + '</div>';
      html += '<div style="font-size:11px;margin-top:2px;color:var(--orange)">Recovery: ' + esc(r.recovery || 'Retry the action, check network connectivity, or verify the API endpoint is available.') + '</div>';
    }
    if (r.taskId || r.commentId) {
      html += '<div style="font-size:11px;margin-top:3px">';
      if (r.taskId) html += '<a href="../kanban/?task=' + attrEsc(r.taskId) + '" style="color:var(--accent)">View in Kanban</a> ';
      if (r.commentId) html += '<span style="color:var(--fg2)">ref: ' + esc(r.commentId) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }
  container.innerHTML = html;
}

function _parseReceiptContext(text) {
  var ctx = { action: 'comment', featureId: '', pathId: '' };
  var s = String(text || '');
  // Detect action from prompt patterns
  if (/\baudit\b/i.test(s)) ctx.action = 'audit';
  else if (/\bmanual verif/i.test(s)) ctx.action = 'manual-verify';
  else if (/\bchallenge\b/i.test(s)) ctx.action = 'challenge';
  else if (/\bsuggest.*next\b|make.*next\b/i.test(s)) ctx.action = 'suggest-next';
  else if (/\badd.*reference\b/i.test(s)) ctx.action = 'add-reference';
  else if (/\bexpected.behav/i.test(s)) ctx.action = 'add-expected-behavior';
  else if (/\bsource.of.truth\b/i.test(s)) ctx.action = 'mark-source-of-truth';
  else if (/\bmissing.*path\b/i.test(s)) ctx.action = 'suggest-missing-path';
  else if (/\breview.spec\b/i.test(s)) ctx.action = 'review-spec';
  else if (/\breview.script\b/i.test(s)) ctx.action = 'review-script';
  else if (/\bgenerate.*script\b/i.test(s)) ctx.action = 'generate-script';
  else if (/\bstaging.replay\b/i.test(s)) ctx.action = 'request-staging';
  else if (/\bclassify.result\b/i.test(s)) ctx.action = 'classify-result';
  else if (/\bapprove.model\b/i.test(s)) ctx.action = 'approve-model-update';
  else if (/\breplan\b/i.test(s)) ctx.action = 'replan';
  else if (/DRY_RUN=0|Run Live/i.test(s)) ctx.action = 'execute-run';
  else if (/\bdirection\b/i.test(s)) ctx.action = 'suggest-direction';
  // Detect feature ID
  var fm = s.match(/feature\s+\S+\s+\(([^)]+)\)/i);
  if (fm) ctx.featureId = fm[1].split(',')[0].trim();
  // Detect path ID
  var pm = s.match(/(path\.[^\s,\n)]+)/);
  if (pm) ctx.pathId = pm[1];
  return ctx;
}

function suggestAksRpE2eDirection() {
  const input = document.getElementById('aks-direction-suggestion');
  const suggestion = String(input?.value || '').trim();
  const prompt = suggestion
    ? `[resume] Direction suggestion for aks-rp-e2e:\n\n${suggestion}\n\nEvaluate this against the current feature status/gaps, source/API/docs references, execution cost, cleanup risk, and existing Next Action. If this is a better project move, update .app/project.json and leave reviewable evidence. If not, explain why in .app/discussion.jsonl.`
    : '[resume] Review aks-rp-e2e and suggest the next best project move from the current feature status/gaps, source/API/docs references, execution cost, cleanup risk, and existing Next Action.';
  prefillProjectComment(prompt);
}

function aksRpE2eProjectCommentStatus() {
  let statusEl = document.getElementById('project-comment-status');
  if (statusEl) return statusEl;
  const input = document.getElementById('project-comment');
  if (!input?.parentElement) return null;
  statusEl = document.createElement('div');
  statusEl.id = 'project-comment-status';
  statusEl.style.cssText = 'font-size:12px;margin:-8px 0 8px;display:none';
  input.parentElement.insertAdjacentElement('afterend', statusEl);
  return statusEl;
}

function setAksRpE2eProjectCommentStatus(text, color) {
  const statusEl = aksRpE2eProjectCommentStatus();
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.style.color = color || 'var(--fg2)';
  statusEl.style.display = text ? 'block' : 'none';
}

async function submitAksRpE2eAgentMessage(text) {
  const message = String(text || '').trim();
  if (!message) return;
  const rctx = _parseReceiptContext(message);
  const receipt = addAksReceipt({ action: rctx.action, featureId: rctx.featureId, pathId: rctx.pathId, state: 'in-progress', next: 'Awaiting project action response' });
  const input = document.getElementById('project-comment');
  const previousPlaceholder = input?.getAttribute('placeholder') || '';
  if (input) {
    input.value = '';
    input.disabled = true;
    input.placeholder = 'Executing action...';
  }
  setAksRpE2eProjectCommentStatus('Calling project action...', 'var(--fg2)');
  try {
    // Determine action type from message content
    const isLiveRun = message.includes('DRY_RUN=0') || message.includes('Run Live');
    const actionName = isLiveRun ? 'execute-run' : 'replan';

    // Extract selected path IDs from the message
    const pathMatches = message.match(/- (path\.[^\n]+)/g);
    const selectedPathIds = pathMatches ? pathMatches.map(m => m.replace('- ', '').trim()) : selectedAksRpE2eReplanPaths();

    // Call project action API
    const actionBody = JSON.stringify({
      path: _projectDetailPath,
      action: actionName,
      params: { selectedPathIds, liveRun: isLiveRun },
    });
    const actionHeaders = { 'Content-Type': 'application/json' };

    const res = await fetch('/api/projects/action', { method: 'POST', headers: actionHeaders, body: actionBody });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        if (data.async) {
          setAksRpE2eProjectCommentStatus('Action triggered — workflow starting...', 'var(--green)');
          receipt.state = 'requested'; receipt.next = 'Workflow starting — check Kanban for progress';
          if (data.workflowRunId) receipt.commentId = data.workflowRunId;
        } else if (data.result) {
          const m = data.result.metrics || {};
          setAksRpE2eProjectCommentStatus(`Replan complete: ${m.replannedClusterCrudCount || '?'} cluster(s), ${m.clusterCrudSaved || 0} saved, density ${m.expectationDensity || '?'}`, 'var(--green)');
          receipt.state = 'done'; receipt.next = 'Verify model changes in feature contract panel';
          if (typeof refreshAksRpE2ePanel === 'function') refreshAksRpE2ePanel();
        }
        renderAksReceipts();
        return;
      }
    }

    // Final fallback: send as project comment
    const fallbackRes = await fetch('/api/projects/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: _projectDetailPath, comment: message }),
    });
    const fallbackData = await fallbackRes.json().catch(() => ({}));
    if (!fallbackRes.ok || fallbackData.ok === false) throw new Error(fallbackData.error || `HTTP ${fallbackRes.status}`);
    const suffix = fallbackData.workflowStarted ? ' (workflow started)' : fallbackData.triggered ? ' - trigger sent' : '';
    setAksRpE2eProjectCommentStatus(`Sent as comment${suffix}`, 'var(--orange,#e8a44c)');
    receipt.state = 'requested'; receipt.next = 'Comment sent — aks-explorer will process asynchronously';
    if (fallbackData.workflowRunId) receipt.commentId = fallbackData.workflowRunId;
    renderAksReceipts();
  } catch (e) {
    setAksRpE2eProjectCommentStatus('Failed: ' + (e?.message || String(e)), 'var(--red)');
    receipt.state = 'error'; receipt.error = e?.message || String(e);
    receipt.recovery = 'Check network connectivity and API endpoint availability. Retry the action or send as a direct comment.';
    receipt.next = 'Resolve error and retry';
    renderAksReceipts();
  } finally {
    if (input) {
      input.disabled = false;
      input.placeholder = previousPlaceholder || 'Discuss AKS feature gaps, evidence, probes, or model direction...';
    }
  }
}

async function submitAksRpE2eProjectComment(text) {
  const comment = String(text || '').trim();
  if (!comment) return;
  const rctx = _parseReceiptContext(comment);
  const receipt = addAksReceipt({ action: rctx.action, featureId: rctx.featureId, pathId: rctx.pathId, state: 'in-progress', next: 'Sending comment to aks-explorer' });
  const input = document.getElementById('project-comment');
  const previousPlaceholder = input?.getAttribute('placeholder') || '';
  if (input) {
    input.value = '';
    input.disabled = true;
    input.placeholder = 'Sending to aks-explorer...';
  }
  setAksRpE2eProjectCommentStatus('Sending to aks-explorer...', 'var(--fg2)');
  try {
    const res = await fetch('/api/projects/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: _projectDetailPath, comment }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || data.triggerError || `HTTP ${res.status}`);
    const suffix = data.workflowStarted
      ? (data.workflowRunId ? ` (${data.workflowRunId})` : '')
      : data.triggered
        ? ' - trigger sent'
        : '';
    setAksRpE2eProjectCommentStatus(`Comment sent to aks-explorer${suffix}`, 'var(--green)');
    receipt.state = 'requested'; receipt.next = 'aks-explorer will process — check discussion or Kanban for results';
    if (data.workflowRunId) receipt.commentId = data.workflowRunId;
    renderAksReceipts();
    if (typeof loadProjectTab === 'function') loadProjectTab('project');
  } catch (e) {
    setAksRpE2eProjectCommentStatus('Failed to send comment: ' + (e?.message || String(e)), 'var(--red)');
    receipt.state = 'error'; receipt.error = e?.message || String(e);
    receipt.recovery = 'Check that the project API is accessible. Verify network, then retry the action.';
    receipt.next = 'Resolve error and retry';
    renderAksReceipts();
  } finally {
    if (input) {
      input.disabled = false;
      input.placeholder = previousPlaceholder || 'Discuss AKS feature gaps, evidence, probes, or model direction...';
    }
  }
}

function selectedAksRpE2eReplanPaths() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem('aksSelectedReplanPathIds') || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

function setSelectedAksRpE2eReplanPaths(pathIds) {
  sessionStorage.setItem('aksSelectedReplanPathIds', JSON.stringify([...new Set(pathIds || [])]));
}

function refreshAksRpE2ePanel() {
  const el = document.getElementById('quality-panel') || document.getElementById('project-tab-content');
  if (el && typeof window.renderAksRpE2eQualityPanel === 'function') {
    window.renderAksRpE2eQualityPanel(el);
  }
}

function toggleAksRpE2eReplanPath(pathId, checked) {
  const selected = new Set(selectedAksRpE2eReplanPaths());
  if (checked) selected.add(pathId);
  else selected.delete(pathId);
  setSelectedAksRpE2eReplanPaths([...selected]);
  refreshAksRpE2ePanel();
}

function clearAksRpE2eReplanSelection() {
  setSelectedAksRpE2eReplanPaths([]);
  refreshAksRpE2ePanel();
}

function selectedAksRpE2eFeatureIds() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem('aksSelectedFeatureIds') || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

function setSelectedAksRpE2eFeatureIds(featureIds) {
  sessionStorage.setItem('aksSelectedFeatureIds', JSON.stringify([...new Set(featureIds || [])]));
}

function toggleAksRpE2eFeatureSelection(featureId, checked) {
  const selected = new Set(selectedAksRpE2eFeatureIds());
  if (checked) selected.add(featureId);
  else selected.delete(featureId);
  setSelectedAksRpE2eFeatureIds([...selected]);
  refreshAksRpE2ePanel();
}

function clearAksRpE2eFeatureSelection() {
  setSelectedAksRpE2eFeatureIds([]);
  refreshAksRpE2ePanel();
}

function selectAksRpE2eReplanPaths(pathIds) {
  setSelectedAksRpE2eReplanPaths(pathIds || []);
  refreshAksRpE2ePanel();
}

function aksRpE2eCurrentRoute() {
  const path = String(window.location.pathname || '');
  if (/\/ui\/feature\/?$/.test(path)) {
    const id = new URLSearchParams(window.location.search || '').get('id') || '';
    return id ? { type: 'feature', id } : { type: 'map', id: '' };
  }
  const hash = String(window.location.hash || '');
  const featureMatch = hash.match(/^#\/feature\/(.+)$/);
  if (featureMatch) {
    return { type: 'feature', id: decodeURIComponent(featureMatch[1]) };
  }
  const pathMatch = hash.match(/^#\/path\/(.+)$/);
  if (pathMatch) {
    return { type: 'path', id: decodeURIComponent(pathMatch[1]) };
  }
  return { type: 'map', id: '' };
}

function navigateAksRpE2eRoute(type, id) {
  const path = String(window.location.pathname || '');
  if (/\/ui\/feature\/?$/.test(path)) {
    const target = type === 'feature' && id
      ? `${window.location.pathname}?id=${encodeURIComponent(String(id))}`
      : '../';
    window.location.href = target;
    return true;
  }
  const nextHash = type === 'map' ? '' : `#/${type}/${encodeURIComponent(String(id || ''))}`;
  if (window.location.hash === nextHash) return false;
  if (nextHash) {
    window.location.hash = nextHash;
  } else {
    window.history.pushState('', document.title, window.location.pathname + window.location.search);
  }
  return true;
}

function syncAksRpE2eRouteSelection() {
  const route = aksRpE2eCurrentRoute();
  if (route.type === 'feature') {
    window.__aksRpE2eFeatureId = route.id || '';
    window.__aksRpE2ePathId = '';
    if (route.id) sessionStorage.setItem('aksSelectedFeatureId', route.id);
    sessionStorage.removeItem('aksSelectedPathId');
  } else if (route.type === 'path') {
    window.__aksRpE2ePathId = route.id || '';
    window.__aksRpE2eFeatureId = '';
    if (route.id) sessionStorage.setItem('aksSelectedPathId', route.id);
    sessionStorage.removeItem('aksSelectedFeatureId');
  } else {
    window.__aksRpE2eFeatureId = '';
    window.__aksRpE2ePathId = '';
  }
  return route;
}

if (!window.__aksRpE2eRouteListenerAttached) {
  window.__aksRpE2eRouteListenerAttached = true;
  window.addEventListener('hashchange', () => {
    syncAksRpE2eRouteSelection();
    refreshAksRpE2ePanel();
  });
}

function submitAksRpE2eFeatureReplanPrompt(pathIds, featureIds) {
  const paths = [...new Set(pathIds || [])].filter(Boolean);
  const features = [...new Set(featureIds || selectedAksRpE2eFeatureIds())].filter(Boolean);
  const text = paths.length
    ? `[resume] Replan aks-rp-e2e combined test cases from selected feature groups.\n\nSelected features:\n${features.map(id => `- ${id}`).join('\n') || '- not specified'}\n\nSelected knowledge paths:\n${paths.map(id => `- ${id}`).join('\n')}\n\nUse model/knowledge-map/views/path-summary.json, specs/index.json, features/, and suites/. Combine multiple scenarios only when input shape, cluster lifecycle, cleanup, and diagnosis remain clear. Produce a reviewable run plan and TypeScript probe before live execution; do not run cloud mutation unless explicit gates pass.`
    : `[resume] Review selected aks-rp-e2e feature groups for combined test replanning.\n\nSelected features:\n${features.map(id => `- ${id}`).join('\n') || '- not specified'}\n\nFind source-backed knowledge paths and test specs that can be combined into a high-density run. If paths are incompatible, explain why and propose separate run plans. Do not run cloud mutation.`;
  if (paths.length) submitAksRpE2eAgentMessage(text);
  else submitAksRpE2eProjectComment(text);
}

function prefillAksRpE2eFeatureReviewPrompt(featureIds) {
  const features = [...new Set(featureIds || selectedAksRpE2eFeatureIds())].filter(Boolean);
  const text = `[resume] Review aks-rp-e2e feature context for selected feature groups.\n\nSelected features:\n${features.map(id => `- ${id}`).join('\n') || '- choose the highest-value feature from the UI context'}\n\nCheck design/source references, public API/spec shape, docs/user contract, handwritten e2ev3 intent, specs, run plans, evidence links, cleanup, and current knowledge-map status. Tell me what is trustworthy, what is missing, and what feedback or steering you need from the user.`;
  prefillProjectComment(text);
}

function prefillAksRpE2eReplanPrompt() {
  const selected = selectedAksRpE2eReplanPaths();
  const text = selected.length
    ? `[resume] Replan aks-rp-e2e for selected knowledge paths:\n\n${selected.map(id => `- ${id}`).join('\n')}\n\nUse model/knowledge-map/views/path-summary.json and specs/index.json. Generate or update a reviewable run plan and TypeScript probe that combines compatible paths into the fewest cluster CRUD lifecycles while preserving path-specific diagnosis, cleanup evidence, and model-impact honesty. Run local e2e/dry-run verification before any cloud mutation.`
    : '[resume] Select the best compatible aks-rp-e2e knowledge paths for a high-density replan. Prefer source-backed paths with test specs, clear cleanup, and clean diagnosis. Produce a reviewable run plan and dry-run TypeScript probe.';
  prefillProjectComment(text);
}

function submitAksRpE2eReplanPrompt() {
  const selected = selectedAksRpE2eReplanPaths();
  const text = selected.length
    ? `[resume] Replan aks-rp-e2e for selected knowledge paths:\n\n${selected.map(id => `- ${id}`).join('\n')}\n\nUse model/knowledge-map/views/path-summary.json and specs/index.json. Generate or update a reviewable run plan and TypeScript probe that combines compatible paths into the fewest cluster CRUD lifecycles while preserving path-specific diagnosis, cleanup evidence, and model-impact honesty. Run local e2e/dry-run verification before any cloud mutation.`
    : '[resume] Select the best compatible aks-rp-e2e knowledge paths for a high-density replan. Prefer source-backed paths with test specs, clear cleanup, and clean diagnosis. Produce a reviewable run plan and dry-run TypeScript probe.';
  submitAksRpE2eAgentMessage(text);
}

function prefillAksRpE2eLiveRunPrompt() {
  const selected = selectedAksRpE2eReplanPaths();
  const selectedArg = selected.join(',');
  const text = selected.length
    ? `[resume] Run the selected aks-rp-e2e replanned test live from the project workspace.\n\nSelected paths:\n${selected.map(id => `- ${id}`).join('\n')}\n\nUse this flow:\n1. Regenerate the run artifacts:\n   cd /app/projects/aks-rp-e2e && bun model/tools/src/replan-feature-paths.ts --select=${selectedArg} --out-dir=.app/decisions/replans/live-selected\n2. Verify Azure auth can get an ARM token:\n   az account get-access-token --resource https://management.azure.com/ -o json\n3. Execute live only when auth is valid:\n   AKS_RP_E2E_DRY_RUN=0 AKS_RP_E2E_RUN_ID=replan-live-$(date +%Y%m%d%H%M%S) bun .app/decisions/replans/live-selected/replan.*.ts\n4. Report elapsed time, baseline cluster CRUD, replanned cluster CRUD, saved cluster CRUD, capacity saved, cleanup status, and any failed assertion.\n\nIf Azure auth is stale, stop and report that az login --scope https://management.azure.com//.default is required. Do not fake the result.`
    : '[resume] In aks-rp-e2e, choose compatible paths with test specs, generate a replanned live run, verify Azure ARM auth, execute with AKS_RP_E2E_DRY_RUN=0, then report time/capacity savings and cleanup status. Stop if auth is stale; do not fake the result.';
  prefillProjectComment(text);
}

function submitAksRpE2eLiveRunPrompt() {
  const selected = selectedAksRpE2eReplanPaths();
  const selectedArg = selected.join(',');
  const text = selected.length
    ? `[resume] Run the selected aks-rp-e2e replanned test live from the project workspace.\n\nSelected paths:\n${selected.map(id => `- ${id}`).join('\n')}\n\nUse this flow:\n1. Regenerate the run artifacts:\n   cd /app/projects/aks-rp-e2e && bun model/tools/src/replan-feature-paths.ts --select=${selectedArg} --out-dir=.app/decisions/replans/live-selected\n2. Verify Azure auth can get an ARM token:\n   az account get-access-token --resource https://management.azure.com/ -o json\n3. Execute live only when auth is valid:\n   AKS_RP_E2E_DRY_RUN=0 AKS_RP_E2E_RUN_ID=replan-live-$(date +%Y%m%d%H%M%S) bun .app/decisions/replans/live-selected/replan.*.ts\n4. Report elapsed time, baseline cluster CRUD, replanned cluster CRUD, saved cluster CRUD, capacity saved, cleanup status, and any failed assertion.\n\nIf Azure auth is stale, stop and report that az login --scope https://management.azure.com//.default is required. Do not fake the result.`
    : '[resume] In aks-rp-e2e, choose compatible paths with test specs, generate a replanned live run, verify Azure ARM auth, execute with AKS_RP_E2E_DRY_RUN=0, then report time/capacity savings and cleanup status. Stop if auth is stale; do not fake the result.';
  submitAksRpE2eAgentMessage(text);
}

function openAksRpE2eFeature(featureId) {
  window.__aksRpE2eFeatureId = featureId || '';
  window.__aksRpE2ePathId = '';
  sessionStorage.setItem('aksSelectedFeatureId', window.__aksRpE2eFeatureId);
  sessionStorage.removeItem('aksSelectedPathId');
  if (navigateAksRpE2eRoute('feature', window.__aksRpE2eFeatureId)) return;
  const el = document.getElementById('quality-panel') || document.getElementById('project-tab-content');
  if (el && typeof window.renderAksRpE2eQualityPanel === 'function') {
    window.renderAksRpE2eQualityPanel(el);
  }
}

function closeAksRpE2eFeature() {
  window.__aksRpE2eFeatureId = '';
  sessionStorage.removeItem('aksSelectedFeatureId');
  navigateAksRpE2eRoute('map');
  const el = document.getElementById('quality-panel') || document.getElementById('project-tab-content');
  if (el && typeof window.renderAksRpE2eQualityPanel === 'function') {
    window.renderAksRpE2eQualityPanel(el);
  }
}

function openAksRpE2ePath(pathId) {
  window.__aksRpE2ePathId = pathId || '';
  window.__aksRpE2eFeatureId = '';
  sessionStorage.setItem('aksSelectedPathId', window.__aksRpE2ePathId);
  sessionStorage.removeItem('aksSelectedFeatureId');
  if (navigateAksRpE2eRoute('path', window.__aksRpE2ePathId)) return;
  const el = document.getElementById('quality-panel') || document.getElementById('project-tab-content');
  if (el && typeof window.renderAksRpE2eQualityPanel === 'function') {
    window.renderAksRpE2eQualityPanel(el);
  }
}

function closeAksRpE2ePath() {
  window.__aksRpE2ePathId = '';
  sessionStorage.removeItem('aksSelectedPathId');
  navigateAksRpE2eRoute('map');
  const el = document.getElementById('quality-panel') || document.getElementById('project-tab-content');
  if (el && typeof window.renderAksRpE2eQualityPanel === 'function') {
    window.renderAksRpE2eQualityPanel(el);
  }
}

function ensureAksRpE2ePanelStyles() {
  if (document.getElementById('aks-rp-e2e-quality-panel-styles')) return;
  const style = document.createElement('style');
  style.id = 'aks-rp-e2e-quality-panel-styles';
  style.textContent = `
    .aks-panel {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      min-width: 0;
    }
    .aks-command-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .aks-project-brief {
      grid-row: span 3;
    }
    .aks-work-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, .7fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .aks-kicker,
    .aks-map-head {
      font-size: 10px;
      color: var(--fg2);
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    .aks-title {
      font-size: 18px;
      font-weight: 650;
      margin: 3px 0 8px;
      line-height: 1.25;
    }
    .aks-brief-text {
      color: var(--fg2);
      font-size: 12px;
      line-height: 1.55;
      margin-bottom: 12px;
      white-space: pre-wrap;
    }
    .aks-metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(86px, 1fr));
      gap: 8px;
    }
    .aks-mini-metric {
      min-width: 0;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
    }
    .aks-target-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 2px 0 8px;
      min-width: 0;
    }
    .aks-target-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 600;
    }
    .aks-pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 1px 7px;
      font-size: 10px;
      white-space: nowrap;
    }
    .aks-next-copy {
      font-size: 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      padding: 8px;
      max-height: 180px;
      overflow: auto;
    }
    .aks-suggest-box {
      width: 100%;
      min-height: 76px;
      resize: vertical;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--fg);
      font: 12px/1.45 var(--font, inherit);
    }
    .aks-suggest-box:focus {
      outline: none;
      border-color: var(--accent);
    }
    .aks-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .aks-btn {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--fg);
      padding: 7px 12px;
      font-size: 12px;
      cursor: pointer;
      font-family: var(--font, inherit);
      line-height: 1.2;
    }
    .aks-btn:hover {
      border-color: var(--accent);
    }
    .aks-btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .aks-section-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 10px;
    }
    .aks-section-title {
      font-size: 13px;
      font-weight: 650;
    }
    .aks-subtle,
    .aks-empty {
      font-size: 11px;
      color: var(--fg2);
    }
    .aks-list {
      display: grid;
      gap: 6px;
    }
    .aks-list-row {
      display: grid;
      grid-template-columns: minmax(160px, .85fr) minmax(160px, 1.15fr);
      gap: 8px;
      align-items: start;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      padding: 8px;
      min-width: 0;
    }
    .aks-list-main,
    .aks-list-note,
    .aks-list-links {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .aks-list-main {
      font-size: 12px;
      font-weight: 550;
      white-space: nowrap;
    }
    .aks-list-note {
      color: var(--fg2);
      font-size: 11px;
      line-height: 1.4;
    }
    .aks-list-links {
      grid-column: 1 / -1;
      font-size: 10px;
    }
    .aks-feature-toolbar {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin: 0 0 10px;
    }
    .aks-gap-line {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      color: var(--fg2);
      font-size: 11px;
      line-height: 1.35;
    }
    .aks-gap-label {
      color: var(--fg);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .05em;
      white-space: nowrap;
    }
    .aks-audit-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }
    .aks-audit-box {
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      padding: 8px;
      min-width: 0;
    }
    .aks-audit-box-title {
      color: var(--fg2);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .05em;
      margin-bottom: 5px;
    }
    .aks-feature-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .aks-feature-table th {
      text-align: left;
      padding: 7px 8px;
      color: var(--fg2);
      font-weight: 500;
      border-bottom: 1px solid var(--border);
    }
    .aks-feature-table td {
      padding: 7px 8px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    .aks-feature-page {
      display: grid;
      gap: 14px;
    }
    .aks-feature-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
    }
    .aks-feature-title {
      font-size: 20px;
      font-weight: 650;
      line-height: 1.25;
      margin: 4px 0;
    }
    .aks-detail-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, .65fr);
      gap: 12px;
    }
    .aks-path-stack {
      display: grid;
      gap: 8px;
    }
    .aks-evidence-card {
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      padding: 10px;
      min-width: 0;
    }
    .aks-evidence-title {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
      overflow-wrap: anywhere;
    }
    .aks-evidence-meta {
      font-size: 10px;
      color: var(--fg2);
      font-family: var(--mono);
      margin-bottom: 5px;
    }
    .aks-step-row {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding: 8px 0;
      font-size: 12px;
    }
    .aks-step-row:last-child {
      border-bottom: 0;
    }
    .aks-step-index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--bg);
      color: var(--fg2);
      font-size: 11px;
    }
    .aks-step-status {
      color: var(--green);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    .aks-step-status-next {
      color: var(--accent);
    }
    .aks-map-grid {
      display: grid;
      grid-template-columns: minmax(190px, 1fr) 28px minmax(220px, 1.05fr) 28px minmax(190px, 1fr) minmax(150px, .75fr);
      gap: 8px;
      align-items: stretch;
    }
    .aks-replan-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(260px, .9fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .aks-replan-list {
      display: grid;
      gap: 6px;
      max-height: 330px;
      overflow: auto;
      padding-right: 4px;
    }
    .aks-replan-row {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px;
      background: var(--bg);
    }
    .aks-replan-title {
      font-size: 12px;
      font-weight: 600;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .aks-map-cell {
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      padding: 8px;
      min-width: 0;
    }
    .aks-feature-cell {
      border-left: 3px solid var(--fg2);
    }
    .aks-map-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--fg2);
    }
    .aks-map-evidence {
      overflow: hidden;
    }
    @media (max-width: 900px) {
      .aks-command-grid,
      .aks-work-grid {
        grid-template-columns: 1fr;
      }
      .aks-project-brief {
        grid-row: auto;
      }
      .aks-map-grid {
        grid-template-columns: 1fr;
      }
      .aks-replan-grid {
        grid-template-columns: 1fr;
      }
      .aks-map-head,
      .aks-map-arrow {
        display: none;
      }
      .aks-list-row {
        grid-template-columns: 1fr;
      }
      .aks-audit-grid {
        grid-template-columns: 1fr;
      }
      .aks-feature-hero,
      .aks-detail-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

async function renderAksRpE2eQualityPanel(el) {
  ensureAksRpE2ePanelStyles();
  const currentRoute = syncAksRpE2eRouteSelection();
  const res = await fetch(`/api/projects/content?path=${encodeURIComponent(_projectDetailPath)}`);
  const data = await res.json();
  const content = data.content || '';
  const goal = extractProjectSection(content, 'Goal');
  const weaknesses = extractProjectSection(content, ['Weaknesses', 'Active Weaknesses']);
  const validation = extractProjectSection(content, 'Validation');
  const plan = extractProjectSection(content, 'Plan');
  const currentState = extractProjectSection(content, 'Current State');
  const currentPhase = extractProjectSection(content, 'Current Phase');
  const nextAction = extractProjectSection(content, 'Next Action');
  let model = null;
  let pathSummary = null;
  let testSpecIndex = null;
  let modelError = '';
  try {
    const modelRes = await fetch(`/api/projects/artifact?path=${encodeURIComponent(_projectDetailPath)}&file=${encodeURIComponent('model/knowledge-map/model.json')}`);
    const modelData = await modelRes.json();
    if (!modelRes.ok || modelData.error) throw new Error(modelData.error || `HTTP ${modelRes.status}`);
    model = JSON.parse(modelData.content || '{}');
  } catch (e) {
    try {
      const legacyRes = await fetch(`/api/projects/artifact?path=${encodeURIComponent(_projectDetailPath)}&file=${encodeURIComponent('evidence/archive/e2e-capability-model.json')}`);
      const legacyData = await legacyRes.json();
      if (!legacyRes.ok || legacyData.error) throw new Error(legacyData.error || `HTTP ${legacyRes.status}`);
      model = JSON.parse(legacyData.content || '{}');
    } catch (legacyError) {
      modelError = legacyError?.message || e?.message || String(e);
    }
  }
  try {
    const pathRes = await fetch(`/api/projects/artifact?path=${encodeURIComponent(_projectDetailPath)}&file=${encodeURIComponent('model/knowledge-map/views/path-summary.json')}`);
    const pathData = await pathRes.json();
    if (pathRes.ok && !pathData.error) pathSummary = JSON.parse(pathData.content || '{}');
  } catch (_) {
    pathSummary = null;
  }
  try {
    const specRes = await fetch(`/api/projects/artifact?path=${encodeURIComponent(_projectDetailPath)}&file=${encodeURIComponent('specs/index.json')}`);
    const specData = await specRes.json();
    if (specRes.ok && !specData.error) testSpecIndex = JSON.parse(specData.content || '{}');
  } catch (_) {
    testSpecIndex = null;
  }

  // Feature packet cache (lazy-loaded per feature group)
  const featurePacketCache = {};
  async function loadFeaturePacket(packetId) {
    if (featurePacketCache[packetId] !== undefined) return featurePacketCache[packetId];
    try {
      const pktRes = await fetch(`/api/projects/artifact?path=${encodeURIComponent(_projectDetailPath)}&file=${encodeURIComponent('features/' + packetId + '.yaml')}`);
      const pktData = await pktRes.json();
      if (!pktRes.ok || pktData.error) { featurePacketCache[packetId] = null; return null; }
      featurePacketCache[packetId] = pktData.content || '';
      return featurePacketCache[packetId];
    } catch (_) {
      featurePacketCache[packetId] = null;
      return null;
    }
  }

  // Simple YAML section extractor for feature packets
  function extractYamlSection(yaml, sectionKey) {
    if (!yaml) return null;
    const regex = new RegExp('^' + sectionKey + ':\\s*$', 'm');
    const match = yaml.match(regex);
    if (!match) return null;
    const start = match.index + match[0].length;
    const rest = yaml.slice(start);
    // Find next top-level key (non-indented, not blank)
    const endMatch = rest.match(/\n[a-zA-Z]/);
    const block = endMatch ? rest.slice(0, endMatch.index) : rest;
    return block.trim() || null;
  }

  // Extract claims from a groundTruth role section
  function extractRoleClaims(yaml, role) {
    if (!yaml) return [];
    const section = extractYamlSection(yaml, 'groundTruth');
    if (!section) return [];
    const roleRegex = new RegExp('^  ' + role + ':\\s*$', 'm');
    const roleMatch = section.match(roleRegex);
    if (!roleMatch) return [];
    const start = roleMatch.index + roleMatch[0].length;
    const rest = section.slice(start);
    // Find next sibling role (2-space indented key)
    const endMatch = rest.match(/\n  [a-zA-Z]/);
    const block = endMatch ? rest.slice(0, endMatch.index) : rest;
    // Parse entries: each starts with "    - path:" or "    - path:" or "    - id:"
    const entries = [];
    const entryBlocks = block.split(/\n    - /);
    for (const eb of entryBlocks) {
      const trimmed = eb.trim();
      if (!trimmed) continue;
      const pathMatch = trimmed.match(/^path:\s*(.+)/m);
      const scenarioMatch = trimmed.match(/^\s*scenario:\s*(.+)/m);
      const claimMatch = trimmed.match(/claim:\s*>\s*\n([\s\S]*?)$/m) || trimmed.match(/claim:\s*>\s*\n?([\s\S]*?)$/m) || trimmed.match(/claim:\s*(.+)/m);
      const claim = claimMatch ? claimMatch[1].replace(/\n\s+/g, ' ').trim() : null;
      entries.push({
        path: pathMatch ? pathMatch[1].trim() : null,
        scenario: scenarioMatch ? scenarioMatch[1].trim() : null,
        claim: claim || null,
      });
    }
    return entries.filter(e => e.claim);
  }

  // Extract list items from a YAML section (simple indented list)
  function extractYamlList(yaml, sectionPath) {
    const parts = sectionPath.split('.');
    let section = yaml;
    for (const part of parts) {
      section = extractYamlSection(section, part);
      if (!section) return [];
    }
    const items = [];
    for (const line of (section || '').split('\n')) {
      const m = line.match(/^\s+- (.+)/);
      if (m) items.push(m[1].trim());
    }
    return items;
  }

  // Extract knownContradictions
  function extractContradictions(yaml) {
    if (!yaml) return [];
    const section = extractYamlSection(yaml, 'knownContradictions');
    if (!section) return [];
    const entries = [];
    const blocks = section.split(/\n  - /);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const claimMatch = trimmed.match(/claim:\s*>\s*\n([\s\S]*?)(?:\n\s*currentResolution:|$)/m) || trimmed.match(/claim:\s*(.+)/m);
      const resMatch = trimmed.match(/currentResolution:\s*>\s*\n([\s\S]*?)$/m) || trimmed.match(/currentResolution:\s*(.+)/m);
      const claim = claimMatch ? claimMatch[1].replace(/\n\s+/g, ' ').trim() : null;
      const resolution = resMatch ? resMatch[1].replace(/\n\s+/g, ' ').trim() : null;
      if (claim) entries.push({ claim, resolution });
    }
    return entries;
  }

  // Extract judgment rules
  function extractJudgmentRules(yaml) {
    if (!yaml) return {};
    const section = extractYamlSection(yaml, 'judgmentRules');
    if (!section) return {};
    const rules = {};
    for (const ruleKey of ['implementationIssueWhen', 'testIssueWhen', 'environmentIssueWhen', 'sourceDocMismatchWhen']) {
      const items = [];
      const keyRegex = new RegExp('^  ' + ruleKey + ':\\s*$', 'm');
      const keyMatch = section.match(keyRegex);
      if (!keyMatch) continue;
      const start = keyMatch.index + keyMatch[0].length;
      const rest = section.slice(start);
      const endMatch = rest.match(/\n  [a-zA-Z]/);
      const block = endMatch ? rest.slice(0, endMatch.index) : rest;
      for (const part of block.split(/\n    - >/)) {
        const text = part.replace(/\n\s+/g, ' ').trim();
        if (text) items.push(text);
      }
      if (items.length) rules[ruleKey] = items;
    }
    return rules;
  }

  // Extract inputPaths accepted/rejected/unknown
  function extractInputPaths(yaml) {
    if (!yaml) return { accepted: [], rejected: [], unknown: [] };
    const section = extractYamlSection(yaml, 'inputPaths');
    if (!section) return { accepted: [], rejected: [], unknown: [] };
    const result = { accepted: [], rejected: [], unknown: [] };
    for (const subKey of ['accepted', 'rejectedOrDiagnostic', 'unknown']) {
      const items = [];
      const keyRegex = new RegExp('^  ' + subKey + ':\\s*$', 'm');
      const keyMatch = section.match(keyRegex);
      if (!keyMatch) continue;
      const start = keyMatch.index + keyMatch[0].length;
      const rest = section.slice(start);
      const endMatch = rest.match(/\n  [a-zA-Z]/);
      const block = endMatch ? rest.slice(0, endMatch.index) : rest;
      if (subKey === 'unknown') {
        for (const line of block.split('\n')) {
          const m = line.match(/^\s+- (.+)/);
          if (m) items.push({ id: m[1].trim() });
        }
      } else {
        const entries = block.split(/\n    - /);
        for (const entry of entries) {
          const t = entry.trim();
          if (!t) continue;
          const idM = t.match(/^id:\s*(.+)/m);
          const surfM = t.match(/surface:\s*(.+)/m);
          const opM = t.match(/operation:\s*(.+)/m);
          const bodyM = t.match(/requestBody:\s*'(.+?)'/m);
          const diagM = t.match(/expectedDiagnosis:\s*(.+)/m);
          items.push({
            id: idM ? idM[1].trim() : null,
            surface: surfM ? surfM[1].trim() : null,
            operation: opM ? opM[1].trim() : null,
            requestBody: bodyM ? bodyM[1].trim() : null,
            diagnosis: diagM ? diagM[1].trim() : null,
          });
        }
      }
      const outKey = subKey === 'rejectedOrDiagnostic' ? 'rejected' : subKey;
      result[outKey] = items;
    }
    return result;
  }
  // ── Helpers ──

  function resultColor(status) {
    if (status === 'pass') return 'var(--green)';
    if (status === 'fail') return 'var(--red)';
    if (status === 'blocked') return 'var(--yellow)';
    if (status === 'unknown') return 'var(--fg2)';
    return 'var(--fg2)';
  }

  function resultIcon(status) {
    if (status === 'pass') return '<span style="color:var(--green)">●</span>';
    if (status === 'fail') return '<span style="color:var(--red)">✗</span>';
    if (status === 'blocked') return '<span style="color:var(--yellow)">◐</span>';
    if (status === 'uncovered') return '<span style="color:var(--fg2)">○</span>';
    return '<span style="color:var(--fg2)">?</span>';
  }

  function statusName(status) {
    if (status === 'pass') return 'Pass';
    if (status === 'fail') return 'Fail';
    if (status === 'blocked') return 'Blocked';
    if (status === 'unknown') return 'Unknown';
    if (status === 'uncovered') return 'Uncovered';
    return status || 'Unknown';
  }

  function assignmentValue(path, variable) {
    return (path || []).find(a => a.variable === variable)?.value;
  }

  function assignmentPath(path) {
    return (path || []).map(a => `${a.variable}=${a.value}`).join(' → ');
  }

  function pathStatusFromSummary(paths) {
    if (!paths || !paths.length) return '';
    for (const status of ['fail', 'blocked', 'unknown', 'pass']) {
      if (paths.some(path => path.status === status)) return status;
    }
    return 'unknown';
  }

  function deriveFeatureStatus(feature, tests, paths = []) {
    const linked = tests.filter(t => t.featureId === feature.id);
    if (linked.length === 0 && paths.length === 0) return { status: 'uncovered', tests: linked };
    for (const status of ['fail', 'blocked', 'unknown', 'pass']) {
      if (linked.some(t => t.result === status)) return { status, tests: linked };
      if (paths.some(path => path.status === status)) return { status, tests: linked };
    }
    return { status: 'unknown', tests: linked };
  }

  function missingBranches(feature, tests, variables) {
    const linked = tests.filter(t => t.featureId === feature.id);
    const suggestions = [];
    for (const assignment of feature.inputPath || []) {
      const variable = (variables || []).find(v => v.id === assignment.variable);
      if (!variable || !Array.isArray(variable.domain) || variable.domain.length < 2) continue;
      const observed = new Set(linked.map(t => assignmentValue(t.inputPath, assignment.variable)).filter(Boolean));
      for (const value of variable.domain) {
        if (!observed.has(value)) suggestions.push(`${assignment.variable}=${value}`);
      }
    }
    return [...new Set(suggestions)].slice(0, 3);
  }

  function nextQuestion(row, variables) {
    const status = row.status;
    const tests = row.tests || [];
    if (status === 'uncovered') return 'Run first probe for this feature.';
    if (status === 'unknown') return 'Resolve unknown result.';
    if (status === 'blocked') return 'Unblock, then rerun.';
    if (status === 'fail') {
      const latest = tests.find(t => t.result === 'fail') || tests[0];
      const blocker = latest?.diagnosis?.kind;
      return blocker ? `Investigate diagnosis=${blocker}.` : 'Classify failure diagnosis.';
    }
    const missing = missingBranches(row.feature, tests, variables);
    return missing.length ? `Probe missing branch: ${missing[0]}.` : '';
  }

  function rowEvidenceIds(row) {
    return [...new Set([
      ...(row.judgments || []).flatMap(j => j.evidence || []),
      ...(row.tests || []).flatMap(t => t.evidence || []),
      ...(row.paths || []).flatMap(path => path.evidence || []),
    ])];
  }

  function latestJudgment(row) {
    return (row.judgments || [])[0] || null;
  }

  function featureGap(row, variables) {
    const judgment = latestJudgment(row);
    if (judgment?.nextAction) return judgment.nextAction;
    if (judgment?.diagnosis?.summary) return judgment.diagnosis.summary;
    const unknownPath = (row.paths || []).find(path => path.status === 'unknown');
    if (unknownPath?.notes) return unknownPath.notes;
    const failingPath = (row.paths || []).find(path => path.status === 'fail');
    if (failingPath?.notes) return failingPath.notes;
    if (row.status === 'pass') {
      const missing = missingBranches(row.feature, row.tests || [], variables);
      return missing.length ? `Passed current claim; missing branch ${missing[0]}.` : 'No active gap for the current claim.';
    }
    return nextQuestion(row, variables) || 'Needs triage.';
  }

  // ── Derived per-path next action ──
  // Determines the single next recommended action for a knowledge path based
  // on where the golden-path chain has gaps.
  function derivePathNextAction(path) {
    const chain = deriveGoldenPathChain(path);
    if (!chain.source) return 'Ground path in Go e2e / API / docs source';
    if (!chain.packet) return 'Create or link feature packet';
    if (!chain.spec) return 'Generate test spec';
    if (!chain.plan) return 'Create run plan';
    if (!chain.probe) return 'Generate test script (REST-first probe)';
    if (!chain['local-check']) return 'Run local --check preflight';
    if (!chain['cloud-replay']) return 'Request gated REST staging replay';
    if (!chain.cleanup) return 'Verify cleanup and record final evidence';
    if (path.status === 'fail') return 'Classify failure (product / probe / env / doc)';
    if (path.status === 'unknown') return 'Triage unknown status with evidence audit';
    if (path.status === 'blocked') return 'Resolve blocker precondition';
    return 'Chain complete — maintain or extend coverage';
  }

  // ── Feature-level confidence metric ──
  // Derives high / medium / low from pass/fail/unknown/blocked path ratios.
  function deriveFeatureConfidence(group) {
    const paths = group.paths || [];
    if (!paths.length) return { level: 'low', reason: 'No knowledge paths mapped' };
    const counts = { pass: 0, fail: 0, unknown: 0, blocked: 0 };
    for (const p of paths) counts[p.status] = (counts[p.status] || 0) + 1;
    const total = paths.length;
    const passRatio = counts.pass / total;
    const failRatio = counts.fail / total;
    const unknownRatio = counts.unknown / total;
    if (passRatio >= 0.7 && counts.unknown === 0 && counts.blocked === 0) {
      return { level: 'high', reason: `${counts.pass}/${total} paths pass, no unknowns` };
    }
    if (passRatio >= 0.4 && unknownRatio <= 0.3) {
      return { level: 'medium', reason: `${counts.pass} pass, ${counts.unknown} unknown, ${counts.fail} fail of ${total}` };
    }
    return { level: 'low', reason: `${counts.pass} pass, ${counts.unknown} unknown, ${counts.fail} fail, ${counts.blocked} blocked of ${total}` };
  }

  // ── Feature-level recommended next move ──
  // Picks the highest-priority unknown/blocked/fail path's next action.
  function deriveFeatureNextMove(group) {
    const paths = group.paths || [];
    if (!paths.length) return 'Map knowledge paths from source/API/docs';
    // Prioritize: unknown > blocked > fail > pass
    const priority = ['unknown', 'blocked', 'fail', 'pass'];
    for (const status of priority) {
      const target = paths.find(p => p.status === status);
      if (target) return `[${target.id || target.featureLabel}] ${derivePathNextAction(target)}`;
    }
    return 'All paths complete — maintain or extend coverage';
  }

  function statusTextWithClaim(row) {
    const tests = row.tests || [];
    const envs = [...new Set([
      ...tests.map(t => assignmentValue(t.contextPath, 'observation.environment')).filter(Boolean),
      ...(row.judgments || []).map(j => assignmentValue(j.contextPath, 'observation.environment')).filter(Boolean),
    ])];
    const envText = envs.length ? ` in ${envs.join(', ')}` : '';
    if (row.status === 'pass') return `Claim passes${envText}.`;
    if (row.status === 'blocked') return `Blocked${envText}; not a product verdict.`;
    if (row.status === 'fail') return `Failing${envText}; classify product vs probe/env/doc.`;
    if (row.status === 'unknown') return `Unknown${envText}; needs source-backed probe or audit.`;
    if (row.status === 'uncovered') return 'No evidence mapped yet.';
    return statusName(row.status);
  }

  function featureActionPrompt(kind, group) {
    const ids = group.rows.map(r => r.feature.id).join(', ');
    const label = group.label || group.id;
    if (kind === 'audit') {
      return `[resume] Audit aks-rp-e2e feature ${label} (${ids}). Check source intent, API/docs references, input path, expectation path, mapped evidence, raw output, cleanup, and whether the current status claim is honest. Report gaps before changing the model.`;
    }
    if (kind === 'manual') {
      return `[resume] Produce a manual verification path for aks-rp-e2e feature ${label} (${ids}). Use existing run plans/replays/scripts when available; otherwise draft exact commands, prerequisites, expected observations, cleanup, and evidence files. Do not mutate cloud resources until preflight is clean.`;
    }
    if (kind === 'suggest') {
      return `[resume] Consider making aks-rp-e2e feature ${label} (${ids}) the next project move. Evaluate status, gap value, source/API/docs grounding, execution cost, environment risk, cleanup risk, and whether it beats current .app/project.json Next Action. Update .app/project.json only if it is a better direction; otherwise explain why in .app/discussion.jsonl.`;
    }
    return `[resume] Challenge the current aks-rp-e2e status for feature ${label} (${ids}). Look for misleading evidence, stale results, missing source references, unclaimed branches, cleanup uncertainty, and product/probe/environment/doc mismatches.`;
  }

  // ── Human Input Actions ──
  // These generate context-rich prompts scoped to a feature/path so the user
  // doesn't need to manually assemble ids, file paths, or evidence links.

  function featureInputPrompt(kind, group) {
    const ids = group.rows.map(r => r.feature.id).join(', ');
    const label = group.label || group.id;
    const packetPath = `features/${group.id}.yaml`;
    const paths = (group.paths || []).map(p => p.id);
    const pathList = paths.length ? `\n\nKnowledge paths:\n${paths.map(p => `- ${p}`).join('\n')}` : '';
    const evidenceIds = [...new Set(group.rows.flatMap(rowEvidenceIds))];
    const evidenceList = evidenceIds.length ? `\n\nExisting evidence: ${evidenceIds.slice(0, 5).join(', ')}${evidenceIds.length > 5 ? ` (+${evidenceIds.length - 5} more)` : ''}` : '';

    if (kind === 'add-reference') {
      return `[resume] Add or correct a source reference for aks-rp-e2e feature ${label} (${ids}).

Feature packet: ${packetPath}
Model: model/knowledge-map/model.json${pathList}${evidenceList}

The user wants to add a reference. Prompt: what is the reference type (PRD/design/API-spec/public-docs/Go-e2e-source/RP-source/bug-PR)? What is the URL or file path? What claim does this reference prove or contradict? Update ${packetPath} groundTruth section with the new reference and extracted claim. Validate model after update.`;
    }
    if (kind === 'add-expected-behavior') {
      return `[resume] Add or correct expected behavior for aks-rp-e2e feature ${label} (${ids}).

Feature packet: ${packetPath}
Model: model/knowledge-map/model.json${pathList}

The user wants to document an expected behavior that is missing or incorrectly recorded. Prompt: which input path does this behavior apply to? What is the expected outcome (accepted/rejected/persisted/defaulted/error-shape/cleanup)? What source backs this expectation? Update the feature packet and model path behavior entries. Do not change model verdicts without execution evidence.`;
    }
    if (kind === 'mark-source-of-truth') {
      return `[resume] Mark or change the source of truth for aks-rp-e2e feature ${label} (${ids}).

Feature packet: ${packetPath}
Model: model/knowledge-map/model.json${pathList}${evidenceList}

The user wants to designate which source is authoritative for this feature's contract. Options: RP source code, public API spec, public docs, Go e2ev3 test, design doc, or PRD. Update ${packetPath} judgmentRules to reflect which source wins when sources disagree. If this changes any existing contradiction resolutions, flag them for review.`;
    }
    if (kind === 'suggest-missing-path') {
      return `[resume] The user believes aks-rp-e2e feature ${label} (${ids}) is missing an input/expectation path.

Feature packet: ${packetPath}
Model: model/knowledge-map/model.json
Current paths:${pathList || '\n- (none)'}

Prompt: what input shape or operation is missing? (e.g. update-in-place, delete-while-running, negative-validation, migration, runtime-constraint, cleanup-after-failure) What is the expected behavior? What source backs this? Add the path to ${packetPath} inputPaths and create a corresponding entry in the model. Do not generate a test spec or probe until the path is reviewed.`;
    }
    if (kind === 'make-next') {
      return `[resume] The user wants to make aks-rp-e2e feature ${label} (${ids}) the next project direction.

Feature packet: ${packetPath}
Model: model/knowledge-map/model.json${pathList}${evidenceList}

Evaluate this feature's readiness: does it have source-backed references, enumerated input paths, test specs, and a clear execution path? If yes, update .app/project.json Next Action to target this feature. If not, list what is missing before it can become the next move. Do not skip the evaluation.`;
    }
    return '';
  }

  function featureReviewPrompt(kind, group) {
    const ids = group.rows.map(r => r.feature.id).join(', ');
    const label = group.label || group.id;
    const packetPath = `features/${group.id}.yaml`;
    const paths = (group.paths || []).map(p => p.id);
    const pathList = paths.length ? `\n\nKnowledge paths:\n${paths.map(p => `- ${p}`).join('\n')}` : '';
    const evidenceIds = [...new Set(group.rows.flatMap(rowEvidenceIds))];
    const evidenceList = evidenceIds.length ? `\n\nEvidence artifacts: ${evidenceIds.slice(0, 8).join(', ')}` : '';
    const specs = specsForPaths(group.paths || []);
    const specList = specs.length ? `\n\nTest specs:\n${specs.map(s => `- ${s.id}: ${s.title || '(untitled)'}`).join('\n')}` : '';

    if (kind === 'review-spec') {
      return `[resume] Review generated test spec(s) for aks-rp-e2e feature ${label} (${ids}).

Feature packet: ${packetPath}${specList}${pathList}

For each test spec: Is the scenario intent correct? Are the assertions source-backed? Is the compatible group key accurate? Are cleanup expectations documented? Are there assertions that assume behavior not proven by source? Mark each spec as reviewed or flag issues. Do not approve specs with ungrounded assertions.`;
    }
    if (kind === 'review-script') {
      const probeRefs = specs.flatMap(s => (s.sourceRefs || []).filter(r => r.includes('replays/')));
      const probeList = probeRefs.length ? `\n\nReplay scripts:\n${probeRefs.map(r => `- ${r}`).join('\n')}` : '';
      return `[resume] Review generated replay script(s) for aks-rp-e2e feature ${label} (${ids}).

Feature packet: ${packetPath}${specList}${probeList}${pathList}

For each probe/replay script: Does the TypeScript match the test spec assertions? Are REST calls using the correct API version and resource path? Is the cleanup path safe? Are gate checks (--check, DRY_RUN, ALLOW_CLOUD_MUTATION) properly wired? Does the script handle auth failure gracefully? Mark each script as reviewed or flag issues.`;
    }
    if (kind === 'generate-script') {
      return `[resume] aks-explorer: Generate a REST-first test script (run-plan and probe) for aks-rp-e2e feature ${label} (${ids}).

Feature packet: ${packetPath}${specList}${pathList}

⚠️ This generates a script artifact only — it does NOT execute cloud mutation.

Requirements:
1. Produce a run-plan referencing the test spec assertions and knowledge paths
2. Generate a TypeScript REST probe with correct API version, resource path, and request body
3. Wire execution gates: --check mode, DRY_RUN=1 default, ALLOW_CLOUD_MUTATION guard
4. Include cleanup expectations and rollback steps
5. Include ARM auth verification as a pre-step
6. Output the script to the appropriate replays/ directory

The generated script is an unverified artifact until reviewed and approved. Do not label it as verified product behavior.`;
    }
    if (kind === 'request-staging') {
      return `[resume] Request gated REST staging test for aks-rp-e2e feature ${label} (${ids}).

Feature packet: ${packetPath}${specList}${pathList}${evidenceList}

⚠️ This is an approval request, not a direct execution command.

Prerequisites for staging execution:
1. Test spec must be reviewed and approved
2. Replay script must be reviewed and approved
3. Internal project-owner preflight must be clean
4. ARM auth must be verified on the execution host
5. Cleanup path must be documented
6. ALLOW_CLOUD_MUTATION gate variable must be explicitly set

State which prerequisites are met and which are not. If internal preflight is missing or stale, create the owner-agent preflight task before staging. If all are met, produce the exact gated execution command with run-id, gate env vars, and cleanup verification steps. Do NOT execute — only produce the approval artifact for human review.`;
    }
    if (kind === 'classify-result') {
      return `[resume] Classify execution result for aks-rp-e2e feature ${label} (${ids}).

Feature packet: ${packetPath}${pathList}${evidenceList}

Review the latest execution evidence. Classify each assertion result as one of:
- product-behavior: the AKS RP behaved differently than documented/expected
- test-probe-issue: the probe/script had a bug or wrong assertion
- environment-blocker: auth, capacity, quota, or infra prevented execution
- source-doc-mismatch: the source/docs disagree about expected behavior
- needs-human-judgment: classification requires domain expertise

For each classification, cite the specific evidence artifact and the specific assertion. Do not change model status without this classification.`;
    }
    if (kind === 'approve-model-update') {
      return `[resume] Approve model update for aks-rp-e2e feature ${label} (${ids}).

Feature packet: ${packetPath}
Model: model/knowledge-map/model.json${pathList}${evidenceList}

⚠️ Model status changes require evidence context.

Review the proposed model changes:
1. What path statuses would change? (e.g. unknown→pass, unknown→fail, blocked→pass)
2. What evidence supports each change?
3. Are there any contradictions with existing judgments?
4. Does the feature packet need updating to reflect new findings?
5. Is cleanup confirmed for any staging/live execution?

Approve only changes backed by cited evidence. Reject changes that lack evidence or contradict existing source-of-truth references.`;
    }
    return '';
  }

  function pathReviewPrompt(kind, path) {
    const label = path.featureLabel || path.featureId || path.id;
    const spec = testSpecForPath(path.id);
    const specInfo = spec ? `\nTest spec: ${spec.id} (${spec.title || 'untitled'}, ${spec.assertionCount || 0} assertions)` : '\nTest spec: none';
    const probeRef = findProbeForPath(path.id);
    const probeInfo = probeRef ? `\nReplay script: ${probeRef}` : '\nReplay script: none';
    const runPlanRef = findRunPlanForPath(path.id);
    const runPlanInfo = runPlanRef ? `\nRun plan: ${runPlanRef}` : '\nRun plan: none';
    const evidenceIds = (path.evidence || []).slice(0, 8);
    const evidenceInfo = evidenceIds.length ? `\nEvidence: ${evidenceIds.join(', ')}` : '\nEvidence: none';

    if (kind === 'review-spec') {
      return `[resume] Review the test spec for aks-rp-e2e knowledge path ${path.id} (${label}).${specInfo}${runPlanInfo}

Is the scenario intent correct for this input shape? Are assertions grounded in source references? Is the compatible group key accurate for combining with other paths? Flag ungrounded assertions or missing cleanup expectations.`;
    }
    if (kind === 'review-script') {
      return `[resume] Review the replay script for aks-rp-e2e knowledge path ${path.id} (${label}).${specInfo}${probeInfo}${runPlanInfo}

Does the TypeScript match the test spec? Are REST calls correct (API version, resource path, request body)? Is cleanup safe? Are execution gates (--check, DRY_RUN, ALLOW_CLOUD_MUTATION) wired? Does it handle auth failure?`;
    }
    if (kind === 'generate-script') {
      return `[resume] aks-explorer: Generate a REST-first test script (run-plan and probe) for aks-rp-e2e knowledge path ${path.id} (${label}).${specInfo}${runPlanInfo}

⚠️ This generates a script artifact only — it does NOT execute cloud mutation.

Requirements:
1. Produce a run-plan referencing the test spec assertions for this path
2. Generate a TypeScript REST probe with correct API version, resource path, and request body
3. Wire execution gates: --check mode, DRY_RUN=1 default, ALLOW_CLOUD_MUTATION guard
4. Include cleanup expectations and rollback steps
5. Include ARM auth verification as a pre-step
6. Scope to path ${path.id} and scenario ${path.scenarioId || 'unknown'}

The generated script is an unverified artifact until reviewed and approved. Do not label it as verified product behavior.`;
    }
    if (kind === 'request-staging') {
      return `[resume] Request gated REST staging test for aks-rp-e2e path ${path.id} (${label}).${specInfo}${probeInfo}${runPlanInfo}${evidenceInfo}

⚠️ Approval request only — do NOT execute.

Check prerequisites: spec reviewed, script reviewed, internal project-owner preflight clean, ARM auth verified, cleanup documented, ALLOW_CLOUD_MUTATION gate set. If internal preflight is missing or stale, create the owner-agent preflight task before staging. Produce the exact gated command only if all met. Do not execute.`;
    }
    if (kind === 'classify-result') {
      return `[resume] Classify result for aks-rp-e2e path ${path.id} (${label}).${evidenceInfo}

Classify each assertion as: product-behavior, test-probe-issue, environment-blocker, source-doc-mismatch, or needs-human-judgment. Cite specific evidence.`;
    }
    if (kind === 'approve-model-update') {
      return `[resume] Approve model update for aks-rp-e2e path ${path.id} (${label}).

Current status: ${path.status}${specInfo}${evidenceInfo}

⚠️ Status changes require evidence. What would change? What evidence supports it? Any contradictions? Approve only with cited evidence.`;
    }
    return '';
  }

  function pathActionPrompt(kind, path) {
    const label = path.featureLabel || path.featureId || path.id;
    if (kind === 'audit') {
      return `[resume] Audit aks-rp-e2e knowledge path ${path.id} (${label}). Verify scenario ${path.scenarioId}, selected input DAG nodes, expected/observed behavior alignments, evidence links, cleanup, and whether status=${path.status} is honest. Do not change product verdicts without source/evidence support.`;
    }
    if (kind === 'verify') {
      return `[resume] Produce the next verification plan for aks-rp-e2e knowledge path ${path.id} (${label}). Include docs/source/API references, exact inputs, expected behavior, scripted probe or manual steps, execution gates, cleanup, evidence files, and model-update rules. Do not run cloud mutation unless explicitly authorized.`;
    }
    if (kind === 'suggest') {
      return `[resume] Consider path ${path.id} (${label}) as the next aks-rp-e2e project move. Compare it against current gaps by value, source grounding, execution cost, environment risk, cleanup risk, and model impact. Update .app/project.json only if it should become the next direction; otherwise record why not.`;
    }
    return `[resume] Challenge aks-rp-e2e knowledge path ${path.id} (${label}). Look for incorrect scenario mapping, wrong input DAG selection, weak expected behavior, stale observed evidence, ambiguous alignment color, missing cleanup proof, or conflict with adjacent features.`;
  }

  function testSpecForPath(pathId) {
    return (testSpecIndex?.specs || []).find(spec => (spec.featurePathIds || []).includes(pathId)) || null;
  }

  function previewReplan(pathIds) {
    const uniqueIds = [...new Set(pathIds || [])];
    const pathById = Object.fromEntries((pathSummary?.paths || []).map(path => [path.id, path]));
    const accepted = [];
    const rejected = [];
    for (const pathId of uniqueIds) {
      const path = pathById[pathId];
      const spec = testSpecForPath(pathId);
      if (!path) {
        rejected.push({ pathId, reason: 'Path is missing from the knowledge-map path summary.' });
      } else if (!spec) {
        rejected.push({ pathId, reason: 'No test spec yet.' });
      } else {
        accepted.push({ path, spec });
      }
    }
    const groups = new Map();
    for (const item of accepted) {
      const key = item.spec.compatibleGroupKey || 'ungrouped';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const sortedGroups = [...groups.entries()].map(([key, items]) => ({
      key,
      items: items.slice().sort((a, b) => (a.spec.sequenceOrder || 0) - (b.spec.sequenceOrder || 0)),
    }));
    const baseline = accepted.length;
    const replanned = sortedGroups.length;
    const assertions = accepted.reduce((sum, item) => sum + (item.spec.assertionCount || 0), 0);
    return {
      accepted,
      rejected,
      groups: sortedGroups,
      metrics: {
        selected: uniqueIds.length,
        accepted: accepted.length,
        baseline,
        replanned,
        saved: Math.max(0, baseline - replanned),
        assertions,
        density: replanned ? Math.round((assertions / replanned) * 100) / 100 : 0,
      },
    };
  }

  function judgmentEnv(j) {
    return assignmentValue(j.contextPath, 'observation.environment') || '';
  }

  function shortName(name) {
    const parts = String(name || '').split(/[._]/).filter(Boolean);
    return parts.length ? parts.slice(-2).join('.') : String(name || '');
  }

  function sectionExcerpt(markdown, maxLines = 6) {
    return String(markdown || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .slice(0, maxLines)
      .join('\n');
  }

  function compactExcerpt(markdown, maxLines = 3, maxChars = 420) {
    const excerpt = sectionExcerpt(markdown, maxLines);
    if (excerpt.length <= maxChars) return excerpt;
    return excerpt.slice(0, maxChars - 3).trimEnd() + '...';
  }

  function extractTasks(markdown) {
    const tasks = [];
    let current = null;
    for (const line of String(markdown || '').split(/\r?\n/)) {
      const idMatch = line.match(/^- id:\s*(.+?)\s*$/);
      if (idMatch) {
        current = { id: idMatch[1].replace(/^["']|["']$/g, '') };
        tasks.push(current);
        continue;
      }
      if (!current) continue;
      const fieldMatch = line.match(/^\s+(status|result|assignee|attempts|goal):\s*(.*)$/);
      if (!fieldMatch) continue;
      current[fieldMatch[1]] = fieldMatch[2].replace(/^["']|["']$/g, '');
    }
    return tasks;
  }

  function pathChips(path, max = 4) {
    const assignments = path || [];
    const chips = assignments.slice(0, max).map(a => {
      const full = `${a.variable}=${a.value}`;
      return `<span style="display:inline-flex;max-width:220px;padding:2px 6px;border:1px solid var(--border);border-radius:999px;background:var(--bg);font-size:10px;font-family:var(--mono);color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${attrEsc(full)}">${esc(shortName(a.variable))}=${esc(a.value)}</span>`;
    });
    if (assignments.length > max) chips.push(`<span style="font-size:10px;color:var(--fg2)">+${assignments.length - max}</span>`);
    return chips.join(' ');
  }

  function summaryInputChips(inputs, max = 5) {
    const items = inputs || [];
    const chips = items.slice(0, max).map(input => {
      const full = input.label || `${input.variable}=${input.value}`;
      const short = input.variable ? `${shortName(input.variable)}=${input.value}` : input.id;
      return `<span style="display:inline-flex;max-width:220px;padding:2px 6px;border:1px solid var(--border);border-radius:999px;background:var(--bg);font-size:10px;font-family:var(--mono);color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${attrEsc(full)}">${esc(short)}</span>`;
    });
    if (items.length > max) chips.push(`<span style="font-size:10px;color:var(--fg2)">+${items.length - max}</span>`);
    return chips.join(' ');
  }

  function behaviorChips(behavior, max = 5) {
    const items = behavior || [];
    const chips = items.slice(0, max).map(item => {
      const color = item.alignment === 'match' ? 'var(--accent)' : item.alignment === 'mismatch' ? 'var(--red)' : item.alignment === 'blocked' ? 'var(--yellow)' : 'var(--fg2)';
      const impactTag = item.verdictImpact === 'audit' ? ' [audit]' : item.verdictImpact === 'claim' ? ' [claim]' : '';
      const label = `${shortName(item.variable)}: ${item.expected}${item.observed == null ? '' : ` -> ${item.observed}`}${impactTag}`;
      const full = `${item.variable}: expected=${item.expected}${item.observed == null ? '' : ` observed=${item.observed}`} alignment=${item.alignment}${item.verdictImpact ? ` verdictImpact=${item.verdictImpact}` : ''}`;
      const auditBorder = item.verdictImpact === 'audit' ? ';border-style:dashed' : '';
      return `<span style="display:inline-flex;max-width:260px;padding:2px 6px;border:1px solid ${color};border-radius:999px;background:var(--bg);font-size:10px;font-family:var(--mono);color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis${auditBorder}" title="${attrEsc(full)}">${esc(label)}</span>`;
    });
    if (items.length > max) chips.push(`<span style="font-size:10px;color:var(--fg2)">+${items.length - max}</span>`);
    return chips.join(' ');
  }

  function behaviorAlignmentColor(alignment) {
    if (alignment === 'match') return 'var(--accent)';
    if (alignment === 'mismatch') return 'var(--red)';
    if (alignment === 'blocked') return 'var(--yellow)';
    return 'var(--fg2)';
  }

  function miniMetric(label, value, color = 'var(--fg)') {
    return `<div class="aks-mini-metric">
      <div style="font-size:18px;font-weight:650;color:${color};line-height:1">${esc(value)}</div>
      <div class="aks-kicker" style="margin-top:4px">${esc(label)}</div>
    </div>`;
  }

  function evidenceLinks(ids) {
    if (!ids || !ids.length) return '';
    return ids.map(id => {
      const ev = evidenceById[id];
      if (!ev) return `<code style="font-size:10px">${esc(id)}</code>`;
      if (ev.kind === 'session' && ev.sessionId) {
        return `<a href="/projects/platform/ui/#/sessions/${encodeURIComponent(ev.sessionId)}" style="font-size:10px" title="${attrEsc(ev.summary || '')}">session ${esc(ev.sessionId)}</a>`;
      }
      if (ev.path) {
        const canonicalPath = ev.path.replace(/^outputs\//, 'evidence/archive/');
        return `<a href="/projects/aks-rp-e2e/${encodeURIComponent(canonicalPath)}" target="_blank" style="font-size:10px" title="${attrEsc(ev.summary || '')}">${esc(canonicalPath.replace(/^evidence\/outputs\//, ''))}</a>`;
      }
      return `<span style="font-size:10px" title="${attrEsc(ev.summary || '')}">${esc(ev.id)}</span>`;
    }).join(' ');
  }

  // ── Build model data ──

  if (!model) {
    el.innerHTML = `<div style="padding:20px;color:var(--fg2)">Capability model unavailable: ${esc(modelError)}</div>`;
    return;
  }

  const features = model.features || [];
  const tests = model.testCases || [];
  const judgments = model.judgments || [];
  const evidenceById = Object.fromEntries((model.evidence || []).map(e => [e.id, e]));
  const pathsByFeatureId = {};
  for (const path of pathSummary?.paths || model.featurePaths || []) {
    if (!path.featureId) continue;
    if (!pathsByFeatureId[path.featureId]) pathsByFeatureId[path.featureId] = [];
    pathsByFeatureId[path.featureId].push(path);
  }
  const statusPriority = ['fail', 'blocked', 'unknown', 'uncovered', 'pass'];

  // Group features
  const productFeatureGroups = [
    { prefix: 'managedsystem-pool-', id: 'managedsystem-pool', label: 'ManagedSystem Pool' },
    { prefix: 'managedsystem-', id: 'managedsystem-pool', label: 'ManagedSystem Pool' },
    { prefix: 'app-routing-', id: 'app-routing', label: 'App Routing' },
    { prefix: 'bootstrap-profile-', id: 'bootstrap-profile', label: 'Bootstrap Profile' },
    { prefix: 'node-autoprovision-', id: 'node-autoprovision', label: 'Node Auto Provisioning' },
    { prefix: 'oidc-issuer-', id: 'oidc-issuer', label: 'OIDC Issuer' },
    { prefix: 'workload-identity-', id: 'workload-identity', label: 'Workload Identity' },
    { prefix: 'workload-autoscaler-', id: 'workload-autoscaler', label: 'Workload Autoscaler' },
    { prefix: 'image-cleaner-', id: 'security-profile', label: 'Security Profile' },
    { prefix: 'node-restriction-', id: 'security-profile', label: 'Security Profile' },
    { prefix: 'virtualmachines-', id: 'virtualmachines-agentpool', label: 'VirtualMachines AgentPool' },
    { prefix: 'machines-agentpool-nap-', id: 'node-autoprovision', label: 'Node Auto Provisioning' },
    { prefix: 'machines-agentpool-', id: 'virtualmachines-agentpool', label: 'VirtualMachines AgentPool' },
  ];

  function featureGroupMeta(feature) {
    if (feature.groupId || feature.groupLabel) {
      return { id: feature.groupId || feature.id, label: feature.groupLabel || feature.label || feature.id };
    }
    const productGroup = productFeatureGroups.find(group => feature.id?.startsWith(group.prefix));
    if (productGroup) {
      return { id: productGroup.id, label: productGroup.label };
    }
    return { id: feature.id, label: feature.label || feature.id };
  }

  // Collect all environments
  const allEnvs = [...new Set([
    ...judgments.map(j => assignmentValue(j.contextPath, 'observation.environment')).filter(Boolean),
    ...tests.map(t => assignmentValue(t.contextPath, 'observation.environment')).filter(Boolean),
  ])].sort();
  const selectedEnv = sessionStorage.getItem('aksSelectedEnv') || 'all';

  // Filter judgments and tests by env
  function matchesEnv(contextPath) {
    if (selectedEnv === 'all') return true;
    const env = assignmentValue(contextPath, 'observation.environment');
    return env === selectedEnv || !env;
  }

  const filteredJudgments = judgments.filter(j => matchesEnv(j.contextPath));
  const filteredTests = tests.filter(t => matchesEnv(t.contextPath));

  const rows = features.map(feature => {
    const linkedJudgments = filteredJudgments.filter(j => j.featureId === feature.id);
    const featurePaths = pathsByFeatureId[feature.id] || [];
    const fallback = deriveFeatureStatus(feature, filteredTests, featurePaths);
    const status = linkedJudgments.length
      ? (statusPriority.find(s => linkedJudgments.some(j => j.status === s)) || 'unknown')
      : fallback.status;
    return { feature, status, tests: fallback.tests, judgments: linkedJudgments, paths: featurePaths };
  }).filter(row => {
    // When filtering by env, hide features with no data in that env
    if (selectedEnv === 'all') return true;
    return row.judgments.length > 0 || row.tests.length > 0;
  });

  const groupMap = new Map();
  for (const row of rows) {
    const meta = featureGroupMeta(row.feature);
    if (!groupMap.has(meta.id)) {
      groupMap.set(meta.id, { id: meta.id, label: meta.label, rows: [], tests: [], judgments: [] });
    }
    const group = groupMap.get(meta.id);
    group.rows.push(row);
    group.tests.push(...row.tests);
    group.judgments.push(...row.judgments);
    group.paths = [...(group.paths || []), ...(row.paths || [])];
  }
  const groups = [...groupMap.values()].map(group => {
    group.status = statusPriority.find(s => group.rows.some(r => r.status === s)) || 'unknown';
    return group;
  });

  const counts = {};
  for (const g of groups) counts[g.status] = (counts[g.status] || 0) + 1;
  const passCount = counts.pass || 0;
  const failCount = counts.fail || 0;
  const totalCount = groups.length;
  const featureCounts = {};
  for (const row of rows) featureCounts[row.status] = (featureCounts[row.status] || 0) + 1;
  const rowByFeatureId = Object.fromEntries(rows.map(r => [r.feature.id, r]));
  const tasks = extractTasks(content);
  const currentDomainTask = [...tasks].reverse().find(t => !['done', 'closed', 'succeeded'].includes(String(t.status || t.result || '').toLowerCase())) || null;
  const nextTargetSource = `${nextAction}\n${currentDomainTask?.title || currentDomainTask?.goal || ''}`;
  const nextTargetId = features.find(f => nextTargetSource.includes(f.id))?.id || '';
  const nextTargetRow = nextTargetId ? rowByFeatureId[nextTargetId] : null;
  const recentEvidence = [...(model.evidence || [])].slice(-5).reverse();
  const attentionRows = rows
    .filter(r => ['fail', 'blocked', 'unknown'].includes(r.status))
    .sort((a, b) => statusPriority.indexOf(a.status) - statusPriority.indexOf(b.status))
    .slice(0, 6);

  // ── Populate Project Snapshot band ──
  const snapshotGoalEl = document.getElementById('snapshot-goal');
  const snapshotCountsEl = document.getElementById('snapshot-counts');
  const snapshotFrontierEl = document.getElementById('snapshot-frontier');
  if (snapshotGoalEl) {
    const goalText = compactExcerpt(goal, 2) || 'Build a durable map between AKS input space and expected behavior space.';
    snapshotGoalEl.textContent = goalText;
  }
  if (snapshotCountsEl) {
    const countPill = (label, n, color) => `<span style="color:${color || 'var(--fg)'}"><strong>${n}</strong> ${label}</span>`;
    snapshotCountsEl.innerHTML = [
      countPill('pass', featureCounts.pass || 0, 'var(--green)'),
      countPill('fail', featureCounts.fail || 0, 'var(--red)'),
      countPill('blocked', featureCounts.blocked || 0, 'var(--yellow)'),
      countPill('unknown', featureCounts.unknown || 0, 'var(--fg2)'),
    ].join('');
  }
  if (snapshotFrontierEl) {
    const frontierNames = attentionRows.slice(0, 4).map(r => r.feature.label || r.feature.id);
    snapshotFrontierEl.textContent = frontierNames.length
      ? `Frontier: ${frontierNames.join(', ')}${attentionRows.length > 4 ? ` (+${attentionRows.length - 4} more)` : ''}`
      : 'No active frontier items.';
  }

  const focusIds = new Set([
    nextTargetId,
    'bootstrap-profile-byo-acr-lifecycle',
    'bootstrap-profile-managed-acr-lifecycle',
    'workload-autoscaler-vpa-upgrade-survival-runtime',
    'managedsystem-pool-rest-add-existing',
    'workload-autoscaler-vpa-cert-renewal-runtime',
    'machines-agentpool-api-crud',
    'app-routing-default-domain-tls-secret',
  ]);
  const mapRows = [...rows].sort((a, b) => {
    const af = focusIds.has(a.feature.id) ? -10 : 0;
    const bf = focusIds.has(b.feature.id) ? -10 : 0;
    return (af + statusPriority.indexOf(a.status)) - (bf + statusPriority.indexOf(b.status));
  }).slice(0, 10);
  const pathRows = (pathSummary?.paths || [])
    .slice()
    .sort((a, b) => statusPriority.indexOf(a.status) - statusPriority.indexOf(b.status))
    .slice(0, 12);
  const replanPathIds = selectedAksRpE2eReplanPaths().filter(id => (pathSummary?.paths || []).some(path => path.id === id));
  const replanPreview = previewReplan(replanPathIds);
  const replanCandidates = (pathSummary?.paths || [])
    .slice()
    .sort((a, b) => {
      const as = testSpecForPath(a.id) ? -10 : 0;
      const bs = testSpecForPath(b.id) ? -10 : 0;
      return (as + statusPriority.indexOf(a.status)) - (bs + statusPriority.indexOf(b.status));
    })
    .slice(0, 64);

  // Per-env counts — use same group logic as main view, skip features with no data in that env
  const envCounts = {};
  for (const env of allEnvs) {
    const mEnv = (cp) => { const v = assignmentValue(cp, 'observation.environment'); return v === env || !v; };
    const ej = judgments.filter(j => mEnv(j.contextPath));
    const et = tests.filter(t => mEnv(t.contextPath));
    const eRows = features.map(feature => {
      const lj = ej.filter(j => j.featureId === feature.id);
      const lt = et.filter(t => t.featureId === feature.id);
      if (lj.length === 0 && lt.length === 0) return null; // no data in this env
      const fb = deriveFeatureStatus(feature, et, pathsByFeatureId[feature.id] || []);
      return lj.length ? (statusPriority.find(s => lj.some(j => j.status === s)) || 'unknown') : fb.status;
    }).filter(s => s !== null);
    // Group same as main view
    const eGroupMap = new Map();
    let ri = 0;
    features.forEach((feature) => {
      const lj = ej.filter(j => j.featureId === feature.id);
      const lt = et.filter(t => t.featureId === feature.id);
      if (lj.length === 0 && lt.length === 0) return;
      const meta = featureGroupMeta(feature);
      if (!eGroupMap.has(meta.id)) eGroupMap.set(meta.id, []);
      eGroupMap.get(meta.id).push(eRows[ri++]);
    });
    const ec = {};
    for (const [, statuses] of eGroupMap) {
      const gs = statusPriority.find(s => statuses.includes(s)) || 'unknown';
      ec[gs] = (ec[gs] || 0) + 1;
    }
    envCounts[env] = ec;
  }

  const selectedFeatureId = currentRoute.type === 'feature'
    ? currentRoute.id
    : window.__aksRpE2eFeatureId || sessionStorage.getItem('aksSelectedFeatureId') || '';
  const selectedPathId = currentRoute.type === 'path'
    ? currentRoute.id
    : window.__aksRpE2ePathId || sessionStorage.getItem('aksSelectedPathId') || '';
  const selectedPath = selectedPathId ? (pathSummary?.paths || []).find(path => path.id === selectedPathId) : null;
  const selectedGroup = selectedFeatureId
    ? groups.find(g => g.id === selectedFeatureId || g.rows.some(r => r.feature.id === selectedFeatureId))
    : null;
  const selectedFeatureIds = selectedAksRpE2eFeatureIds()
    .filter(id => groups.some(group => group.id === id || group.rows.some(row => row.feature.id === id)));
  const selectedFeatureGroups = selectedFeatureIds
    .map(id => groups.find(group => group.id === id || group.rows.some(row => row.feature.id === id)))
    .filter(Boolean);

  function groupFeatureIds(group) {
    return [...new Set((group?.rows || []).map(row => row.feature.id).filter(Boolean))];
  }

  function pathsForFeatureGroup(group) {
    const ids = new Set(groupFeatureIds(group));
    return (pathSummary?.paths || [])
      .filter(path => ids.has(path.featureId))
      .sort((a, b) => statusPriority.indexOf(a.status) - statusPriority.indexOf(b.status) || String(a.id).localeCompare(String(b.id)));
  }

  function specsForPaths(paths) {
    const pathIds = new Set((paths || []).map(path => path.id));
    return (testSpecIndex?.specs || [])
      .filter(spec => (spec.featurePathIds || []).some(pathId => pathIds.has(pathId)))
      .sort((a, b) => String(a.compatibleGroupKey || '').localeCompare(String(b.compatibleGroupKey || '')) || (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
  }

  function specBackedPathIdsForGroups(featureGroups) {
    const pathIds = [];
    for (const group of featureGroups || []) {
      const paths = pathsForFeatureGroup(group);
      const specs = specsForPaths(paths);
      const specPathIds = new Set(specs.flatMap(spec => spec.featurePathIds || []));
      for (const path of paths) {
        if (specPathIds.has(path.id)) pathIds.push(path.id);
      }
    }
    return [...new Set(pathIds)];
  }

  function compatibleGroupSummary(specs) {
    const groups = new Map();
    for (const spec of specs || []) {
      const key = spec.compatibleGroupKey || 'ungrouped';
      if (!groups.has(key)) groups.set(key, 0);
      groups.set(key, groups.get(key) + 1);
    }
    return [...groups.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([key, count]) => `${key} (${count})`);
  }

  function sourceRefLinks(refs, max = 5) {
    const unique = [...new Set((refs || []).filter(Boolean))].slice(0, max);
    if (!unique.length) return '<span class="aks-subtle">No source refs</span>';
    return unique.map(ref => {
      const hrefRef = ref.startsWith('decisions/') ? ref.replace(/^decisions\//, 'design/') : ref;
      const local = /^(features|specs|suites|replays|model|evidence|runs|design|reports)\//.test(hrefRef);
      if (local) {
        return `<a href="/projects/aks-rp-e2e/${encodeURIComponent(hrefRef)}" target="_blank" style="font-size:10px" title="${attrEsc(ref)}">${esc(ref)}</a>`;
      }
      return `<code style="font-size:10px" title="${attrEsc(ref)}">${esc(ref)}</code>`;
    }).join(' ');
  }

  function featureEvidenceCards(ids) {
    if (!ids.length) return '<div class="aks-empty">No evidence mapped to this feature.</div>';
    return ids.map(id => {
      const ev = evidenceById[id];
      if (!ev) return `<div class="aks-evidence-card"><div class="aks-evidence-title">${esc(id)}</div><div class="aks-subtle">Evidence id is referenced but not present in the evidence catalog.</div></div>`;
      const link = evidenceLinks([id]);
      return `<div class="aks-evidence-card">
        <div class="aks-evidence-title">${link}</div>
        <div class="aks-evidence-meta">${esc(ev.kind || 'artifact')}</div>
        <div style="font-size:11px;color:var(--fg2);line-height:1.45">${esc(ev.summary || 'No summary recorded.')}</div>
      </div>`;
    }).join('');
  }

  function deriveVerificationState(path, spec) {
    // Returns: missing | generated | needs-review | internally-preflighted | execution-gated | staging-verified | model-updated
    if (!spec) return 'missing';
    const hasRunPlan = (spec.sourceRefs || []).some(r => r.includes('run-plans/'));
    const hasProbe = (spec.sourceRefs || []).some(r => r.includes('replays/'));
    const evidenceIds = path.evidence || [];
    const hasStaging = evidenceIds.some(e => /staging/i.test(e));
    const hasLive = evidenceIds.some(e => /live|devbox/i.test(e));
    const hasLocalCheck = evidenceIds.some(e => /local-check|dry-run|check/i.test(e));
    if (path.status === 'pass' && (hasStaging || hasLive)) return 'model-updated';
    if (hasStaging || hasLive) return 'staging-verified';
    if (path.status === 'blocked' || path.status === 'unknown') return 'execution-gated';
    if (hasLocalCheck) return 'internally-preflighted';
    if (hasRunPlan || hasProbe) return 'needs-review';
    return 'generated';
  }

  function verificationStateLabel(state) {
    const map = {
      'missing': '⚪ Missing',
      'generated': '🔵 Generated',
      'needs-review': '🟡 Needs Review',
      'internally-preflighted': '🟢 Internal Preflight',
      'execution-gated': '🟠 Execution Gated',
      'staging-verified': '✅ Staging Verified',
      'model-updated': '✅ Model Updated',
    };
    return map[state] || state;
  }

  function verificationStateColor(state) {
    const map = {
      'missing': 'var(--fg2)',
      'generated': 'var(--accent)',
      'needs-review': 'var(--yellow)',
      'internally-preflighted': 'var(--green)',
      'execution-gated': 'var(--yellow)',
      'staging-verified': 'var(--green)',
      'model-updated': 'var(--green)',
    };
    return map[state] || 'var(--fg2)';
  }

  function findRunPlanForPath(pathId) {
    // Convention: run-plan files reference path IDs; check spec sourceRefs
    const spec = testSpecForPath(pathId);
    if (!spec) return null;
    const ref = (spec.sourceRefs || []).find(r => r.includes('run-plans/'));
    return ref || null;
  }

  function findProbeForPath(pathId) {
    const spec = testSpecForPath(pathId);
    if (!spec) return null;
    const ref = (spec.sourceRefs || []).find(r => r.includes('replays/'));
    return ref || null;
  }

  // ── Surface-type derivation from path ID patterns ──

  function deriveSurfaceType(pathId) {
    const id = String(pathId || '').toLowerCase();
    if (/\.rest[.-]/.test(id) || /rest-/.test(id) || /\.rest$/.test(id) || /arm-rest/.test(id)) return 'REST';
    if (/\.cli[.-]/.test(id) || /cli-/.test(id) || /\.cli$/.test(id)) return 'CLI';
    if (/runtime/.test(id) || /\.runtime[.-]/.test(id) || /reconcil/.test(id) || /cert-renewal/.test(id) || /leader-election/.test(id) || /upgrade-survival/.test(id) || /helm-release/.test(id) || /components/.test(id) || /token-projection/.test(id) || /scaling/.test(id) || /placement/.test(id) || /node-restrict/.test(id) || /image-cleaner/.test(id) || /reachability/.test(id)) return 'runtime';
    if (/product/.test(id) || /public-api/.test(id) || /staging/.test(id) || /mode-immutab/.test(id) || /delete-existing/.test(id) || /disable/.test(id) || /enable/.test(id) || /crud/.test(id) || /lifecycle/.test(id) || /\.pass$/.test(id)) return 'product';
    if (/e2ev3/.test(id) || /source-equivalent/.test(id) || /standalone/.test(id)) return 'e2ev3';
    return 'product';
  }

  function surfaceTypePillHtml(surfaceType) {
    const colors = {
      REST: 'var(--accent)',
      CLI: '#b07cd8',
      runtime: 'var(--green)',
      product: 'var(--fg)',
      e2ev3: 'var(--yellow)',
    };
    const color = colors[surfaceType] || 'var(--fg2)';
    return `<span class="aks-pill" style="color:${color};border-color:${color};font-size:9px;font-weight:600;letter-spacing:.04em">${esc(surfaceType)}</span>`;
  }

  // ── Golden-path evidence chain summary ──

  const goldenPathChainLinks = ['source', 'packet', 'spec', 'plan', 'probe', 'local-check', 'cloud-replay', 'cleanup'];

  function deriveGoldenPathChain(path) {
    const pathId = String(path.id || '');
    const spec = testSpecForPath(pathId);
    const evidenceIds = (path.evidence || []).map(e => String(e || '').toLowerCase());
    const specRefs = (spec?.sourceRefs || []).map(r => String(r || '').toLowerCase());

    const chain = {};

    // source: spec sourceRefs include devbox or Go source files
    chain.source = specRefs.some(r => /devbox:/.test(r) || /\.go$/.test(r) || /source/.test(r)) ||
      (path.behavior || []).some(b => (b.evidence || []).length > 0);

    // packet: spec sourceRefs include feature-packets
    chain.packet = specRefs.some(r => /feature-packets\//.test(r));

    // spec: test spec exists
    chain.spec = !!spec;

    // plan: spec sourceRefs include run-plans
    chain.plan = specRefs.some(r => /run-plans\//.test(r));

    // probe: spec sourceRefs include probes
    chain.probe = specRefs.some(r => /probes\//.test(r));

    // local-check: evidence includes local-check/dry-run/check refs
    chain['local-check'] = evidenceIds.some(e => /local-check|dry-run|check/.test(e));

    // cloud-replay: evidence includes staging/live/iteration/devbox refs with pass behavior
    chain['cloud-replay'] = evidenceIds.some(e => /staging|live|iteration|devbox/.test(e)) &&
      (path.behavior || []).some(b => b.alignment === 'match' && (b.evidence || []).length > 0);

    // cleanup: path status is pass or fail and evidence implies cleanup
    chain.cleanup = (path.status === 'pass' || path.status === 'fail') &&
      evidenceIds.some(e => /staging|live|iteration/.test(e));

    return chain;
  }

  // ── Verification level derived from golden-path chain ──

  const surfaceTypeSortOrder = { REST: 0, product: 1, CLI: 2, runtime: 3, e2ev3: 4 };

  function deriveVerificationLevel(path) {
    const chain = deriveGoldenPathChain(path);
    // staging-evidence: cloud-replay link present (implies staging/live execution)
    if (chain['cloud-replay']) return 'staging-evidence';
    // local-check-only: local-check link present but no cloud-replay
    if (chain['local-check']) return 'local-check-only';
    // spec-only: spec link present but neither local-check nor cloud-replay
    if (chain.spec) return 'spec-only';
    // no-evidence: nothing meaningful in the chain
    return 'no-evidence';
  }

  function verificationLevelPillHtml(level) {
    const styles = {
      'staging-evidence': { color: 'var(--green)', bg: 'rgba(0,180,80,0.08)', label: 'staging-evidence' },
      'local-check-only': { color: 'var(--yellow)', bg: 'rgba(200,180,0,0.08)', label: 'local-check-only' },
      'spec-only':        { color: 'var(--accent)', bg: 'rgba(60,120,220,0.08)', label: 'spec-only' },
      'no-evidence':      { color: 'var(--fg2)',    bg: 'rgba(128,128,128,0.08)', label: 'no-evidence' },
    };
    const s = styles[level] || styles['no-evidence'];
    return `<span class="aks-pill" style="color:${s.color};border-color:${s.color};background:${s.bg};font-size:9px;font-weight:600;letter-spacing:.04em">${esc(s.label)}</span>`;
  }

  function sortPathsBySurface(paths) {
    return [...paths].sort((a, b) => {
      const sa = surfaceTypeSortOrder[deriveSurfaceType(a.id)] ?? 5;
      const sb = surfaceTypeSortOrder[deriveSurfaceType(b.id)] ?? 5;
      return sa - sb;
    });
  }

  function goldenPathChainHtml(path) {
    const chain = deriveGoldenPathChain(path);
    const present = goldenPathChainLinks.filter(link => chain[link]);
    const missing = goldenPathChainLinks.filter(link => !chain[link]);
    if (present.length === 0) return '';

    let html = `<div style="margin-top:8px"><div class="aks-audit-box-title">Evidence Chain</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">`;
    for (const link of goldenPathChainLinks) {
      const ok = chain[link];
      const color = ok ? 'var(--green)' : 'var(--fg2)';
      const icon = ok ? '✅' : '⬜';
      html += `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border:1px solid ${ok ? 'var(--green)' : 'var(--border)'};border-radius:999px;font-size:10px;color:${color};background:var(--bg);white-space:nowrap">${icon} ${esc(link)}</span>`;
    }
    html += `</div>`;
    if (missing.length > 0 && missing.length < goldenPathChainLinks.length) {
      html += `<div style="font-size:10px;color:var(--fg2);margin-top:4px">Missing: ${esc(missing.join(', '))}</div>`;
    }
    html += `</div>`;
    return html;
  }

  function pathPageHtml(path) {
    const featureRow = rowByFeatureId[path.featureId];
    const featureGroup = groups.find(g => g.rows.some(r => r.feature.id === path.featureId));
    const evidenceIds = [...new Set(path.evidence || [])];
    const spec = testSpecForPath(path.id);
    const vState = deriveVerificationState(path, spec);
    let out = `<section class="aks-feature-page">`;
    out += `<div class="aks-feature-hero aks-panel">`;
    out += `<div>`;
    out += `<button class="aks-btn" onclick="closeAksRpE2ePath()">Back To Knowledge Map</button>`;
    out += `<div class="aks-kicker" style="margin-top:12px">Knowledge Path</div>`;
    out += `<div class="aks-feature-title">${esc(path.featureLabel || path.featureId)}</div>`;
    out += `<div style="font-family:var(--mono);font-size:11px;color:var(--fg2);overflow-wrap:anywhere">${esc(path.id)}</div>`;
    out += `<div class="aks-actions">`;
    out += `<button class="aks-btn aks-btn-primary" onclick="prefillProjectComment(${jsStringAttr(pathActionPrompt('audit', path))})">Audit Path</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(pathActionPrompt('verify', path))})">Verify Plan</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(pathActionPrompt('suggest', path))})">Suggest As Next</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(pathActionPrompt('challenge', path))})">Challenge</button>`;
    if (featureGroup) out += `<button class="aks-btn" onclick="openAksRpE2eFeature(${jsStringAttr(featureGroup.id)})">Open Feature</button>`;
    out += `</div>`;
    out += `</div>`;
    out += `<div style="min-width:220px">`;
    out += miniMetric('path status', statusName(path.status), resultColor(path.status));
    out += `<div style="height:8px"></div>`;
    out += miniMetric('verification', verificationStateLabel(vState), verificationStateColor(vState));
    out += `<div style="height:8px"></div>`;
    out += miniMetric('inputs', (path.selectedInputs || []).length);
    out += `<div style="height:8px"></div>`;
    out += miniMetric('behavior', (path.behavior || []).length);
    out += `<div style="height:8px"></div>`;
    out += miniMetric('next action', derivePathNextAction(path), 'var(--accent)');
    out += `</div>`;
    out += `</div>`;

    out += `<div class="aks-detail-grid">`;
    out += `<div class="aks-panel">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Model Path</div><div class="aks-subtle">Scenario -> input DAG selection -> feature bridge -> behavior alignment</div></div></div>`;
    out += `<div class="aks-audit-grid">`;
    out += `<div class="aks-audit-box"><div class="aks-audit-box-title">Scenario</div><div style="font-size:12px">${esc(path.scenarioTitle || path.scenarioId)}</div><div style="font-family:var(--mono);font-size:10px;color:var(--fg2);margin-top:5px">${esc(path.scenarioId)}</div></div>`;
    out += `<div class="aks-audit-box"><div class="aks-audit-box-title">Input DAG</div><div style="font-family:var(--mono);font-size:12px">${esc(path.inputDagId || 'unknown')}</div></div>`;
    out += `</div>`;
    out += `<div class="aks-audit-box" style="margin-bottom:8px"><div class="aks-audit-box-title">Selected Input Nodes</div>${summaryInputChips(path.selectedInputs, 20) || '<span class="aks-subtle">none</span>'}</div>`;
    out += `<div class="aks-audit-box"><div class="aks-audit-box-title">Notes / Next Boundary</div><div style="font-size:12px;color:var(--fg2);line-height:1.45">${esc(path.notes || featureGap(featureRow || { status: path.status, feature: { inputPath: [] }, tests: [], judgments: [], paths: [path] }, model.inputVariables || []))}</div></div>`;
    out += goldenPathChainHtml(path);
    out += `</div>`;

    out += `<div class="aks-panel">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Behavior Alignment</div><div class="aks-subtle">Blue match, red mismatch, yellow blocked, gray unknown · Claim behaviors affect verdict; audit behaviors are observational only</div></div></div>`;
    out += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
    out += `<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Behavior</th><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Expected</th><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Observed</th><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Alignment</th><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Impact</th></tr>`;
    for (const behavior of path.behavior || []) {
      const color = behaviorAlignmentColor(behavior.alignment);
      const impactLabel = behavior.verdictImpact === 'audit' ? 'audit' : behavior.verdictImpact === 'claim' ? 'claim' : '—';
      const impactColor = behavior.verdictImpact === 'audit' ? 'var(--fg2)' : behavior.verdictImpact === 'claim' ? 'var(--accent)' : 'var(--fg2)';
      const impactStyle = behavior.verdictImpact === 'audit' ? 'font-style:italic' : 'font-weight:600';
      out += `<tr style="border-bottom:1px solid var(--border)${behavior.verdictImpact === 'audit' ? ';opacity:0.75' : ''}">`;
      out += `<td style="padding:5px;font-family:var(--mono);font-size:11px">${esc(behavior.variable)}</td>`;
      out += `<td style="padding:5px">${esc(behavior.expected)}</td>`;
      out += `<td style="padding:5px">${esc(behavior.observed == null ? 'not observed' : behavior.observed)}</td>`;
      out += `<td style="padding:5px;color:${color};font-weight:600">${esc(behavior.alignment)}</td>`;
      out += `<td style="padding:5px;color:${impactColor};${impactStyle};font-size:11px" title="${attrEsc(behavior.note || '')}">${esc(impactLabel)}</td>`;
      out += `</tr>`;
      if (behavior.verdictImpact === 'audit' && behavior.note) {
        out += `<tr style="border-bottom:1px solid var(--border)"><td colspan="5" style="padding:2px 5px 4px 18px;font-size:10px;color:var(--fg2);font-style:italic">${esc(behavior.note)}</td></tr>`;
      }
      if ((behavior.evidence || []).length) {
        out += `<tr style="border-bottom:1px solid var(--border)"><td colspan="5" style="padding:2px 5px 6px 18px">${evidenceLinks(behavior.evidence)}</td></tr>`;
      }
    }
    out += `</table>`;
    out += `</div>`;
    out += `</div>`;

    // ── Verification Pipeline ──
    out += `<div class="aks-detail-grid">`;
    out += `<div class="aks-panel" data-testid="verification-pipeline">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Verification Pipeline</div><div class="aks-subtle">Test spec → run plan → replay script → internal preflight → execution gate → staging/live evidence → cleanup → model verdict</div></div></div>`;

    const runPlanRef = findRunPlanForPath(path.id);
    const probeRef = findProbeForPath(path.id);
    const stageRows = [
      { stage: 'Test Spec', present: !!spec, detail: spec ? `${spec.id} — ${spec.title} (${spec.assertionCount || 0} assertions)` : 'No test spec found for this path' },
      { stage: 'Run Plan', present: !!runPlanRef, detail: runPlanRef || 'No run plan linked' },
      { stage: 'Replay Script (Probe)', present: !!probeRef, detail: probeRef || 'No probe linked' },
      { stage: 'Internal Preflight', present: evidenceIds.some(e => /local-check|dry-run|check/i.test(e)), detail: evidenceIds.filter(e => /local-check|dry-run|check/i.test(e)).join(', ') || 'Not yet recorded' },
      { stage: 'Execution Gate', present: path.status !== 'blocked' && path.status !== 'unknown', detail: (path.status === 'blocked' || path.status === 'unknown') ? 'Blocked — see notes' : 'Clear' },
      { stage: 'Staging/Live Evidence', present: evidenceIds.some(e => /staging|live|devbox/i.test(e)), detail: evidenceIds.filter(e => /staging|live|devbox/i.test(e)).join(', ') || 'No staging/live evidence' },
      { stage: 'Cleanup', present: path.status === 'pass' || path.status === 'fail', detail: (path.status === 'pass' || path.status === 'fail') ? 'Completed with evidence' : 'Pending' },
      { stage: 'Model Verdict', present: path.status === 'pass' || path.status === 'fail', detail: path.status },
    ];
    out += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
    out += `<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Stage</th><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Status</th><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Detail</th></tr>`;
    for (const row of stageRows) {
      const icon = row.present ? '✅' : '⬜';
      out += `<tr style="border-bottom:1px solid var(--border)">`;
      out += `<td style="padding:5px;font-weight:500">${icon} ${esc(row.stage)}</td>`;
      out += `<td style="padding:5px;color:${row.present ? 'var(--green)' : 'var(--fg2)'};font-weight:600">${row.present ? 'Done' : 'Pending'}</td>`;
      out += `<td style="padding:5px;font-family:var(--mono);font-size:11px;overflow-wrap:anywhere">${esc(row.detail)}</td>`;
      out += `</tr>`;
    }
    out += `</table>`;

    if (spec && (spec.sourceRefs || []).length) {
      out += `<div style="margin-top:10px"><div style="font-size:10px;color:var(--fg2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Spec Source References</div>`;
      out += `<div style="font-size:11px;font-family:var(--mono);line-height:1.6">`;
      for (const ref of spec.sourceRefs) {
        out += `<div style="overflow-wrap:anywhere">${esc(ref)}</div>`;
      }
      out += `</div></div>`;
    }
    out += `</div>`;

    // ── Input Shape Detail ──
    out += `<div class="aks-panel" data-testid="input-shape-detail">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Input Shape</div><div class="aks-subtle">The exact input variable assignments that define this path</div></div></div>`;
    if ((path.selectedInputs || []).length) {
      out += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
      out += `<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Variable</th><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Value</th><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Label</th></tr>`;
      for (const inp of path.selectedInputs) {
        out += `<tr style="border-bottom:1px solid var(--border)">`;
        out += `<td style="padding:5px;font-family:var(--mono);font-size:11px">${esc(inp.variable)}</td>`;
        out += `<td style="padding:5px;font-weight:600">${esc(inp.value)}</td>`;
        out += `<td style="padding:5px;font-size:11px;color:var(--fg2)">${esc(inp.label || '')}</td>`;
        out += `</tr>`;
      }
      out += `</table>`;
    } else {
      out += `<div class="aks-empty">No input shape recorded for this path.</div>`;
    }
    out += `</div>`;
    out += `</div>`;

    out += `<div class="aks-detail-grid">`;
    out += `<div class="aks-panel">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Evidence</div><div class="aks-subtle">Open raw artifacts before changing any model verdict</div></div></div>`;
    out += `<div class="aks-list">${featureEvidenceCards(evidenceIds)}</div>`;
    out += `</div>`;
    out += `<div class="aks-panel">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Reviewer Actions</div><div class="aks-subtle">Drive the project from this exact path</div></div></div>`;
    out += `<textarea id="aks-direction-suggestion" class="aks-suggest-box" placeholder="Suggest how this path should move: reverify, deepen evidence, split the path, mark blocked, or choose a wider feature."></textarea>`;
    out += `<div class="aks-actions">`;
    out += `<button class="aks-btn aks-btn-primary" onclick="suggestAksRpE2eDirection()">Send Direction To aks-explorer</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(pathActionPrompt('verify', path))})">Use Verification Prompt</button>`;
    out += `</div>`;
    // Path-level review actions
    out += `<div class="aks-actions" style="margin-top:8px" data-testid="path-review-actions">`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(pathReviewPrompt('review-spec', path))})">Review Spec</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(pathReviewPrompt('review-script', path))})">Review Script</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(pathReviewPrompt('generate-script', path))})">Generate Test Script</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(pathReviewPrompt('request-staging', path))})">Request REST Staging Replay</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(pathReviewPrompt('classify-result', path))})">Classify Result</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(pathReviewPrompt('approve-model-update', path))})">Approve Model Update</button>`;
    out += `</div>`;
    out += `</div>`;
    out += `</div>`;
    out += `</section>`;
    return out;
  }

  async function featurePageHtml(group) {
    const groupEvidence = [...new Set(group.rows.flatMap(rowEvidenceIds))];
    const groupGap = group.rows.map(r => featureGap(r, model.inputVariables || [])).find(Boolean) || 'No active gap recorded.';
    const groupClaim = group.rows.map(statusTextWithClaim).find(Boolean) || statusName(group.status);
    const groupSelected = selectedFeatureIds.includes(group.id);
    const featureTests = filteredTests.filter(t => group.rows.some(r => r.feature.id === t.featureId));
    const featureJudgments = group.judgments;
    const featurePaths = group.paths || [];
    const featureSpecs = specsForPaths(featurePaths);
    const featureSourceRefs = featureSpecs.flatMap(spec => spec.sourceRefs || []);
    const featureIds = group.rows.map(r => r.feature.id);

    // Load the feature packet for contract context
    const packetId = group.id;
    const packetYaml = await loadFeaturePacket(packetId);

    // Extract structured contract data from packet
    const refRoles = ['design', 'api', 'userDocs', 'goE2E', 'implementation'];
    const refRoleLabels = { design: 'PRD / Design', api: 'API / REST Spec', userDocs: 'Public Docs', goE2E: 'Go E2E Source', implementation: 'RP / Implementation' };
    const roleClaims = {};
    for (const role of refRoles) {
      roleClaims[role] = extractRoleClaims(packetYaml, role);
    }
    const hasAnyClaims = refRoles.some(r => roleClaims[r].length > 0);

    const contradictions = extractContradictions(packetYaml);
    const judgmentRules = extractJudgmentRules(packetYaml);
    const pktInputPaths = extractInputPaths(packetYaml);

    // Extract purpose
    const purposeMatch = packetYaml ? packetYaml.match(/^purpose:\s*>\s*\n([\s\S]*?)(?:\n[a-zA-Z])/m) || packetYaml.match(/^purpose:\s*(.+)/m) : null;
    const purpose = purposeMatch ? purposeMatch[1].replace(/\n\s+/g, ' ').trim() : null;
    let out = `<section class="aks-feature-page">`;
    out += `<div class="aks-feature-hero aks-panel">`;
    out += `<div>`;
    out += `<button class="aks-btn" onclick="closeAksRpE2eFeature()">Back To Knowledge Map</button>`;
    out += `<div class="aks-kicker" style="margin-top:12px">Feature</div>`;
    out += `<div class="aks-feature-title">${esc(group.label)}</div>`;
    out += `<div style="font-family:var(--mono);font-size:11px;color:var(--fg2);overflow-wrap:anywhere">${esc(featureIds.join(', '))}</div>`;
    out += `<div class="aks-actions">`;
    out += `<button class="aks-btn aks-btn-primary" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('audit', group))})">Ask aks-explorer To Audit</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('manual', group))})">Manual Verify</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('suggest', group))})">Suggest As Next</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('challenge', group))})">Challenge Verdict</button>`;
    out += `</div>`;
    // Human input actions row
    out += `<div class="aks-actions" style="margin-top:4px" data-testid="feature-input-actions">`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureInputPrompt('add-reference', group))})">Add Reference</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureInputPrompt('add-expected-behavior', group))})">Add Expected Behavior</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureInputPrompt('mark-source-of-truth', group))})">Mark Source of Truth</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureInputPrompt('suggest-missing-path', group))})">Suggest Missing Path</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureInputPrompt('make-next', group))})">Make Feature Next</button>`;
    out += `</div>`;
    // Human review actions row
    out += `<div class="aks-actions" style="margin-top:4px" data-testid="feature-review-actions">`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureReviewPrompt('review-spec', group))})">Review Spec</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureReviewPrompt('review-script', group))})">Review Script</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureReviewPrompt('generate-script', group))})">Generate Test Script</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureReviewPrompt('request-staging', group))})">Request REST Staging Replay</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureReviewPrompt('classify-result', group))})">Classify Result</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureReviewPrompt('approve-model-update', group))})">Approve Model Update</button>`;
    out += `</div>`;
    out += `</div>`;
    out += `<div style="min-width:220px">`;
    out += miniMetric('status', statusName(group.status), resultColor(group.status));
    out += `<div style="height:8px"></div>`;
    out += miniMetric('tests', featureTests.length);
    out += `<div style="height:8px"></div>`;
    out += miniMetric('evidence', groupEvidence.length);
    out += `<div style="height:8px"></div>`;
    const _conf = deriveFeatureConfidence(group);
    out += miniMetric('confidence', _conf.level, _conf.level === 'high' ? 'var(--green)' : _conf.level === 'medium' ? 'var(--yellow)' : 'var(--fg2)');
    out += `<div style="height:8px"></div>`;
    out += miniMetric('next move', deriveFeatureNextMove(group), 'var(--fg2)');
    out += `</div>`;
    out += `</div>`;

    // ── Action Receipts Container ──
    out += `<div id="aks-receipt-container" class="aks-panel" data-testid="aks-receipt-container" style="padding:12px 16px"></div>`;

    // ── Feature Contract Panel ──
    out += `<div class="aks-panel" data-testid="feature-contract-panel">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Feature Contract</div><div class="aks-subtle">How this feature should work — grouped source references, extracted claims, constraints, and open questions</div></div></div>`;

    // Purpose / Intent
    out += `<div class="aks-audit-box" style="margin-bottom:10px">`;
    out += `<div class="aks-audit-box-title">Purpose / Intent</div>`;
    if (purpose) {
      out += `<div style="font-size:12px;line-height:1.55">${esc(purpose)}</div>`;
    } else {
      out += `<div class="aks-empty">No feature packet found at features/${esc(packetId)}.yaml — contract claims cannot be extracted.</div>`;
    }
    out += `</div>`;

    // Current Claim + Gap (compact)
    out += `<div class="aks-audit-grid" style="margin-bottom:10px">`;
    out += `<div class="aks-audit-box"><div class="aks-audit-box-title">Current Claim</div><div style="font-size:12px">${esc(groupClaim)}</div></div>`;
    out += `<div class="aks-audit-box"><div class="aks-audit-box-title">Current Gap / Next Verification</div><div style="font-size:12px;color:var(--fg2);line-height:1.45">${esc(groupGap)}</div></div>`;
    out += `</div>`;

    // Grouped References by Role
    out += `<div class="aks-audit-box" style="margin-bottom:10px" data-testid="contract-references">`;
    out += `<div class="aks-audit-box-title">Source References By Role</div>`;
    if (hasAnyClaims) {
      for (const role of refRoles) {
        const claims = roleClaims[role];
        if (!claims.length) {
          out += `<div style="margin-bottom:8px"><div style="font-size:11px;font-weight:600;color:var(--fg2);margin-bottom:3px">${esc(refRoleLabels[role] || role)}</div><div class="aks-empty">No ${esc(refRoleLabels[role] || role).toLowerCase()} references in the feature packet.</div></div>`;
          continue;
        }
        out += `<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:600;color:var(--fg);margin-bottom:4px">${esc(refRoleLabels[role] || role)} <span class="aks-pill" style="font-size:9px">${claims.length}</span></div>`;
        for (const c of claims) {
          out += `<div style="border-left:2px solid var(--border);padding:4px 0 4px 10px;margin-bottom:6px">`;
          out += `<div style="font-size:11px;line-height:1.5;color:var(--fg)">${esc(c.claim)}</div>`;
          const refs = [c.path, c.scenario].filter(Boolean);
          if (refs.length) out += `<div style="font-size:10px;color:var(--fg2);margin-top:2px;font-family:var(--mono)">${sourceRefLinks(refs, 3)}</div>`;
          out += `</div>`;
        }
        out += `</div>`;
      }
    } else {
      const allRefs = [...new Set([...featureSourceRefs])];
      if (allRefs.length) {
        out += `<div style="font-size:11px;color:var(--fg2);margin-bottom:4px">No feature packet with role-grouped references. Showing test-spec source refs:</div>`;
        out += `<div>${sourceRefLinks(allRefs, 10)}</div>`;
      } else {
        out += `<div class="aks-empty">No source references found in feature packet or test specs.</div>`;
      }
    }
    out += `</div>`;

    // Constraints / Non-Goals
    out += `<div class="aks-audit-box" style="margin-bottom:10px" data-testid="contract-constraints">`;
    out += `<div class="aks-audit-box-title">Constraints &amp; Non-Goals</div>`;
    const constraints = [];
    constraints.push({ label: 'REST-first replay', text: 'Staging execution uses ARM REST or generated clients for product/API behavior. CLI-specific failures are classified evidence, not the main golden replay conveyor.' });
    if (pktInputPaths.accepted.length) {
      for (const ip of pktInputPaths.accepted) {
        constraints.push({ label: `Accepted input: ${ip.surface || 'unknown'}`, text: `${ip.operation || ''} ${ip.requestBody ? '— body: ' + ip.requestBody : ''}`.trim() });
      }
    }
    if (pktInputPaths.rejected.length) {
      for (const ip of pktInputPaths.rejected) {
        constraints.push({ label: `Rejected/diagnostic: ${ip.surface || 'unknown'}`, text: `${ip.operation || ''} — diagnosis: ${ip.diagnosis || 'unknown'}` });
      }
    }
    if (pktInputPaths.unknown.length) {
      constraints.push({ label: 'Unknown input paths', text: pktInputPaths.unknown.map(u => u.id || u).join(', ') });
    }
    for (const c of contradictions) {
      constraints.push({ label: 'Known contradiction', text: `${c.claim}${c.resolution ? ' → Resolution: ' + c.resolution : ''}` });
    }
    if (constraints.length) {
      for (const c of constraints) {
        out += `<div style="display:flex;gap:8px;align-items:start;margin-bottom:6px">`;
        out += `<span style="flex:0 0 auto;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--fg2);padding-top:1px;white-space:nowrap">${esc(c.label)}</span>`;
        out += `<span style="font-size:11px;color:var(--fg);line-height:1.45">${esc(c.text)}</span>`;
        out += `</div>`;
      }
    } else {
      out += `<div class="aks-empty">No constraints or non-goals extracted from feature packet.</div>`;
    }
    out += `</div>`;

    // Judgment Rules
    if (Object.keys(judgmentRules).length) {
      out += `<div class="aks-audit-box" style="margin-bottom:10px" data-testid="contract-judgment-rules">`;
      out += `<div class="aks-audit-box-title">Judgment Rules (Source of Truth Hints)</div>`;
      const ruleLabels = { implementationIssueWhen: 'Product issue when', testIssueWhen: 'Test/probe issue when', environmentIssueWhen: 'Environment issue when', sourceDocMismatchWhen: 'Source/doc mismatch when' };
      for (const [rk, items] of Object.entries(judgmentRules)) {
        out += `<div style="margin-bottom:6px"><div style="font-size:11px;font-weight:600;color:var(--fg);margin-bottom:3px">${esc(ruleLabels[rk] || rk)}</div>`;
        for (const item of items.slice(0, 3)) {
          out += `<div style="font-size:11px;color:var(--fg2);line-height:1.45;padding-left:10px;border-left:2px solid var(--border);margin-bottom:4px">${esc(item)}</div>`;
        }
        if (items.length > 3) out += `<div class="aks-empty" style="padding-left:10px">+${items.length - 3} more rules</div>`;
        out += `</div>`;
      }
      out += `</div>`;
    }

    // Open Questions
    const openQuestions = [];
    if (pktInputPaths.unknown.length) {
      openQuestions.push(`Unknown input paths not yet exercised: ${pktInputPaths.unknown.map(u => u.id || u).join(', ')}`);
    }
    const uncoveredRows = group.rows.filter(r => r.status === 'unknown' || r.status === 'uncovered');
    for (const r of uncoveredRows) {
      openQuestions.push(`${r.feature.label || r.feature.id}: status=${r.status}, needs source-backed probe or audit.`);
    }
    if (openQuestions.length) {
      out += `<div class="aks-audit-box" style="margin-bottom:10px" data-testid="contract-open-questions">`;
      out += `<div class="aks-audit-box-title">Open Questions</div>`;
      for (const q of openQuestions) {
        out += `<div style="font-size:11px;color:var(--fg2);line-height:1.45;margin-bottom:4px">• ${esc(q)}</div>`;
      }
      out += `</div>`;
    }

    out += `</div>`; // end feature contract panel

    // ── Knowledge Paths ──
    out += `<div class="aks-detail-grid">`;
    out += `<div class="aks-panel">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Knowledge Paths</div><div class="aks-subtle">Input/expectation paths with surface type and behavior alignment</div></div></div>`;
    out += `<div class="aks-path-stack">`;
    if (featurePaths.length) {
      const sortedPaths = sortPathsBySurface(featurePaths);
      for (const path of sortedPaths) {
        const surfaceType = deriveSurfaceType(path.id);
        const verLevel = deriveVerificationLevel(path);
        out += `<div class="aks-audit-box">`;
        out += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${resultIcon(path.status)}<strong style="font-size:12px">${esc(path.featureLabel || path.featureId)}</strong>${surfaceTypePillHtml(surfaceType)}${surfaceType === 'CLI' ? '<span class="aks-pill" style="color:#9a6abf;border:1px dashed #9a6abf;opacity:0.72;font-size:9px;font-weight:500;letter-spacing:.03em">CLI contract</span>' : ''}${verificationLevelPillHtml(verLevel)}<span class="aks-pill" style="color:${resultColor(path.status)};border-color:${resultColor(path.status)}">${esc(statusName(path.status))}</span><button class="aks-btn" style="margin-left:auto;padding:4px 8px" onclick="openAksRpE2ePath(${jsStringAttr(path.id)})">Open Path</button></div>`;
        out += `<div class="aks-audit-box-title">Scenario</div><div style="font-size:11px;color:var(--fg2);line-height:1.45">${esc(path.scenarioTitle || path.scenarioId)}</div>`;
        out += `<div class="aks-audit-box-title" style="margin-top:10px">Selected Inputs</div>${summaryInputChips(path.selectedInputs, 12) || '<span class="aks-subtle">none</span>'}`;
        out += `<div class="aks-audit-box-title" style="margin-top:10px">Behavior Alignment</div>${behaviorChips(path.behavior, 12) || '<span class="aks-subtle">none</span>'}`;
        out += goldenPathChainHtml(path);
        out += `<div class="aks-audit-box-title" style="margin-top:10px">Next Action</div><div style="font-size:11px;color:var(--fg2);line-height:1.45;font-style:italic">${esc(derivePathNextAction(path))}</div>`;
        out += `<div class="aks-audit-box-title" style="margin-top:10px">Notes</div><div style="font-size:11px;color:var(--fg2);line-height:1.45">${esc(path.notes || 'No path notes recorded.')}</div>`;
        out += `</div>`;
      }
    }
    for (const row of group.rows) {
      out += `<div class="aks-audit-box">`;
      out += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${resultIcon(row.status)}<strong style="font-size:12px">${esc(row.feature.label || row.feature.id)}</strong><span class="aks-pill" style="color:${resultColor(row.status)};border-color:${resultColor(row.status)}">${esc(statusName(row.status))}</span></div>`;
      out += `<div class="aks-audit-box-title">Input Path</div>${pathChips(row.feature.inputPath, 12) || '<span class="aks-subtle">none</span>'}`;
      out += `<div class="aks-audit-box-title" style="margin-top:10px">Expectation Path</div>${pathChips(row.feature.expectationPath, 12) || '<span class="aks-subtle">none</span>'}`;
      out += `<div class="aks-audit-box-title" style="margin-top:10px">Description / Source Notes</div><div style="font-size:11px;color:var(--fg2);line-height:1.45">${esc(row.feature.description || 'No feature description recorded.')}</div>`;
      out += `</div>`;
    }
    out += `</div>`;
    out += `</div>`;

    out += `<div class="aks-panel">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Feature Review</div><div class="aks-subtle">Design/API/test-spec context plus user feedback controls</div></div></div>`;
    out += `<div class="aks-audit-box" style="margin-bottom:8px"><div class="aks-audit-box-title">Test Specs</div>`;
    if (featureSpecs.length) {
      for (const spec of featureSpecs.slice(0, 8)) {
        out += `<div style="font-size:11px;color:var(--fg2);line-height:1.45;margin-bottom:5px"><code>${esc(spec.id)}</code> ${esc(spec.title || '')}<div>${sourceRefLinks(spec.sourceRefs, 4)}</div></div>`;
      }
      if (featureSpecs.length > 8) out += `<div class="aks-empty">${featureSpecs.length - 8} more specs</div>`;
    } else {
      out += `<div class="aks-empty">No test specs mapped to this feature yet.</div>`;
    }
    out += `</div>`;
    out += `<textarea id="aks-direction-suggestion" class="aks-suggest-box" placeholder="Suggest how this feature should move: audit first, rerun gated branch, make it next, split the feature, or challenge the current status."></textarea>`;
    out += `<div class="aks-actions">`;
    out += `<button class="aks-btn aks-btn-primary" onclick="suggestAksRpE2eDirection()">Send Direction To aks-explorer</button>`;
    out += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('suggest', group))})">Use Feature As Direction</button>`;
    out += `<button class="aks-btn" onclick="prefillAksRpE2eFeatureReviewPrompt(${attrEsc(JSON.stringify([group.id]))})">Review Context</button>`;
    out += `<button class="aks-btn" onclick="selectAksRpE2eReplanPaths(${attrEsc(JSON.stringify(specBackedPathIdsForGroups([group])))})">Seed Replan Paths</button>`;
    out += `</div>`;
    out += `</div>`;
    out += `</div>`;

    out += `<div class="aks-detail-grid">`;
    out += `<div class="aks-panel">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Evidence And Raw Audit Links</div><div class="aks-subtle">Open artifacts to manually verify claims, raw outputs, cleanup, and self-review</div></div></div>`;
    out += `<div class="aks-list">${featureEvidenceCards(groupEvidence)}</div>`;
    out += `</div>`;
    out += `<div class="aks-panel">`;
    out += `<div class="aks-section-head"><div><div class="aks-section-title">Tests And Judgments</div><div class="aks-subtle">Mapped execution cases and model judgments</div></div></div>`;
    if (!featureTests.length && !featureJudgments.length) {
      out += `<div class="aks-empty">No mapped tests or judgments for this feature.</div>`;
    } else {
      out += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
      out += `<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Kind</th><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Status</th><th style="text-align:left;padding:5px;color:var(--fg2);font-weight:500">Context</th></tr>`;
      for (const t of featureTests) {
        out += `<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px;font-family:var(--mono);font-size:11px">${esc(t.id)}</td><td style="padding:5px;color:${resultColor(t.result)}">${esc(t.result || '')}</td><td style="padding:5px;font-family:var(--mono);font-size:10px;color:var(--fg2)">${esc(assignmentPath(t.contextPath))}</td></tr>`;
      }
      for (const j of featureJudgments) {
        const diag = j.diagnosis?.kind ? `${j.diagnosis.kind}: ${j.diagnosis.summary || ''}` : (j.summary || '');
        out += `<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px;font-family:var(--mono);font-size:11px">judgment</td><td style="padding:5px;color:${resultColor(j.status)}">${esc(j.status || '')}</td><td style="padding:5px;font-size:10px;color:var(--fg2)">${esc(diag || assignmentPath(j.contextPath))}</td></tr>`;
      }
      out += `</table>`;
    }
    out += `</div>`;
    out += `</div>`;
    out += `</section>`;
    return out;
  }

  // ── Render ──

  let html = '';

  if (selectedPath) {
    el.style.whiteSpace = 'normal';
    el.style.fontFamily = 'inherit';
    el.style.fontSize = 'inherit';
    el.classList.remove('md-rendered');
    el.innerHTML = pathPageHtml(selectedPath);
    return;
  }

  if (selectedGroup) {
    el.style.whiteSpace = 'normal';
    el.style.fontFamily = 'inherit';
    el.style.fontSize = 'inherit';
    el.classList.remove('md-rendered');
    el.innerHTML = await featurePageHtml(selectedGroup);
    return;
  }

  // User workflow first: current target, owner-agent handoff, audit trail.
  const reviewAsk = '[resume] Review the current aks-rp-e2e knowledge map and next action. Tell me whether the project direction is trustworthy, what is blocked, and what evidence should be audited before changing the model.';
  const blockerAsk = '[resume] Inspect aks-rp-e2e blocked/failing feature paths. Separate product failures, environment blockers, test/probe issues, and source/doc mismatches. Preserve rerun gates and do not blind-rerun gated branches.';
  const replanAsk = '[resume] Design the next high-density AKS RP E2E run plan from the knowledge map. Combine scenarios only when input shape, lifecycle, cleanup, and diagnosis remain clear. Produce a reviewable run plan before execution.';

  html += `<section class="aks-command-grid">`;
  html += `<div class="aks-panel aks-project-brief">`;
  html += `<div class="aks-kicker">Project Goal</div>`;
  html += `<div class="aks-title">AKS input/expectation knowledge workspace</div>`;
  html += `<div class="aks-brief-text">${esc(compactExcerpt(goal, 4) || compactExcerpt(currentState || currentPhase, 3) || 'Active project goal is not recorded in .app/project.json.')}</div>`;
  html += `<div class="aks-metric-grid">`;
  html += miniMetric('inputs', (model.inputVariables || []).length);
  html += miniMetric('expectations', (model.expectationVariables || []).length);
  html += miniMetric('scenarios', (model.userScenarios || []).length);
  html += miniMetric('paths', (pathSummary?.paths || model.featurePaths || []).length);
  html += miniMetric('features', features.length);
  html += miniMetric('evidence', (model.evidence || []).length);
  html += miniMetric('pass', featureCounts.pass || 0, 'var(--green)');
  html += miniMetric('fail', featureCounts.fail || 0, 'var(--red)');
  html += miniMetric('blocked', featureCounts.blocked || 0, 'var(--yellow)');
  html += miniMetric('unknown', featureCounts.unknown || 0, 'var(--fg2)');
  html += `</div>`;
  html += `</div>`;

  html += `<div class="aks-panel aks-next-panel">`;
  html += `<div class="aks-kicker">Next Domain Move</div>`;
  if (currentDomainTask) {
    html += `<div class="aks-target-row"><span class="aks-pill">${esc(currentDomainTask.status || currentDomainTask.result || 'active')}</span><span class="aks-target-name" title="${attrEsc(currentDomainTask.id || currentDomainTask.title || '')}">${esc(currentDomainTask.title || currentDomainTask.id || '')}</span>${currentDomainTask.assignee ? `<span class="aks-subtle">${esc(currentDomainTask.assignee)}</span>` : ''}</div>`;
  }
  if (nextTargetRow) {
    html += `<div class="aks-target-row"><span>${resultIcon(nextTargetRow.status)}</span><span class="aks-target-name" title="${attrEsc(nextTargetId)}">${esc(nextTargetRow.feature.label || nextTargetId)}</span><span class="aks-pill" style="border-color:${resultColor(nextTargetRow.status)};color:${resultColor(nextTargetRow.status)}">${esc(statusName(nextTargetRow.status))}</span></div>`;
  }
  const nextText = sectionExcerpt(nextAction, 8);
  const phaseText = sectionExcerpt(currentPhase || currentState, 4);
  html += `<div class="md-rendered aks-next-copy">${renderMarkdownBlock(nextText || phaseText || 'No next action found in .app/project.json.')}</div>`;
  html += `<div class="aks-actions">`;
  html += `<button class="aks-btn aks-btn-primary" onclick="prefillProjectComment(${jsStringAttr(reviewAsk)})">Review Domain Direction</button>`;
  html += `<a class="aks-btn" href="/projects/aks-rp-e2e/ui/feature/">Evidence Panel</a>`;
  html += `<a class="aks-btn" href="/projects/aks-rp-e2e.app/ui/kanban/">Open Task Kanban</a>`;
  html += `</div>`;
  html += `</div>`;

  html += `<div class="aks-panel">`;
  html += `<div class="aks-kicker">Suggest Direction</div>`;
  html += `<textarea id="aks-direction-suggestion" class="aks-suggest-box" placeholder="Example: focus on BYO ACR blocker next; verify whether this is setup/env or product behavior, then decide whether to update the capability model."></textarea>`;
  html += `<div class="aks-actions">`;
  html += `<button class="aks-btn aks-btn-primary" onclick="suggestAksRpE2eDirection()">Send Direction To aks-explorer</button>`;
  html += `<button class="aks-btn" onclick="document.getElementById('aks-direction-suggestion').value='';suggestAksRpE2eDirection()">Ask aks-explorer To Propose</button>`;
  html += `</div>`;
  html += `</div>`;

  html += `<details class="aks-panel aks-drawer">`;
  html += `<summary class="aks-drawer-summary">Audit Trail <span class="aks-subtle">${recentEvidence.length} recent</span></summary>`;
  html += `<div class="aks-list">`;
  for (const ev of recentEvidence) {
    html += `<div class="aks-list-row"><span class="aks-list-main">${evidenceLinks([ev.id])}</span><span class="aks-list-note">${esc((ev.summary || '').slice(0, 120))}${(ev.summary || '').length > 120 ? '...' : ''}</span></div>`;
  }
  html += `</div>`;
  html += `<div class="aks-actions" style="margin-top:10px">`;
  html += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(blockerAsk)})">Inspect Blockers</button>`;
  html += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(replanAsk)})">Design Replan</button>`;
  html += `</div>`;
  html += `</details>`;
  html += `</section>`;

  html += `<section class="aks-work-grid">`;
  html += `<details class="aks-panel aks-drawer">`;
  html += `<summary class="aks-drawer-summary">Attention Queue <span class="aks-subtle">${attentionRows.length} items needing action</span></summary>`;
  html += `<div class="aks-list">`;
  for (const row of attentionRows) {
    const ev = [...new Set([...(row.judgments || []).flatMap(j => j.evidence || []), ...(row.tests || []).flatMap(t => t.evidence || [])])];
    html += `<div class="aks-list-row">`;
    html += `<span class="aks-list-main">${resultIcon(row.status)} <span title="${attrEsc(row.feature.id)}">${esc(row.feature.label || row.feature.id)}</span></span>`;
    html += `<span class="aks-list-note">${esc(nextQuestion(row, model.inputVariables || []) || statusName(row.status))}</span>`;
    html += `<span class="aks-list-links">${evidenceLinks(ev.slice(0, 2)) || ''}</span>`;
    html += `</div>`;
  }
  if (!attentionRows.length) html += `<div class="aks-empty">No fail, blocked, or unknown feature rows in the current filter.</div>`;
  html += `</div>`;
  html += `</details>`;

  const probeLadder = [
    ['managedsystem-pool-rest-add-existing', 'ManagedSystem REST add-existing'],
    ['workload-autoscaler-vpa-upgrade-survival-runtime', 'VPA upgrade survival'],
    ['bootstrap-profile-managed-acr-lifecycle', 'Bootstrap managed ACR lifecycle'],
    ['bootstrap-profile-byo-acr-lifecycle', 'Bootstrap BYO ACR lifecycle'],
  ];
  html += `<details class="aks-panel aks-drawer">`;
  html += `<summary class="aks-drawer-summary">Probe Ladder <span class="aks-subtle">${probeLadder.length} probes</span></summary>`;
  probeLadder.forEach(([featureId, label], index) => {
    const row = rowByFeatureId[featureId];
    const status = row?.status || (featureId === nextTargetId ? 'unknown' : 'uncovered');
    const statusText = featureId === nextTargetId && status !== 'pass' ? `next/${status}` : status;
    html += `<div class="aks-step-row"><span class="aks-step-index">${index + 1}</span><span title="${attrEsc(featureId)}">${esc(label)}</span><span class="aks-step-status" style="color:${resultColor(status)}">${esc(statusText)}</span></div>`;
  });
  html += `</details>`;
  html += `</section>`;

  const reviewQueueGroups = selectedFeatureGroups.length
    ? selectedFeatureGroups
    : groups
      .filter(group => ['fail', 'blocked', 'unknown', 'uncovered'].includes(group.status))
      .sort((a, b) => statusPriority.indexOf(a.status) - statusPriority.indexOf(b.status) || String(a.label).localeCompare(String(b.label)))
      .slice(0, 8);
  const selectedSpecBackedPathIds = specBackedPathIdsForGroups(selectedFeatureGroups);
  const selectedFeaturePathCount = selectedFeatureGroups.reduce((sum, group) => sum + pathsForFeatureGroup(group).length, 0);
  const selectedSpecs = specsForPaths(selectedFeatureGroups.flatMap(pathsForFeatureGroup));
  const selectedCompatibleGroups = compatibleGroupSummary(selectedSpecs);

  html += `<section class="aks-replan-grid" data-testid="selected-workbench">`;
  html += `<div class="aks-panel">`;
  html += `<div class="aks-section-head"><div><div class="aks-section-title" data-testid="selected-workbench-title">Selected Workbench</div><div class="aks-subtle">Select features/paths, review source/spec/evidence context, check compatibility, then replan or request review.</div></div><div class="aks-subtle">${selectedFeatureIds.length} selected</div></div>`;
  html += `<div class="aks-metric-grid" style="margin-bottom:10px">`;
  html += miniMetric('selected features', selectedFeatureIds.length);
  html += miniMetric('related paths', selectedFeaturePathCount);
  html += miniMetric('spec-backed paths', selectedSpecBackedPathIds.length);
  html += miniMetric('test specs', selectedSpecs.length);
  html += `</div>`;
  if (selectedFeatureGroups.length) {
    html += `<div class="aks-audit-box" style="margin-bottom:10px">`;
    html += `<div class="aks-audit-box-title">Combined Replan Compatibility</div>`;
    html += `<div style="font-size:11px;color:var(--fg2);line-height:1.45">${selectedCompatibleGroups.length ? esc(selectedCompatibleGroups.join(' · ')) : 'No compatible spec groups found for the selected features yet.'}</div>`;
    html += `</div>`;
  } else {
    html += `<div class="aks-empty" style="margin-bottom:10px">No features selected yet. Use the queue below or the Feature Status table to choose features for review and combined replanning.</div>`;
  }
  html += `<div class="aks-list">`;
  for (const group of reviewQueueGroups) {
    const groupPaths = pathsForFeatureGroup(group);
    const groupSpecs = specsForPaths(groupPaths);
    const groupSpecPathIds = specBackedPathIdsForGroups([group]);
    const refs = groupSpecs.flatMap(spec => spec.sourceRefs || []);
    const checked = selectedFeatureIds.includes(group.id) ? 'checked' : '';
    const groupGap = group.rows.map(r => featureGap(r, model.inputVariables || [])).find(Boolean) || 'No active gap recorded.';
    html += `<label class="aks-replan-row">`;
    html += `<input type="checkbox" ${checked} onchange="toggleAksRpE2eFeatureSelection(${jsStringAttr(group.id)}, this.checked)" />`;
    html += `<span style="min-width:0">`;
    html += `<span class="aks-replan-title" title="${attrEsc(group.id)}">${esc(group.label)}</span>`;
    html += `<span style="display:block;font-size:10px;color:var(--fg2);margin-top:3px;overflow-wrap:anywhere">${esc(groupFeatureIds(group).join(', '))}</span>`;
    html += `<span style="display:block;font-size:11px;color:var(--fg2);margin-top:5px;line-height:1.35">${esc(groupGap)}</span>`;
    html += `<span style="display:block;font-size:10px;margin-top:5px">${sourceRefLinks(refs, 4)}</span>`;
    html += `</span>`;
    html += `<span style="display:grid;gap:4px;justify-items:end">`;
    html += `<span class="aks-pill" style="color:${resultColor(group.status)};border-color:${resultColor(group.status)}">${esc(statusName(group.status))}</span>`;
    html += `<span class="aks-pill">${groupPaths.length} path${groupPaths.length === 1 ? '' : 's'}</span>`;
    html += `<span class="aks-pill">${groupSpecs.length} spec${groupSpecs.length === 1 ? '' : 's'}</span>`;
    html += `<button type="button" class="aks-btn" style="padding:4px 8px" onclick="event.preventDefault();event.stopPropagation();openAksRpE2eFeature(${jsStringAttr(group.id)})">Open</button>`;
    if (groupSpecPathIds.length) {
      html += `<button type="button" class="aks-btn" style="padding:4px 8px" onclick="event.preventDefault();event.stopPropagation();selectAksRpE2eReplanPaths(${attrEsc(JSON.stringify(groupSpecPathIds))})">Use Paths</button>`;
    }
    html += `</span>`;
    html += `</label>`;
  }
  if (!reviewQueueGroups.length) html += `<div class="aks-empty">No actionable feature groups found in the current filter.</div>`;
  html += `</div>`;
  html += `<div class="aks-actions">`;
  if (selectedSpecBackedPathIds.length) {
    html += `<button class="aks-btn aks-btn-primary" onclick="submitAksRpE2eFeatureReplanPrompt(${attrEsc(JSON.stringify(selectedSpecBackedPathIds))}, ${attrEsc(JSON.stringify(selectedFeatureIds))})">Replan Selected</button>`;
    html += `<button class="aks-btn" onclick="selectAksRpE2eReplanPaths(${attrEsc(JSON.stringify(selectedSpecBackedPathIds))})">Seed Path Builder</button>`;
  } else if (selectedFeatureIds.length) {
    html += `<button class="aks-btn aks-btn-primary" onclick="prefillAksRpE2eFeatureReviewPrompt(${attrEsc(JSON.stringify(selectedFeatureIds))})">Review / Plan Selected</button>`;
  }
  html += `<button class="aks-btn" onclick="prefillAksRpE2eFeatureReviewPrompt(${attrEsc(JSON.stringify(selectedFeatureIds))})">Review Selected Features</button>`;
  html += `<button class="aks-btn" onclick="clearAksRpE2eFeatureSelection()">Clear Selection</button>`;
  html += `</div>`;
  html += `</div>`;

  const reviewLinks = [
    ['Knowledge model', 'model/knowledge-map/model.json'],
    ['Path summary', 'model/knowledge-map/views/path-summary.json'],
    ['Status summary', 'model/knowledge-map/views/status-summary.json'],
    ['Feature packets', 'features/README.md'],
    ['Test spec index', 'specs/index.json'],
    ['Run plan guide', 'suites/README.md'],
    ['Execution guide', 'replays/execution/README.md'],
  ];
  html += `<details class="aks-panel aks-drawer">`;
  html += `<summary class="aks-drawer-summary">Review Inputs <span class="aks-subtle">${reviewLinks.length} links</span></summary>`;
  html += `<div class="aks-list">`;
  for (const [label, ref] of reviewLinks) {
    html += `<div class="aks-list-row"><span class="aks-list-main">${esc(label)}</span><span class="aks-list-note">${sourceRefLinks([ref], 1)}</span></div>`;
  }
  html += `</div>`;
  html += `<div class="aks-audit-box" style="margin-top:10px">`;
  html += `<div class="aks-audit-box-title">How To Use This Page</div>`;
  html += `<div style="font-size:11px;color:var(--fg2);line-height:1.45">Select feature groups when you want to review design/API/test-spec evidence or ask aks-explorer to combine compatible scenarios. Use the path builder below when you already know the exact knowledge paths to combine.</div>`;
  html += `</div>`;
  html += `</details>`;
  html += `</section>`;

  html += `<section class="aks-replan-grid" data-testid="replan-builder">`;
  html += `<div class="aks-panel">`;
  html += `<div class="aks-section-head"><div><div class="aks-section-title">Path-Level Replan</div><div class="aks-subtle">Fine-grained path selection for combined run plans. Reached via Selected Workbench "Seed Path Builder" or manual path checkboxes.</div></div><div class="aks-subtle">${replanPathIds.length} selected</div></div>`;
  if (!testSpecIndex) {
    html += `<div class="aks-empty">specs/index.json is not available yet, so replanning preview is hidden.</div>`;
  } else {
    html += `<div class="aks-replan-list">`;
    for (const path of replanCandidates) {
      const spec = testSpecForPath(path.id);
      const checked = replanPathIds.includes(path.id) ? 'checked' : '';
      html += `<label class="aks-replan-row">`;
      html += `<input type="checkbox" ${checked} onchange="toggleAksRpE2eReplanPath(${jsStringAttr(path.id)}, this.checked)" />`;
      html += `<span style="min-width:0">`;
      html += `<span class="aks-replan-title" title="${attrEsc(path.id)}">${esc(path.featureLabel || path.featureId)}</span>`;
      html += `<span style="display:block;font-size:10px;color:var(--fg2);margin-top:3px;overflow-wrap:anywhere">${esc(path.id)}</span>`;
      html += `<span style="display:block;font-size:10px;color:var(--fg2);margin-top:5px">${summaryInputChips(path.selectedInputs, 4) || 'no selected inputs'}</span>`;
      html += `</span>`;
      html += `<span style="display:grid;gap:4px;justify-items:end"><span class="aks-pill" style="color:${resultColor(path.status)};border-color:${resultColor(path.status)}">${esc(statusName(path.status))}</span><span class="aks-pill" title="${attrEsc(spec?.compatibleGroupKey || 'No test spec yet')}">${esc(spec ? 'spec' : 'no spec')}</span></span>`;
      html += `</label>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  html += `<div class="aks-panel">`;
  html += `<div class="aks-section-head"><div><div class="aks-section-title">Replan Preview</div><div class="aks-subtle">The e2e test covers this same path: model -> specs -> selection -> generated dry-run probe.</div></div></div>`;
  html += `<div class="aks-metric-grid" style="margin-bottom:10px">`;
  html += miniMetric('accepted paths', replanPreview.metrics.accepted);
  html += miniMetric('baseline CRUD', replanPreview.metrics.baseline);
  html += miniMetric('replanned CRUD', replanPreview.metrics.replanned);
  html += miniMetric('CRUD saved', replanPreview.metrics.saved, replanPreview.metrics.saved ? 'var(--green)' : 'var(--fg2)');
  html += miniMetric('assertions/run', replanPreview.metrics.density);
  html += `</div>`;
  if (replanPreview.groups.length) {
    for (const group of replanPreview.groups) {
      html += `<div class="aks-audit-box" style="margin-bottom:8px">`;
      html += `<div class="aks-audit-box-title">Compatible Group</div>`;
      html += `<div style="font-family:var(--mono);font-size:11px;color:var(--fg2);overflow-wrap:anywhere">${esc(group.key)}</div>`;
      html += `<div style="margin-top:7px;display:grid;gap:4px">`;
      for (const item of group.items) {
        html += `<div style="display:flex;gap:6px;align-items:center;min-width:0"><span>${resultIcon(item.path.status)}</span><span style="font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${attrEsc(item.path.id)}">${esc(item.path.featureLabel || item.path.featureId)}</span><span class="aks-subtle" style="margin-left:auto">${esc(item.spec.sequenceOrder || '')}</span></div>`;
      }
      html += `</div>`;
      html += `</div>`;
    }
  } else {
    html += `<div class="aks-empty">Select one or more paths with test specs to preview a high-density run.</div>`;
  }
  if (replanPreview.rejected.length) {
    html += `<div class="aks-audit-box" style="border-color:var(--yellow);margin-bottom:8px"><div class="aks-audit-box-title">Rejected</div>`;
    for (const rejected of replanPreview.rejected) {
      html += `<div style="font-size:11px;color:var(--fg2);line-height:1.45"><code>${esc(rejected.pathId)}</code>: ${esc(rejected.reason)}</div>`;
    }
    html += `</div>`;
  }
  const selectedList = replanPathIds.join(',');
  html += `<div class="aks-actions">`;
  html += `<button class="aks-btn aks-btn-primary" onclick="submitAksRpE2eReplanPrompt()">Ask aks-explorer To Replan</button>`;
  html += `<button class="aks-btn" onclick="submitAksRpE2eLiveRunPrompt()">Ask aks-explorer To Run Live</button>`;
  html += `<button class="aks-btn" onclick="clearAksRpE2eReplanSelection()">Clear</button>`;
  if (selectedList) {
    html += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(`[resume] Run local replanning e2e for selected paths and inspect generated artifacts:\\n\\ncd /app/projects/aks-rp-e2e && bun model/tools/src/replan-feature-paths.ts --select=${selectedList} --out-dir=.app/decisions/replans/manual-preview && bun test .app/e2e/replanning-flow.test.ts`)})">Use Local Command</button>`;
  }
  html += `</div>`;
  html += `</div>`;
  html += `</section>`;

  html += `<section class="aks-panel" style="margin-bottom:16px">`;
  html += `<div class="aks-section-head">`;
  html += `<div><div class="aks-section-title">Knowledge Map</div><div class="aks-subtle">Scenario -> input DAG selection -> feature path -> behavior alignment -> evidence</div></div>`;
  html += `<div class="aks-subtle">top ${(pathRows.length || mapRows.length)} paths</div>`;
  html += `</div>`;
  html += `<div class="aks-map-grid">`;
  html += `<div class="aks-map-head">Input Selection</div><div></div><div class="aks-map-head">Feature Path</div><div></div><div class="aks-map-head">Behavior</div><div class="aks-map-head">Evidence</div>`;
  if (pathRows.length) {
    for (const path of pathRows) {
      html += `<div class="aks-map-cell">${summaryInputChips(path.selectedInputs, 5) || '<span class="aks-subtle">none</span>'}</div>`;
      html += `<div class="aks-map-arrow">→</div>`;
      html += `<div class="aks-map-cell aks-feature-cell" style="border-left-color:${resultColor(path.status)}"><div style="display:flex;align-items:center;gap:6px">${resultIcon(path.status)}<span style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${attrEsc(path.id)}">${esc(path.featureLabel || path.featureId)}</span><button class="aks-btn" style="margin-left:auto;padding:4px 8px" onclick="openAksRpE2ePath(${jsStringAttr(path.id)})">Open</button></div><div style="font-size:10px;color:var(--fg2);margin-top:5px">${esc(path.scenarioTitle || path.scenarioId)}</div></div>`;
      html += `<div class="aks-map-arrow">→</div>`;
      html += `<div class="aks-map-cell">${behaviorChips(path.behavior, 5) || '<span class="aks-subtle">none</span>'}</div>`;
      html += `<div class="aks-map-cell aks-map-evidence">${evidenceLinks((path.evidence || []).slice(0, 3)) || '<span class="aks-subtle">none</span>'}</div>`;
    }
  } else {
    for (const row of mapRows) {
      const ev = rowEvidenceIds(row);
      const next = nextQuestion(row, model.inputVariables || []);
      html += `<div class="aks-map-cell">${pathChips(row.feature.inputPath, 5) || '<span class="aks-subtle">none</span>'}</div>`;
      html += `<div class="aks-map-arrow">→</div>`;
      html += `<div class="aks-map-cell aks-feature-cell" style="border-left-color:${resultColor(row.status)}"><div style="display:flex;align-items:center;gap:6px">${resultIcon(row.status)}<span style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${attrEsc(row.feature.id)}">${esc(row.feature.label || row.feature.id)}</span></div>${next ? `<div style="font-size:10px;color:var(--fg2);margin-top:5px">${esc(next)}</div>` : ''}</div>`;
      html += `<div class="aks-map-arrow">→</div>`;
      html += `<div class="aks-map-cell">${pathChips(row.feature.expectationPath, 5) || '<span class="aks-subtle">none</span>'}</div>`;
      html += `<div class="aks-map-cell aks-map-evidence">${evidenceLinks(ev.slice(0, 3)) || '<span class="aks-subtle">none</span>'}</div>`;
    }
  }
  html += `</div>`;
  html += `</section>`;

  // Env toggle with counts
  if (allEnvs.length > 1) {
    html += `<div style="display:flex;gap:0;margin-bottom:12px;border:1px solid var(--border);border-radius:6px;overflow:hidden;width:fit-content">`;
    for (const env of ['all', ...allEnvs]) {
      const active = env === selectedEnv;
      const ec = env === 'all' ? counts : (envCounts[env] || {});
      const p = ec.pass || 0;
      const f = ec.fail || 0;
      const label = env === 'all' ? 'All' : env;
      const badge = `<span style="color:var(--green)">${p}✓</span> <span style="color:var(--red)">${f}✗</span>`;
      html += `<button onclick="sessionStorage.setItem('aksSelectedEnv','${env}');renderAksRpE2eQualityPanel(this.closest('#quality-panel')||this.closest('#project-tab-content'))" style="padding:6px 14px;font-size:12px;border:none;cursor:pointer;font-family:var(--font,inherit);background:${active ? 'var(--bg3)' : 'var(--bg2)'};color:${active ? 'var(--fg)' : 'var(--fg2)'};${active ? 'box-shadow:inset 0 -2px 0 var(--accent);' : ''}">`;      html += `${esc(label)} <span style="font-size:10px;margin-left:4px">${badge}</span>`;
      html += `</button>`;
    }
    html += `</div>`;
  }

  // Summary bar
  const summaryParts = [];
  if (counts.pass) summaryParts.push(`<span style="color:var(--green)">${counts.pass} pass</span>`);
  if (counts.fail) summaryParts.push(`<span style="color:var(--red)">${counts.fail} fail</span>`);
  if (counts.blocked) summaryParts.push(`<span style="color:var(--yellow)">${counts.blocked} blocked</span>`);
  if (counts.unknown) summaryParts.push(`<span style="color:var(--fg2)">${counts.unknown} unknown</span>`);
  if (counts.uncovered) summaryParts.push(`<span style="color:var(--fg2)">${counts.uncovered} uncovered</span>`);

  html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:16px">`;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">`;
  html += `<div style="font-size:15px;font-weight:600">${passCount}/${totalCount} features covered</div>`;
  html += `<div style="font-size:13px">${summaryParts.join(' · ')}</div>`;
  html += `</div>`;
  // Progress bar
  const pctPass = totalCount ? Math.round((passCount / totalCount) * 100) : 0;
  const pctFail = totalCount ? Math.round(((counts.fail || 0) / totalCount) * 100) : 0;
  const pctOther = 100 - pctPass - pctFail;
  html += `<div style="margin-top:10px;height:6px;border-radius:3px;background:var(--bg3);overflow:hidden;display:flex">`;
  if (pctPass) html += `<div style="width:${pctPass}%;background:var(--green)"></div>`;
  if (pctFail) html += `<div style="width:${pctFail}%;background:var(--red)"></div>`;
  if (pctOther) html += `<div style="width:${pctOther}%;background:var(--border)"></div>`;
  html += `</div>`;
  html += `</div>`;

  // Feature list
  html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">`;
  html += `<div class="aks-section-head" style="padding:14px 16px 8px;margin-bottom:0">`;
  html += `<div><div class="aks-section-title" data-testid="feature-explorer-title">Feature Explorer</div><div class="aks-subtle">The primary review surface. Browse AKS feature groups by status, gap, evidence, and specs. Open, select, review, challenge, or suggest actions per feature.</div></div>`;
  html += `<div class="aks-subtle">${groups.length} feature groups</div>`;
  html += `</div>`;
  html += `<table class="aks-feature-table"><thead><tr><th style="width:30%">Feature</th><th style="width:12%">Status</th><th>Current gap / next verification</th><th style="width:18%">Evidence</th><th style="width:14%">Actions</th></tr></thead></table>`;

  for (const group of groups) {
    const featureTests = filteredTests.filter(t => group.rows.some(r => r.feature.id === t.featureId));
    const runCount = featureTests.length;
    const env = [...new Set(group.judgments.map(j => judgmentEnv(j)).filter(Boolean))].join(', ');
    const next = group.rows.map(r => nextQuestion(r, model.inputVariables || [])).find(Boolean);
    const needsAction = group.status === 'fail' || group.status === 'uncovered' || group.status === 'blocked' || group.status === 'unknown';
    const detailId = `detail-${group.id.replace(/[^a-zA-Z0-9-]/g, '_')}`;
    const groupEvidence = [...new Set(group.rows.flatMap(rowEvidenceIds))];
    const groupGap = group.rows.map(r => featureGap(r, model.inputVariables || [])).find(Boolean) || 'No active gap recorded.';
    const groupClaim = group.rows.map(statusTextWithClaim).find(Boolean) || statusName(group.status);
    const groupSelected = selectedFeatureIds.includes(group.id);

    // Main row
    html += `<div style="border-bottom:1px solid var(--border)">`;
    html += `<div onclick="document.getElementById('${detailId}').toggleAttribute('open')" style="display:grid;grid-template-columns:minmax(220px,1.1fr) 110px minmax(260px,1.4fr) minmax(160px,.85fr) 130px;gap:8px;align-items:start;padding:10px 14px;cursor:pointer;user-select:none">`;
    html += `<div style="min-width:0"><div style="display:flex;align-items:center;gap:8px;min-width:0"><span style="font-size:14px;flex:0 0 16px;text-align:center">${resultIcon(group.status)}</span><span style="font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;user-select:text;cursor:text" title="${attrEsc(group.id)}">${esc(group.label)}</span></div><div style="font-size:10px;color:var(--fg2);font-family:var(--mono);margin-left:24px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(group.rows.map(r => r.feature.id).join(', '))}</div></div>`;
    // Per-status breakdown for the group
    const rowCounts = {};
    for (const r of group.rows) rowCounts[r.status] = (rowCounts[r.status] || 0) + 1;
    const breakdown = [];
    if (rowCounts.pass) breakdown.push(`<span style="color:var(--green)">${rowCounts.pass}✓</span>`);
    if (rowCounts.fail) breakdown.push(`<span style="color:var(--red)">${rowCounts.fail}✗</span>`);
    for (const s of ['blocked','unknown','uncovered']) if (rowCounts[s]) breakdown.push(`<span style="color:var(--fg2)">${rowCounts[s]} ${s}</span>`);
    html += `<div style="font-size:11px;display:flex;gap:6px;flex-wrap:wrap">${breakdown.join('')} ${env ? `<span style="color:var(--fg2);font-family:var(--mono)">${esc(env)}</span>` : ''}</div>`;
    html += `<div class="aks-gap-line"><span class="aks-gap-label">Gap</span><span title="${attrEsc(groupGap)}">${esc(groupGap)}</span></div>`;
    html += `<div style="font-size:10px;line-height:1.4;max-height:42px;overflow:hidden">${evidenceLinks(groupEvidence.slice(0, 3)) || '<span class="aks-subtle">No evidence</span>'}</div>`;
    html += `<div style="display:flex;gap:6px;flex-wrap:wrap" onclick="event.stopPropagation()">`;
    html += `<button class="aks-btn aks-btn-primary" onclick="openAksRpE2eFeature(${jsStringAttr(group.id)})">Open</button>`;
    html += `<label class="aks-btn" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" ${groupSelected ? 'checked' : ''} onchange="toggleAksRpE2eFeatureSelection(${jsStringAttr(group.id)}, this.checked)" /> Select</label>`;
    html += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('audit', group))})">Audit</button>`;
    html += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('suggest', group))})">Suggest</button>`;
    html += `</div>`;
    html += `</div>`;

    // Next action hint (shown inline for items needing action)
    if (needsAction && next) {
      html += `<div style="padding:0 14px 8px 40px;font-size:12px;color:var(--fg2)">→ ${esc(next)}</div>`;
    }

    // Expandable detail
    html += `<details id="${detailId}" style="padding:0 14px 12px 40px">`;
    html += `<summary style="font-size:11px;color:var(--fg2);cursor:pointer;margin-bottom:8px">Details</summary>`;
    html += `<div class="aks-feature-toolbar">`;
    html += `<button class="aks-btn aks-btn-primary" onclick="openAksRpE2eFeature(${jsStringAttr(group.id)})">Open Feature Page</button>`;
    html += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('audit', group))})">Audit Feature</button>`;
    html += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('manual', group))})">Manual Verify</button>`;
    html += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('suggest', group))})">Suggest As Next</button>`;
    html += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(featureActionPrompt('challenge', group))})">Challenge Verdict</button>`;
    html += `</div>`;
    html += `<div class="aks-audit-grid">`;
    html += `<div class="aks-audit-box"><div class="aks-audit-box-title">Current Claim</div><div style="font-size:12px;color:var(--fg)">${esc(groupClaim)}</div><div class="aks-gap-line" style="margin-top:6px"><span class="aks-gap-label">Next</span><span>${esc(groupGap)}</span></div></div>`;
    html += `<div class="aks-audit-box"><div class="aks-audit-box-title">Input Path</div>${group.rows.map(r => pathChips(r.feature.inputPath, 8) || '<span class="aks-subtle">none</span>').join('<div style="height:5px"></div>')}</div>`;
    html += `<div class="aks-audit-box"><div class="aks-audit-box-title">Expectation Path</div>${group.rows.map(r => pathChips(r.feature.expectationPath, 8) || '<span class="aks-subtle">none</span>').join('<div style="height:5px"></div>')}</div>`;
    html += `<div class="aks-audit-box"><div class="aks-audit-box-title">Source / Notes</div><div style="font-size:11px;color:var(--fg2);line-height:1.45">${esc(group.rows.map(r => r.feature.description || '').filter(Boolean).join(' ') || 'No feature description recorded in the capability model.')}</div></div>`;
    html += `</div>`;

    // ── Per-Path Verification Status ──
    const featurePaths = pathsForFeatureGroup(group);
    if (featurePaths.length > 0) {
      html += `<div style="margin-bottom:8px">`;
      html += `<div style="font-size:10px;color:var(--fg2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Knowledge Paths</div>`;
      html += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
      html += `<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 6px;color:var(--fg2);font-weight:500">Path</th><th style="text-align:left;padding:4px 6px;color:var(--fg2);font-weight:500">Status</th><th style="text-align:left;padding:4px 6px;color:var(--fg2);font-weight:500">Verification</th><th style="text-align:left;padding:4px 6px;color:var(--fg2);font-weight:500">Input Shape</th><th style="text-align:left;padding:4px 6px;color:var(--fg2);font-weight:500">Actions</th></tr>`;
      for (const fp of featurePaths) {
        const fpSpec = testSpecForPath(fp.id);
        const fpVState = deriveVerificationState(fp, fpSpec);
        const inputSummary = (fp.selectedInputs || []).slice(0, 3).map(i => i.label || `${i.variable}=${i.value}`).join(', ');
        html += `<tr style="border-bottom:1px solid var(--border)">`;
        html += `<td style="padding:4px 6px;font-family:var(--mono);font-size:11px;cursor:pointer;color:var(--accent)" onclick="openAksRpE2ePath(${jsStringAttr(fp.id)})">${esc(fp.id.replace(/^path\./, ''))}</td>`;
        html += `<td style="padding:4px 6px;color:${resultColor(fp.status)};font-weight:600">${esc(statusName(fp.status))}</td>`;
        html += `<td style="padding:4px 6px;color:${verificationStateColor(fpVState)};font-size:11px">${verificationStateLabel(fpVState)}</td>`;
        html += `<td style="padding:4px 6px;font-size:11px;color:var(--fg2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${attrEsc(inputSummary)}">${esc(inputSummary || '—')}</td>`;
        html += `<td style="padding:4px 6px"><button class="aks-btn" style="font-size:10px;padding:2px 8px" onclick="openAksRpE2ePath(${jsStringAttr(fp.id)})">Open</button></td>`;
        html += `</tr>`;
      }
      html += `</table></div>`;
    }

    // Merged evidence table — one row per test, with judgment diagnosis and linked resources
    const featureJudgments = group.judgments;
    if (featureTests.length > 0 || featureJudgments.length > 0) {
      html += `<div style="margin-bottom:8px">`;
      html += `<div style="font-size:10px;color:var(--fg2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Evidence</div>`;
      html += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
      html += `<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 6px;color:var(--fg2);font-weight:500">Test</th><th style="text-align:left;padding:4px 6px;color:var(--fg2);font-weight:500">Status</th><th style="text-align:left;padding:4px 6px;color:var(--fg2);font-weight:500">Env</th><th style="text-align:left;padding:4px 6px;color:var(--fg2);font-weight:500">Links</th></tr>`;

      // Build lookup: featureId → judgment
      const judgByFeature = {};
      for (const j of featureJudgments) {
        if (!judgByFeature[j.featureId]) judgByFeature[j.featureId] = [];
        judgByFeature[j.featureId].push(j);
      }

      for (const t of featureTests) {
        const env = assignmentValue(t.contextPath, 'observation.environment') || '—';
        const matchedJ = (judgByFeature[t.featureId] || []).find(j => judgmentEnv(j) === env);
        // Merge evidence from test + matched judgment
        const allEvIds = [...new Set([...(t.evidence || []), ...(matchedJ?.evidence || [])])];
        html += `<tr style="border-bottom:1px solid var(--border)">`;
        html += `<td style="padding:4px 6px;font-family:var(--mono);font-size:11px;user-select:text">${esc(t.id)}</td>`;
        html += `<td style="padding:4px 6px;color:${resultColor(t.result)};font-weight:600">${esc(t.result)}</td>`;
        html += `<td style="padding:4px 6px;font-family:var(--mono);font-size:11px">${esc(env)}</td>`;
        html += `<td style="padding:4px 6px">${evidenceLinks(allEvIds) || '<span style="color:var(--fg2)">—</span>'}</td>`;
        html += `</tr>`;
        // Diagnosis subtitle
        if (matchedJ) {
          const diag = matchedJ.diagnosis?.kind ? `${matchedJ.diagnosis.kind}${matchedJ.diagnosis.summary ? `: ${matchedJ.diagnosis.summary}` : ''}` : (matchedJ.summary || '');
          if (diag) {
            html += `<tr style="border-bottom:1px solid var(--border)"><td colspan="4" style="padding:2px 6px 6px 24px;font-size:11px;color:var(--fg2);font-style:italic">${esc(diag)}</td></tr>`;
          }
        }
        // Input → Observed (collapsed)
        const inputObs = [assignmentPath(t.inputPath), assignmentPath(t.observedPath)].filter(Boolean).join(' → ');
        if (inputObs) {
          html += `<tr style="border-bottom:1px solid var(--border)"><td colspan="4" style="padding:2px 6px 4px 24px;font-family:var(--mono);font-size:10px;color:var(--fg2)">${esc(inputObs)}</td></tr>`;
        }
      }

      // Orphan judgments (no matching test)
      const testFeatureIds = new Set(featureTests.map(t => t.featureId));
      const orphanJudgments = featureJudgments.filter(j => !testFeatureIds.has(j.featureId));
      for (const j of orphanJudgments) {
        const diag = j.diagnosis?.kind ? `${j.diagnosis.kind}${j.diagnosis.summary ? `: ${j.diagnosis.summary}` : ''}` : (j.summary || '—');
        html += `<tr style="border-bottom:1px solid var(--border)">`;
        html += `<td style="padding:4px 6px;font-size:11px;color:var(--fg2)">judgment</td>`;
        html += `<td style="padding:4px 6px;color:${resultColor(j.status)};font-weight:600">${esc(j.status)}</td>`;
        html += `<td style="padding:4px 6px;font-family:var(--mono);font-size:11px">${esc(judgmentEnv(j))}</td>`;
        html += `<td style="padding:4px 6px">${evidenceLinks(j.evidence) || '<span style="color:var(--fg2)">—</span>'} <span style="color:var(--fg2);font-size:11px">${esc(diag)}</span></td>`;
        html += `</tr>`;
      }

      html += `</table></div>`;
    }

    html += `</details>`;
    html += `</div>`;
  }
  html += `</div>`;

  // Action buttons
  const actions = [
    { label: 'Review Direction', text: reviewAsk },
    { label: 'Inspect Blockers', text: blockerAsk },
    { label: 'Design Replan', text: replanAsk },
  ];
  html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">`;
  html += `<a class="aks-btn aks-btn-primary" href="/projects/aks-rp-e2e.app/ui/kanban/">Open Task Kanban</a>`;
  html += `<a class="aks-btn" href="/projects/aks-rp-e2e/ui/feature/">Evidence Panel</a>`;
  for (const a of actions) {
    html += `<button class="aks-btn" onclick="prefillProjectComment(${jsStringAttr(a.text)})">${esc(a.label)}</button>`;
  }
  html += `</div>`;

  // Collapsed sections: Weaknesses, Validation, Plan
  if (weaknesses) {
    html += `<details style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">`;
    html += `<summary style="padding:10px 14px;cursor:pointer;font-size:13px;font-weight:500;color:var(--fg)">Weaknesses</summary>`;
    html += `<div class="md-rendered" style="padding:0 14px 12px;font-size:13px">${renderMarkdownBlock(weaknesses)}</div>`;
    html += `</details>`;
  }
  if (validation) {
    html += `<details style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">`;
    html += `<summary style="padding:10px 14px;cursor:pointer;font-size:13px;font-weight:500;color:var(--fg)">Validation</summary>`;
    html += `<div class="md-rendered" style="padding:0 14px 12px;font-size:13px">${renderMarkdownBlock(validation)}</div>`;
    html += `</details>`;
  }
  if (plan) {
    html += `<details style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">`;
    html += `<summary style="padding:10px 14px;cursor:pointer;font-size:13px;font-weight:500;color:var(--fg)">Plan</summary>`;
    html += `<div class="md-rendered" style="padding:0 14px 12px;font-size:13px">${renderMarkdownBlock(plan)}</div>`;
    html += `</details>`;
  }

  el.style.whiteSpace = 'normal';
  el.style.fontFamily = 'inherit';
  el.style.fontSize = 'inherit';
  el.classList.remove('md-rendered');
  el.innerHTML = html;
}
