// May's shared Conversation uses the same reads/events as Console and Telegram.
// Sessions are read-only execution diagnostics.
let mayActiveTurn = null;
let mayConversationRead = null;
let mayConversationDirty = false;
let mayStopPending = false;
let maySendPending = false;
let mayUnconfirmedInput = null;
let mayConversationContext = null;
let mayRequestPage = 0;
const MAY_REQUEST_PAGE_SIZE = 6;
const MAY_TASK_REF_PAGE_SIZE = 3;
const mayTaskRefPages = new Map();

function isMayConversation() {
  return Boolean(humanInterface.appId) && isAgentChatActive(humanInterface.agent);
}

function openConversationTask(appId, taskId) {
  if (!appId || !taskId) return;
  const query = new URLSearchParams({ appId: String(appId), task: String(taskId) });
  routeTo(`/projects/${encodeURIComponent(String(appId) + '.app')}/tasks?${query.toString()}`);
}

function changeMayRequestPage(delta) {
  mayRequestPage += delta;
  renderMayConversationContextBar(mayConversationContext);
}

function changeMayTaskRefPage(requestId, delta) {
  mayTaskRefPages.set(requestId, Math.max(0, (mayTaskRefPages.get(requestId) || 0) + delta));
  renderMayConversationContextBar(mayConversationContext);
}

function renderMayConversationContextBar(conversation) {
  const bar = document.getElementById('conversation-context-bar');
  if (!bar) return;
  mayConversationContext = conversation;
  if (!isMayConversation()) {
    bar.hidden = true;
    bar.style.display = 'none';
    bar.replaceChildren();
    return;
  }
  const openRequests = (Array.isArray(conversation?.requests) ? conversation.requests : []).filter(
    (req) => req && req.status === 'open',
  );
  if (!openRequests.length) {
    mayRequestPage = 0;
    mayTaskRefPages.clear();
    bar.hidden = true;
    bar.style.display = 'none';
    bar.replaceChildren();
    return;
  }
  const requestPageCount = Math.ceil(openRequests.length / MAY_REQUEST_PAGE_SIZE);
  mayRequestPage = Math.min(Math.max(0, mayRequestPage), requestPageCount - 1);
  const requestStart = mayRequestPage * MAY_REQUEST_PAGE_SIZE;
  const visibleRequests = openRequests.slice(requestStart, requestStart + MAY_REQUEST_PAGE_SIZE);
  bar.hidden = false;
  bar.style.display = 'flex';
  let html = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
  html += `<span style="color:var(--fg2)">Open asks (${openRequests.length}), showing ${requestStart + 1}-${requestStart + visibleRequests.length}:</span>`;
  for (const req of visibleRequests) {
    const taskRefs = (Array.isArray(req.taskRefs) ? req.taskRefs : []).filter((ref) => ref?.appId && ref?.taskId);
    const taskPageCount = Math.max(1, Math.ceil(taskRefs.length / MAY_TASK_REF_PAGE_SIZE));
    const taskPage = Math.min(mayTaskRefPages.get(req.id) || 0, taskPageCount - 1);
    mayTaskRefPages.set(req.id, taskPage);
    const taskStart = taskPage * MAY_TASK_REF_PAGE_SIZE;
    const taskChips = taskRefs
      .slice(taskStart, taskStart + MAY_TASK_REF_PAGE_SIZE)
      .map(
        (ref) =>
          `<button type="button" class="ask-btn" style="padding:1px 6px;font-size:11px" onclick="openConversationTask(${jsStringAttr(ref.appId)}, ${jsStringAttr(ref.taskId)})" title="Open Task ${attrEsc(ref.appId + '/' + ref.taskId)}">${esc(ref.appId)} · ${esc(ref.ref || ref.taskId)}</button>`,
      )
      .join(' ');
    const taskPager = taskRefs.length > MAY_TASK_REF_PAGE_SIZE
      ? `<span data-task-ref-page="${taskPage + 1}/${taskPageCount}" style="display:inline-flex;gap:3px;align-items:center"><button type="button" class="ask-btn" onclick="changeMayTaskRefPage(${jsStringAttr(req.id)}, -1)" ${taskPage === 0 ? 'disabled' : ''} title="Previous Task references">‹</button><span>${taskStart + 1}-${Math.min(taskStart + MAY_TASK_REF_PAGE_SIZE, taskRefs.length)} of ${taskRefs.length} Tasks</span><button type="button" class="ask-btn" onclick="changeMayTaskRefPage(${jsStringAttr(req.id)}, 1)" ${taskPage + 1 >= taskPageCount ? 'disabled' : ''} title="Next Task references">›</button></span>`
      : '';
    html += `<span data-request-id="${attrEsc(req.id)}" style="display:inline-flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px 8px">` +
      `<span style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${attrEsc(req.scope || '')}">${esc(req.scope || req.id)}</span>` +
      `${taskChips}${taskPager}</span>`;
  }
  if (requestPageCount > 1) {
    html += `<span data-request-page="${mayRequestPage + 1}/${requestPageCount}" style="display:inline-flex;gap:4px;align-items:center"><button type="button" class="ask-btn" onclick="changeMayRequestPage(-1)" ${mayRequestPage === 0 ? 'disabled' : ''}>Previous asks</button><button type="button" class="ask-btn" onclick="changeMayRequestPage(1)" ${mayRequestPage + 1 >= requestPageCount ? 'disabled' : ''}>Next asks</button></span>`;
  }
  html += '</div>';
  bar.innerHTML = html;
}

function updateConversationStop() {
  const button = document.getElementById('chat-stop');
  if (!button) return;
  const active = isMayConversation();
  button.hidden = !active;
  button.disabled = !active || !mayActiveTurn || mayStopPending;
  const contextBar = document.getElementById('conversation-context-bar');
  if (contextBar && !active) {
    contextBar.hidden = true;
    contextBar.style.display = 'none';
  }
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
  if (!response.ok || receipt.delivery !== 'accepted' || !Number.isSafeInteger(receipt.eventId) || receipt.eventId <= 0) {
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
  // An unknown HTTP outcome may already be durable. Retrying the unchanged
  // draft keeps its identity instead of admitting the same ask twice.
  if (mayUnconfirmedInput?.text !== text) {
    mayUnconfirmedInput = { text, id: `web-ui:${crypto.randomUUID()}` };
  }
  const { id } = mayUnconfirmedInput;
  try {
    await publishChatEvent({
      type: 'conversation.message.created', target: { appId: humanInterface.appId },
      data: {
        conversationId: humanInterface.conversationId,
        author: { kind: 'human', id },
        text: text.trim(),
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

// A bounded view of the existing canonical human-action read, not another inbox.
let mayHumanActionsRead = null;
async function loadMayHumanActions(cursor = '') {
  const host = document.getElementById('human-action-list');
  if (!host || !isMayConversation()) return;
  const read = {};
  const route = currentRouteParams;
  mayHumanActionsRead = read;
  host.textContent = 'Reading human actions…';
  const current = () => mayHumanActionsRead === read && isMayConversation() && currentRouteParams === route;
  try {
    const query = new URLSearchParams({ allApps: 'true', humanActionOnly: 'true', limit: '20' });
    if (cursor) query.set('cursor', cursor);
    const res = await fetch('/api/tasks?' + query);
    const page = await res.json();
    if (!current()) return;
    if (!res.ok || !Array.isArray(page.items)) throw new Error(page.error || 'Human-action read unavailable');
    host.replaceChildren();
    const count = document.createElement('p');
    count.textContent = `${page.items.length} shown${Number.isSafeInteger(page.total) ? ` of ${page.total}` : ' (bounded page; total unknown)'}. Only unresolved human-owned Conditions; disabled Apps retain obligations.`;
    host.append(count);
    for (const task of page.items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${task.appId} · ${task.ref}: ${task.humanAction?.requestedAction || task.outcome}`;
      button.onclick = () => openConversationTask(task.appId, task.taskId);
      host.append(button);
    }
    if (page.nextCursor) {
      const more = document.createElement('button');
      more.type = 'button'; more.textContent = 'Next human actions';
      more.onclick = () => loadMayHumanActions(page.nextCursor);
      host.append(more);
    }
    const refresh = document.createElement('button');
    refresh.type = 'button'; refresh.textContent = 'Refresh human actions';
    refresh.onclick = () => loadMayHumanActions(); host.append(refresh);
  } catch (error) {
    if (current()) host.textContent = `Human actions unavailable: ${error.message}`;
  }
}
