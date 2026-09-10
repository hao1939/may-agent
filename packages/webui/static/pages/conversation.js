// May's shared Conversation uses the same reads/events as Console and Telegram.
// Session inspection and direct agent chat keep their existing separate views.
let mayActiveTurn = null;
let mayConversationRead = null;
let mayConversationDirty = false;
let mayStopPending = false;
let maySendPending = false;
let mayUnconfirmedInput = null;

function isMayConversation() {
  return currentAgentChat === 'may' && !isSessionPageMode();
}

function updateConversationStop() {
  const button = document.getElementById('chat-stop');
  if (!button) return;
  document.getElementById('md-toggle').hidden = isMayConversation();
  document.querySelector('#chat-agent-banner .banner-session').hidden = isMayConversation();
  button.hidden = !isMayConversation();
  button.disabled = !isMayConversation() || !mayActiveTurn || mayStopPending;
}

function subscribeMayConversation() {
  if (ws?.readyState === WebSocket.OPEN && isMayConversation()) {
    ws.send(JSON.stringify({ type: 'subscribe', sessions: [], conversations: ['may:primary'] }));
  }
  updateConversationStop();
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
        const response = await fetch('/api/conversation?appId=may&conversationId=may%3Aprimary', { signal: AbortSignal.timeout(5000) });
        const conversation = await response.json();
        if (!response.ok) throw new Error(conversation.error || 'Conversation unavailable');
        if (!isMayConversation()) return;
        mayActiveTurn = conversation.activeTurn || null;
        const messages = document.getElementById('chat-messages');
        const fragment = document.createDocumentFragment();
        for (const message of conversation.messages || []) {
          const el = document.createElement('div');
          el.className = message.author.kind === 'human' ? 'msg user' : 'msg assistant';
          el.dataset.messageId = message.id;
          // Conversation text is untrusted; plain text is sufficient here.
          el.textContent = message.text;
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

async function publishMayConversationEvent(event) {
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
    await publishMayConversationEvent({
      type: 'conversation.turn.stop.requested', target: { appId: 'may' },
      data: { conversationId: 'may:primary', turnId: turn.id, expectedRevision: turn.revision },
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
  if (mayUnconfirmedInput?.text !== text) mayUnconfirmedInput = { text, id: `web-ui:${crypto.randomUUID()}` };
  const { id } = mayUnconfirmedInput;
  try {
    await publishMayConversationEvent({
      type: 'conversation.message.created', target: { appId: 'may' },
      data: { conversationId: 'may:primary', author: { kind: 'human', id }, text: text.trim(), metadata: { channel: 'web-ui' } },
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
