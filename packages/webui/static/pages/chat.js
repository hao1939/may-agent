// Shared WebSocket observations for Conversation and read-only diagnostics.
let ws = null;
let realtimeEnabled = false;
let wsPollTimer = null;
let wsReconnectTimer = null;
let chatAutoScroll = true;

function toggleChatScroll() {
  chatAutoScroll = !chatAutoScroll;
  const btn = document.getElementById('scroll-toggle');
  if (chatAutoScroll) {
    btn.textContent = '⬇ Auto-scroll';
    btn.classList.remove('off');
    // Immediately scroll to bottom when re-enabled
    const messages = document.getElementById('chat-messages');
    messages.scrollTop = messages.scrollHeight;
  } else {
    btn.textContent = '⏸ Scroll paused';
    btn.classList.add('off');
  }
}

function chatScrollToBottom(el) {
  if (chatAutoScroll) el.scrollTop = el.scrollHeight;
}

// Smart auto-scroll: pause when user scrolls up, resume when at bottom
document.addEventListener('DOMContentLoaded', () => {
  const messages = document.getElementById('chat-messages');
  if (messages) {
    messages.addEventListener('scroll', () => {
      const atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 40;
      if (atBottom && !chatAutoScroll) {
        chatAutoScroll = true;
        const btn = document.getElementById('scroll-toggle');
        btn.textContent = '⬇ Auto-scroll';
        btn.classList.remove('off');
      } else if (!atBottom && chatAutoScroll) {
        chatAutoScroll = false;
        const btn = document.getElementById('scroll-toggle');
        btn.textContent = '⏸ Scroll paused';
        btn.classList.add('off');
      }
    });
  }
});

function linkifyRefs(html) {
  if (!html) return html;
  // KE-NNN — route to knowledge surface so deep links work cross-pane.
  html = html.replace(/\b(KE-\d+)\b/g, '<a href="#/knowledge/entries/$1.md" onclick="event.stopPropagation()">$1</a>');
  return html;
}

function syncRealtimeSubscriptions() {
  if (ws?.readyState !== WebSocket.OPEN) return;
  const conversation = isMayConversation();
  const sessions = currentTab === 'live' || conversation ? ['*']
    : currentTab === 'sessions' && currentRouteParams.id ? [currentRouteParams.id] : [];
  ws.send(JSON.stringify({ type: 'subscribe', sessions,
    conversations: conversation ? [humanInterface.conversationId] : [] }));
}

function setRealtimeEnabled(enabled) {
  realtimeEnabled = !!enabled;
  clearTimeout(wsReconnectTimer);
  wsReconnectTimer = null;
  if (realtimeEnabled) {
    connectWs();
    syncRealtimeSubscriptions();
    return;
  }
  clearInterval(wsPollTimer);
  wsPollTimer = null;
  const socket = ws;
  ws = null;
  if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
}

function refreshSessionStatus() {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'status' }));
}

function connectWs() {
  if (!realtimeEnabled) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  wsReconnectTimer = null;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${proto}//${location.host}/ws`);
  ws = socket;
  const status = document.getElementById('chat-status');

  socket.onopen = () => {
    if (ws !== socket) return socket.close();
    status.textContent = 'Connected';
    syncRealtimeSubscriptions();
    if (isMayConversation()) {
      void refreshMayConversation();
    } else {
      if (currentTab === 'live') scheduleLivenessRefresh();
      else if (currentTab === 'sessions' && currentRouteParams.id) void loadSessionDetail(currentRouteParams.id);
    }
    // Poll for active sessions periodically
    const pollSessions = refreshSessionStatus;
    pollSessions();
    clearInterval(wsPollTimer);
    wsPollTimer = setInterval(pollSessions, 15000);
  };
  socket.onclose = () => {
    if (ws !== socket) return;
    ws = null;
    updateConversationStop();
    clearInterval(wsPollTimer);
    wsPollTimer = null;
    if (!realtimeEnabled) return;
    status.textContent = 'Disconnected — reconnecting...';
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(connectWs, 3000);
  };
  socket.onerror = () => { if (ws === socket) status.textContent = 'Connection error'; };

  socket.onmessage = (e) => {
    if (ws !== socket) return;
    try {
      const event = JSON.parse(e.data);
      const eventType = typeof event.type === 'string' ? event.type.replace(/\./g, '_') : event.type;
      const data = event && typeof event.data === 'object' && event.data !== null && !Array.isArray(event.data)
        ? event.data
        : event;

      // Live event pub-sub: panels subscribe via window.busSubscribe(type, fn)
      // and get the raw (unmangled) event. Type matches AgentEvent shape:
      // 'session.start', 'session.end', 'message.created', 'metric.breach', etc.
      if (typeof event.type === 'string' && window.__busSubs) {
        const subs = window.__busSubs[event.type];
        if (subs) for (const fn of subs) { try { fn(event); } catch (err) { console.error('bus sub err', err); } }
        const all = window.__busSubs['*'];
        if (all) for (const fn of all) { try { fn(event); } catch (err) { console.error('bus * sub err', err); } }
      }

      if (isMayConversation() && event.type === 'conversation.updated'
        && data.appId === humanInterface.appId && data.conversationId === humanInterface.conversationId) {
        void refreshMayConversation();
      }

      // Notifications wake the current read model; they never write messages.
      if (data.sessionId && (eventType === 'turn_end' || eventType === 'session_end')) {
        if (currentTab === 'sessions' && data.sessionId === currentRouteParams.id) void loadSessionDetail(data.sessionId);
      }

      switch (eventType) {
        case 'overflow':
          if (event.action === 'reread') {
            syncRealtimeSubscriptions();
            refreshSessionStatus();
            if (isMayConversation()) void refreshMayConversation();
            else if (currentTab === 'sessions' && currentRouteParams.id) void loadSessionDetail(currentRouteParams.id);
            scheduleLivenessRefresh();
          }
          break;
        case 'session_start':
        case 'session_end':
          refreshSessionStatus();
          scheduleLivenessRefresh();
          break;
        case 'message_created':
        case 'metric_breach':
        case 'metric_recovered':
        case 'handler_failed':
          scheduleLivenessRefresh();
          break;
      }
    } catch {}
  };
}


document.getElementById('chat-send').addEventListener('click', () => void sendMayConversation());
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMayConversation(); }
});
