// ── Knowledge Browser ─────────────────────────────────────────────────
let kbCurrentPath = '';

async function loadKnowledge() {
  const searchInput = document.getElementById('kb-search-input');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = '1';
    searchInput.addEventListener('input', () => {
      if (!searchInput.value.trim()) {
        const results = document.getElementById('kb-search-results');
        const status = document.getElementById('kb-search-status');
        if (results) results.innerHTML = '';
        if (status) status.textContent = '';
      }
    });
  }
  browsePath('');
}

async function searchKnowledge() {
  const input = document.getElementById('kb-search-input');
  const results = document.getElementById('kb-search-results');
  const status = document.getElementById('kb-search-status');
  const q = input?.value?.trim() || '';
  if (!results || !status) return;
  if (q.length < 2) {
    status.textContent = 'Enter at least 2 characters.';
    results.innerHTML = '';
    return;
  }
  status.textContent = 'Searching...';
  results.innerHTML = '';
  try {
    const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}&limit=40`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    status.textContent = `${data.results?.length || 0} result${data.results?.length === 1 ? '' : 's'}`;
    if (!data.results?.length) {
      results.innerHTML = '<div class="empty-state">No knowledge matches found.</div>';
      return;
    }
    results.innerHTML = `<div class="knowledge-results">${data.results.map(renderKnowledgeResult).join('')}</div>`;
  } catch (e) {
    status.textContent = '';
    results.innerHTML = `<div style="color:var(--red);margin-bottom:12px">Search failed: ${esc(e.message)}</div>`;
  }
}

function renderKnowledgeResult(result) {
  const open = result.browsePath
    ? `onclick="viewFile(${jsStringAttr(result.browsePath)})"`
    : '';
  const clickable = result.browsePath ? ' knowledge-result-clickable' : '';
  return `<div class="knowledge-result${clickable}" ${open}>
    <div class="knowledge-result-path">${esc(result.path || '')}</div>
    <div class="knowledge-result-meta">${esc(result.source || '')} · ${esc(result.match || 'match')}</div>
    <div class="knowledge-result-snippet">${esc(result.snippet || '')}</div>
  </div>`;
}

async function browsePath(path) {
  kbCurrentPath = path;
  const tree = document.getElementById('kb-tree');
  const content = document.getElementById('kb-content');
  const breadcrumb = document.getElementById('kb-breadcrumb');

  // Breadcrumb
  const parts = path ? path.split('/') : [];
  let crumb = '<a href="#" onclick="event.preventDefault(); browsePath(\'\')">shared</a>';
  let accumulated = '';
  for (const part of parts) {
    accumulated += (accumulated ? '/' : '') + part;
    const p = accumulated;
    crumb += ` / <a href="#" onclick="event.preventDefault(); browsePath('${p}')">${part}</a>`;
  }
  breadcrumb.innerHTML = '📁 ' + crumb;

  tree.innerHTML = '<span style="color:var(--fg2)">Loading...</span>';

  try {
    const resp = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
    const data = await resp.json();

    if (data.type === 'dir') {
      // Render directory listing
      const dirs = data.entries.filter(e => e.type === 'dir');
      const files = data.entries.filter(e => e.type === 'file');

      let html = '';
      for (const d of dirs) {
        const childPath = path ? `${path}/${d.name}` : d.name;
        html += `<div class="request" onclick="browsePath('${childPath}')" style="padding:8px 12px">
          <span style="color:var(--accent)">📁 ${esc(d.name)}</span>
        </div>`;
      }
      for (const f of files) {
        const filePath = path ? `${path}/${f.name}` : f.name;
        const size = f.size ? `<span style="color:var(--fg2);font-size:11px;float:right">${(f.size/1024).toFixed(1)}KB</span>` : '';
        html += `<div class="request" onclick="viewFile('${filePath}')" style="padding:8px 12px">
          <span>📄 ${esc(f.name)}</span>${size}
        </div>`;
      }
      tree.innerHTML = html || '<span style="color:var(--fg2)">Empty directory</span>';
    } else if (data.type === 'file') {
      // Directly opened a file from URL
      renderFileContent(content, data.content, path);
    }
  } catch (err) {
    tree.innerHTML = `<span style="color:var(--red)">Error: ${err.message}</span>`;
  }
}

async function viewFile(path) {
  const content = document.getElementById('kb-content');
  content.innerHTML = '<span style="color:var(--fg2)">Loading...</span>';

  try {
    const resp = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
    const data = await resp.json();
    renderFileContent(content, data.content, path);
  } catch (err) {
    content.innerHTML = `<span style="color:var(--red)">Error: ${err.message}</span>`;
  }
}

function renderFileContent(el, text, path) {
  if (path.endsWith('.md') && window.marked && window.marked.parse) {
    let html = linkifyRefs(window.marked.parse(text));
    el.innerHTML = '<div class="md-rendered">' + html + '</div>';
  } else if (path.endsWith('.json')) {
    try {
      el.innerHTML = `<pre style="font-size:12px">${esc(JSON.stringify(JSON.parse(text), null, 2))}</pre>`;
    } catch {
      el.innerHTML = `<pre style="font-size:12px">${esc(text)}</pre>`;
    }
  } else {
    el.innerHTML = `<pre style="font-size:12px">${esc(text)}</pre>`;
  }
}
