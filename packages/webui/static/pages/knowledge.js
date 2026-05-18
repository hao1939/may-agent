// ── Knowledge Browser ─────────────────────────────────────────────────
let kbCurrentPath = '';

async function loadKnowledge() {
  browsePath('');
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
