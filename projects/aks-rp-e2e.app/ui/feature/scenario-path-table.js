/* scenario-path-table.js - feature-local test spec workspace.
   Renders full test specs, mapped knowledge paths, result evidence, and
   owner-agent actions for /projects/aks-rp-e2e/ui/feature?id=<feature-id>.
   Exports: window.renderScenarioPathTable(container)
*/
(function () {
  'use strict';

  const BASE = '/projects/aks-rp-e2e';
  const PATHS_URL = BASE + '/model/knowledge-map/views/path-summary.json';
  const SPECS_URL = BASE + '/specs/index.json';
  const SPEC_BASE = BASE + '/specs/';
  const PROJECT_PATH = 'projects/aks-rp-e2e';
  const TEST_RUN_INDEX = 'runs/index.jsonl';

  const STATUS_COLORS = {
    pass: 'var(--green)',
    fail: 'var(--red)',
    unknown: 'var(--yellow)',
    blocked: 'var(--orange)',
    queued: 'var(--accent)',
    running: 'var(--accent)',
    requested: 'var(--accent)',
    completed: 'var(--green)',
    infra_failed: 'var(--red)',
    canceled: 'var(--fg2)',
    not_ready: 'var(--orange)',
    fixture_not_ready: 'var(--orange)',
    spec_not_ready: 'var(--orange)',
    product_pass: 'var(--green)',
    product_gap: 'var(--red)',
    test_code_bug: 'var(--orange)',
    spec_bug: 'var(--orange)',
    infra_block: 'var(--orange)',
    fixture_blocked: 'var(--orange)',
    inconclusive: 'var(--yellow)',
    partial: 'var(--yellow)',
    ready: 'var(--green)',
    draft: 'var(--yellow)',
    planned: 'var(--fg2)',
    superseded: 'var(--fg2)',
    variant: 'var(--accent)',
  };

  let state = {
    featureId: '',
    rows: [],
    pathMap: {},
    counts: {},
    runsBySpec: {},
  };

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function attrEsc(s) {
    if (typeof window.attrEsc === 'function') return window.attrEsc(s);
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function featureIdFromPage() {
    const q = new URLSearchParams(window.location.search || '');
    return q.get('id') || window.__aksRpE2eFeatureId || sessionStorage.getItem('aksSelectedFeatureId') || '';
  }

  function featureLabel(featureId) {
    if (featureId === 'managedsystem-pool') return 'ManagedSystem Pool';
    return slug(featureId).split('-').filter(Boolean).map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join(' ') || 'Feature';
  }

  function featureTokens(featureId) {
    const id = slug(featureId);
    const tokens = new Set(id.split('-').filter(Boolean));
    if (id === 'managedsystem-pool') {
      tokens.add('managedsystem');
      tokens.add('managed-system');
    }
    return [...tokens];
  }

  function matchesFeaturePath(featureId, path) {
    if (!path) return false;
    const pathText = slug([path.id, path.featureId, path.featureLabel, path.scenarioId, path.scenarioTitle].filter(Boolean).join(' '));
    if (featureId === 'managedsystem-pool') return pathText.includes('managedsystem');
    const fid = slug(featureId);
    if (pathText.includes(fid)) return true;
    return featureTokens(featureId).some(function (token) {
      return token.length > 3 && pathText.includes(token);
    });
  }

  function matchesFeatureSpec(featureId, spec, featurePathIds) {
    const ids = spec.featurePathIds || (spec.featurePathId ? [spec.featurePathId] : []);
    if (ids.some(function (id) { return featurePathIds.has(id); })) return true;
    const text = slug([spec.id, spec.title, spec.sourceScenario?.id, spec.sourceScenario?.title, ...(spec.sourceRefs || [])].join(' '));
    if (featureId === 'managedsystem-pool') return text.includes('managedsystem');
    const fid = slug(featureId);
    if (text.includes(fid)) return true;
    return featureTokens(featureId).some(function (token) {
      return token.length > 3 && text.includes(token);
    });
  }

  function candidateSpecFiles(featureId, specsData) {
    const files = specsData.specFiles || [];
    if (featureId === 'managedsystem-pool') {
      return files.filter(function (file) { return /^managedsystem-/i.test(file); });
    }
    const tokens = featureTokens(featureId).filter(function (token) { return token.length > 3; });
    const filtered = files.filter(function (file) {
      const text = slug(file);
      return tokens.some(function (token) { return text.includes(token); });
    });
    return filtered.length ? filtered : files;
  }

  async function fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch ' + url + ': HTTP ' + resp.status);
    return resp.json();
  }

  async function fetchProjectArtifactText(file, optional) {
    const url = '/api/projects/artifact?path=' + encodeURIComponent(PROJECT_PATH) + '&file=' + encodeURIComponent(file);
    const resp = await fetch(url);
    const data = await resp.json().catch(function () { return {}; });
    if (!resp.ok || data.error) {
      if (optional) return '';
      throw new Error(data.error || ('Failed to fetch ' + file + ': HTTP ' + resp.status));
    }
    return data.content || '';
  }

  async function fetchProjectArtifactJson(file, optional) {
    const text = await fetchProjectArtifactText(file, optional);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      if (optional) return null;
      throw e;
    }
  }

  function parseJsonl(text) {
    return String(text || '').split(/\r?\n/).map(function (line) {
      if (!line.trim()) return null;
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  }

  async function loadFeatureTestRuns(featureId) {
    const indexText = await fetchProjectArtifactText(TEST_RUN_INDEX, true);
    const rawRecords = parseJsonl(indexText).filter(function (record) {
      return record && record.featureId === featureId && record.specId;
    });
    const latestByRun = rawRecords.reduce(function (acc, record) {
      const key = record.runId || record.requestId || JSON.stringify(record);
      const prev = acc[key];
      if (!prev || String(record.updatedAt || record.createdAt || '').localeCompare(String(prev.updatedAt || prev.createdAt || '')) > 0) {
        acc[key] = record;
      }
      return acc;
    }, {});
    const records = Object.values(latestByRun).sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    }).slice(0, 30);

    const enriched = await Promise.all(records.map(async function (record) {
      const statusDoc = record.statusPath ? await fetchProjectArtifactJson(record.statusPath, true) : null;
      const result = record.resultPath ? await fetchProjectArtifactJson(record.resultPath, true) : null;
      const diagnosis = record.diagnosisPath ? await fetchProjectArtifactJson(record.diagnosisPath, true) : null;
      const summary = record.summaryPath ? await fetchProjectArtifactText(record.summaryPath, true) : '';
      const stepsPath = record.stepsPath || (record.runId ? 'runs/executions/' + record.runId + '/steps.jsonl' : '');
      const stepsText = stepsPath ? await fetchProjectArtifactText(stepsPath, true) : '';
      const steps = parseJsonl(stepsText);
      const feedbackPath = record.feedbackPath || (record.runId ? 'runs/executions/' + record.runId + '/feedback.jsonl' : '');
      const feedbackText = feedbackPath ? await fetchProjectArtifactText(feedbackPath, true) : '';
      const feedback = parseJsonl(feedbackText);
      return Object.assign({}, record, { statusDoc, result, diagnosis, summary, stepsPath, steps, feedbackPath, feedback });
    }));

    return enriched.reduce(function (acc, record) {
      if (!acc[record.specId]) acc[record.specId] = [];
      acc[record.specId].push(record);
      return acc;
    }, {});
  }

  async function fetchSpecFile(file) {
    try {
      const spec = await fetchJSON(SPEC_BASE + encodeURIComponent(file));
      spec.file = spec.file || file;
      return spec;
    } catch (e) {
      return { file, loadError: e?.message || String(e) };
    }
  }

  function deriveStatus(pathObjs, spec) {
    if (spec?.status === 'fail') return 'fail';
    if (spec?.status === 'blocked') return 'blocked';
    if (spec?.status === 'partial') return 'partial';
    if (spec?.status === 'superseded') return 'superseded';
    const statuses = (pathObjs || []).map(function (p) { return p.status; }).filter(Boolean);
    if (statuses.includes('fail')) return 'fail';
    if (statuses.includes('blocked')) return 'blocked';
    if (spec?.status === 'pass') return 'pass';
    if (spec?.executionHealth?.state === 'verified' && spec?.executionHealth?.diagnosis === 'passed-live-e2e') return 'pass';
    if (statuses.includes('unknown')) return 'unknown';
    if (statuses.includes('pass')) return 'pass';
    return 'unknown';
  }

  function collectEvidence(pathObjs, spec) {
    const seen = {};
    const out = [];
    function add(item) {
      if (!item || seen[item]) return;
      seen[item] = true;
      out.push(item);
    }
    (pathObjs || []).forEach(function (p) {
      (p.evidence || []).forEach(add);
      (p.behavior || []).forEach(function (b) { (b.evidence || []).forEach(add); });
    });
    (spec?.goldenPath?.verificationChain || []).forEach(function (ref) {
      if (/^evidence\//.test(ref)) add(ref);
    });
    return out;
  }

  function statusBadge(status) {
    const color = statusColor(status);
    return '<span class="feature-test-badge" style="border-color:' + color + ';color:' + color + ';background:' + color + '18">' + esc(status || 'unknown') + '</span>';
  }

  function chip(text, color) {
    const c = color || 'var(--accent)';
    return '<span class="feature-test-chip" style="border-color:' + c + '44;color:' + c + ';background:' + c + '18">' + esc(text) + '</span>';
  }

  function statusColor(status) {
    const s = String(status || 'unknown').toLowerCase();
    if (STATUS_COLORS[s]) return STATUS_COLORS[s];
    if (s.includes('fail')) return STATUS_COLORS.fail;
    if (s.includes('pass')) return STATUS_COLORS.pass;
    if (s.includes('partial') || s.includes('mixed')) return STATUS_COLORS.partial;
    if (s.includes('blocked')) return STATUS_COLORS.blocked;
    if (s.includes('planned')) return STATUS_COLORS.planned;
    return 'var(--fg2)';
  }

  function compactStatus(statuses) {
    const unique = [...new Set((statuses || []).filter(Boolean).map(function (s) { return String(s).toLowerCase(); }))];
    if (!unique.length) return 'unknown';
    if (unique.length === 1) return unique[0];
    if (unique.includes('fail') && unique.includes('pass')) return 'mixed';
    if (unique.some(function (s) { return s.includes('partial'); })) return 'partial';
    if (unique.includes('planned') && unique.length > 1) return 'partial';
    return 'mixed';
  }

  function surfaceLabel(surface) {
    const raw = String(surface || '').trim();
    const s = raw.toLowerCase();
    if (!raw) return '';
    if (s.includes('cli')) return 'CLI';
    if (s.includes('rest') || s.includes('arm')) return 'REST';
    if (s.includes('generated')) return 'generated client';
    if (s.includes('source') || s.includes('e2ev3')) return 'source e2e';
    if (s.includes('typescript') || s.includes('js')) return 'JS replay';
    return raw;
  }

  function addBadgeValue(map, key, status) {
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(status || 'unknown');
  }

  function specBadgeHtml(spec) {
    const envs = {};
    const surfaces = {};
    (spec.environmentCoverage || []).forEach(function (entry) {
      addBadgeValue(envs, entry.environment, entry.status || spec.status);
    });
    (spec.userSurfaceCoverage || []).forEach(function (entry) {
      addBadgeValue(surfaces, surfaceLabel(entry.surface), entry.status || spec.status);
    });
    (spec.executionVariants || []).forEach(function (variant) {
      addBadgeValue(envs, variant.environment, variant.status || spec.status);
      addBadgeValue(surfaces, surfaceLabel(variant.clientSurface), variant.status || spec.status);
    });
    (spec.operations || []).forEach(function (operation) {
      addBadgeValue(surfaces, surfaceLabel(operation.surface), spec.status);
    });
    function render(prefix, map) {
      return Object.keys(map).sort().map(function (key) {
        const status = compactStatus(map[key]);
        return chip(prefix + ': ' + key + ' ' + status, statusColor(status));
      }).join('');
    }
    const html = render('env', envs) + render('surface', surfaces);
    return html || chip('env: unspecified', 'var(--fg2)') + chip('surface: unspecified', 'var(--fg2)');
  }

  function defaultExecutionTarget(spec) {
    const variants = spec.executionVariants || [];
    const primary = variants.find(function (variant) {
      return /staging/i.test(variant.environment || '') &&
        (/rest|arm|typescript|js/i.test([variant.clientSurface, variant.executionSurface].join(' '))) &&
        variant.status === 'pass';
    }) || variants.find(function (variant) {
      return /staging/i.test(variant.environment || '') && /rest|arm|typescript|js/i.test([variant.clientSurface, variant.executionSurface].join(' '));
    });
    if (primary) {
      return {
        id: primary.id,
        environment: primary.environment,
        surface: surfaceLabel(primary.clientSurface || primary.executionSurface),
        status: primary.status || 'unknown',
        executionSurface: primary.executionSurface || '',
        requestShape: primary.requestShape || '',
      };
    }
    const operationSurface = surfaceLabel((spec.operations || []).map(function (op) { return op.surface; }).filter(Boolean)[0] || 'rest');
    return {
      id: 'target.staging-rest-request',
      environment: 'staging',
      surface: operationSurface || 'REST',
      status: spec.status || 'unknown',
      executionSurface: spec.executionStrategy?.replaySurface || '',
      requestShape: 'spec operations',
    };
  }

  function executionTargetRows(spec) {
    const variants = spec.executionVariants || [];
    const rows = variants.length ? variants : [{
      id: 'target.staging-rest-request',
      environment: (spec.environmentCoverage || [])[0]?.environment || 'staging',
      clientSurface: (spec.userSurfaceCoverage || [])[0]?.surface || (spec.operations || [])[0]?.surface || 'rest',
      status: spec.status || 'unknown',
      executionSurface: spec.executionStrategy?.replaySurface || '',
      requestShape: (spec.operations || []).map(function (op) { return op.id; }).join(', '),
      notes: spec.executionStrategy?.brief || '',
    }];
    return rows.map(function (target) {
      const surface = surfaceLabel(target.clientSurface || target.executionSurface);
      const isDefault = target.id === defaultExecutionTarget(spec).id;
      return '<div class="feature-execution-target">' +
        '<div><strong>' + esc(target.environment || 'environment') + '</strong>' +
          '<div class="feature-test-mono">' + esc(surface || target.clientSurface || '') + '</div>' +
          (target.id ? '<div class="feature-test-muted">' + esc(target.id) + '</div>' : '') +
        '</div>' +
        '<div>' +
          statusBadge(target.status || 'unknown') +
          (isDefault ? chip('default trigger target', 'var(--green)') : '') +
          (target.executionSurface ? chip(target.executionSurface, 'var(--accent)') : '') +
          (target.requestShape ? '<div class="feature-test-mono">' + esc(target.requestShape) + '</div>' : '') +
          (target.notes ? '<div class="feature-test-muted">' + esc(target.notes) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function requestFlowRows(spec) {
    const target = defaultExecutionTarget(spec);
    const steps = [
      ['Request', 'Create a project event for this spec and execution target.'],
      ['Accept', 'Project owner agent claims or schedules the work.'],
      ['Preflight', 'Verify auth, target environment, gates, quota, and cleanup plan.'],
      ['Execute', 'Run the linked replay/probe for ' + (target.environment || 'staging') + ' / ' + (target.surface || 'REST') + '.'],
      ['Evaluate', 'Map observed values to the spec assertions.'],
      ['Cleanup', 'Record resource cleanup or explicit retained-resource reason.'],
      ['Publish', 'Write JSON/markdown evidence and update the task tree and feature page state.'],
    ];
    return steps.map(function (step, index) {
      return '<div class="feature-flow-step">' +
        '<span class="feature-flow-index">' + esc(index + 1) + '</span>' +
        '<div><strong>' + esc(step[0]) + '</strong><div class="feature-test-muted">' + esc(step[1]) + '</div></div>' +
      '</div>';
    }).join('');
  }

  function executionOverviewHtml(row) {
    const spec = row.spec;
    const target = defaultExecutionTarget(spec);
    return '<div class="feature-execution-overview">' +
      '<section><div class="feature-test-subhead">Execution Target</div>' +
        '<div class="feature-target-summary">' +
          chip('env: ' + (target.environment || 'staging'), statusColor(target.status)) +
          chip('surface: ' + (target.surface || 'REST'), statusColor(target.status)) +
          (target.executionSurface ? chip('executor: ' + target.executionSurface, 'var(--accent)') : '') +
          (target.requestShape ? chip('shape: ' + target.requestShape, 'var(--fg2)') : '') +
        '</div>' +
        '<div class="feature-test-muted">Trigger Test requests this default target. Other environments and surfaces remain visible as variants below.</div>' +
      '</section>' +
      '<section><div class="feature-test-subhead">Request Flow</div>' + requestFlowRows(spec) + '</section>' +
      '<section class="feature-spec-wide"><div class="feature-test-subhead">Environment / Surface Variants</div>' + executionTargetRows(spec) + '</section>' +
    '</div>';
  }

  function refLink(ref) {
    const value = String(ref || '');
    if (!value) return '';
    if (/^evidence\//.test(value) || /^sources\//.test(value) || /^scenarios\//.test(value) || /^probes\//.test(value) || /^model\//.test(value)) {
      return '<a href="' + BASE + '/' + value.split('/').map(encodeURIComponent).join('/') + '" target="_blank" title="' + attrEsc(value) + '">' + esc(value) + '</a>';
    }
    return '<code title="' + attrEsc(value) + '">' + esc(value) + '</code>';
  }

  function refList(refs, emptyText) {
    const list = (refs || []).filter(Boolean);
    if (!list.length) return '<span class="feature-test-muted">' + esc(emptyText || 'none') + '</span>';
    return list.map(function (ref) {
      return '<div class="feature-test-ref">' + refLink(ref) + '</div>';
    }).join('');
  }

  function compactJson(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  function operationRows(spec) {
    const operations = spec.operations || [];
    if (!operations.length) return '<div class="feature-test-empty">No operations recorded in this spec.</div>';
    return operations.map(function (op) {
      const method = op.method ? chip(op.method, 'var(--purple)') : '';
      const surface = op.surface ? chip(op.surface, 'var(--accent)') : '';
      return '<div class="feature-test-row">' +
        '<div><strong>' + esc(op.id || 'operation') + '</strong><div class="feature-test-muted">' + esc(op.intent || '') + '</div></div>' +
        '<div>' + surface + method + '<div class="feature-test-mono">' + esc(op.pathTemplate || '') + '</div>' +
        (op.requestShapeSource ? '<div class="feature-test-muted">request shape source: ' + esc(op.requestShapeSource) + '</div>' : '') +
        ((op.arguments || []).length ? '<div class="feature-test-muted">arguments: ' + esc((op.arguments || []).join(' ')) + '</div>' : '') +
        (op.body ? '<pre class="feature-test-json">' + esc(JSON.stringify(op.body, null, 2)) + '</pre>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function assertionRows(spec) {
    const assertions = spec.assertions || [];
    if (!assertions.length) return '<div class="feature-test-empty">No assertions recorded in this spec.</div>';
    return assertions.map(function (a) {
      const impact = a.verdictImpact === 'audit' ? chip('audit', 'var(--fg2)') : chip(a.verdictImpact || 'claim', 'var(--green)');
      return '<div class="feature-test-row">' +
        '<div><strong>' + esc(a.id || 'assertion') + '</strong><div class="feature-test-muted">' + esc(a.note || '') + '</div></div>' +
        '<div><div class="feature-test-mono">' + esc(a.behavior || '') + ' = ' + esc(a.expected || '') + '</div>' + impact + '</div>' +
      '</div>';
    }).join('');
  }

  function cleanupRows(spec) {
    const cleanup = spec.cleanup || spec.clusterLifecycle?.cleanup || [];
    if (!cleanup.length) return '<div class="feature-test-empty">No cleanup steps recorded in this spec.</div>';
    return cleanup.map(function (step) {
      if (typeof step === 'string') return '<div class="feature-test-muted">' + esc(step) + '</div>';
      return '<div class="feature-test-row">' +
        '<div><strong>' + esc(step.id || step.surface || 'cleanup') + '</strong></div>' +
        '<div class="feature-test-muted">' + esc(step.intent || compactJson(step)) + '</div>' +
      '</div>';
    }).join('');
  }

  function variantRows(spec) {
    const variants = spec.executionVariants || [];
    if (!variants.length) return '<div class="feature-test-empty">No execution variants recorded.</div>';
    return variants.map(function (variant) {
      return '<div class="feature-test-row">' +
        '<div><strong>' + esc(variant.environment || variant.id || 'variant') + '</strong>' +
          '<div class="feature-test-mono">' + esc(variant.clientSurface || '') + '</div>' +
          (variant.id ? '<div class="feature-test-muted">' + esc(variant.id) + '</div>' : '') +
        '</div>' +
        '<div>' +
          statusBadge(variant.status || 'unknown') +
          (variant.executionSurface ? chip(variant.executionSurface, 'var(--accent)') : '') +
          (variant.requestShape ? '<div class="feature-test-mono">' + esc(variant.requestShape) + '</div>' : '') +
          (variant.notes ? '<div class="feature-test-muted">' + esc(variant.notes) + '</div>' : '') +
          refList(variant.evidenceRefs || [], 'No variant evidence linked.') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function testCaseRows(spec) {
    const cases = spec.testCases || [];
    if (!cases.length) return '<div class="feature-test-empty">No test-case matrix recorded in this spec.</div>';
    return cases.map(function (testCase) {
      return '<div class="feature-test-row">' +
        '<div><strong>' + esc(testCase.id || testCase.field || 'case') + '</strong>' +
          '<div class="feature-test-mono">' + esc(testCase.field || '') + '</div>' +
          '<div>' +
            (testCase.environment ? chip('env: ' + testCase.environment, statusColor(testCase.status)) : '') +
            (testCase.userSurface ? chip('surface: ' + surfaceLabel(testCase.userSurface), statusColor(testCase.status)) : '') +
            statusBadge(testCase.status || 'unknown') +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div>' + esc(testCase.expected || '') + '</div>' +
          (testCase.requestBody ? '<pre class="feature-test-json">' + esc(JSON.stringify(testCase.requestBody, null, 2)) + '</pre>' : '') +
          refList(testCase.evidenceRefs || [], 'No case evidence linked yet.') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function lifecycleRows(spec) {
    const lifecycle = spec.testLifecycle || [];
    if (!lifecycle.length) return '<div class="feature-test-empty">No ordered lifecycle recorded in this spec.</div>';
    return lifecycle.slice().sort(function (a, b) {
      return (a.order || 999) - (b.order || 999);
    }).map(function (step) {
      return '<div class="feature-test-row">' +
        '<div><strong>' + esc((step.order ? step.order + '. ' : '') + (step.phase || step.id || 'step')) + '</strong>' +
          '<div class="feature-test-mono">' + esc(step.surface || '') + '</div></div>' +
        '<div><div>' + esc(step.action || '') + '</div>' +
          (step.purpose ? '<div class="feature-test-muted">' + esc(step.purpose) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function uniqueRefs(refs) {
    const seen = {};
    const out = [];
    (refs || []).forEach(function (ref) {
      if (!ref || seen[ref]) return;
      seen[ref] = true;
      out.push(ref);
    });
    return out;
  }

  function firstSentence(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    const m = s.match(/^(.+?[.!?])(?:\s|$)/);
    return m ? m[1] : s;
  }

  function specOperationSummary(spec) {
    const ops = spec.operations || [];
    if (!ops.length) return 'No operation recorded yet.';
    return ops.map(function (op) {
      const pieces = [];
      if (op.surface) pieces.push(op.surface);
      if (op.method) pieces.push(op.method);
      const prefix = pieces.length ? pieces.join(' ') + ': ' : '';
      return prefix + (op.intent || op.id || 'operation');
    }).join(' ');
  }

  function specExpectationSummary(spec) {
    const assertions = spec.assertions || [];
    if (!assertions.length) return 'No expectation assertions recorded yet.';
    return assertions.map(function (a) {
      const impact = a.verdictImpact === 'audit' ? ' (audit)' : '';
      return (a.behavior || a.id || 'assertion') + '=' + (a.expected == null ? 'unknown' : a.expected) + impact;
    }).join('; ');
  }

  function specExecutionSummary(spec) {
    const strategy = spec.executionStrategy || {};
    if (strategy.brief) return strategy.brief;
    const surfaces = [...new Set((spec.operations || []).map(function (op) { return op.surface; }).filter(Boolean))];
    if (surfaces.length) return 'Execution surface: ' + surfaces.join(', ') + '.';
    return 'Execution method has not been specified yet.';
  }

  function specBriefHtml(spec) {
    const scenario = spec.sourceScenario?.title || spec.title || spec.id;
    const operation = specOperationSummary(spec);
    const expectation = specExpectationSummary(spec);
    const execution = specExecutionSummary(spec);
    const strategy = spec.executionStrategy || {};
    const guard = strategy.directAzCliAllowed === false
      ? '<div class="feature-brief-guard">Do not invoke az CLI for this test; use the project-owner JS/REST replay path.</div>'
      : '';
    return '<div class="feature-spec-brief" data-testid="feature-spec-brief">' +
      '<div class="feature-brief-box"><div class="feature-test-subhead">User Scenario</div><div>' + esc(firstSentence(scenario) || scenario) + '</div><div class="feature-test-muted">' + esc(operation) + '</div></div>' +
      '<div class="feature-brief-box"><div class="feature-test-subhead">Expectation Brief</div><div>' + esc(expectation) + '</div></div>' +
      '<div class="feature-brief-box"><div class="feature-test-subhead">Execution Method</div><div>' + esc(execution) + '</div>' + guard + '</div>' +
    '</div>';
  }

  function pathResultHtml(row) {
    if (!row.pathObjs.length) return '<div class="feature-test-empty">No mapped knowledge path result yet.</div>';
    return row.pathObjs.map(function (path) {
      const behaviors = path.behavior || [];
      const behaviorRows = behaviors.length ? behaviors.map(function (b) {
        const color = b.alignment === 'match' ? 'var(--green)' : b.alignment === 'mismatch' ? 'var(--red)' : 'var(--fg2)';
        return '<tr>' +
          '<td>' + esc(b.variable) + '</td>' +
          '<td>' + esc(b.expected) + '</td>' +
          '<td>' + esc(b.observed == null ? 'not observed' : b.observed) + '</td>' +
          '<td style="color:' + color + '">' + esc(b.alignment || 'unknown') + '</td>' +
          '<td>' + esc(b.verdictImpact || 'claim') + '</td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="5" class="feature-test-muted">No behavior rows recorded.</td></tr>';

      return '<div class="feature-result-card">' +
        '<div class="feature-result-head"><strong>' + esc(path.featureLabel || path.featureId || path.id) + '</strong>' + statusBadge(path.status) + '</div>' +
        '<div class="feature-test-mono">' + esc(path.id) + '</div>' +
        '<div class="feature-test-subhead">Input Path</div>' +
        '<div>' + ((path.selectedInputs || []).map(function (input) {
          return chip(input.label || (input.variable + '=' + input.value), 'var(--fg2)');
        }).join('') || '<span class="feature-test-muted">none</span>') + '</div>' +
        '<div class="feature-test-subhead">Observed Behavior</div>' +
        '<table class="feature-behavior-table"><thead><tr><th>Behavior</th><th>Expected</th><th>Observed</th><th>Alignment</th><th>Impact</th></tr></thead><tbody>' + behaviorRows + '</tbody></table>' +
        '<div class="feature-test-subhead">Evidence</div>' +
        refList(path.evidence || [], 'No evidence mapped to this path.') +
      '</div>';
    }).join('');
  }

  function assertionResultRows(row) {
    const specAssertions = row.spec.assertions || [];
    const observedByBehavior = {};
    row.pathObjs.forEach(function (path) {
      (path.behavior || []).forEach(function (behavior) {
        if (behavior.variable) observedByBehavior[behavior.variable] = behavior;
      });
    });
    if (!specAssertions.length) return '<tr><td colspan="5" class="feature-test-muted">No spec assertions recorded.</td></tr>';
    return specAssertions.map(function (assertion) {
      const observed = observedByBehavior[assertion.behavior] || {};
      const alignment = observed.alignment || (row.status === 'pass' ? 'match' : 'unknown');
      const color = alignment === 'match' ? 'var(--green)' : alignment === 'mismatch' ? 'var(--red)' : 'var(--fg2)';
      return '<tr>' +
        '<td>' + esc(assertion.behavior || assertion.id) + '</td>' +
        '<td>' + esc(assertion.expected) + '</td>' +
        '<td>' + esc(observed.observed == null ? 'not mapped' : observed.observed) + '</td>' +
        '<td style="color:' + color + '">' + esc(alignment) + '</td>' +
        '<td>' + esc(assertion.verdictImpact || 'claim') + '</td>' +
      '</tr>';
    }).join('');
  }

  function resultOverviewHtml(row) {
    const spec = row.spec;
    const target = defaultExecutionTarget(spec);
    const refs = uniqueRefs([
      ...(row.evidence || []),
      ...(spec.goldenPath?.verificationChain || []),
      ...(spec.executionVariants || []).flatMap(function (variant) { return variant.evidenceRefs || []; }),
    ]);
    const evidenceRefs = refs.filter(function (ref) { return /^evidence\//.test(ref); });
    const artifactRefs = refs.filter(function (ref) { return /scenarios\/run-plans\/|probes\//.test(ref); });
    return runnerEvidenceHtml(row) +
    '<div class="feature-result-card">' +
      '<div class="feature-result-head"><strong>Mapped Spec And Feature Model State</strong>' + statusBadge(row.status || spec.status || 'unknown') + '</div>' +
      '<div class="feature-target-summary">' +
        chip('env: ' + (target.environment || 'staging'), statusColor(target.status || row.status)) +
        chip('surface: ' + (target.surface || 'REST'), statusColor(target.status || row.status)) +
        chip('source: mapped evidence', 'var(--fg2)') +
      '</div>' +
      '<div class="feature-test-muted">This is the current accepted knowledge-map/test-spec state. Runner output above only changes this state after diagnosis and model-update review.</div>' +
      '<div class="feature-test-subhead">Assertion Results</div>' +
      '<table class="feature-behavior-table"><thead><tr><th>Assertion</th><th>Expected</th><th>Observed</th><th>Alignment</th><th>Impact</th></tr></thead><tbody>' + assertionResultRows(row) + '</tbody></table>' +
      '<div class="feature-test-subhead">Evidence</div>' + refList(evidenceRefs, 'No evidence refs mapped yet.') +
      '<div class="feature-test-subhead">Run Artifacts</div>' + refList(artifactRefs, 'No run artifacts mapped yet.') +
    '</div>' +
    pathResultHtml(row);
  }

  function latestRunnerRun(row) {
    return (row.testRuns || [])[0] || null;
  }

  function runnerStatus(run) {
    if (!run) return '';
    return run.result?.status || run.diagnosis?.runnerStatus || run.statusDoc?.status || run.status || 'queued';
  }

  function runnerPhase(run) {
    if (!run) return '';
    return run.statusDoc?.phase || run.phase || '';
  }

  function runnerDiagnosis(run) {
    if (!run) return '';
    return run.diagnosis?.diagnosis || run.diagnosis?.classification || run.result?.diagnosis || '';
  }

  function runnerModelImpact(run) {
    if (!run) return null;
    return run.diagnosis?.modelImpact || run.result?.modelImpact || null;
  }

  function runnerReviewState(run) {
    if (!run) return 'none';
    return run.diagnosis?.reviewState || 'pending';
  }

  function modelUpdateAllowed(run) {
    if (!run) return false;
    const diagnosis = run.diagnosis || {};
    const reviewState = diagnosis.reviewState || 'pending';
    const modelImpact = diagnosis.modelImpact || {};
    if (reviewState !== 'accepted') return false;
    if (modelImpact.modelEditAllowed === false) return false;
    if (modelImpact.validationRequired === true && !modelImpact.validationPassed) return false;
    return true;
  }

  function modelUpdateReviewHtml(run) {
    if (!run) return '';
    const diagnosis = runnerDiagnosis(run);
    const review = runnerReviewState(run);
    const impact = runnerModelImpact(run);
    if (!diagnosis) {
      return '<div class="feature-model-review">' +
        statusBadge('pending') +
        '<span class="feature-test-muted">Raw runner output must be diagnosed before model status changes.</span>' +
      '</div>';
    }
    if (review === 'pending') {
      return '<div class="feature-model-review feature-model-review-pending" data-testid="model-update-pending">' +
        statusBadge('pending review') +
        chip('diagnosis: ' + diagnosis, statusColor(diagnosis)) +
        '<div class="feature-test-muted">Diagnosis is recorded but not yet accepted. Model status will not change until the diagnosis is reviewed and accepted.</div>' +
        (impact ? '<div class="feature-test-muted">Proposed impact: ' + esc(impact.recommendation || 'unknown') + '</div>' : '') +
      '</div>';
    }
    if (review === 'accepted') {
      var allowed = modelUpdateAllowed(run);
      var rec = impact?.recommendation || 'unknown';
      if (rec === 'no-product-model-change' || !allowed) {
        return '<div class="feature-model-review" data-testid="model-update-accepted">' +
          statusBadge('accepted') +
          chip('diagnosis: ' + diagnosis, statusColor(diagnosis)) +
          chip('model: no change', 'var(--fg2)') +
          '<div class="feature-test-muted">' + esc(impact?.reason || 'No product model change from this run.') + '</div>' +
        '</div>';
      }
      return '<div class="feature-model-review feature-model-review-actionable" data-testid="model-update-actionable">' +
        statusBadge('accepted') +
        chip('diagnosis: ' + diagnosis, statusColor(diagnosis)) +
        chip('model update: proposed', 'var(--accent)') +
        '<div class="feature-test-muted">' + esc(impact?.reason || 'Model update is proposed based on accepted evidence.') + '</div>' +
        (impact?.validationRequired ? '<div class="feature-callout">Validation required before model.json can be updated.</div>' : '') +
      '</div>';
    }
    return '<div class="feature-model-review">' +
      statusBadge(review) + chip('diagnosis: ' + diagnosis, statusColor(diagnosis)) +
    '</div>';
  }

  function specHealth(row) {
    const spec = row?.spec || {};
    const meta = spec.executionHealth || spec.runnerHealth || {};
    const run = latestRunnerRun(row);
    const runState = run ? runnerStatus(run) : '';
    const runDiagnosis = run ? runnerDiagnosis(run) : '';
    return {
      specState: spec.specState || meta.specState || (spec.status === 'superseded' ? 'superseded' : 'ready'),
      role: meta.role || '',
      state: runState || meta.state || spec.status || 'unknown',
      diagnosis: runDiagnosis || meta.diagnosis || '',
      reason: meta.reason || spec.statusReason || '',
      nextAction: meta.nextAction || spec.next_action || '',
      directTrigger: meta.directTrigger === true,
      dependsOn: Array.isArray(meta.dependsOn) ? meta.dependsOn : [],
      latestRequestId: run?.requestId || meta.latestRequestId || '',
      latestRunId: run?.runId || meta.latestRunId || '',
      latestEvidenceRefs: Array.isArray(meta.latestEvidenceRefs) ? meta.latestEvidenceRefs : [],
      gate: meta.gate || null,
      source: run ? 'latest run' : (meta.state ? 'spec health' : 'model status'),
    };
  }

  function canDirectTrigger(row) {
    return specHealth(row).directTrigger === true;
  }

  function specHealthGroup(row) {
    const health = row.health || specHealth(row);
    const gateDiagnosis = health.gate?.diagnosis || '';
    if (health.role === 'fixture-root') {
      return { key: 'fixture', title: 'Fixture Root', description: 'Builds the reusable ManagedSystem pool fixture that downstream specs need.' };
    }
    if (health.diagnosis === 'product_gap' || row.status === 'fail') {
      return { key: 'product-gap', title: 'Known Product Gaps', description: 'Evidence points at product behavior, not runner noise.' };
    }
    if (health.diagnosis === 'spec_bug' || health.specState === 'draft') {
      return { key: 'not-ready', title: 'Needs Spec Or Script Work', description: 'Project work is required before this can be executed cleanly.' };
    }
    if (gateDiagnosis === 'fixture_blocked' || health.diagnosis === 'fixture_blocked' || health.diagnosis === 'fixture_not_ready') {
      return { key: 'fixture-dependent', title: 'Ready, Fixture Gated', description: 'These specs are ready, but live execution waits for the shared fixture root.' };
    }
    if (health.state === 'not_ready') {
      return { key: 'not-ready', title: 'Needs Spec Or Script Work', description: 'Project work is required before this can be executed cleanly.' };
    }
    if (row.status === 'pass' || (health.state === 'verified' && health.diagnosis === 'passed-live-e2e')) {
      return { key: 'accepted', title: 'Accepted Evidence', description: 'Specs with accepted model evidence and no current runner repair needed.' };
    }
    return { key: 'other', title: 'Other Specs', description: 'Specs that need review before the next execution decision.' };
  }

  function specHealthSummaryHtml(row) {
    const health = row.health || specHealth(row);
    const deps = health.dependsOn || [];
    const refs = health.latestEvidenceRefs || [];
    return '<div class="feature-health-summary">' +
      '<div class="feature-target-summary">' +
        chip('spec: ' + health.specState, statusColor(health.specState)) +
        chip('execution: ' + health.state, statusColor(health.state)) +
        (health.diagnosis ? chip('diagnosis: ' + health.diagnosis, statusColor(health.diagnosis)) : '') +
        (health.gate?.state ? chip('gate: ' + health.gate.state, statusColor(health.gate.state)) : '') +
        (health.gate?.diagnosis ? chip('gate diagnosis: ' + health.gate.diagnosis, statusColor(health.gate.diagnosis)) : '') +
        (health.role ? chip('role: ' + health.role, 'var(--fg2)') : '') +
        chip('source: ' + health.source, 'var(--fg2)') +
      '</div>' +
      (health.reason ? '<div class="feature-test-muted">' + esc(health.reason) + '</div>' : '') +
      (deps.length ? '<div class="feature-test-subhead">Dependencies</div>' + deps.map(function (dep) {
        return '<div class="feature-test-row"><div class="feature-test-mono">' + esc(dep.specId || dep.id || 'dependency') + '</div><div class="feature-test-muted">' + esc(dep.relationship || dep.reason || '') + '</div></div>';
      }).join('') : '') +
      (health.nextAction ? '<div class="feature-callout">' + esc(health.nextAction) + '</div>' : '') +
      (health.gate?.reason ? '<div class="feature-callout">' + esc(health.gate.reason) + '</div>' : '') +
      (refs.length ? '<details><summary>Latest health evidence</summary>' + refList(refs, 'No health evidence linked.') + '</details>' : '') +
    '</div>';
  }

  function compactObjectHtml(value) {
    if (!value) return '';
    return '<pre class="feature-test-json">' + esc(JSON.stringify(value, null, 2)) + '</pre>';
  }

  function runnerAuditHtml(run) {
    const audit = run?.diagnosis?.audit || run?.result?.audit || {};
    const links = Array.isArray(audit.portalLinks) ? audit.portalLinks : [];
    const commands = Array.isArray(audit.auditCommands) ? audit.auditCommands : [];
    if (!links.length && !commands.length) {
      return '<span class="feature-test-muted">No portal audit context recorded yet.</span>';
    }
    const linkHtml = links.length
      ? '<div class="feature-test-subhead">Portal Links</div>' + links.map(function (link) {
          const label = link.label || link.kind || 'Azure resource';
          const resource = link.resourceId ? '<div class="feature-test-mono">' + esc(link.resourceId) + '</div>' : '';
          return '<div class="feature-test-ref"><a target="_blank" rel="noreferrer" href="' + esc(link.url || '#') + '">' + esc(label) + '</a>' + resource + '</div>';
        }).join('')
      : '';
    const commandHtml = commands.length
      ? '<div class="feature-test-subhead">Audit Commands</div>' + commands.map(function (command) {
          return '<div class="feature-test-mono">' + esc(command) + '</div>';
        }).join('')
      : '';
    const note = audit.note ? '<div class="feature-test-muted">' + esc(audit.note) + '</div>' : '';
    return linkHtml + commandHtml + note;
  }

  function runInvestigationHtml(run) {
    const diagnosis = run?.diagnosis || {};
    const blocker = diagnosis.blocker || run?.result?.probeEvidence?.blocker || {};
    const audit = diagnosis.audit || run?.result?.audit || {};
    const links = Array.isArray(audit.portalLinks) ? audit.portalLinks : [];
    const commands = Array.isArray(audit.auditCommands) ? audit.auditCommands : [];
    const activityLinks = links.filter(function (link) { return link.kind === 'activity-log'; }).slice(0, 3);
    const resourceLinks = links.filter(function (link) { return link.kind === 'resource'; }).slice(0, 3);
    const mainMessage = blocker.message || diagnosis.summary || run?.result?.summary || '';
    const where = [
      blocker.resource ? 'resource: ' + blocker.resource : '',
      blocker.phase ? 'phase: ' + blocker.phase : '',
      blocker.subcategory ? 'type: ' + blocker.subcategory : '',
    ].filter(Boolean).join(' | ');
    if (!mainMessage && !links.length && !commands.length) {
      return '<div class="feature-test-muted">No investigation evidence recorded yet.</div>';
    }
    return '<div class="feature-investigation">' +
      (mainMessage ? '<div><strong>What failed</strong><div class="feature-test-muted">' + esc(mainMessage) + '</div>' + contextFeedbackHtml(run, 'failure.message', 'failure message') + '</div>' : '') +
      (where ? '<div><strong>Where</strong><div class="feature-test-muted">' + esc(where) + '</div>' + contextFeedbackHtml(run, 'failure.location', 'failure location') + '</div>' : '') +
      (resourceLinks.length ? '<div><strong>Portal</strong><div class="feature-action-row">' + resourceLinks.map(function (link) {
        return '<a class="feature-test-button" target="_blank" rel="noreferrer" href="' + esc(link.url || '#') + '">' + esc(link.label || 'Resource') + '</a>';
      }).join('') + '</div>' + contextFeedbackHtml(run, 'audit.portal', 'portal resource links') + '</div>' : '') +
      (activityLinks.length ? '<div><strong>Activity Log</strong><div class="feature-action-row">' + activityLinks.map(function (link) {
        return '<a class="feature-test-button" target="_blank" rel="noreferrer" href="' + esc(link.url || '#') + '">' + esc((link.label || 'Activity').replace(' activity log', '')) + '</a>';
      }).join('') + '</div>' + contextFeedbackHtml(run, 'audit.activity-log', 'activity log links') + '</div>' : '') +
      (commands.length ? '<details><summary>Audit commands</summary>' + commands.slice(0, 6).map(function (command) {
        return '<div class="feature-test-mono">' + esc(command) + '</div>';
      }).join('') + contextFeedbackHtml(run, 'audit.commands', 'audit commands') + '</details>' : '') +
      runFeedbackHistoryHtml(run) +
    '</div>';
  }

  function feedbackControlId(runId, contextKey) {
    return 'feature-feedback-' + slug(runId || 'run') + '-' + slug(contextKey || 'run');
  }

  function feedbackStatusId(runId, contextKey) {
    return 'feature-feedback-status-' + slug(runId || 'run') + '-' + slug(contextKey || 'run');
  }

  function contextFeedbackHtml(run, contextKey, label) {
    const runIdArg = attrEsc(JSON.stringify(run.runId));
    const contextArg = attrEsc(JSON.stringify(contextKey));
    return '<details class="feature-feedback">' +
      '<summary>Feedback on this</summary>' +
      '<textarea class="feature-feedback-input" id="' + esc(feedbackControlId(run.runId, contextKey)) + '" placeholder="Tell the project owner what you know about this ' + esc(label || 'context') + '. Free-form text is fine."></textarea>' +
      '<div class="feature-action-row">' +
        '<button class="feature-test-button feature-test-button-primary" onclick="submitAksFeatureRunFeedback(' + runIdArg + ',' + attrEsc(JSON.stringify('feedback')) + ',' + contextArg + ')">Send Feedback</button>' +
        '<button class="feature-test-button" onclick="submitAksFeatureRunFeedback(' + runIdArg + ',' + attrEsc(JSON.stringify('confirm-infra-block')) + ',' + contextArg + ')">Confirm Infra Block</button>' +
        '<button class="feature-test-button" onclick="submitAksFeatureRunFeedback(' + runIdArg + ',' + attrEsc(JSON.stringify('mark-product-issue')) + ',' + contextArg + ')">Product Issue</button>' +
        '<button class="feature-test-button" onclick="submitAksFeatureRunFeedback(' + runIdArg + ',' + attrEsc(JSON.stringify('mark-test-bug')) + ',' + contextArg + ')">Test Bug</button>' +
        '<button class="feature-test-button" onclick="submitAksFeatureRunFeedback(' + runIdArg + ',' + attrEsc(JSON.stringify('request-rerun')) + ',' + contextArg + ')">Rerun</button>' +
      '</div>' +
      '<div class="feature-test-muted" id="' + esc(feedbackStatusId(run.runId, contextKey)) + '"></div>' +
    '</details>';
  }

  function runFeedbackHistoryHtml(run) {
    const feedback = Array.isArray(run?.feedback) ? run.feedback.slice().reverse() : [];
    const latest = feedback[0];
    return '<div class="feature-feedback">' +
      '<strong>Feedback History</strong>' +
      (latest ? '<div class="feature-test-muted">Latest: ' + esc(latest.action || 'feedback') + (latest.note ? ' - ' + esc(latest.note) : '') + '</div>' : '<div class="feature-test-muted">Classify the failure or tell the project owner what to do next.</div>') +
      (feedback.length ? '<details><summary>Recent feedback</summary>' + feedback.slice(0, 5).map(function (item) {
        const context = item.context?.key ? '<div class="feature-test-muted">' + esc(item.context.key) + '</div>' : '';
        return '<div class="feature-test-row"><div>' + esc(item.action || 'feedback') + context + '<div class="feature-test-muted">' + esc(item.ts || '') + '</div></div><div>' + esc(item.note || '') + '</div></div>';
      }).join('') + '</details>' : '') +
    '</div>';
  }

  function feedbackContextSnapshot(run, contextKey) {
    const diagnosis = run?.diagnosis || {};
    const blocker = diagnosis.blocker || run?.result?.probeEvidence?.blocker || {};
    const audit = diagnosis.audit || run?.result?.audit || {};
    const keys = String(contextKey || 'run').split('.');
    const base = {
      key: contextKey || 'run',
      runnerStatus: runnerStatus(run),
      phase: runnerPhase(run),
      diagnosis: runnerDiagnosis(run),
    };
    if (contextKey === 'failure.message') return Object.assign(base, { message: blocker.message || diagnosis.summary || run?.result?.summary || '' });
    if (contextKey === 'failure.location') return Object.assign(base, { resource: blocker.resource || '', blockerPhase: blocker.phase || '', subcategory: blocker.subcategory || '' });
    if (contextKey === 'audit.portal') return Object.assign(base, { portalLinks: (audit.portalLinks || []).filter(function (link) { return link.kind === 'resource'; }).slice(0, 5) });
    if (contextKey === 'audit.activity-log') return Object.assign(base, { portalLinks: (audit.portalLinks || []).filter(function (link) { return link.kind === 'activity-log'; }).slice(0, 5) });
    if (contextKey === 'audit.commands') return Object.assign(base, { auditCommands: (audit.auditCommands || []).slice(0, 6) });
    return Object.assign(base, { path: keys });
  }

  function findRunById(runId) {
    for (const row of state.rows || []) {
      for (const run of row.testRuns || []) {
        if (run.runId === runId) return { row, run };
      }
    }
    return null;
  }

  function feedbackNext(action) {
    const map = {
      'confirm-infra-block': 'Project owner should keep feature verdict unchanged, attach blocker evidence, and plan an environment/rerun path.',
      'mark-product-issue': 'Project owner should create or update a product investigation task with this run evidence.',
      'mark-test-bug': 'Project owner should inspect the probe/spec before using this run for product judgment.',
      'request-rerun': 'Project owner should plan a rerun using the note as target/gate guidance.',
    };
    return map[action] || 'Project owner should review this feedback and decide the next project action.';
  }

  function runnerStatusLine(row) {
    const run = latestRunnerRun(row);
    if (!run) return '<div class="feature-test-muted">No linked test request yet.</div>';
    const diagnosis = runnerDiagnosis(run);
    return '<div class="feature-target-summary">' +
      chip('request: ' + run.requestId, 'var(--fg2)') +
      chip('run: ' + run.runId, 'var(--fg2)') +
      chip('runner: ' + runnerStatus(run), statusColor(runnerStatus(run))) +
      (runnerPhase(run) ? chip('phase: ' + runnerPhase(run), 'var(--accent)') : '') +
      (diagnosis ? chip('diagnosis: ' + diagnosis, statusColor(diagnosis)) : '') +
    '</div>';
  }

  function runnerLinks(run) {
    if (!run) return '';
    const refs = [
      run.requestPath,
      run.statusPath,
      run.stepsPath,
      run.result ? run.resultPath : '',
      run.diagnosis ? run.diagnosisPath : '',
      run.summaryPath,
    ].filter(Boolean);
    return refList(refs, 'No runner files linked yet.');
  }

  function runnerStepsHtml(run) {
    const steps = (run?.steps || []).slice(-8).reverse();
    if (!steps.length) return '<span class="feature-test-muted">No runner steps recorded yet.</span>';
    return '<div class="feature-run-steps">' + steps.map(function (step) {
      const title = step.step || step.phase || 'step';
      const detail = [
        step.phase ? 'phase: ' + step.phase : '',
        step.host ? 'host: ' + step.host : '',
        step.exitCode != null ? 'exit: ' + step.exitCode : '',
        step.note || '',
      ].filter(Boolean).join(' | ');
      return '<div class="feature-test-row">' +
        '<div><strong>' + esc(title) + '</strong><div class="feature-test-muted">' + esc(step.ts || '') + '</div></div>' +
        '<div>' + statusBadge(step.status || run.status || 'running') + (detail ? '<div class="feature-test-muted">' + esc(detail) + '</div>' : '') +
        (step.command ? '<div class="feature-test-mono">' + esc(step.command) + '</div>' : '') +
        '</div></div>';
    }).join('') + '</div>';
  }

  function runnerEvidenceHtml(row) {
    const runs = row.testRuns || [];
    if (!runs.length) {
      return '<div class="feature-result-card">' +
        '<div class="feature-result-head"><strong>Runner Request</strong>' + statusBadge('not requested') + '</div>' +
        '<div class="feature-test-muted">Trigger Test creates a durable request/run record under <code>runs/</code>. Refresh keeps the request linked to this spec.</div>' +
      '</div>';
    }

    const run = runs[0];
    const diagnosis = runnerDiagnosis(run);
    const modelImpact = runnerModelImpact(run);
    const status = runnerStatus(run);
    const target = run.target || {};
    const targetEnv = target.environment || row.spec.executionVariants?.[0]?.environment || 'staging';
    const targetSurface = target.surface || target.clientSurface || target.executionSurface || 'REST';
    const dispatchReason = run.statusDoc?.runnerDispatchReason || run.runnerDispatchReason || '';
    const runnerPid = run.statusDoc?.runnerPid || run.runnerPid || '';
    return '<div class="feature-result-card" data-testid="feature-runner-result">' +
      '<div class="feature-result-head"><strong>Linked Runner Request</strong>' + statusBadge(status) + '</div>' +
      '<div class="feature-target-summary">' +
        chip('request: ' + run.requestId, 'var(--fg2)') +
        chip('run: ' + run.runId, 'var(--fg2)') +
        chip('env: ' + targetEnv, statusColor(status)) +
        chip('surface: ' + surfaceLabel(targetSurface), statusColor(status)) +
        (runnerPid ? chip('runner pid: ' + runnerPid, 'var(--accent)') : (run.workflowRunId ? chip('workflow: ' + run.workflowRunId, 'var(--accent)') : '')) +
      '</div>' +
      '<div class="feature-test-row"><div>Runner Phase</div><div>' + esc(runnerPhase(run) || 'not started') + '</div></div>' +
      (dispatchReason ? '<div class="feature-test-row"><div>Dispatch Reason</div><div>' + esc(dispatchReason) + '</div></div>' : '') +
      '<div class="feature-test-row"><div>Progress</div><div>' + runnerStepsHtml(run) + '</div></div>' +
      '<div class="feature-test-row"><div>Portal Audit</div><div>' + runnerAuditHtml(run) + '</div></div>' +
      '<div class="feature-test-row"><div>Runner Files</div><div>' + runnerLinks(run) + '</div></div>' +
      '<div class="feature-test-row"><div>Test Output</div><div>' +
        (run.result ? compactObjectHtml(run.result) : '<span class="feature-test-muted">No result.json has been recorded yet. The request is linked, but execution evidence is still pending.</span>') +
      '</div></div>' +
      '<div class="feature-test-row"><div>Diagnosis</div><div>' +
        (diagnosis ? statusBadge(diagnosis) + compactObjectHtml(run.diagnosis) : '<span class="feature-test-muted">No diagnosis.json has been recorded yet. Raw runner output must be diagnosed before model status changes.</span>') +
      '</div></div>' +
      '<div class="feature-test-row"><div>Model Impact</div><div>' +
        modelUpdateReviewHtml(run) +
        (modelImpact ? compactObjectHtml(modelImpact) : '') +
      '</div></div>' +
      (runs.length > 1 ? '<div class="feature-test-subhead">Recent Requests</div>' + runs.slice(1, 5).map(function (oldRun) {
        return '<div class="feature-test-row"><div class="feature-test-mono">' + esc(oldRun.runId) + '</div><div>' + statusBadge(runnerStatus(oldRun)) + ' <span class="feature-test-muted">' + esc(oldRun.updatedAt || oldRun.createdAt || '') + '</span></div></div>';
      }).join('') : '') +
    '</div>';
  }

  function runOverviewRows(rows) {
    const runRows = [];
    (rows || []).forEach(function (row) {
      (row.testRuns || []).forEach(function (run) {
        runRows.push({ row, run });
      });
    });
    runRows.sort(function (a, b) {
      return String(b.run.updatedAt || b.run.createdAt || '').localeCompare(String(a.run.updatedAt || a.run.createdAt || ''));
    });
    return runRows;
  }

  function featureRunOverviewHtml(rows) {
    const runRows = runOverviewRows(rows);
    if (!runRows.length) {
      return '<section class="feature-test-panel" data-testid="feature-test-runs-panel">' +
        '<div class="feature-test-header">' +
          '<div><div class="feature-test-kicker">Test Requests / Runs</div>' +
          '<div class="feature-test-title">No triggered tests yet</div>' +
          '<div class="feature-test-muted">After you click Trigger Test, the request appears here with request id, run id, current phase, output links, and result/diagnosis state. It also remains under the matching spec card after refresh.</div></div>' +
          '<div class="feature-action-row"><button class="feature-test-button" onclick="refreshAksFeatureTests()">Refresh Runs</button></div>' +
        '</div>' +
      '</section>';
    }

    return '<section class="feature-test-panel" data-testid="feature-test-runs-panel">' +
      '<div class="feature-test-header">' +
        '<div><div class="feature-test-kicker">Test Requests / Runs</div>' +
        '<div class="feature-test-title">Triggered Test Progress</div>' +
        '<div class="feature-test-muted">This is the fastest place to check a triggered test. It reads <code>runs/</code>, so progress remains visible after page refresh.</div></div>' +
        '<div class="feature-action-row"><button class="feature-test-button" onclick="refreshAksFeatureTests()">Refresh Runs</button><a class="feature-test-button" href="' + BASE + '/ui/kanban/">Task Kanban</a></div>' +
      '</div>' +
      '<div class="feature-run-list">' + runRows.slice(0, 8).map(function (item) {
        const row = item.row;
        const run = item.run;
        const status = runnerStatus(run);
        const diagnosis = runnerDiagnosis(run);
        const specId = row.spec.id;
        const target = run.target || {};
        const workflowLink = run.workflowRunId
          ? '<a class="feature-test-button" target="_blank" href="/api/loop-trace?workflowRunId=' + encodeURIComponent(run.workflowRunId) + '">Trace</a>'
          : '';
        return '<div class="feature-run-row" data-testid="feature-test-run-row">' +
          '<div>' +
            '<strong>' + esc(row.spec.title || specId) + '</strong>' +
            '<div class="feature-test-mono">' + esc(specId) + '</div>' +
            '<div class="feature-target-summary">' +
              chip('request: ' + run.requestId, 'var(--fg2)') +
              chip('run: ' + run.runId, 'var(--fg2)') +
              chip('env: ' + (target.environment || 'staging'), statusColor(status)) +
              chip('surface: ' + surfaceLabel(target.surface || target.clientSurface || target.executionSurface || 'REST'), statusColor(status)) +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div class="feature-target-summary">' +
              statusBadge(status) +
              (runnerPhase(run) ? chip('phase: ' + runnerPhase(run), 'var(--accent)') : '') +
              (diagnosis ? chip('diagnosis: ' + diagnosis, statusColor(diagnosis)) : chip('diagnosis: pending', 'var(--fg2)')) +
              (runnerReviewState(run) === 'pending' && diagnosis ? chip('model review: pending', 'var(--yellow)') : '') +
              (runnerReviewState(run) === 'accepted' && diagnosis ? chip('model review: accepted', 'var(--green)') : '') +
            '</div>' +
            '<div class="feature-test-muted">' + esc(run.updatedAt || run.createdAt || '') + '</div>' +
            runInvestigationHtml(run) +
            '<div class="feature-action-row">' +
              '<button class="feature-test-button" onclick="showAksFeatureSpecResult(' + attrEsc(JSON.stringify(specId)) + ')">Check Result</button>' +
              (run.summaryPath ? '<a class="feature-test-button" target="_blank" href="' + BASE + '/' + run.summaryPath.split('/').map(encodeURIComponent).join('/') + '">Summary</a>' : '') +
              workflowLink +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>' +
    '</section>';
  }

  function specHealthBoardHtml(rows) {
    const groups = {};
    (rows || []).forEach(function (row) {
      const group = specHealthGroup(row);
      if (!groups[group.key]) groups[group.key] = { meta: group, rows: [] };
      groups[group.key].rows.push(row);
    });
    const order = ['fixture', 'fixture-dependent', 'not-ready', 'product-gap', 'accepted', 'other'];
    return '<section class="feature-test-panel" data-testid="feature-spec-health-board">' +
      '<div class="feature-test-header">' +
        '<div><div class="feature-test-kicker">Spec Health</div>' +
        '<div class="feature-test-title">ManagedSystem Execution Readiness</div>' +
        '<div class="feature-test-muted">Model/spec verdicts are separate from current executable readiness. Fixture dependencies, spec/script work, and product gaps are not runner bugs.</div></div>' +
      '</div>' +
      '<div class="feature-health-board">' + order.filter(function (key) { return groups[key]; }).map(function (key) {
        const group = groups[key];
        return '<div class="feature-health-column">' +
          '<div class="feature-health-column-head"><strong>' + esc(group.meta.title) + '</strong>' + chip(String(group.rows.length), 'var(--fg2)') + '</div>' +
          '<div class="feature-test-muted">' + esc(group.meta.description) + '</div>' +
          group.rows.map(function (row) {
            const health = row.health || specHealth(row);
            return '<div class="feature-health-item">' +
              '<div><strong>' + esc(row.spec.title || row.spec.id) + '</strong><div class="feature-test-mono">' + esc(row.spec.id) + '</div></div>' +
              '<div class="feature-target-summary">' +
                chip('model: ' + (row.status || 'unknown'), statusColor(row.status)) +
                chip('execution: ' + (health.state || 'unknown'), statusColor(health.state)) +
                (health.diagnosis ? chip(health.diagnosis, statusColor(health.diagnosis)) : '') +
                (health.gate?.diagnosis ? chip('gate: ' + health.gate.diagnosis, statusColor(health.gate.diagnosis)) : '') +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>';
      }).join('') + '</div>' +
    '</section>';
  }

  function renderSpecGroups(rows) {
    const groups = {};
    const order = ['fixture', 'fixture-dependent', 'not-ready', 'product-gap', 'accepted', 'other'];
    (rows || []).forEach(function (row) {
      const group = specHealthGroup(row);
      if (!groups[group.key]) groups[group.key] = { meta: group, rows: [] };
      groups[group.key].rows.push(row);
    });
    return order.filter(function (key) { return groups[key]; }).map(function (key) {
      const group = groups[key];
      return '<section class="feature-spec-group" data-testid="feature-spec-group">' +
        '<div class="feature-spec-group-head">' +
          '<div><div class="feature-test-kicker">Spec Group</div><h2>' + esc(group.meta.title) + '</h2><div class="feature-test-muted">' + esc(group.meta.description) + '</div></div>' +
          chip(group.rows.length + ' specs', 'var(--fg2)') +
        '</div>' +
        group.rows.map(renderSpecCard).join('') +
      '</section>';
    }).join('');
  }

  function specReviewHtml(row, initiallyOpen) {
    const spec = row.spec;
    const lifecycle = spec.clusterLifecycle || {};
    const refs = uniqueRefs([
      ...(spec.sourceRefs || []),
      ...(spec.goldenPath?.verificationChain || []),
    ]);
    const runPlanRefs = refs.filter(function (ref) { return /scenarios\/run-plans\//.test(ref); });
    const probeRefs = refs.filter(function (ref) { return /probes\//.test(ref); });
    const sourceRefs = refs.filter(function (ref) {
      return !/^evidence\//.test(ref) && !/scenarios\/run-plans\//.test(ref) && !/probes\//.test(ref);
    });

    const specFile = spec.file || '';
    return '<details class="feature-spec-details"' + (initiallyOpen ? ' open' : '') + '>' +
      '<summary>Review Test Spec</summary>' +
      '<div class="feature-spec-grid">' +
        '<section><div class="feature-test-subhead">Scenario Intent</div>' +
          '<div class="feature-test-muted">' + esc(spec.sourceScenario?.title || spec.title || '') + '</div>' +
          (spec.goldenPath?.scope ? '<div class="feature-callout">' + esc(spec.goldenPath.scope) + '</div>' : '') +
        '</section>' +
        '<section><div class="feature-test-subhead">Lifecycle / Compatibility</div>' +
          '<div class="feature-test-row"><div>Group</div><div class="feature-test-mono">' + esc(spec.compatibleGroupKey || lifecycle.compatibleGroupKey || 'unknown') + '</div></div>' +
          '<div class="feature-test-row"><div>Order</div><div>' + esc(spec.sequenceOrder || lifecycle.sequenceOrder || 'unknown') + '</div></div>' +
          '<div class="feature-test-row"><div>Creates Cluster</div><div>' + esc(lifecycle.createsCluster == null ? 'unknown' : lifecycle.createsCluster) + '</div></div>' +
        '</section>' +
        '<section class="feature-spec-wide"><div class="feature-test-subhead">Test Lifecycle</div>' + lifecycleRows(spec) + '</section>' +
        '<section class="feature-spec-wide"><div class="feature-test-subhead">Execution Variants</div>' + variantRows(spec) + '</section>' +
        '<section class="feature-spec-wide"><div class="feature-test-subhead">Test Cases</div>' + testCaseRows(spec) + '</section>' +
        '<section><div class="feature-test-subhead">Operations</div>' + operationRows(spec) + '</section>' +
        '<section><div class="feature-test-subhead">Assertions</div>' + assertionRows(spec) + '</section>' +
        '<section><div class="feature-test-subhead">Cleanup</div>' + cleanupRows(spec) + '</section>' +
        '<section><div class="feature-test-subhead">Run Artifacts</div>' +
          '<div>Run plan</div>' + refList(runPlanRefs, 'No run plan linked.') +
          '<div style="margin-top:8px">Replay script</div>' + refList(probeRefs, 'No replay script linked.') +
        '</section>' +
        '<section class="feature-spec-wide"><div class="feature-test-subhead">Sources</div>' + refList(sourceRefs, 'No source refs linked.') + '</section>' +
        (specFile ? '<section class="feature-spec-wide"><div class="feature-test-subhead">Raw Spec</div>' + refList(['specs/' + specFile], 'No spec file linked.') + '</section>' : '') +
      '</div>' +
    '</details>';
  }

  function resultPanelId(specId) {
    return 'feature-result-' + slug(specId);
  }

  function buildTriggerPrompt(row) {
    const spec = row.spec;
    const target = defaultExecutionTarget(spec);
    const pathIds = row.pathIds.length ? row.pathIds : (spec.featurePathIds || []);
    const refs = spec.sourceRefs || [];
    const runPlan = refs.find(function (ref) { return /scenarios\/run-plans\//.test(ref); }) || '';
    const probe = refs.find(function (ref) { return /probes\//.test(ref); }) || '';
    const strategy = spec.executionStrategy || {};
    const executionLines = [];
    if (strategy.executor) executionLines.push('executor: ' + strategy.executor);
    if (strategy.scenarioSurface) executionLines.push('scenarioSurface: ' + strategy.scenarioSurface);
    if (strategy.replaySurface) executionLines.push('replaySurface: ' + strategy.replaySurface);
    if (strategy.directAzCliAllowed === false) executionLines.push('directAzCliAllowed: false');
    return [
      '[feature-test-request]',
      'feature: ' + state.featureId,
      'spec: ' + spec.id,
      'title: ' + (spec.title || ''),
      'userScenario: ' + (spec.sourceScenario?.title || spec.title || ''),
      'event: feature-test.requested',
      'target:',
      '- environment: ' + (target.environment || 'staging'),
      '- userSurface: ' + (target.surface || 'REST'),
      '- executionSurface: ' + (target.executionSurface || strategy.replaySurface || 'typescript-js-rest-replay'),
      '- variant: ' + (target.id || 'target.staging-rest-request'),
      'expectation: ' + specExpectationSummary(spec),
      ...(executionLines.length ? ['executionStrategy:', ...executionLines.map(function (line) { return '- ' + line; })] : []),
      'paths:',
      ...(pathIds.length ? pathIds.map(function (id) { return '- ' + id; }) : ['- none supplied']),
      '',
      'Execute exactly this one test through the project-owner workflow against the target above.',
      runPlan || probe ? 'Use the linked run plan and probe from the spec.' : 'If no JS/REST run plan or probe is linked, create the JS/REST replay artifact first and do not execute until it is reviewed.',
      runPlan ? 'runPlan: ' + runPlan : 'runPlan: not linked',
      probe ? 'probe: ' + probe : 'probe: not linked',
      strategy.directAzCliAllowed === false ? 'Do not invoke az CLI for this test. The CLI surface is the scenario/source of the captured payload, not the runtime executor.' : '',
      '',
      'Before mutation, verify owner preflight, ARM auth, explicit cloud gate, cleanup plan, and assertion boundaries.',
      'After execution, record JSON and markdown evidence under evidence/archive, update model status only for proven verdict-driving assertions, and report the result back to the task tree and feature page.',
    ].filter(function (line) { return line !== ''; }).join('\n');
  }

  function requestProgressHtml(row, actionData, target) {
    const workflowRunId = actionData.workflowRunId || '';
    const featureTestRequest = actionData.featureTestRequest || {};
    const requestId = featureTestRequest.requestId || '';
    const runId = featureTestRequest.runId || '';
    const runner = featureTestRequest.runner || {};
    const workflowStarted = actionData.workflowStarted === true || Boolean(workflowRunId);
    const state = runner.dispatched ? 'Test runner dispatched' : (requestId ? 'Test request linked' : (workflowStarted ? 'Workflow started' : 'Workflow queued'));
    const badge = requestId ? statusBadge(featureTestRequest.status || 'queued') : (workflowStarted ? statusBadge(actionData.workflowStatus || 'active') : statusBadge('queued'));
    const trace = workflowRunId
      ? '<a class="feature-test-button" target="_blank" href="/api/loop-trace?workflowRunId=' + encodeURIComponent(workflowRunId) + '">Open Trace</a>'
      : '';
    return '<div class="feature-result-card">' +
      '<div class="feature-result-head"><strong>' + esc(state) + '</strong>' + badge + '</div>' +
      '<div class="feature-target-summary">' +
        chip('event: ' + (actionData.reason || 'feature-test.requested'), 'var(--accent)') +
        chip('env: ' + (target.environment || 'staging'), statusColor(target.status || row.status)) +
        chip('surface: ' + (target.surface || 'REST'), statusColor(target.status || row.status)) +
        chip('executor: ' + (target.executionSurface || 'typescript-js-rest-replay'), 'var(--fg2)') +
      '</div>' +
      '<div class="feature-test-muted">' +
        (requestId
          ? (runner.dispatched
            ? 'The feature-page request is durable and the project-local runner was dispatched. Refresh Results to inspect phase, output, diagnosis, and model impact.'
            : 'The feature-page request is durable, but no runner was dispatched. Use Check Latest Result to inspect the gate or dispatch reason.')
          : workflowStarted
          ? 'The project workflow accepted this test trigger. Use the trace or Kanban board to follow progress; use Check Result after evidence is recorded.'
          : 'The event was accepted by the daemon, but no workflow run id was visible within the short HTTP confirmation window. Use Kanban to watch pickup, then refresh results.') +
      '</div>' +
      (requestId ? '<div class="feature-test-row"><div>Request</div><div class="feature-test-mono">' + esc(requestId) + '</div></div>' : '') +
      (runId ? '<div class="feature-test-row"><div>Run</div><div class="feature-test-mono">' + esc(runId) + '</div></div>' : '') +
      (runner.pid ? '<div class="feature-test-row"><div>Runner PID</div><div class="feature-test-mono">' + esc(runner.pid) + '</div></div>' : '') +
      (runner.reason ? '<div class="feature-test-row"><div>Dispatch Reason</div><div>' + esc(runner.reason) + '</div></div>' : '') +
      (workflowRunId ? '<div class="feature-test-row"><div>Workflow Run</div><div class="feature-test-mono">' + esc(workflowRunId) + '</div></div>' : '') +
      '<div class="feature-action-row">' +
        '<button class="feature-test-button" onclick="refreshAksFeatureTests()">Refresh Results</button>' +
        '<button class="feature-test-button" onclick="showAksFeatureSpecResult(' + attrEsc(JSON.stringify(row.spec.id)) + ')">Check Latest Result</button>' +
        '<a class="feature-test-button" href="' + BASE + '/ui/kanban/">Task Kanban</a>' +
        trace +
      '</div>' +
    '</div>';
  }

  window.requestAksFeatureTest = async function (specId) {
    const row = state.rows.find(function (item) { return item.spec.id === specId; });
    if (!row) return;
    if (!canDirectTrigger(row)) {
      const panel = document.getElementById(resultPanelId(specId));
      const health = row.health || specHealth(row);
      if (panel) {
        panel.innerHTML = '<div class="feature-result-card">' +
          '<div class="feature-result-head"><strong>Direct Runner Not Ready</strong>' + statusBadge(health.state || 'not_ready') + '</div>' +
          '<div class="feature-test-muted">' + esc(health.reason || 'This spec does not have a direct runner adapter yet.') + '</div>' +
          (health.nextAction ? '<div class="feature-callout">' + esc(health.nextAction) + '</div>' : '') +
        '</div>';
      }
      return;
    }
    const prompt = buildTriggerPrompt(row);
    const target = defaultExecutionTarget(row.spec);
    const pathIds = row.pathIds.length ? row.pathIds : (row.spec.featurePathIds || []);
    const receipt = typeof window.addAksReceipt === 'function'
      ? window.addAksReceipt({
          action: 'trigger-test',
          featureId: state.featureId,
          pathId: pathIds[0] || '',
          state: 'in-progress',
          next: 'Sending one-test request to project owner',
        })
      : null;

    try {
      const params = {
        source: 'feature-page',
        featureId: state.featureId,
        specId: row.spec.id,
        selectedPathIds: pathIds,
        runMode: 'gated-rest-staging-replay',
        liveRun: true,
        gatedLiveRun: true,
        ownerAgent: 'aks-explorer',
        executionTarget: target,
        eventType: 'feature-test.requested',
        prompt,
      };
      const body = {
        type: 'project.execution.requested',
        source: 'web-ui',
        owner: 'agent:aks-explorer',
        data: {
          project: 'aks-rp-e2e',
          projectPath: PROJECT_PATH,
          reason: 'feature-test.requested',
          action: 'execute-run',
          params,
          requested_by: 'feature-page',
        },
      };
      const actionRes = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const actionData = await actionRes.json().catch(function () { return {}; });
      if (!actionRes.ok || actionData.ok === false) {
        throw new Error(actionData.error || actionData.triggerError || ('HTTP ' + actionRes.status));
      }

      if (receipt) {
        const linked = actionData.featureTestRequest || {};
        receipt.state = linked.requestId ? 'queued' : (actionData.workflowStarted === false ? 'queued' : 'requested');
        receipt.next = linked.requestId
          ? 'Request linked under runs; refresh or check result for runner output and diagnosis'
          : 'Workflow trigger accepted; check Kanban or trace, then refresh this result after evidence is recorded';
        if (linked.requestId) receipt.commentId = linked.requestId;
        else if (actionData.workflowRunId) receipt.commentId = actionData.workflowRunId;
        if (typeof window.renderAksReceipts === 'function') window.renderAksReceipts();
      }
      const panel = document.getElementById(resultPanelId(specId));
      if (panel) {
        panel.innerHTML = requestProgressHtml(row, actionData, target) + resultOverviewHtml(row);
      }
    } catch (e) {
      if (receipt) {
        receipt.state = 'error';
        receipt.error = e?.message || String(e);
        receipt.recovery = 'Retry the action after the project action endpoint is healthy.';
        receipt.next = 'Resolve request failure';
        if (typeof window.renderAksReceipts === 'function') window.renderAksReceipts();
      }
      const panel = document.getElementById(resultPanelId(specId));
      if (panel) panel.innerHTML = '<div class="feature-test-error">Failed to trigger test workflow: ' + esc(e?.message || String(e)) + '</div>';
    }
  };

  window.submitAksFeatureRunFeedback = async function (runId, action, contextKey) {
    const found = findRunById(runId);
    if (!found) return;
    const row = found.row;
    const run = found.run;
    const key = contextKey || 'run';
    const input = document.getElementById(feedbackControlId(runId, key));
    const statusEl = document.getElementById(feedbackStatusId(runId, key));
    const note = input ? String(input.value || '').trim() : '';
    const diagnosis = runnerDiagnosis(run);
    const blocker = run.diagnosis?.blocker || run.result?.probeEvidence?.blocker || {};
    if (action === 'feedback' && !note) {
      if (statusEl) statusEl.textContent = 'Add feedback text before sending.';
      return;
    }
    if (statusEl) statusEl.textContent = 'Sending feedback...';

    try {
      const body = {
        type: 'project.execution.requested',
        source: 'web-ui',
        owner: 'agent:aks-explorer',
        data: {
          project: 'aks-rp-e2e',
          projectPath: PROJECT_PATH,
          reason: 'feature-test.failure.reviewed',
          action: 'review-run-failure',
          requested_by: 'feature-page',
          params: {
            eventType: 'feature-test.failure.reviewed',
            subject: {
              type: key === 'run' ? 'feature-test-run' : 'feature-test-run-context',
              id: key === 'run' ? run.runId : run.runId + '#' + key,
              parentId: run.requestId,
            },
            context: feedbackContextSnapshot(run, key),
            featureId: state.featureId,
            specId: row.spec.id,
            requestId: run.requestId,
            runId: run.runId,
            action,
            note,
            diagnosis,
            blocker,
            status: runnerStatus(run),
            phase: runnerPhase(run),
            next: feedbackNext(action),
            evidence: {
              statusPath: run.statusPath,
              resultPath: run.resultPath,
              diagnosisPath: run.diagnosisPath,
              summaryPath: run.summaryPath,
              feedbackPath: run.feedbackPath,
            },
          },
        },
      };
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
      const feedback = data.featureTestFeedback || {};
      if (statusEl) statusEl.textContent = 'Feedback recorded' + (feedback.feedbackId ? ': ' + feedback.feedbackId : '') + '. Project owner was notified.';
      if (input) input.value = '';
      await refreshAksFeatureTests();
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Feedback failed: ' + (e?.message || String(e));
    }
  };

  window.showAksFeatureSpecResult = function (specId) {
    const row = state.rows.find(function (item) { return item.spec.id === specId; });
    const panel = document.getElementById(resultPanelId(specId));
    if (!row || !panel) return;
    panel.innerHTML = resultOverviewHtml(row);
  };

  window.refreshAksFeatureTests = function () {
    const el = document.getElementById('scenario-path-table');
    if (el && typeof window.renderScenarioPathTable === 'function') window.renderScenarioPathTable(el);
  };

  // ── Per-spec action prompts (generate-script, request-staging, review-script) ──
  function specActionPrompt(kind, row) {
    var spec = row.spec;
    var pathIds = row.pathIds.length ? row.pathIds : (spec.featurePathIds || []);
    var refs = spec.sourceRefs || [];
    var probeRef = refs.find(function (r) { return /probes\//.test(r); }) || '';
    var runPlanRef = refs.find(function (r) { return /run-plans\//.test(r); }) || '';
    var pathList = pathIds.length ? '\nKnowledge paths:\n' + pathIds.map(function (p) { return '- ' + p; }).join('\n') : '';
    var specLine = 'spec: ' + spec.id + ' — ' + (spec.title || '');

    if (kind === 'generate-script') {
      return '[resume] aks-explorer: Generate a REST-first test script for spec ' + spec.id + ' (feature: ' + state.featureId + ').\n\n' +
        specLine + pathList + '\n\n' +
        '⚠️ This generates a script artifact only — it does NOT execute cloud mutation.\n\n' +
        'Requirements:\n' +
        '1. Produce a run-plan referencing the test spec assertions and knowledge paths\n' +
        '2. Generate a TypeScript REST probe with correct API version, resource path, and request body\n' +
        '3. Wire execution gates: --check mode, DRY_RUN=1 default, ALLOW_CLOUD_MUTATION guard\n' +
        '4. Include cleanup expectations and rollback steps\n' +
        '5. Include ARM auth verification as a pre-step\n' +
        '6. Output the script to the appropriate replays/ directory\n\n' +
        'The generated script is an unverified artifact until reviewed and approved.';
    }
    if (kind === 'request-staging') {
      return '[resume] Request gated REST staging replay for spec ' + spec.id + ' (feature: ' + state.featureId + ').\n\n' +
        specLine + pathList + '\n' +
        (runPlanRef ? 'runPlan: ' + runPlanRef + '\n' : '') +
        (probeRef ? 'probe: ' + probeRef + '\n' : '') + '\n' +
        '⚠️ This is an approval request, not a direct execution command.\n\n' +
        'Prerequisites for staging execution:\n' +
        '1. Test spec must be reviewed and approved\n' +
        '2. Replay script must be reviewed and approved\n' +
        '3. Internal project-owner preflight must be clean\n' +
        '4. ARM auth must be verified on the execution host\n' +
        '5. Cleanup path must be documented\n' +
        '6. ALLOW_CLOUD_MUTATION gate variable must be explicitly set\n\n' +
        'Do NOT execute — only produce the approval artifact for human review.';
    }
    if (kind === 'review-script') {
      return '[resume] Review generated replay script for spec ' + spec.id + ' (feature: ' + state.featureId + ').\n\n' +
        specLine + pathList + '\n' +
        (probeRef ? 'probe: ' + probeRef + '\n' : '') + '\n' +
        'For the probe/replay script: Does the TypeScript match the test spec assertions? Are REST calls using the correct API version and resource path? Is the cleanup path safe? Are gate checks (--check, DRY_RUN, ALLOW_CLOUD_MUTATION) properly wired? Does the script handle auth failure gracefully? Mark the script as reviewed or flag issues.';
    }
    if (kind === 'classify-result') {
      return '[resume] Classify the latest result for spec ' + spec.id + ' (feature: ' + state.featureId + ').\n\n' +
        specLine + pathList + '\n\n' +
        'Classify this result into one of:\n' +
        '- **product**: AKS RP or platform behavior does not match the spec expectation\n' +
        '- **probe**: the test script has a bug, wrong assertion, or missing setup\n' +
        '- **environment**: staging/capacity/SKU/region issue unrelated to product behavior\n' +
        '- **doc-mismatch**: spec expectation is wrong; update the spec, not the product verdict\n\n' +
        'Provide evidence references supporting the classification. Do not change model status without explicit approval.';
    }
    if (kind === 'approve-model-update') {
      return '[resume] Approve model update for spec ' + spec.id + ' (feature: ' + state.featureId + ').\n\n' +
        specLine + pathList + '\n\n' +
        'Model status changes require evidence and classification:\n' +
        '1. What is the current model status for paths covered by this spec?\n' +
        '2. What status should it change to, and why?\n' +
        '3. Which evidence artifacts support the change?\n' +
        '4. Has the result been classified (product / probe / env / doc)?\n\n' +
        'Approve only if the classification is clear and evidence is mapped. The validator must exit 0 after the edit.';
    }
    return '';
  }

  window.specGenerateScript = function (specId) {
    var row = state.rows.find(function (r) { return r.spec.id === specId; });
    if (!row) return;
    if (typeof prefillProjectComment === 'function') prefillProjectComment(specActionPrompt('generate-script', row));
  };
  window.specRequestStaging = function (specId) {
    var row = state.rows.find(function (r) { return r.spec.id === specId; });
    if (!row) return;
    if (typeof prefillProjectComment === 'function') prefillProjectComment(specActionPrompt('request-staging', row));
  };
  window.specReviewScript = function (specId) {
    var row = state.rows.find(function (r) { return r.spec.id === specId; });
    if (!row) return;
    if (typeof prefillProjectComment === 'function') prefillProjectComment(specActionPrompt('review-script', row));
  };
  window.specClassifyResult = function (specId) {
    var row = state.rows.find(function (r) { return r.spec.id === specId; });
    if (!row) return;
    if (typeof prefillProjectComment === 'function') prefillProjectComment(specActionPrompt('classify-result', row));
  };
  window.specApproveModelUpdate = function (specId) {
    var row = state.rows.find(function (r) { return r.spec.id === specId; });
    if (!row) return;
    if (typeof prefillProjectComment === 'function') prefillProjectComment(specActionPrompt('approve-model-update', row));
  };

  function renderSpecCard(row, index) {
    const spec = row.spec;
    const health = row.health || specHealth(row);
    const directTrigger = canDirectTrigger(row);
    const triggerButton = directTrigger
      ? '<button class="feature-test-button feature-test-button-primary" data-testid="trigger-feature-test" onclick="requestAksFeatureTest(' + attrEsc(JSON.stringify(spec.id)) + ')">Trigger Test</button>'
      : '<button class="feature-test-button" data-testid="trigger-feature-test" disabled title="' + attrEsc(health.reason || 'Direct runner is not ready for this spec.') + '">Trigger Test</button>';
    const pathIds = row.pathIds.length ? row.pathIds : (spec.featurePathIds || []);
    const evidence = row.evidence;
    const behaviorCount = row.pathObjs.reduce(function (sum, path) {
      return sum + ((path.behavior || []).length);
    }, 0);
    return '<article class="feature-spec-card" data-testid="feature-test-spec-card">' +
      '<div class="feature-spec-head">' +
        '<div>' +
          '<div class="feature-test-kicker">Test Spec</div>' +
          '<h3>' + esc(spec.title || spec.id) + '</h3>' +
          '<div class="feature-test-mono">' + esc(spec.id) + '</div>' +
          '<div class="feature-spec-badges">' + specBadgeHtml(spec) + '</div>' +
        '</div>' +
        '<div class="feature-spec-status">' + statusBadge(row.status) + '<div class="feature-test-muted">' + esc((spec.assertions || []).length || spec.assertionCount || 0) + ' assertions</div></div>' +
      '</div>' +
      '<div class="feature-path-chips">' + (pathIds.map(function (pathId) { return chip(pathId, 'var(--fg2)'); }).join('') || '<span class="feature-test-muted">No path ids linked.</span>') + '</div>' +
      runnerStatusLine(row) +
      specHealthSummaryHtml(row) +
      specBriefHtml(spec) +
      executionOverviewHtml(row) +
      specReviewHtml(row, false) +
      '<div class="feature-action-row">' +
        triggerButton +
        '<button class="feature-test-button" data-testid="check-feature-result" onclick="showAksFeatureSpecResult(' + attrEsc(JSON.stringify(spec.id)) + ')">Check Result</button>' +
        '<button class="feature-test-button" data-testid="spec-generate-script" onclick="specGenerateScript(' + attrEsc(JSON.stringify(spec.id)) + ')">Generate Test Script</button>' +
        '<button class="feature-test-button" data-testid="spec-request-staging" onclick="specRequestStaging(' + attrEsc(JSON.stringify(spec.id)) + ')">Request REST Staging Replay</button>' +
        '<button class="feature-test-button" data-testid="spec-review-script" onclick="specReviewScript(' + attrEsc(JSON.stringify(spec.id)) + ')">Review Script</button>' +
        '<button class="feature-test-button" data-testid="spec-classify-result" onclick="specClassifyResult(' + attrEsc(JSON.stringify(spec.id)) + ')">Classify Result</button>' +
        '<button class="feature-test-button" data-testid="spec-approve-model-update" onclick="specApproveModelUpdate(' + attrEsc(JSON.stringify(spec.id)) + ')">Approve Model Update</button>' +
      '</div>' +
      '<div class="feature-result-summary">' +
        '<span>model/spec: ' + esc(row.status || 'unknown') + '</span>' +
        '<span>latest run: ' + esc(runnerStatus(latestRunnerRun(row)) || 'not requested') + '</span>' +
        '<span>' + esc(behaviorCount) + ' behavior checks</span>' +
        '<span>' + esc(evidence.length) + ' evidence refs</span>' +
      '</div>' +
      '<div id="' + attrEsc(resultPanelId(spec.id)) + '" class="feature-result-panel feature-result-panel-empty">Use Check Result to inspect mapped evidence.</div>' +
    '</article>';
  }

  function ensureStyles() {
    if (document.getElementById('aks-feature-test-workspace-styles')) return;
    const style = document.createElement('style');
    style.id = 'aks-feature-test-workspace-styles';
    style.textContent = `
      .feature-test-workspace {
        margin: 20px 0 0;
        display: grid;
        gap: 14px;
      }
      .feature-test-panel,
      .feature-spec-card {
        background: var(--bg2);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 14px 16px;
        min-width: 0;
      }
      .feature-test-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: start;
      }
      .feature-test-title {
        font-size: 18px;
        font-weight: 650;
        line-height: 1.25;
        margin: 2px 0 5px;
      }
      .feature-test-kicker,
      .feature-test-subhead {
        font-size: 10px;
        color: var(--fg2);
        text-transform: uppercase;
        letter-spacing: .05em;
      }
      .feature-test-subhead {
        margin: 12px 0 5px;
      }
      .feature-test-muted,
      .feature-test-empty {
        color: var(--fg2);
        font-size: 11px;
        line-height: 1.45;
      }
      .feature-test-empty {
        border: 1px dashed var(--border);
        border-radius: 6px;
        padding: 8px;
        background: var(--bg);
      }
      .feature-test-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 8px;
      }
      .feature-test-metric {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 8px 10px;
      }
      .feature-test-metric strong {
        display: block;
        font-size: 18px;
        line-height: 1;
      }
      .feature-spec-list {
        display: grid;
        gap: 12px;
      }
      .feature-spec-group {
        display: grid;
        gap: 10px;
      }
      .feature-spec-group-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg);
        padding: 10px 12px;
      }
      .feature-spec-group-head h2 {
        font-size: 14px;
        line-height: 1.25;
        margin: 2px 0 4px;
      }
      .feature-health-board {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      .feature-health-column {
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        padding: 10px;
        min-width: 0;
      }
      .feature-health-column-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: flex-start;
        margin-bottom: 4px;
      }
      .feature-health-item,
      .feature-health-summary {
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        padding: 8px 10px;
        min-width: 0;
      }
      .feature-health-item {
        display: grid;
        gap: 6px;
        margin-top: 8px;
      }
      .feature-health-summary {
        display: grid;
        gap: 7px;
        margin: 8px 0 10px;
      }
      .feature-run-list {
        display: grid;
        gap: 8px;
        margin-top: 10px;
      }
      .feature-run-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(240px, .62fr);
        gap: 12px;
        align-items: start;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        padding: 10px;
      }
      .feature-spec-head,
      .feature-result-head,
      .feature-action-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        flex-wrap: wrap;
      }
      .feature-spec-head {
        justify-content: space-between;
      }
      .feature-spec-head h3 {
        font-size: 15px;
        line-height: 1.3;
        margin: 0 0 3px;
      }
      .feature-spec-status {
        text-align: right;
      }
      .feature-spec-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        margin-top: 6px;
      }
      .feature-test-mono {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--fg2);
        overflow-wrap: anywhere;
      }
      .feature-investigation {
        display: grid;
        gap: 8px;
        margin: 8px 0;
        padding: 8px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--panel);
        min-width: 0;
      }
      .feature-investigation details {
        min-width: 0;
      }
      .feature-investigation summary {
        cursor: pointer;
        color: var(--fg);
        font-size: 11px;
        font-weight: 600;
      }
      .feature-investigation .feature-action-row {
        padding: 0;
        border: 0;
        background: transparent;
        gap: 6px;
      }
      .feature-feedback {
        display: grid;
        gap: 7px;
        min-width: 0;
      }
      .feature-feedback-input {
        width: 100%;
        min-height: 58px;
        resize: vertical;
        box-sizing: border-box;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        color: var(--fg);
        padding: 7px 8px;
        font: 11px/1.45 var(--sans);
      }
      .feature-test-badge,
      .feature-test-chip {
        display: inline-flex;
        align-items: center;
        max-width: 100%;
        border: 1px solid;
        border-radius: 999px;
        padding: 2px 7px;
        font-size: 10px;
        line-height: 1.25;
        margin: 2px 4px 2px 0;
        overflow-wrap: anywhere;
      }
      .feature-path-chips {
        margin: 8px 0;
      }
      .feature-spec-brief {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
        gap: 8px;
        margin: 10px 0;
      }
      .feature-brief-box {
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        padding: 9px 10px;
        min-width: 0;
        font-size: 12px;
        line-height: 1.45;
      }
      .feature-brief-guard {
        margin-top: 6px;
        border-left: 3px solid var(--yellow);
        padding: 5px 7px;
        color: var(--yellow);
        background: #d2992212;
        font-size: 11px;
        line-height: 1.4;
      }
      .feature-execution-overview {
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        padding: 10px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 10px;
        margin: 10px 0;
      }
      .feature-target-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
      }
      .feature-flow-step,
      .feature-execution-target {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        border-top: 1px solid var(--border);
        padding-top: 7px;
        margin-top: 7px;
      }
      .feature-execution-target {
        grid-template-columns: minmax(150px, .55fr) minmax(0, 1fr);
      }
      .feature-flow-index {
        width: 20px;
        height: 20px;
        border-radius: 999px;
        border: 1px solid var(--border);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: var(--fg2);
        background: var(--bg2);
      }
      .feature-spec-details {
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        padding: 8px 10px;
      }
      .feature-spec-details summary {
        cursor: pointer;
        font-size: 12px;
        font-weight: 650;
      }
      .feature-spec-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      .feature-spec-grid section {
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg2);
        padding: 10px;
        min-width: 0;
      }
      .feature-spec-wide {
        grid-column: 1 / -1;
      }
      .feature-test-row {
        display: grid;
        grid-template-columns: minmax(120px, .45fr) minmax(0, 1fr);
        gap: 8px;
        padding: 6px 0;
        border-bottom: 1px solid var(--border);
        font-size: 12px;
      }
      .feature-test-row:last-child {
        border-bottom: 0;
      }
      .feature-test-json {
        max-height: 260px;
        overflow: auto;
        margin: 6px 0 0;
        padding: 8px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        color: var(--fg);
        font: 11px/1.45 var(--mono);
        white-space: pre-wrap;
      }
      .feature-callout {
        margin-top: 8px;
        border-left: 3px solid var(--accent);
        padding: 7px 9px;
        background: var(--bg);
        color: var(--fg2);
        font-size: 11px;
        line-height: 1.5;
      }
      .feature-test-button {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--fg);
        padding: 7px 12px;
        font: 12px/1.2 var(--font);
        cursor: pointer;
      }
      .feature-test-button:hover {
        border-color: var(--accent);
      }
      .feature-test-button:disabled {
        cursor: not-allowed;
        color: var(--fg2);
        opacity: .62;
      }
      .feature-test-button-primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
      .feature-result-panel,
      .feature-result-card {
        display: grid;
        gap: 8px;
      }
      .feature-result-summary {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        color: var(--fg2);
        font-size: 11px;
        margin-top: 8px;
      }
      .feature-result-summary span {
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--bg);
        padding: 2px 7px;
      }
      .feature-result-panel-empty {
        color: var(--fg2);
        font-size: 11px;
        border: 1px dashed var(--border);
        border-radius: 6px;
        background: var(--bg);
        padding: 8px;
      }
      .feature-result-card {
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        padding: 10px;
      }
      .feature-behavior-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .feature-behavior-table th,
      .feature-behavior-table td {
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid var(--border);
        padding: 5px;
      }
      .feature-behavior-table th {
        color: var(--fg2);
        font-weight: 500;
      }
      .feature-test-ref {
        font: 10px/1.45 var(--mono);
        overflow-wrap: anywhere;
        margin: 2px 0;
      }
      .feature-test-success {
        border: 1px solid var(--green);
        color: var(--green);
        background: #3fb95014;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 12px;
      }
      .feature-test-error {
        border: 1px solid var(--red);
        color: var(--red);
        background: #f8514914;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 12px;
      }
      .feature-model-review {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: flex-start;
        padding: 6px 0;
      }
      .feature-model-review-pending {
        border-left: 3px solid var(--yellow);
        padding-left: 8px;
      }
      .feature-model-review-actionable {
        border-left: 3px solid var(--accent);
        padding-left: 8px;
      }
      @media (max-width: 900px) {
        .feature-test-header,
        .feature-run-row,
        .feature-execution-overview,
        .feature-execution-target,
        .feature-spec-grid,
        .feature-spec-brief,
        .feature-test-row {
          grid-template-columns: 1fr;
        }
        .feature-test-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .feature-spec-status {
          text-align: left;
        }
      }
    `;
    document.head.appendChild(style);
  }

  window.renderScenarioPathTable = async function (container) {
    if (!container) return;
    ensureStyles();
    const featureId = featureIdFromPage() || 'managedsystem-pool';
    state.featureId = featureId;
    container.innerHTML = '<div class="feature-test-panel feature-test-muted">Loading feature test specs...</div>';

    try {
      const results = await Promise.all([fetchJSON(PATHS_URL), fetchJSON(SPECS_URL), loadFeatureTestRuns(featureId)]);
      const pathsData = results[0];
      const specsData = results[1];
      const runsBySpec = results[2] || {};
      const pathsList = pathsData.paths || [];
      const pathMap = {};
      pathsList.forEach(function (path) { pathMap[path.id] = path; });

      const featurePaths = pathsList.filter(function (path) { return matchesFeaturePath(featureId, path); });
      const featurePathIds = new Set(featurePaths.map(function (path) { return path.id; }));

      const indexSpecs = specsData.specs || [];
      const activeSpecIds = new Set(indexSpecs.map(function (spec) { return spec.id; }).filter(Boolean));
      const files = candidateSpecFiles(featureId, specsData);
      const fullSpecs = (await Promise.all(files.map(fetchSpecFile))).filter(function (spec) {
        return !spec.loadError && activeSpecIds.has(spec.id) && spec.status !== 'superseded';
      });
      const specsById = {};
      indexSpecs.forEach(function (spec) {
        if (spec.id && spec.status !== 'superseded') specsById[spec.id] = spec;
      });
      fullSpecs.forEach(function (spec) {
        specsById[spec.id] = Object.assign({}, specsById[spec.id] || {}, spec);
      });

      let specs = Object.values(specsById).filter(function (spec) {
        return activeSpecIds.has(spec.id) && spec.status !== 'superseded' && matchesFeatureSpec(featureId, spec, featurePathIds);
      });
      const seenSpec = {};
      specs = specs.filter(function (spec) {
        if (!spec.id || seenSpec[spec.id]) return false;
        seenSpec[spec.id] = true;
        return true;
      });
      specs.sort(function (a, b) {
        return (a.sequenceOrder || a.clusterLifecycle?.sequenceOrder || 999) - (b.sequenceOrder || b.clusterLifecycle?.sequenceOrder || 999) ||
          String(a.id).localeCompare(String(b.id));
      });

      const rows = specs.map(function (spec) {
        const pathIds = spec.featurePathIds || (spec.featurePathId ? [spec.featurePathId] : []);
        const pathObjs = pathIds.map(function (id) { return pathMap[id]; }).filter(Boolean);
        const status = deriveStatus(pathObjs, spec);
        const evidence = collectEvidence(pathObjs, spec);
        const testRuns = runsBySpec[spec.id] || [];
        const row = { spec, pathIds, pathObjs, status, evidence, testRuns };
        row.health = specHealth(row);
        return row;
      });

      const counts = { pass: 0, fail: 0, unknown: 0, blocked: 0 };
      rows.forEach(function (row) { counts[row.status] = (counts[row.status] || 0) + 1; });
      const healthCounts = {};
      let gatedCount = 0;
      rows.forEach(function (row) {
        const key = row.health?.state || 'unknown';
        healthCounts[key] = (healthCounts[key] || 0) + 1;
        if (row.health?.gate?.state === 'blocked') gatedCount += 1;
      });
      state = { featureId, rows, pathMap, counts, runsBySpec };

      let html = '<section class="feature-test-workspace" data-testid="dedicated-feature-test-page">';
      html += '<div class="feature-test-panel feature-test-header">';
      html += '<div><div class="feature-test-kicker">Dedicated Feature Page</div>';
      html += '<div class="feature-test-title">' + esc(featureLabel(featureId)) + ' Test Specs And Results</div>';
      html += '<div class="feature-test-muted">Review source-backed specs, trigger one gated staging test through aks-explorer, and inspect mapped evidence before accepting any model verdict.</div></div>';
      html += '<div class="feature-action-row"><button class="feature-test-button" onclick="refreshAksFeatureTests()">Refresh Results</button><a class="feature-test-button" href="' + BASE + '/ui/kanban/">Task Kanban</a></div>';
      html += '</div>';

      html += '<div class="feature-test-summary">';
      html += '<div class="feature-test-metric"><strong>' + esc(rows.length) + '</strong><span class="feature-test-muted">test specs</span></div>';
      html += '<div class="feature-test-metric"><strong>' + esc(featurePaths.length) + '</strong><span class="feature-test-muted">knowledge paths</span></div>';
      html += '<div class="feature-test-metric"><strong style="color:var(--green)">' + esc(counts.pass || 0) + '</strong><span class="feature-test-muted">passing specs</span></div>';
      html += '<div class="feature-test-metric"><strong style="color:var(--accent)">' + esc(Object.values(runsBySpec).reduce(function (sum, runs) { return sum + runs.length; }, 0)) + '</strong><span class="feature-test-muted">linked runs</span></div>';
      html += '<div class="feature-test-metric"><strong style="color:var(--orange)">' + esc(gatedCount) + '</strong><span class="feature-test-muted">gated now</span></div>';
      html += '</div>';
      html += specHealthBoardHtml(rows);
      html += featureRunOverviewHtml(rows);

      if (!rows.length) {
        html += '<div class="feature-test-panel feature-test-empty">No test specs matched feature id <code>' + esc(featureId) + '</code>.</div>';
      } else {
        html += '<div class="feature-spec-list">' + renderSpecGroups(rows) + '</div>';
      }
      html += '</section>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = '<div class="feature-test-panel feature-test-error">Error loading feature test specs: ' + esc(err?.message || String(err)) + '</div>';
      console.error('feature test workspace error:', err);
    }
  };
})();
