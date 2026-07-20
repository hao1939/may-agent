let terminalInitialized = false;
let terminalProfiles = [];
let activeTerminalId = 'may';
let terminal = null;
let fitAddon = null;
let terminalSocket = null;
let terminalResizeObserver = null;
let terminalReplayWrites = 0;
let terminalClientGeneration = 0;
let terminalFitFrame = 0;
let terminalHasFocus = false;
let terminalScrollDelta = 0;
let terminalScrollFrame = 0;

function initTerminalPage(requestedProfileId) {
  const host = document.getElementById('terminal-content');
  if (!host) return;
  if (requestedProfileId) activeTerminalId = requestedProfileId;
  if (!terminalInitialized) {
    terminalInitialized = true;
    window.addEventListener('focus', sendTerminalFocusFrame);
    document.addEventListener('visibilitychange', sendTerminalFocusFrame);
    host.innerHTML = `
      <div class="terminal-shell">
        <div class="terminal-toolbar">
          <div id="terminal-tabs" class="terminal-tabs"></div>
          <div class="terminal-actions">
            <span id="terminal-status" class="terminal-status">Loading</span>
            <button class="ask-btn" onclick="copyTerminalSelection()">Copy</button>
            <button class="ask-btn" onclick="pasteIntoTerminal()">Paste</button>
            <button class="ask-btn" onclick="returnToLiveTerminal()" title="Leave history view and return to the live terminal">Live</button>
            <button class="ask-btn" onclick="fitActiveTerminal()">Fit</button>
            <button class="ask-btn" onclick="restartActiveTerminal()">Restart Terminal</button>
          </div>
        </div>
        <div id="terminal-quickbar" class="terminal-quickbar"></div>
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
    renderTerminalQuickbar();
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

function activeTerminalProfile() {
  return terminalProfiles.find(p => p.id === activeTerminalId) || null;
}

function renderTerminalQuickbar() {
  const quickbar = document.getElementById('terminal-quickbar');
  if (!quickbar) return;
  if (activeTerminalId !== 'may') {
    quickbar.innerHTML = '';
    quickbar.classList.add('hidden');
    return;
  }
  quickbar.classList.remove('hidden');
  quickbar.innerHTML = `
    <button class="terminal-quick" onclick="sendTerminalCommand('/status')">Status</button>
    <button class="terminal-quick" onclick="sendTerminalCommand('/sessions')">Sessions</button>
    <button class="terminal-quick" onclick="sendTerminalCommand('/watch chat')">Watch Chat</button>
    <button class="terminal-quick" onclick="sendTerminalCommand('/watch current')">Watch Current</button>
    <button class="terminal-quick" onclick="sendTerminalCommand('/may')">Use May</button>
    <button class="terminal-quick" onclick="clearTerminalScreen()">Clear</button>
  `;
}

function disposeTerminalClient() {
  terminalClientGeneration++;
  if (terminalFitFrame) {
    cancelAnimationFrame(terminalFitFrame);
    terminalFitFrame = 0;
  }
  if (terminalScrollFrame) {
    cancelAnimationFrame(terminalScrollFrame);
    terminalScrollFrame = 0;
  }
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
  terminalReplayWrites = 0;
  terminalHasFocus = false;
  terminalScrollDelta = 0;
}

async function waitForTerminalLayout() {
  await new Promise(resolve => requestAnimationFrame(() => resolve()));
  await new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function connectTerminal(profileId) {
  disposeTerminalClient();
  const generation = terminalClientGeneration;
  renderTerminalQuickbar();
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
    // tmux owns persistent scrollback for every web terminal profile. xterm
    // renders the active browser client and keeps local scrollback only as a
    // best-effort convenience.
    scrollback: 50000,
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
  terminalHasFocus = document.visibilityState !== 'hidden' && document.hasFocus();
  terminal.element?.addEventListener('focusin', () => {
    terminalHasFocus = true;
    sendTerminalFocusFrame();
  });
  terminal.element?.addEventListener('focusout', () => {
    terminalHasFocus = false;
  });
  terminal.element?.addEventListener('wheel', queueTerminalScroll, { passive: false, capture: true });
  if (status) status.textContent = `Opening ${profileId}`;

  terminal.onData(data => {
    if (terminalReplayWrites > 0) return;
    if (terminalSocket?.readyState === WebSocket.OPEN) {
      terminalSocket.send(JSON.stringify({ type: 'input', data }));
    }
  });
  terminal.onResize(size => {
    if (terminalCanOwnSize() && terminalSocket?.readyState === WebSocket.OPEN) {
      terminalSocket.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
    }
  });
  terminalResizeObserver = new ResizeObserver(() => scheduleActiveTerminalFit());
  terminalResizeObserver.observe(mount);

  await waitForTerminalLayout();
  if (generation !== terminalClientGeneration || !terminal) return;
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
    else if (frame.type === 'replay') {
      terminalReplayWrites++;
      terminal.write(frame.data || '', () => {
        terminalReplayWrites = Math.max(0, terminalReplayWrites - 1);
      });
    }
    else if (frame.type === 'ready') {
      if (status) {
        const profile = activeTerminalProfile();
        const idle = profile?.idleUntil ? ` · warm until ${new Date(profile.idleUntil).toLocaleTimeString()}` : '';
        status.textContent = `${frame.profile?.label || profileId} · ${profileId}${profileId === 'may' ? ' · daemon console' : ''} · pid ${frame.pid}${idle}`;
      }
      terminal.focus();
      sendTerminalFocusFrame();
      scheduleActiveTerminalFit();
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
}

function scheduleActiveTerminalFit() {
  if (terminalFitFrame) return;
  terminalFitFrame = requestAnimationFrame(() => {
    terminalFitFrame = 0;
    fitActiveTerminal();
  });
}

function fitActiveTerminal() {
  if (!terminal || !fitAddon) return;
  try {
    const mount = document.getElementById('terminal-mount');
    if (mount) {
      const height = terminalMountHeight(mount) + 'px';
      if (mount.style.height !== height) mount.style.height = height;
    }
    fitAddon.fit();
  } catch {}
}

function terminalMountHeight(mount) {
  const main = document.querySelector('body.terminal-mode .main');
  const mainRect = main?.getBoundingClientRect();
  const mainStyle = main ? getComputedStyle(main) : null;
  const mainPaddingBottom = mainStyle ? parseFloat(mainStyle.paddingBottom || '0') || 0 : 0;
  const mountRect = mount.getBoundingClientRect();
  const border = 2;
  const bottom = (mainRect?.bottom || window.innerHeight) - mainPaddingBottom;
  const available = Math.max(120, Math.floor(bottom - mountRect.top));
  const cell = terminal?.element?.querySelector('.xterm-rows > div')?.getBoundingClientRect().height || 19;
  const rows = Math.max(8, Math.floor((available - border) / cell));
  return Math.floor(rows * cell + border);
}

function sendTerminalData(data) {
  if (terminalSocket?.readyState !== WebSocket.OPEN) {
    toast('terminal is not connected', 'error');
    return false;
  }
  terminalSocket.send(JSON.stringify({ type: 'input', data }));
  terminal?.focus();
  return true;
}

function sendTerminalFocusFrame() {
  if (!terminalCanOwnSize() || terminalSocket?.readyState !== WebSocket.OPEN || !terminal) return;
  terminalSocket.send(JSON.stringify({ type: 'focus', cols: terminal.cols, rows: terminal.rows }));
}

function terminalCanOwnSize() {
  return terminalHasFocus && document.visibilityState !== 'hidden' && document.hasFocus();
}

function queueTerminalScroll(event) {
  if (!terminal || !terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) return;
  if (event.ctrlKey || event.metaKey || !event.deltaY) return;
  event.preventDefault();
  event.stopPropagation();
  terminal.focus();
  terminalHasFocus = true;

  const unit = event.deltaMode === 1
    ? 32
    : event.deltaMode === 2
      ? 32 * Math.max(1, terminal.rows || 1)
      : 1;
  terminalScrollDelta += event.deltaY * unit;
  if (terminalScrollFrame) return;
  terminalScrollFrame = requestAnimationFrame(flushTerminalScroll);
}

function flushTerminalScroll() {
  terminalScrollFrame = 0;
  if (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) {
    terminalScrollDelta = 0;
    return;
  }
  const linePixels = 32;
  const lines = Math.min(24, Math.floor(Math.abs(terminalScrollDelta) / linePixels));
  if (lines < 1) return;
  const direction = terminalScrollDelta < 0 ? 'up' : 'down';
  terminalScrollDelta -= Math.sign(terminalScrollDelta) * lines * linePixels;
  terminalSocket.send(JSON.stringify({ type: 'scroll', direction, lines }));
  if (Math.abs(terminalScrollDelta) >= linePixels) {
    terminalScrollFrame = requestAnimationFrame(flushTerminalScroll);
  }
}

function returnToLiveTerminal() {
  terminalScrollDelta = 0;
  if (terminalSocket?.readyState === WebSocket.OPEN) {
    terminalSocket.send(JSON.stringify({ type: 'history-exit' }));
  }
  terminal?.scrollToBottom();
  terminal?.focus();
}

function sendTerminalCommand(command) {
  sendTerminalData(`${command}\n`);
}

function clearTerminalScreen() {
  terminal?.clear();
  terminal?.focus();
}

async function copyTerminalSelection() {
  if (!terminal) return;
  const text = terminal.getSelection();
  if (!text) {
    toast('no terminal selection to copy');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('terminal selection copied');
  } catch (err) {
    toast(`copy failed: ${err.message || err}`, 'error');
  }
}

async function pasteIntoTerminal() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) sendTerminalData(text);
  } catch (err) {
    toast(`paste failed: ${err.message || err}`, 'error');
  }
}

async function restartActiveTerminal() {
  if (!activeTerminalId) return;
  if (!confirm(`Restart ${activeTerminalId} terminal profile? This restarts the web terminal/tmux session, not the May daemon.`)) return;
  try {
    const res = await fetch(`/api/terminals/${encodeURIComponent(activeTerminalId)}/restart`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    connectTerminal(activeTerminalId);
  } catch (err) {
    toast(`terminal restart failed: ${err.message || err}`, 'error');
  }
}
