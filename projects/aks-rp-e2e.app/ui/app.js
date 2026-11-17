// A read-only view of the four linked Tasks. The Host owns state and progress.
const refreshButton = document.getElementById("refresh");
const refreshStatus = document.getElementById("refresh-status");
const text = (value) => (typeof value === "string" ? value : "");
const date = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleString()
    : "unknown";
const relative = (value) => {
  if (date(value) === "unknown") return "time unknown";
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
};
const cards = [...document.querySelectorAll("a[data-task-id]")].map((link) => {
  const identity = new URL(link.href).searchParams;
  const panel = document.createElement("div");
  panel.className = "task-state";
  panel.innerHTML = `<span class="badge">Checking status…</span>
    <p class="latest"></p><details hidden><summary></summary><div class="wait-body"></div></details>
    <div class="activity"></div><div class="checked"></div>`;
  link.before(panel);
  return {
    panel,
    query: new URLSearchParams({
      appId: identity.get("appId"),
      taskId: link.dataset.taskId,
    }),
  };
});

function render(card, task) {
  const { panel } = card;
  const badge = panel.querySelector(".badge");
  // Unknown future statuses remain readable; these labels are presentation only.
  const labels = {
    running: "Busy · running",
    waiting: "Waiting",
    idle: "Idle",
    pending: "Pending",
    attention: "Needs attention",
  };
  badge.textContent = Object.hasOwn(labels, task.status)
    ? labels[task.status]
    : task.status;
  badge.dataset.status = task.status;
  const progress = text(task.progress?.message) || text(task.progress?.stage);
  panel.querySelector(".latest").textContent =
    progress ||
    text(task.summary) ||
    text(task.statusDetail) ||
    "No report available.";
  const timestamp = progress ? task.progress.updatedAt : task.updatedAt;
  const activity = panel.querySelector(".activity");
  activity.textContent = `${progress ? "Progress reported" : "Task updated"} ${relative(timestamp)}`;
  activity.title = date(timestamp);
  panel.querySelector(".checked").textContent =
    `Checked ${new Date().toLocaleTimeString()}`;

  const request = text(task.humanAction?.requestedAction);
  const waits = Array.isArray(task.waitingOn) ? task.waitingOn : [];
  const details = panel.querySelector("details");
  const body = panel.querySelector(".wait-body");
  details.hidden = !request && !waits.length;
  panel.querySelector("summary").textContent = request
    ? "Needs input — show request"
    : `Waiting on ${waits.length} prerequisite${waits.length === 1 ? "" : "s"}`;
  body.textContent = request;
  if (!request && waits.length) {
    const list = document.createElement("ul");
    for (const wait of waits) {
      const item = document.createElement("li");
      item.textContent = [
        text(wait.type) || text(wait.kind),
        text(wait.subject),
      ]
        .filter(Boolean)
        .join(": ");
      list.append(item);
    }
    body.append(list);
  }
}

async function readCard(card) {
  try {
    const response = await fetch(`/api/task?${card.query}`, {
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Task read failed");
    const task = await response.json();
    if (
      !task ||
      task.appId !== card.query.get("appId") ||
      task.taskId !== card.query.get("taskId") ||
      !text(task.status).trim()
    )
      throw new Error("Unexpected Task response");
    render(card, task);
    return true;
  } catch {
    const { panel } = card;
    const badge = panel.querySelector(".badge");
    badge.textContent = "Status unavailable";
    delete badge.dataset.status;
    panel.querySelector(".latest").textContent =
      "Could not read current status. Refresh or open the task to try again.";
    panel.querySelector(".activity").textContent = "";
    panel.querySelector("details").hidden = true;
    panel.querySelector(".checked").textContent =
      `Check failed ${new Date().toLocaleTimeString()}`;
    return false;
  }
}

let refreshing = false;
async function refresh() {
  if (refreshing || document.hidden) return;
  refreshing = true;
  refreshButton.disabled = true;
  refreshStatus.textContent = "Checking task status…";
  try {
    const results = await Promise.all(cards.map(readCard));
    const failed = results.filter((ok) => !ok).length;
    refreshStatus.textContent = `${failed ? `${failed} task status${failed === 1 ? "" : "es"} unavailable.` : "All four statuses checked."} Auto-refreshes every 20 seconds while visible.`;
  } finally {
    refreshing = false;
    refreshButton.disabled = false;
  }
}
refreshButton.addEventListener("click", refresh);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
window.addEventListener("pageshow", refresh);
setInterval(refresh, 20_000);
refresh();
