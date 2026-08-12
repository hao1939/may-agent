// Herdr owns the entire browser window so its panes, menus, and keyboard model
// are not constrained by May's navigation chrome or an iframe boundary.

function terminalEndpoint() {
  const url = new URL(window.location.href);
  const requestedPort = url.searchParams.get('terminalPort');
  const portNumber = requestedPort && /^\d{1,5}$/.test(requestedPort) ? Number(requestedPort) : 7681;
  url.port = String(portNumber > 0 && portNumber <= 65535 ? portNumber : 7681);
  url.pathname = '/terminal/';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function initTerminalPage() {
  window.location.assign(terminalEndpoint());
}
