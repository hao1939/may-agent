// May's shared Conversation uses the same reads/events as Console and Telegram.
// Session inspection and direct agent chat keep their existing separate views.
let mayActiveTurn = null;
let mayConversationRead = null;
let mayConversationDirty = false;
let mayStopPending = false;
let maySendPending = false;
let mayUnconfirmedInput = null;
let mayFocusedTask = null;

function isMayConversation() {
  return Boolean(humanInterface.appId) && isAgentChatActive(humanInterface.agent);
}

function focusMayConversationTask(appId, taskId, ref) {
  if (!appId || !taskId) {
    mayFocusedTask = null;
  } else {
    mayFocusedTask = { appId: String(appId), taskId: String(taskId), ...(ref ? { ref: String(ref) } : {}) };
  }
  renderMayConversationFocusBar();
  const input = document.getElementById('chat-input');
  if (input && isMayConversation()) input.focus();
}

function discussTaskWithMay(appId, taskId, ref) {
  focusMayConversationTask(appId, taskId, ref);
  if (humanInterface.agent) {
    currentAgentSubTab = 'chat';
    routeTo('/agents/' + encodeURIComponent(humanInterface.agent));
  }
}

function openConversationTask(appId, taskId) {
  if (!appId || !taskId) return;
  const query = new URLSearchParams({ appId: String(appId), task: String(taskId) });
  routeTo(`/projects/${encodeURIComponent(String(appId) + '.app')}/tasks?${query.toString()}`);
}

function renderMayConversationFocusBar() {
  const bar = document.getElementById('conversation-focus-bar');
  const input = document.getElementById('chat-input');
  if (!bar) return;
  const active = isMayConversation() && Boolean(mayFocusedTask);
  bar.hidden = !active;
  bar.style.display = active ? 'flex' : 'none';
  if (!active) {
    bar.replaceChildren();
    if (input && isMayConversation()) input.placeholder = 'Talk with May…';
    return;
  }
  const label = `${mayFocusedTask.appId}/${mayFocusedTask.ref || mayFocusedTask.taskId}`;
  bar.innerHTML =
    `<span data-focused-task="${attrEsc(mayFocusedTask.appId + ':' + mayFocusedTask.taskId)}" style="display:inline-flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--accent);border-radius:999px;padding:2px 8px;color:var(--accent)">` +
    `<span>Focused Task: <b>${esc(label)}</b></span>` +
    `<button type="button" onclick="focusMayConversationTask(null)" title="Clear focused Task" style="background:none;border:none;color:var(--accent);cursor:pointer;padding:0 2px">×</button>` +
    `</span>`;
  if (input && isMayConversation()) {
    input.placeholder = `Talk with May about ${label}…`;
  }
}

function renderMayConversationContextBar(conversation) {
  const bar = document.getElementById('conversation-context-bar');
  if (!bar) return;
  if (!isMayConversation()) {
    bar.hidden = true;
    bar.style.display = 'none';
    bar.replaceChildren();
    return;
  }
  const openRequests = (Array.isArray(conversation.requests) ? conversation.requests : []).filter(
    (req) => req && req.status === 'open',
  );
  if (!openRequests.length) {
    bar.hidden = true;
    bar.style.display = 'none';
    bar.replaceChildren();
    return;
  }
  bar.hidden = false;
  bar.style.display = 'flex';
  let html = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
  html += `<span style="color:var(--fg2)">Open asks (${openRequests.length}):</span>`;
  for (const req of openRequests.slice(0, 6)) {
    const taskChips = (Array.isArray(req.taskRefs) ? req.taskRefs : [])
      .slice(0, 3)
      .map(
        (ref) =>
          `<button type="button" class="ask-btn" style="padding:1px 6px;font-size:11px" onclick="openConversationTask(${jsStringAttr(ref.appId)}, ${jsStringAttr(ref.taskId)})" title="Open Task ${attrEsc(ref.appId + '/' + ref.taskId)}">${esc(ref.appId)} · ${esc(ref.ref || ref.taskId)}</button>`,
      )
      .join(' ');
    html += `<span data-request-id="${attrEsc(req.id)}" style="display:inline-flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px 8px">` +
      `<span style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${attrEsc(req.scope || '')}">${esc(req.scope || req.id)}</span>` +
      `${taskChips}</span>`;
  }
  html += '</div>';
  bar.innerHTML = html;
}

function updateConversationStop() {
  const button = document.getElementById('chat-stop');
  if (!button) return;
  const active = isMayConversation();
  document.querySelector('#chat-agent-banner .banner-session').hidden = active;
  button.hidden = !active;
  button.disabled = !active || !mayActiveTurn || mayStopPending;
  const contextBar = document.getElementById('conversation-context-bar');
  if (contextBar && !active) {
    contextBar.hidden = true;
    contextBar.style.display = 'none';
  }
  renderMayConversationFocusBar();
}

function refreshMayConversation() {
  if (!isMayConversation()) return Promise.resolve();
  if (mayConversationRead) {
    mayConversationDirty = true;
    return mayConversationRead;
  }
  mayConversationRead = (async () => {
    do {
      mayConversationDirty = false;
      try {
        const params = new URLSearchParams({
          appId: humanInterface.appId,
          conversationId: humanInterface.conversationId,
        });
        const response = await fetch('/api/conversation?' + params.toString(), { signal: AbortSignal.timeout(5000) });
        const conversation = await response.json();
        if (!response.ok) throw new Error(conversation.error || 'Conversation unavailable');
        if (!isMayConversation()) return;
        mayActiveTurn = conversation.activeTurn || null;
        renderMayConversationContextBar(conversation);
        renderMayConversationFocusBar();
        const messages = document.getElementById('chat-messages');
        const fragment = document.createDocumentFragment();
        for (const message of conversation.messages || []) {
          const el = document.createElement('div');
          el.className = message.author.kind === 'human' ? 'msg user' : 'msg assistant';
          el.dataset.messageId = message.id;
          const body = document.createElement('div');
          body.className = 'message-text';
          // Conversation text is untrusted; plain text is sufficient here.
          body.textContent = message.text;
          el.appendChild(body);

          const rawTaskRefs = [
            ...(Array.isArray(message.metadata?.taskRefs) ? message.metadata.taskRefs : []),
            ...(message.metadata?.followTask ? [message.metadata.followTask] : []),
          ];
          const seenTasks = new Set();
          const taskRefs = rawTaskRefs.filter((ref) => {
            if (!ref || !ref.appId || !ref.taskId) return false;
            const key = `${ref.appId}\0${ref.taskId}`;
            if (seenTasks.has(key)) return false;
            seenTasks.add(key);
            return true;
          });
          if (taskRefs.length) {
            const meta = document.createElement('div');
            meta.className = 'msg-meta';
            meta.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;font-size:11px;align-items:center';
            for (const ref of taskRefs) {
              const openBtn = document.createElement('button');
              openBtn.type = 'button';
              openBtn.className = 'ask-btn';
              openBtn.dataset.taskRef = `${ref.appId}:${ref.taskId}`;
              openBtn.style.cssText = 'padding:1px 6px;font-size:11px';
              openBtn.textContent = `Task ${ref.appId} · ${ref.ref || ref.taskId}`;
              openBtn.title = `Open ${ref.appId}/${ref.taskId}`;
              openBtn.onclick = () => openConversationTask(ref.appId, ref.taskId);
              meta.appendChild(openBtn);

              const focusBtn = document.createElement('button');
              focusBtn.type = 'button';
              focusBtn.className = 'ask-btn';
              focusBtn.dataset.focusTask = `${ref.appId}:${ref.taskId}`;
              focusBtn.style.cssText = 'padding:1px 6px;font-size:11px';
              focusBtn.textContent = 'Focus';
              focusBtn.title = `Focus next message on ${ref.appId}/${ref.taskId}`;
              focusBtn.onclick = () => focusMayConversationTask(ref.appId, ref.taskId, ref.ref);
              meta.appendChild(focusBtn);
            }
            el.appendChild(meta);
          }
          fragment.appendChild(el);
        }
        messages.replaceChildren(fragment);
        chatScrollToBottom(messages);
        document.getElementById('chat-status').textContent = mayActiveTurn ? 'Working — Stop returns control to you' : 'Ready';
      } catch (error) {
        if (isMayConversation()) {
          // Retain the last exact target: HTTP Stop is independent of these
          // reads/notifications, and the Host rejects a stale turn revision.
          document.getElementById('chat-status').textContent = error.message;
        }
      }
      updateConversationStop();
    } while (mayConversationDirty && isMayConversation());
  })().finally(() => { mayConversationRead = null; });
  return mayConversationRead;
}

async function publishChatEvent(event) {
  const response = await fetch('/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
    signal: AbortSignal.timeout(10000),
  });
  const receipt = await response.json();
  if (!response.ok || receipt.delivery !== 'accepted') {
    throw new Error(receipt.error || 'The Host has not confirmed acceptance');
  }
  return receipt;
}

async function stopMayConversation() {
  const turn = mayActiveTurn;
  if (!isMayConversation() || !turn || mayStopPending) return;
  mayStopPending = true;
  updateConversationStop();
  try {
    await publishChatEvent({
      type: 'conversation.turn.stop.requested', target: { appId: humanInterface.appId },
      data: { conversationId: humanInterface.conversationId, turnId: turn.id, expectedRevision: turn.revision },
      idempotencyKey: `web-stop:${turn.id}:${turn.revision}`,
    });
    toast('Stop request accepted. Background Tasks continue.');
  } catch (error) {
    toast('Stop was not confirmed: ' + error.message);
  } finally {
    mayStopPending = false;
    await refreshMayConversation();
    updateConversationStop();
  }
}

async function sendMayConversation() {
  const input = document.getElementById('chat-input');
  const text = input.value;
  if (!text.trim() || maySendPending) return;
  maySendPending = true;
  const focusKey = mayFocusedTask ? `${mayFocusedTask.appId}:${mayFocusedTask.taskId}` : '';
  const signature = `${text}\0${focusKey}`;
  // An unknown HTTP outcome may already be durable. Retrying the unchanged
  // draft + focus keeps its identity instead of admitting the same ask twice.
  if (mayUnconfirmedInput?.signature !== signature) {
    mayUnconfirmedInput = { signature, id: `web-ui:${crypto.randomUUID()}` };
  }
  const { id } = mayUnconfirmedInput;
  const context = {
    ...(mayFocusedTask ? { focusedTask: { appId: mayFocusedTask.appId, taskId: mayFocusedTask.taskId } } : {}),
  };
  try {
    await publishChatEvent({
      type: 'conversation.message.created', target: { appId: humanInterface.appId },
      data: {
        conversationId: humanInterface.conversationId,
        author: { kind: 'human', id },
        text: text.trim(),
        ...(Object.keys(context).length ? { context } : {}),
        metadata: { channel: 'web-ui' },
      },
      idempotencyKey: id,
    });
    mayUnconfirmedInput = null;
    if (input.value === text) input.value = '';
    await refreshMayConversation();
  } catch (error) {
    toast('Message was not confirmed: ' + error.message);
  } finally {
    maySendPending = false;
  }
}

document.getElementById('chat-stop').addEventListener('click', stopMayConversation);
