let terminalInitialized = false;
let terminalProfiles = [];
let activeTerminalId = 'may';
let terminal = null;
let fitAddon = null;
let terminalSocket = null;
let terminalResizeObserver = null;

function initTerminalPage(requestedProfileId) {
  const host = document.getElementById('terminal-content');
  if (!host) return;
  if (requestedProfileId) activeTerminalId = requestedProfileId;
  if (!terminalInitialized) {
    terminalInitialized = true;
    host.innerHTML = `
      <div class="terminal-shell">
        <div class="terminal-toolbar">
          <div id="terminal-tabs" class="terminal-tabs"></div>
          <div class="terminal-actions">
            <span id="terminal-status" class="terminal-status">Loading</span>
            <button class="ask-btn" onclick="restartActiveTerminal()">Restart</button>
            <button class="ask-btn" onclick="fitActiveTerminal()">Fit</button>
          </div>
        </div>
        <div id="terminal-mount" class="terminal-mount"></div>
      </div>`;
  }
  loadTerminals(requestedProfileId);
}

async function loadTerminals(requestedProfileId) {
  const status = document.getElementById('terminal-status');
  try {
    const res = await fetch('/api/terminals');
    const data = await res.json();
    terminalProfiles = data.profiles || [];
    if (!data.enabled) {
      renderTerminalDisabled(data.reason || 'Web terminal is disabled.');
      return;
    }
    if (requestedProfileId && terminalProfiles.some(p => p.id === requestedProfileId)) activeTerminalId = requestedProfileId;
    if (!terminalProfiles.some(p => p.id === activeTerminalId)) activeTerminalId = terminalProfiles[0]?.id || 'shell';
    renderTerminalTabs();
    connectTerminal(activeTerminalId);
  } catch (err) {
    if (status) status.textContent = err.message || String(err);
  }
}

function renderTerminalDisabled(reason) {
  const host = document.getElementById('terminal-content');
  if (!host) return;
  host.innerHTML = `
    <div class="terminal-disabled">
      <h2>Web Terminal Disabled</h2>
      <p>${esc(reason)}</p>
      <pre>MAY_WEB_TERMINAL=1</pre>
    </div>`;
}

function renderTerminalTabs() {
  const tabs = document.getElementById('terminal-tabs');
  if (!tabs) return;
  tabs.innerHTML = terminalProfiles.map(profile => `
    <button class="terminal-tab ${profile.id === activeTerminalId ? 'active' : ''}"
      title="${esc(profile.description || '')}"
      onclick="selectTerminal('${attrEsc(profile.id)}')">
      ${esc(profile.label || profile.id)}
    </button>
  `).join('');
}

function selectTerminal(profileId) {
  routeTo(`/terminal/${encodeURIComponent(profileId)}`);
}

function disposeTerminalClient() {
  if (terminalResizeObserver) {
    terminalResizeObserver.disconnect();
    terminalResizeObserver = null;
  }
  if (terminalSocket) {
    terminalSocket.onclose = null;
    terminalSocket.close();
    terminalSocket = null;
  }
  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
  fitAddon = null;
}

function connectTerminal(profileId) {
  disposeTerminalClient();
  const mount = document.getElementById('terminal-mount');
  const status = document.getElementById('terminal-status');
  if (!mount || !window.Terminal || !window.FitAddon?.FitAddon) {
    if (status) status.textContent = 'xterm assets missing';
    return;
  }
  mount.innerHTML = '';
  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    convertEol: true,
    // tmux owns scrollback. xterm scrollback records tmux repaint/status escape
    // sequences and makes old content look malformed when scrolling locally.
    scrollback: 0,
    fontFamily: '"JetBrains Mono", "Cascadia Mono", "SF Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace',
    fontSize: 14,
    fontWeight: 400,
    fontWeightBold: 600,
    letterSpacing: 0,
    lineHeight: 1.36,
    minimumContrastRatio: 4.5,
    drawBoldTextInBrightColors: false,
    theme: {
      background: '#0b0f14',
      foreground: '#d6deeb',
      cursor: '#f8fafc',
      cursorAccent: '#0b0f14',
      selectionBackground: '#334155',
      selectionForeground: '#f8fafc',
      black: '#111827',
      red: '#f87171',
      green: '#34d399',
      yellow: '#fbbf24',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: '#d1d5db',
      brightBlack: '#6b7280',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fde68a',
      brightBlue: '#93c5fd',
      brightMagenta: '#d8b4fe',
      brightCyan: '#67e8f9',
      brightWhite: '#f8fafc'
    }
  });
  fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(mount);
  terminal.focus();
  fitActiveTerminal();

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const qs = new URLSearchParams({ cols: String(terminal.cols), rows: String(terminal.rows) });
  terminalSocket = new WebSocket(`${proto}//${location.host}/api/terminals/${encodeURIComponent(profileId)}/ws?${qs}`);
  terminalSocket.onopen = () => {
    if (status) status.textContent = `Connecting ${profileId}`;
  };
  terminalSocket.onmessage = event => {
    let frame;
    try { frame = JSON.parse(event.data); } catch { frame = { type: 'data', data: String(event.data) }; }
    if (frame.type === 'data') terminal.write(frame.data || '');
    else if (frame.type === 'ready') {
      if (status) status.textContent = `${frame.profile?.label || profileId} · pid ${frame.pid}`;
      terminal.focus();
      fitActiveTerminal();
    } else if (frame.type === 'error') {
      if (status) status.textContent = frame.message || 'terminal error';
      terminal.writeln(`\r\n[terminal error] ${frame.message || 'unknown error'}\r\n`);
    } else if (frame.type === 'exit') {
      if (status) status.textContent = `Exited ${frame.exitCode}`;
      terminal.writeln(`\r\n[terminal exited: ${frame.exitCode}]\r\n`);
    } else if (frame.type === 'restart') {
      terminal.writeln('\r\n[terminal restarting]\r\n');
    }
  };
  terminalSocket.onclose = () => {
    if (status) status.textContent = 'Disconnected';
  };
  terminal.onData(data => {
    if (terminalSocket?.readyState === WebSocket.OPEN) {
      terminalSocket.send(JSON.stringify({ type: 'input', data }));
    }
  });
  terminal.onResize(size => {
    if (terminalSocket?.readyState === WebSocket.OPEN) {
      terminalSocket.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
    }
  });
  terminalResizeObserver = new ResizeObserver(() => fitActiveTerminal());
  terminalResizeObserver.observe(mount);
}

function fitActiveTerminal() {
  if (!terminal || !fitAddon) return;
  try {
    fitAddon.fit();
  } catch {}
}

async function restartActiveTerminal() {
  if (!activeTerminalId) return;
  if (!confirm(`Restart ${activeTerminalId} terminal session? This kills the tmux session for this profile.`)) return;
  try {
    const res = await fetch(`/api/terminals/${encodeURIComponent(activeTerminalId)}/restart`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    connectTerminal(activeTerminalId);
  } catch (err) {
    toast(`terminal restart failed: ${err.message || err}`, 'error');
  }
}
